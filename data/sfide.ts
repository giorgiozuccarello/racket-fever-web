// ============================================================
// SFIDE SOCIALI — lancio, proposta orari automatica, accettazione
// con prenotazione automatica, dichiarazione risultato, riordino
// della Classifica Sociale.
//
// Una Sfida è un documento a sé (collezione "sfide"), collegato via
// ID alle tre mezz'ore prenotate una volta accettata. Non è un
// "sotto-tipo" di prenotazione: la prenotazione vera e propria nasce
// solo DOPO l'accettazione, riusando la stessa logica già in uso per
// "prenota con compagno" (costo diviso a metà).
// ============================================================

import {
  collection, doc, addDoc, updateDoc, deleteDoc, runTransaction, onSnapshot, query, where, serverTimestamp,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Campo, Blocco, ORARI, orarioFineSlot } from './circoli';
import { PrenotazioneAdmin, prenotaConCompagno } from './prenotazioniRepo';
import { calcolaPrezzo } from './prezzi';
import { SocioCircolo } from './users';
import { formatISO } from './settimana';
import { creaNotifica } from './notifiche';

const GIORNI_IT_BREVE = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'];
const MESI_IT = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];
function dataLabel(d: Date): string {
  return `${GIORNI_IT_BREVE[d.getDay()]} ${d.getDate()} ${MESI_IT[d.getMonth()]}`;
}

// Le notifiche delle Sfide non devono mai "sparire nel nulla" se il
// primo tentativo fallisce (rete instabile, momento di contesa su
// Firestore, ecc.): qui si riprova fino a 3 volte con una breve
// pausa, prima di arrendersi davvero. Non è un sistema di coda vero
// e proprio (serve un server per quello), ma è molto più robusto di
// un semplice tentativo unico.
export async function notificaSfidaConRitentativi(uid: string, testo: string): Promise<void> {
  const TENTATIVI = 3;
  const ATTESA_MS = 900;
  let ultimoErrore: any;
  for (let i = 0; i < TENTATIVI; i++) {
    try {
      await creaNotifica(uid, testo);
      return;
    } catch (e) {
      ultimoErrore = e;
      if (i < TENTATIVI - 1) await new Promise((r) => setTimeout(r, ATTESA_MS));
    }
  }
  console.warn(`Notifica sfida non recapitata dopo ${TENTATIVI} tentativi:`, ultimoErrore);
}

// ATTENZIONE TEST: nella release definitiva questo va rimesso a 7 giorni
// (7 * 24 * 60 * 60 * 1000). Per ora è a 5 minuti solo per poter
// testare velocemente lo scadere del countdown.
export const DURATA_ACCETTAZIONE_MS = 5 * 60 * 1000;

export interface ProposteOrario {
  data: string;       // 'YYYY-MM-DD'
  dataLabel: string;
  campoId: string;
  campoNome: string;
  orari: string[];     // 3 mezz'ore consecutive, es. ['14:30','15:00','15:30']
  prezzi: number[];    // prezzo di ciascuna mezz'ora, stesso ordine di "orari"
}

export type StatoSfida = 'lanciata' | 'accettata' | 'conclusa' | 'rinviata' | 'annullata';

export interface Sfida {
  id: string;
  circoloId: string;
  sfidanteId: string;
  sfidanteNome: string;
  sfidanteCognome: string;
  sfidatoId: string;
  sfidatoNome: string;
  sfidatoCognome: string;
  posizioneSfidante: number; // fotografia al momento del lancio, solo informativa
  posizioneSfidato: number;
  stato: StatoSfida;
  proposte: ProposteOrario[];
  slotSceltoIndex?: number | null;
  prenotazioneIds?: string[] | null;
  risultatoSfidante?: { esito: 'vinta' | 'persa'; punteggio: string } | null;
  risultatoSfidato?: { esito: 'vinta' | 'persa'; punteggio: string } | null;
  vincitoreId?: string | null;
  scadenzaAccettazione?: number | null; // timestamp millis: entro quando lo sfidato deve accettare
  creataIl?: any;
}

// ---------------- Lettura ----------------

export function ascoltaSfideCircolo(circoloId: string, callback: (sfide: Sfida[]) => void) {
  const q = query(collection(db, 'sfide'), where('circoloId', '==', circoloId));
  return onSnapshot(
    q,
    (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as Sfida[]),
    (errore) => console.warn('Ascolto sfide interrotto:', errore?.message ?? errore)
  );
}

// ---------------- Idoneità a lanciare/ricevere una sfida ----------------

// Sfide "aperte" in cui il socio è coinvolto (lanciata o accettata:
// entrambe contano ai fini del limite "massimo 2 sfide, mai come
// sfidante e sfidato insieme sulla stessa").
function sfideAperteDi(uid: string, sfide: Sfida[]) {
  return sfide.filter(
    (s) => (s.stato === 'lanciata' || s.stato === 'accettata') && (s.sfidanteId === uid || s.sfidatoId === uid)
  );
}

export function eImpegnatoComeSfidante(uid: string, sfide: Sfida[]): boolean {
  return sfide.some((s) => (s.stato === 'lanciata' || s.stato === 'accettata') && s.sfidanteId === uid);
}

export function eImpegnatoComeSfidato(uid: string, sfide: Sfida[]): boolean {
  return sfide.some((s) => (s.stato === 'lanciata' || s.stato === 'accettata') && s.sfidatoId === uid);
}

export function socioPienoDiSfide(uid: string, sfide: Sfida[]): boolean {
  return sfideAperteDi(uid, sfide).length >= 2;
}

// Le stesse due persone non possono rilanciarsi la stessa sfida se
// non sono passate almeno 2 settimane dall'ultima (regolamento).
export function sfidaTroppoRecente(uid1: string, uid2: string, sfide: Sfida[]): boolean {
  const DUE_SETTIMANE_MS = 14 * 24 * 60 * 60 * 1000;
  const adesso = Date.now();
  return sfide.some((s) => {
    if (s.stato === 'annullata') return false; // annullata dall'Admin: non è stata davvero giocata, non conta
    const stessaCoppia = (s.sfidanteId === uid1 && s.sfidatoId === uid2) || (s.sfidanteId === uid2 && s.sfidatoId === uid1);
    if (!stessaCoppia) return false;
    const quando = s.creataIl?.seconds ? s.creataIl.seconds * 1000 : 0;
    return adesso - quando < DUE_SETTIMANE_MS;
  });
}

export function socioCongelato(socio: SocioCircolo): boolean {
  if (!socio.sfideCongelateFino) return false;
  return socio.sfideCongelateFino >= formatISO(new Date());
}

// ---------------- Algoritmo: ricerca proposte orario compatibili ----------------

// Costruisce TUTTE le combinazioni valide (giorno + campo + tripletta
// di mezz'ore consecutive libere) dentro una finestra di giorni, filtrate
// sulla fascia giorni/orario preferita dallo sfidato (se non l'ha ancora
// impostata, nessun filtro). Non si ferma al primo risultato per giorno:
// esplora davvero ogni combinazione possibile, altrimenti "Aggiorna"
// non avrebbe nulla di nuovo da proporre.
// Vero se una mezz'ora (data + orario di inizio) è già trascorsa —
// impedisce all'algoritmo di proporre uno slot "oggi ma nel passato".
function slotInizioEPassato(data: string, oraInizio: string): boolean {
  const [h, m] = oraInizio.split(':').map(Number);
  const momento = new Date(`${data}T00:00:00`);
  momento.setHours(h, m, 0, 0);
  return Date.now() >= momento.getTime();
}

function trovaCombinazioniInFinestra(
  campi: Campo[],
  prenotazioni: PrenotazioneAdmin[],
  blocchi: Blocco[],
  preferenzeSfidato: { giorni: number[]; oraInizio: string; oraFine: string } | null | undefined,
  offsetMin: number,
  offsetMax: number
): ProposteOrario[] {
  const risultati: ProposteOrario[] = [];
  const oraInizioFiltro = preferenzeSfidato?.oraInizio ?? '08:00';
  const oraFineFiltro = preferenzeSfidato?.oraFine ?? '23:30';
  const orariCandidati = ORARI.filter((o) => o >= oraInizioFiltro && o < oraFineFiltro);

  for (let offset = offsetMin; offset <= offsetMax; offset++) {
    const d = new Date();
    d.setDate(d.getDate() + offset);
    const giornoSettimana = d.getDay();
    const dataIso = formatISO(d);

    if (preferenzeSfidato && preferenzeSfidato.giorni.length > 0 && !preferenzeSfidato.giorni.includes(giornoSettimana)) {
      continue;
    }

    for (const campo of campi) {
      for (let idx = 0; idx + 2 < orariCandidati.length; idx++) {
        const tripletta = [orariCandidati[idx], orariCandidati[idx + 1], orariCandidati[idx + 2]];
        if (orarioFineSlot(tripletta[0]) !== tripletta[1] || orarioFineSlot(tripletta[1]) !== tripletta[2]) continue;
        if (slotInizioEPassato(dataIso, tripletta[0])) continue;

        const libera = tripletta.every((ora) => {
          const occupato = prenotazioni.some((p) => p.campoId === campo.id && p.data === dataIso && p.orario === ora);
          if (occupato) return false;
          const riservato = blocchi.some((b) => {
            if (b.campoId !== campo.id) return false;
            if (ora < b.orarioInizio || ora >= b.orarioFine) return false;
            return b.tipo === 'data' ? b.data === dataIso : (b.giorniSettimana ?? []).includes(giornoSettimana);
          });
          return !riservato;
        });

        if (libera) {
          const prezzi = tripletta.map((ora) => calcolaPrezzo(campo, d, ora));
          risultati.push({
            data: dataIso, dataLabel: dataLabel(d), campoId: campo.id, campoNome: campo.nome,
            orari: tripletta, prezzi,
          });
        }
      }
    }
  }

  return risultati;
}

export function chiaveProposta(p: ProposteOrario): string {
  return `${p.data}|${p.campoId}|${p.orari[0]}`;
}

// Prima cerca nella settimana corrente (7 giorni, come da regolamento);
// solo se non trova NULLA lì, estende automaticamente alla settimana
// successiva — "finestraEstesa" lo segnala all'interfaccia per
// mostrare l'avviso.
export function trovaCandidatiSfida(
  campi: Campo[],
  prenotazioni: PrenotazioneAdmin[],
  blocchi: Blocco[],
  preferenzeSfidato: { giorni: number[]; oraInizio: string; oraFine: string } | null | undefined
): { candidati: ProposteOrario[]; finestraEstesa: boolean } {
  const primaSettimana = trovaCombinazioniInFinestra(campi, prenotazioni, blocchi, preferenzeSfidato, 0, 6);
  if (primaSettimana.length > 0) return { candidati: primaSettimana, finestraEstesa: false };

  const secondaSettimana = trovaCombinazioniInFinestra(campi, prenotazioni, blocchi, preferenzeSfidato, 7, 13);
  return { candidati: secondaSettimana, finestraEstesa: secondaSettimana.length > 0 };
}

// Sceglie fino a 3 proposte dal pool di candidati, escludendo quelle già
// mostrate in questa sessione ("chiaviEscluse") e privilegiando giorni
// diversi tra loro per dare varietà allo sfidante.
export function sceglieProposte(candidati: ProposteOrario[], chiaviEscluse: string[]): ProposteOrario[] {
  const disponibili = candidati.filter((c) => !chiaviEscluse.includes(chiaveProposta(c)));

  const perGiorno = new Map<string, ProposteOrario[]>();
  disponibili.forEach((c) => {
    if (!perGiorno.has(c.data)) perGiorno.set(c.data, []);
    perGiorno.get(c.data)!.push(c);
  });

  const scelte: ProposteOrario[] = [];
  for (const lista of perGiorno.values()) {
    if (scelte.length >= 3) break;
    scelte.push(lista[0]);
  }
  if (scelte.length < 3) {
    for (const c of disponibili) {
      if (scelte.length >= 3) break;
      if (!scelte.some((s) => chiaveProposta(s) === chiaveProposta(c))) scelte.push(c);
    }
  }
  return scelte;
}

// ---------------- Scrittura: lancio, accettazione, risultato, chiusura ----------------

export async function lanciaSfida(params: {
  circoloId: string;
  sfidanteId: string; sfidanteNome: string; sfidanteCognome: string; posizioneSfidante: number;
  sfidatoId: string; sfidatoNome: string; sfidatoCognome: string; posizioneSfidato: number;
  proposte: ProposteOrario[]; // vuoto = nessuno slot trovato, la sfida nasce già "rinviata"
}): Promise<string> {
  const stato: StatoSfida = params.proposte.length === 0 ? 'rinviata' : 'lanciata';
  const ref = await addDoc(collection(db, 'sfide'), {
    circoloId: params.circoloId,
    sfidanteId: params.sfidanteId, sfidanteNome: params.sfidanteNome, sfidanteCognome: params.sfidanteCognome,
    posizioneSfidante: params.posizioneSfidante,
    sfidatoId: params.sfidatoId, sfidatoNome: params.sfidatoNome, sfidatoCognome: params.sfidatoCognome,
    posizioneSfidato: params.posizioneSfidato,
    stato,
    proposte: params.proposte,
    slotSceltoIndex: null,
    prenotazioneIds: null,
    risultatoSfidante: null,
    risultatoSfidato: null,
    vincitoreId: null,
    scadenzaAccettazione: stato === 'lanciata' ? Date.now() + DURATA_ACCETTAZIONE_MS : null,
    creataIl: serverTimestamp(),
  });
  return ref.id;
}

// Se lo sfidato non ha accettato nessuna proposta entro la scadenza,
// perde per rinuncia: la sfida si chiude con lo sfidante vincitore e
// il normale riordino si applica. Non avendo un sistema di
// automazioni lato server, questo controllo viene fatto dal client
// (chiunque veda la sfida scaduta la chiude, per chiunque la stia
// guardando in quel momento — Admin o uno dei due soci).
export async function risolviSfidaScaduta(
  sfida: Sfida, soci: SocioCircolo[]
): Promise<void> {
  if (sfida.stato !== 'lanciata') return;
  if (!sfida.scadenzaAccettazione || Date.now() < sfida.scadenzaAccettazione) return;
  const applicata = await concludiSfida(sfida.id, sfida.sfidanteId, sfida.sfidatoId, sfida.sfidanteId, soci, 'lanciata');
  if (!applicata) return; // un altro client l'ha già chiusa, o è appena stata accettata: niente doppio avviso
  await notificaSfidaConRitentativi(
    sfida.sfidatoId,
    `Non hai risposto in tempo alla sfida di ${sfida.sfidanteNome} ${sfida.sfidanteCognome}: hai perso la tua posizione in classifica.`
  );
  await notificaSfidaConRitentativi(
    sfida.sfidanteId,
    `${sfida.sfidatoNome} ${sfida.sfidatoCognome} non ha risposto in tempo alla tua sfida: hai vinto a tavolino e preso la sua posizione.`
  );
}

// Lo sfidato accetta una delle 3 proposte. PRIMA di tutto la sfida
// viene segnata "accettata" con una transazione che rilegge lo stato
// fresco (se nel frattempo è appena scaduta, si ferma qui con un
// errore chiaro) — solo DOPO questo blocco immediato iniziano le tre
// prenotazioni vere e proprie. Così il controllo automatico di
// scadenza, che agisce solo su sfide ancora "lanciata", non può più
// intromettersi mentre la prenotazione è a metà.
export async function accettaSfida(
  sfida: Sfida, indiceScelto: number
): Promise<{ sosUsatoSfidante: boolean; sosUsatoSfidato: boolean }> {
  const slot = sfida.proposte[indiceScelto];
  if (!slot) throw new Error('SLOT_NON_VALIDO');
  // Difesa esplicita: una proposta valida ha SEMPRE 3 mezz'ore (e 3
  // prezzi corrispondenti). Se per qualunque motivo non fosse così,
  // meglio fermarsi subito con un errore chiaro che prenotare solo
  // in parte la partita senza che nessuno se ne accorga.
  if (!Array.isArray(slot.orari) || slot.orari.length !== 3 || !Array.isArray(slot.prezzi) || slot.prezzi.length !== 3) {
    throw new Error('PROPOSTA_INCOMPLETA');
  }

  const sfidaRef = doc(db, 'sfide', sfida.id);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(sfidaRef);
    if (!snap.exists()) throw new Error('SFIDA_NON_TROVATA');
    if (snap.data().stato !== 'lanciata') throw new Error('SFIDA_NON_PIU_DISPONIBILE');
    tx.update(sfidaRef, { stato: 'accettata', slotSceltoIndex: indiceScelto });
  });

  // Il Credito S.O.S. copre sempre l'eventuale differenza per entrambi
  // (illimitato, da saldare in segreteria) — la sfida non può più
  // restare bloccata per credito insufficiente. Teniamo comunque la
  // rete di sicurezza sotto: se qualcos'altro va storto (es. uno slot
  // occupato nel frattempo da qualcun altro), la sfida torna "lanciata".
  try {
    const prenotazioneIds: string[] = [];
    let sosUsatoSfidante = false;
    let sosUsatoSfidato = false;
    for (let i = 0; i < slot.orari.length; i++) {
      const risultato = await prenotaConCompagno({
        uid: sfida.sfidanteId,
        compagnoId: sfida.sfidatoId,
        circoloId: sfida.circoloId,
        campoId: slot.campoId,
        campoNome: slot.campoNome,
        data: slot.data,
        dataLabel: slot.dataLabel,
        orario: slot.orari[i],
        prezzo: slot.prezzi[i] ?? 0,
        etichetta: null,
        utenteNome: sfida.sfidanteNome,
        utenteCognome: sfida.sfidanteCognome,
        compagnoNome: sfida.sfidatoNome,
        compagnoCognome: sfida.sfidatoCognome,
        sfidaId: sfida.id,
      });
      prenotazioneIds.push(risultato.id);
      if (risultato.sosUsatoUtente) sosUsatoSfidante = true;
      if (risultato.sosUsatoCompagno) sosUsatoSfidato = true;
    }
    await updateDoc(sfidaRef, { prenotazioneIds });
    return { sosUsatoSfidante, sosUsatoSfidato };
  } catch (erroreBooking) {
    await updateDoc(sfidaRef, { stato: 'lanciata', slotSceltoIndex: null });
    throw erroreBooking;
  }
}

export async function dichiaraRisultato(
  sfidaId: string, chi: 'sfidante' | 'sfidato', esito: 'vinta' | 'persa', punteggio: string
): Promise<void> {
  const campo = chi === 'sfidante' ? 'risultatoSfidante' : 'risultatoSfidato';
  await updateDoc(doc(db, 'sfide', sfidaId), { [campo]: { esito, punteggio: punteggio.trim() } });
}

// Chiusura definitiva: applica il riordino della Classifica Sociale
// usando le posizioni ATTUALI (non quelle fotografate al lancio, che
// potrebbero essere cambiate nel frattempo per via di altre sfide
// concluse prima di questa).
//
// È una TRANSAZIONE apposta: più client diversi (sfidante, sfidato,
// Admin, il controllo automatico di scadenza) possono provare ad
// agire sulla STESSA sfida quasi in contemporanea — la transazione
// rilegge lo stato fresco e si ferma da sola se non corrisponde più
// a "statoAtteso" (es. è appena stata accettata mentre stava per
// scadere, oppure è già stata conclusa da un altro client).
export async function concludiSfida(
  sfidaId: string, sfidanteId: string, sfidatoId: string, vincitoreId: string, soci: SocioCircolo[],
  statoAtteso: StatoSfida
): Promise<boolean> {
  const sfidaRef = doc(db, 'sfide', sfidaId);
  let applicata = false;

  await runTransaction(db, async (tx) => {
    const sfidaSnap = await tx.get(sfidaRef);
    if (!sfidaSnap.exists()) return;
    const statoAttuale = sfidaSnap.data().stato as StatoSfida;
    if (statoAttuale !== statoAtteso) return; // qualcosa è cambiato nel frattempo, non tocchiamo nulla

    const sfidante = soci.find((s) => s.uid === sfidanteId);
    const sfidato = soci.find((s) => s.uid === sfidatoId);

    if (
      sfidante && sfidato &&
      sfidante.posizioneClassificaSociale != null && sfidato.posizioneClassificaSociale != null &&
      vincitoreId === sfidanteId && sfidante.posizioneClassificaSociale > sfidato.posizioneClassificaSociale
    ) {
      const posSfidante = sfidante.posizioneClassificaSociale;
      const posSfidato = sfidato.posizioneClassificaSociale;
      soci.forEach((s) => {
        const pos = s.posizioneClassificaSociale;
        if (pos == null || s.uid === sfidanteId) return;
        if (pos >= posSfidato && pos < posSfidante) {
          tx.update(doc(db, 'utenti', s.uid), { posizioneClassificaSociale: pos + 1 });
        }
      });
      tx.update(doc(db, 'utenti', sfidanteId), { posizioneClassificaSociale: posSfidato });
    }

    tx.update(sfidaRef, { stato: 'conclusa', vincitoreId });
    applicata = true;
  });

  return applicata;
}

// L'Admin annulla una sfida in corso (lanciata o accettata): nessun
// vincitore, nessun riordino della classifica — semplicemente non si
// gioca più. Se erano già state prenotate le tre mezz'ore (sfida
// "accettata"), vengono cancellate per liberare di nuovo lo slot in
// griglia. Entrambi i soci vengono avvisati.
export async function annullaSfida(sfida: Sfida): Promise<void> {
  if (sfida.prenotazioneIds && sfida.prenotazioneIds.length > 0) {
    for (const prenId of sfida.prenotazioneIds) {
      await deleteDoc(doc(db, 'prenotazioni', prenId));
    }
  }
  await updateDoc(doc(db, 'sfide', sfida.id), { stato: 'annullata' });
  await notificaSfidaConRitentativi(
    sfida.sfidanteId,
    `Il circolo ha annullato la sfida con ${sfida.sfidatoNome} ${sfida.sfidatoCognome}. La classifica non cambia.`
  );
  await notificaSfidaConRitentativi(
    sfida.sfidatoId,
    `Il circolo ha annullato la sfida con ${sfida.sfidanteNome} ${sfida.sfidanteCognome}. La classifica non cambia.`
  );
}

// Pulsante di servizio per i test: cancella TUTTE le sfide di un
// circolo (comprese quelle concluse) e le prenotazioni collegate.
// Include apposta anche le concluse: altrimenti la regola "non si
// rilancia la stessa sfida prima di 2 settimane" continuerebbe a
// bloccare i test ripetuti tra la stessa coppia di soci, anche dopo
// il reset — qui l'obiettivo è ripartire puliti, non conservare lo
// storico.
export async function resettaSfideTest(circoloId: string, sfide: Sfida[]): Promise<void> {
  const daCancellare = sfide.filter((sf) => sf.circoloId === circoloId);
  for (const sf of daCancellare) {
    if (sf.prenotazioneIds && sf.prenotazioneIds.length > 0) {
      for (const prenId of sf.prenotazioneIds) {
        await deleteDoc(doc(db, 'prenotazioni', prenId));
      }
    }
    await deleteDoc(doc(db, 'sfide', sf.id));
  }
}
