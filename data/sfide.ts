// ============================================================
// SFIDE SOCIALI — Soluzione Quattro
// ------------------------------------------------------------
// Chat libera tra Sfidante e Sfidato, due timer di reazione
// (Accordo, Prenotazione), proposta formale con blocco reale
// degli slot, prenotazione vera al termine. Sostituisce
// interamente il vecchio motore a proposte automatiche
// (conservato come riferimento in sfide.ts.OLD_SOLUZIONE_UNO).
// ============================================================

import {
  collection, doc, addDoc, updateDoc, deleteDoc, getDoc, getDocs, runTransaction, onSnapshot, query, where, orderBy, serverTimestamp,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Campo, Blocco, Circolo, ORARI, orarioFineSlot } from './circoli';
import { PrenotazioneAdmin, prenotaConCompagno, cancellaConRimborsoDiviso, idSlot, SLOT_OCCUPATO } from './prenotazioniRepo';
import { dividiInParti } from './giocatori';
import { calcolaPrezzo } from './prezzi';
import { SocioCircolo, impostaCongelamentoSfide } from './users';
import { formatISO } from './settimana';
import { creaNotifica } from './notifiche';

// Le notifiche delle Sfide non devono mai "sparire nel nulla" se il
// primo tentativo fallisce (rete instabile, momento di contesa su
// Firestore, ecc.): qui si riprova fino a 3 volte con una breve
// pausa, prima di arrendersi davvero.
// circoloId: da quale circolo parte l'avviso. Senza, la notifica
// resta priva del campo e il "Reset Completo Soci" non la trova.
export async function notificaSfidaConRitentativi(uid: string, testo: string, circoloId?: string): Promise<void> {
  const TENTATIVI = 3;
  const ATTESA_MS = 900;
  let ultimoErrore: any;
  for (let i = 0; i < TENTATIVI; i++) {
    try {
      await creaNotifica(uid, testo, undefined, circoloId);
      return;
    } catch (e) {
      ultimoErrore = e;
      if (i < TENTATIVI - 1) await new Promise((r) => setTimeout(r, ATTESA_MS));
    }
  }
  console.warn(`Notifica sfida non recapitata dopo ${TENTATIVI} tentativi:`, ultimoErrore);
}

// Durata dei due timer di reazione: 24 ore normalmente, 5 minuti se
// il circolo ha attivato la modalità test (bottone dedicato in
// Admin → Sfide in Corso). La durata delle PENALITÀ (congelamento 7
// giorni) resta sempre fissa: è un effetto reale sul gioco, non
// un'attesa arbitraria.
export function durataTimerMs(circolo: { timerSfideVeloce?: boolean } | null | undefined): number {
  return circolo?.timerSfideVeloce ? 5 * 60 * 1000 : 24 * 60 * 60 * 1000;
}

const GIORNI_CONGELAMENTO_PENALITA = 7;

export type FaseSfida = 'accordo' | 'prenotazione' | 'accettata' | 'conclusa' | 'decaduta' | 'annullata';

export interface PropostaFormale {
  campoId: string;
  campoNome: string;
  data: string;       // 'YYYY-MM-DD'
  dataLabel: string;
  orari: string[];     // 3 o 4 mezz'ore consecutive
  prezzi: number[];
}

export interface Sfida {
  id: string;
  circoloId: string;
  sfidanteId: string; sfidanteNome: string; sfidanteCognome: string; posizioneSfidante: number;
  sfidatoId: string; sfidatoNome: string; sfidatoCognome: string; posizioneSfidato: number;

  fase: FaseSfida;

  // Fase "accordo" — timer 1
  accordoScadenza: number;         // timestamp millis
  accordoSfidante: boolean;        // ha cliccato "Accordo Trovato" (toggle)
  accordoSfidato: boolean;

  // Fase "prenotazione" — timer 2, regola "ultima risposta valida"
  prenotazioneScadenza: number | null;
  ultimaAzioneDi: 'sfidante' | 'sfidato' | null;
  proposta: PropostaFormale | null;   // l'ultima proposta formale inviata
  propostaAccettata: boolean;
  prenotazioneIds: string[] | null;   // slot "sospesi" durante l'attesa, poi reali dopo la prenotazione

  // Match fissato — valido sia a fase 'accettata' che per lo storico/Bacheca
  matchCampoNome: string | null;
  matchData: string | null;
  matchDataLabel: string | null;
  matchOrari: string[] | null;
  matchViaRegolaCircolo: boolean; // true se fissato d'ufficio (domenica 18:00) invece che concordato

  // Risultato
  risultatoSfidante: { esito: 'vinta' | 'persa'; punteggio: string } | null;
  risultatoSfidato: { esito: 'vinta' | 'persa'; punteggio: string } | null;
  vincitoreId: string | null;
  nonPresentatoId: string | null; // se la sfida si è chiusa per mancata presentazione, chi è mancato
  risultatoUfficiale?: string | null; // il testo scritto DA ADMIN — è questo, non le dichiarazioni dei giocatori, a comparire in Bacheca
  conclusaIl?: any; // timestamp di quando è stata dichiarata conclusa — serve per lo storico in Bacheca

  creataIl?: any;
}

export type TipoMessaggioSfida = 'testo' | 'sistema' | 'proposta_formale';

export interface MessaggioSfida {
  id: string;
  tipo: TipoMessaggioSfida;
  mittenteId: string; // 'sistema' per i messaggi automatici
  mittenteNome: string;
  testo?: string;
  proposta?: PropostaFormale;
  creatoIl?: any;
}

// ---------------- Lettura ----------------

export function ascoltaSfideCircolo(circoloId: string, callback: (sfide: Sfida[]) => void) {
  const q = query(collection(db, 'sfide'), where('circoloId', '==', circoloId));
  return onSnapshot(
    q,
    (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as Sfida[]),
    (err) => console.warn('Ascolto sfide fallito:', err)
  );
}

export function ascoltaMessaggiSfida(sfidaId: string, callback: (messaggi: MessaggioSfida[]) => void) {
  const q = query(collection(db, 'sfide', sfidaId, 'messaggi'), orderBy('creatoIl', 'asc'));
  return onSnapshot(
    q,
    (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as MessaggioSfida[]),
    (err) => console.warn('Ascolto messaggi sfida fallito:', err)
  );
}

// ---------------- Idoneità a lanciare/ricevere sfide ----------------

export function eImpegnatoComeSfidante(uid: string, sfide: Sfida[]): boolean {
  return sfide.some((s) => s.sfidanteId === uid && (s.fase === 'accordo' || s.fase === 'prenotazione' || s.fase === 'accettata'));
}

export function eImpegnatoComeSfidato(uid: string, sfide: Sfida[]): boolean {
  return sfide.some((s) => s.sfidatoId === uid && (s.fase === 'accordo' || s.fase === 'prenotazione' || s.fase === 'accettata'));
}

export function socioPienoDiSfide(uid: string, sfide: Sfida[]): boolean {
  const attive = sfide.filter((s) =>
    (s.sfidanteId === uid || s.sfidatoId === uid) && (s.fase === 'accordo' || s.fase === 'prenotazione' || s.fase === 'accettata')
  );
  return attive.length >= 2;
}

export function sfidaTroppoRecente(uid1: string, uid2: string, sfide: Sfida[]): boolean {
  const DUE_SETTIMANE_MS = 14 * 24 * 60 * 60 * 1000;
  const adesso = Date.now();
  return sfide.some((s) => {
    if (s.fase === 'annullata') return false; // non giocata davvero, non conta
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

// ---------------- Fase 0 — Lancio ----------------

export async function lanciaSfidaV2(params: {
  circoloId: string;
  sfidanteId: string; sfidanteNome: string; sfidanteCognome: string; posizioneSfidante: number;
  sfidatoId: string; sfidatoNome: string; sfidatoCognome: string; posizioneSfidato: number;
  circolo: Circolo | null;
}): Promise<string> {
  const durata = durataTimerMs(params.circolo);
  const ref = await addDoc(collection(db, 'sfide'), {
    circoloId: params.circoloId,
    sfidanteId: params.sfidanteId, sfidanteNome: params.sfidanteNome, sfidanteCognome: params.sfidanteCognome,
    posizioneSfidante: params.posizioneSfidante,
    sfidatoId: params.sfidatoId, sfidatoNome: params.sfidatoNome, sfidatoCognome: params.sfidatoCognome,
    posizioneSfidato: params.posizioneSfidato,
    fase: 'accordo',
    accordoScadenza: Date.now() + durata,
    accordoSfidante: false,
    accordoSfidato: false,
    prenotazioneScadenza: null,
    ultimaAzioneDi: null,
    proposta: null,
    propostaAccettata: false,
    prenotazioneIds: null,
    matchCampoNome: null, matchData: null, matchDataLabel: null, matchOrari: null,
    matchViaRegolaCircolo: false,
    risultatoSfidante: null, risultatoSfidato: null, vincitoreId: null, nonPresentatoId: null,
    creataIl: serverTimestamp(),
  });
  await notificaSfidaConRitentativi(
    params.sfidatoId,
    `${params.sfidanteNome} ${params.sfidanteCognome} ti ha lanciato una sfida! Apri la chat per organizzarvi — avete 24 ore per dirvi se avete trovato un accordo di massima.`,
    params.circoloId,
  );
  return ref.id;
}

// ---------------- Chat — messaggio di testo libero ----------------

export async function inviaMessaggioTesto(sfida: Sfida, mittenteId: string, mittenteNome: string, testo: string): Promise<void> {
  const pulito = testo.trim();
  if (!pulito) return;
  await addDoc(collection(db, 'sfide', sfida.id, 'messaggi'), {
    tipo: 'testo', mittenteId, mittenteNome, testo: pulito, creatoIl: serverTimestamp(),
  });
  // In fase "prenotazione" ogni messaggio conta come "azione" ai fini
  // della regola "ultima risposta valida": chi scrive per ultimo è
  // considerato in attesa di risposta dall'altro.
  if (sfida.fase === 'prenotazione') {
    const chi = mittenteId === sfida.sfidanteId ? 'sfidante' : 'sfidato';
    await updateDoc(doc(db, 'sfide', sfida.id), { ultimaAzioneDi: chi });
  }
  const destinatarioId = mittenteId === sfida.sfidanteId ? sfida.sfidatoId : sfida.sfidanteId;
  await notificaSfidaConRitentativi(destinatarioId, `${mittenteNome}: ${pulito}`, sfida.circoloId);
}

async function messaggioSistema(sfidaId: string, testo: string): Promise<void> {
  await addDoc(collection(db, 'sfide', sfidaId, 'messaggi'), {
    tipo: 'sistema', mittenteId: 'sistema', mittenteNome: 'Sistema', testo, creatoIl: serverTimestamp(),
  });
}

// ---------------- Penalità condivise ----------------

// Il "vincitore" prende la posizione del "perdente" in classifica —
// stessa identica logica di una vittoria normale (concludiSfida),
// riusata qui per ogni caso di penalità automatica per mancata
// risposta o mancata presentazione.
// Le posizioni in classifica vivono sulla TESSERA (una per circolo),
// non piu' sul profilo utente: un socio puo' essere 3o in un circolo
// e 12o in un altro. Scrivere su /utenti non aggiornava nulla — la
// classifica restava ferma senza segnalare alcun errore.
async function applicaPerditaPosizione(perdenteId: string, vincitoreId: string, soci: SocioCircolo[], circoloId: string): Promise<void> {
  const perdente = soci.find((s) => s.uid === perdenteId);
  const vincitore = soci.find((s) => s.uid === vincitoreId);
  if (!perdente || !vincitore || perdente.posizioneClassificaSociale == null || vincitore.posizioneClassificaSociale == null) return;
  if (vincitore.posizioneClassificaSociale <= perdente.posizioneClassificaSociale) return; // già davanti, nulla da fare

  const posPerdente = perdente.posizioneClassificaSociale;
  const posVincitore = vincitore.posizioneClassificaSociale;
  await runTransaction(db, async (tx) => {
    soci.forEach((s) => {
      const pos = s.posizioneClassificaSociale;
      if (pos == null || s.uid === vincitoreId) return;
      if (pos >= posPerdente && pos < posVincitore) {
        tx.update(doc(db, 'tessere', `${s.uid}_${circoloId}`), { posizioneClassificaSociale: pos + 1 });
      }
    });
    tx.update(doc(db, 'tessere', `${vincitoreId}_${circoloId}`), { posizioneClassificaSociale: posPerdente });
  });
}

async function applicaCongelamento(uid: string): Promise<void> {
  const fino = new Date();
  fino.setDate(fino.getDate() + GIORNI_CONGELAMENTO_PENALITA);
  await impostaCongelamentoSfide(uid, formatISO(fino));
}

// ---------------- Fase "accordo" — i due bottoni ----------------

// Toggle di "Accordo Trovato": un secondo click annulla il primo.
// Se dopo il click ENTRAMBI risultano a "trovato", si passa subito
// alla fase "prenotazione" con un timer fresco, senza aspettare la
// scadenza del timer 1.
export async function cliccaAccordoTrovato(sfida: Sfida, chi: 'sfidante' | 'sfidato', mittenteNome: string, circolo: Circolo | null): Promise<void> {
  const campo = chi === 'sfidante' ? 'accordoSfidante' : 'accordoSfidato';
  const valoreAttuale = chi === 'sfidante' ? sfida.accordoSfidante : sfida.accordoSfidato;
  const nuovoValore = !valoreAttuale;

  await updateDoc(doc(db, 'sfide', sfida.id), { [campo]: nuovoValore });
  await messaggioSistema(
    sfida.id,
    nuovoValore ? `${mittenteNome} ha cliccato "Accordo Trovato".` : `${mittenteNome} ha annullato "Accordo Trovato".`
  );

  const altroValore = chi === 'sfidante' ? sfida.accordoSfidato : sfida.accordoSfidante;
  if (nuovoValore && altroValore) {
    const durata = durataTimerMs(circolo);
    await updateDoc(doc(db, 'sfide', sfida.id), {
      fase: 'prenotazione',
      prenotazioneScadenza: Date.now() + durata,
      ultimaAzioneDi: chi, // l'ultimo dei due a confermare è, per definizione, l'ultima azione
    });
    await messaggioSistema(sfida.id, 'Accordo trovato da entrambi! Ora potete usare "Proponi Orario" per formalizzare, o continuare a scrivervi.');
    await notificaSfidaConRitentativi(sfida.sfidanteId, 'Accordo trovato con lo sfidato: ora potete proporre l\'orario formale.', sfida.circoloId);
    await notificaSfidaConRitentativi(sfida.sfidatoId, 'Accordo trovato con lo sfidante: ora potete proporre l\'orario formale.', sfida.circoloId);
  } else {
    const destinatarioId = chi === 'sfidante' ? sfida.sfidatoId : sfida.sfidanteId;
    await notificaSfidaConRitentativi(destinatarioId, `${mittenteNome} ha cliccato "Accordo Trovato" nella vostra sfida.`, sfida.circoloId);
  }
}

// "Accordo Non Trovato": applica SUBITO la regola del circolo (non è
// toggleabile, a differenza di "Trovato" — una volta chiamata in
// causa la segreteria, l'esito si fissa).
export async function cliccaAccordoNonTrovato(
  sfida: Sfida, chi: 'sfidante' | 'sfidato', mittenteNome: string,
  campi: Campo[], prenotazioni: PrenotazioneAdmin[], blocchi: Blocco[]
): Promise<void> {
  await messaggioSistema(sfida.id, `${mittenteNome} ha cliccato "Accordo Non Trovato": si applica la regola del circolo.`);
  await applicaRegolaCircolo(sfida, campi, prenotazioni, blocchi);
}

// Cerca la prima domenica libera (18:00-19:30, su un campo
// qualunque) e fissa la sfida d'ufficio lì. Se nessun campo è
// libero, la sfida viene annullata senza penalità per nessuno —
// come da regolamento del circolo.
async function applicaRegolaCircolo(
  sfida: Sfida, campi: Campo[], prenotazioni: PrenotazioneAdmin[], blocchi: Blocco[]
): Promise<void> {
  const ORARIO_UFFICIO = ['18:00', '18:30', '19:00'];
  const oggi = new Date();
  let domenica = new Date(oggi);
  const giorniAllaProssimaDomenica = (7 - domenica.getDay()) % 7 || 7;
  domenica.setDate(domenica.getDate() + giorniAllaProssimaDomenica);

  for (let tentativo = 0; tentativo < 2; tentativo++) { // questa domenica, poi la successiva se serve
    const dataIso = formatISO(domenica);
    const giornoSettimana = domenica.getDay();
    for (const campo of campi) {
      const libero = ORARIO_UFFICIO.every((ora) => {
        const occupato = prenotazioni.some((p) => p.campoId === campo.id && p.data === dataIso && p.orario === ora);
        if (occupato) return false;
        const riservato = blocchi.some((b) => {
          if (b.campoId !== campo.id) return false;
          if (ora < b.orarioInizio || ora >= b.orarioFine) return false;
          return b.tipo === 'data' ? b.data === dataIso : (b.giorniSettimana ?? []).includes(giornoSettimana);
        });
        return !riservato;
      });
      if (libero) {
        try {
          await fissaMatch(sfida, campo, dataIso, ORARIO_UFFICIO, true);
          return;
        } catch (e: any) {
          // ⚠️ "Libero" e' quello che dice la fotografia locale: fra il
          // controllo e la scrittura qualcuno puo' aver preso l'orario.
          // Non e' un motivo per arrendersi — il campo dopo, o la
          // domenica dopo, possono essere ancora liberi. Su ogni altro
          // errore (credito, rete) ci si ferma davvero.
          if (e?.message !== SLOT_OCCUPATO) throw e;
          console.warn('Regola del circolo: campo occupato all\'ultimo, si prova il successivo', campo.id);
        }
      }
    }
    domenica = new Date(domenica);
    domenica.setDate(domenica.getDate() + 7);
  }

  // Nessun campo libero in nessuna delle due domeniche: annullata, senza penalità.
  await updateDoc(doc(db, 'sfide', sfida.id), { fase: 'annullata' });
  await messaggioSistema(sfida.id, 'Nessun campo libero la domenica: la sfida è annullata, senza penalità per nessuno.');
  await notificaSfidaConRitentativi(sfida.sfidanteId, 'Sfida Annullata: nessun campo libero la domenica per la regola del circolo.', sfida.circoloId);
  await notificaSfidaConRitentativi(sfida.sfidatoId, 'Sfida Annullata: nessun campo libero la domenica per la regola del circolo.', sfida.circoloId);
}

// Prenota davvero un campo/orario per la sfida (usato sia dalla
// regola del circolo sia dalla conferma finale della proposta
// formale) — riusa prenotaConCompagno: stesso meccanismo di costo
// diviso 50/50 con ricorso automatico al Fido, già in uso ovunque.
async function fissaMatch(
  sfida: Sfida, campo: Campo, dataIso: string, orari: string[], viaRegolaCircolo: boolean
): Promise<{ sosUsatoSfidante: boolean; sosUsatoSfidato: boolean }> {
  const giorno = new Date(`${dataIso}T00:00:00`);
  const dataLabel = `${giorno.getDate()}/${giorno.getMonth() + 1}`;
  const prenotazioneIds: string[] = [];
  let sosUsatoSfidante = false;
  let sosUsatoSfidato = false;
  // Le mezz'ore della sfida sono una partita sola: stesso gruppo nel
  // registro, stesso cardId in Home. L'id della sfida e' gia' unico e
  // stabile, quindi serve da identificativo della card.
  const gruppoId = `sfida_${sfida.id}`;

  // Tutte le mezz'ore o nessuna. Se una fallisce a meta' — il caso
  // tipico e' il credito che non basta sulla seconda — quelle gia'
  // create vanno disfatte subito: la sfida non verrebbe fissata
  // (l'aggiornamento qui sotto non viene raggiunto), quindi
  // resterebbero appese a nulla, con il campo occupato e nessun
  // annullamento in grado di ritrovarle.
  const creati: { id: string; orario: string; prezzo: number }[] = [];
  try {
    for (const ora of orari) {
      const prezzo = calcolaPrezzo(campo, giorno, ora);
      const risultato = await prenotaConCompagno({
        uid: sfida.sfidanteId,
        compagnoId: sfida.sfidatoId,
        circoloId: sfida.circoloId,
        campoId: campo.id,
        campoNome: campo.nome,
        data: dataIso,
        dataLabel,
        orario: ora,
        prezzo,
        etichetta: null,
        utenteNome: sfida.sfidanteNome,
        utenteCognome: sfida.sfidanteCognome,
        compagnoNome: sfida.sfidatoNome,
        compagnoCognome: sfida.sfidatoCognome,
        sfidaId: sfida.id,
        gruppoId,
        cardId: gruppoId,
      });
      creati.push({ id: risultato.id, orario: ora, prezzo });
      prenotazioneIds.push(risultato.id);
      if (risultato.sosUsatoUtente) sosUsatoSfidante = true;
      if (risultato.sosUsatoCompagno) sosUsatoSfidato = true;
    }
  } catch (errore) {
    // A ritroso: se anche il disfacimento si interrompe, quel che resta
    // e' un blocco iniziale intero e non una prenotazione bucata.
    for (const c of [...creati].reverse()) {
      try {
        await cancellaConRimborsoDiviso({
          utenteId: sfida.sfidanteId,
          compagnoId: sfida.sfidatoId,
          // ⚠️ La quota ESATTA che era stata addebitata. Senza, il
          // rimborso ricadeva su una divisione a meta' arrotondata in
          // modo diverso dall'addebito, e su un prezzo con i centesimi
          // dispari uno dei due si ritrovava un centesimo in piu' e
          // l'altro uno in meno — per sempre.
          giocatori: [{
            uid: sfida.sfidatoId,
            nome: sfida.sfidatoNome,
            cognome: sfida.sfidatoCognome,
            quota: dividiInParti(c.prezzo, 1).quotaCiascuno,
          }],
          circoloId: sfida.circoloId,
          prenotazioneId: c.id,
          prezzoTotale: c.prezzo,
          gruppoId,
          cardId: gruppoId,
          socioNome: `${sfida.sfidanteNome} ${sfida.sfidanteCognome}`,
          compagnoNome: `${sfida.sfidatoNome} ${sfida.sfidatoCognome}`,
          campoNome: campo.nome,
          dataLabel,
          dataISO: dataIso,
          campoId: campo.id,
          orario: c.orario,
          eseguitoDaUid: sfida.sfidanteId,
          eseguitoDaNome: `${sfida.sfidanteNome} ${sfida.sfidanteCognome}`,
          eseguitoDaRuolo: 'socio',
          parziale: true,
          descrizione: 'Rimborso: la sfida non è stata fissata',
        });
      } catch (e) {
        console.warn('Mezz\'ora della sfida non disfatta dopo l\'errore:', c.id, e);
      }
    }
    throw errore;
  }

  await updateDoc(doc(db, 'sfide', sfida.id), {
    fase: 'accettata',
    prenotazioneScadenza: null,
    prenotazioneIds,
    matchCampoNome: campo.nome, matchData: dataIso, matchDataLabel: dataLabel, matchOrari: orari,
    matchViaRegolaCircolo: viaRegolaCircolo,
  });
  await messaggioSistema(sfida.id, `Sfida fissata: ${campo.nome}, ${dataLabel} ore ${orari[0]}-${orarioFineSlot(orari[orari.length - 1])}.`);
  const testoNotifica = `Sfida in Corso: ${campo.nome}, ${dataLabel} ore ${orari[0]}.`;
  await notificaSfidaConRitentativi(sfida.sfidanteId, testoNotifica, sfida.circoloId);
  await notificaSfidaConRitentativi(sfida.sfidatoId, testoNotifica, sfida.circoloId);
  return { sosUsatoSfidante, sosUsatoSfidato };
}

// Risoluzione passiva del timer 1 (chiamata dal client quando nota
// che accordoScadenza è passata e la fase è ancora "accordo" — non
// c'è un server dedicato per questo, come per il resto delle Sfide).
export async function risolviTimerAccordo(sfida: Sfida, soci: SocioCircolo[]): Promise<void> {
  if (sfida.fase !== 'accordo') return;
  if (Date.now() < sfida.accordoScadenza) return;

  const sfidaRef = doc(db, 'sfide', sfida.id);
  let daApplicare: 'silenzio' | 'sfidante_muto' | 'sfidato_muto' | null = null;

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(sfidaRef);
    if (!snap.exists() || snap.data().fase !== 'accordo') return;
    const s = snap.data() as Sfida;
    if (!s.accordoSfidante && !s.accordoSfidato) daApplicare = 'silenzio';
    else if (s.accordoSfidato && !s.accordoSfidante) daApplicare = 'sfidante_muto';
    else if (s.accordoSfidante && !s.accordoSfidato) daApplicare = 'sfidato_muto';
    else return; // entrambi trovato: non dovrebbe arrivare qui (già passato a "prenotazione")
    // "decaduta", non "annullata": qui una vera penalità è stata
    // applicata (qualcuno ha perso qualcosa) — deve comparire nello
    // storico, a differenza di un annullamento senza conseguenze.
    const vincitoreId = daApplicare === 'sfidante_muto' ? s.sfidatoId : s.sfidanteId;
    tx.update(sfidaRef, { fase: 'decaduta', vincitoreId, risultatoUfficiale: 'Tempo Scaduto', conclusaIl: serverTimestamp() });
  });

  if (!daApplicare) return;

  if (daApplicare === 'silenzio' || daApplicare === 'sfidato_muto') {
    await applicaPerditaPosizione(sfida.sfidatoId, sfida.sfidanteId, soci, sfida.circoloId);
    await messaggioSistema(sfida.id, 'Le 24 ore sono scadute senza risposta dallo sfidato: perde la posizione in classifica.');
    await notificaSfidaConRitentativi(sfida.sfidatoId, 'Non hai risposto in tempo alla sfida: hai perso la tua posizione in classifica.', sfida.circoloId);
    await notificaSfidaConRitentativi(sfida.sfidanteId, `${sfida.sfidatoNome} non ha risposto in tempo: hai preso la sua posizione in classifica.`, sfida.circoloId);
  } else if (daApplicare === 'sfidante_muto') {
    await applicaCongelamento(sfida.sfidanteId);
    await messaggioSistema(sfida.id, 'Le 24 ore sono scadute senza risposta dallo sfidante: è congelato dalle sfide per 7 giorni.');
    await notificaSfidaConRitentativi(sfida.sfidanteId, 'Non hai risposto in tempo alla tua stessa sfida: sei congelato dal lanciarne altre per 7 giorni.', sfida.circoloId);
    await notificaSfidaConRitentativi(sfida.sfidatoId, `${sfida.sfidanteNome} non ha risposto in tempo: la sfida decade, nessuna penalità per te.`, sfida.circoloId);
  }
}

// ⚠️ Cancella i segnaposto di QUESTA sfida, e solo quelli.
//
// Da quando l'identificativo di una prenotazione e' ricavato dallo
// slot (circolo, campo, giorno, ora), un id conservato dentro la sfida
// non punta piu' "a quel documento o a niente": punta ALLO SLOT. Se
// nel frattempo il segnaposto e' stato tolto e un altro socio ha
// prenotato quella mezz'ora, quell'id e' diventato il suo — e una
// cancellazione alla cieca gli avrebbe fatto sparire la prenotazione
// pagata, senza rimborso, senza movimento e senza un avviso.
// Quindi si legge prima, e si cancella solo se e' davvero un
// segnaposto sospeso di questa sfida.
async function liberaSegnaposto(prenotazioneIds: string[] | null | undefined, sfidaId: string) {
  if (!prenotazioneIds || prenotazioneIds.length === 0) return;
  for (const id of prenotazioneIds) {
    try {
      const rif = doc(db, 'prenotazioni', id);
      const snap = await getDoc(rif);
      if (!snap.exists()) continue;
      const dati = snap.data() as any;
      if (dati.sfidaId !== sfidaId || !dati.sospesaSfida) continue;
      await deleteDoc(rif);
    } catch (e) {
      console.warn('Segnaposto sfida non liberato:', id, e);
    }
  }
}

// ---------------- Fase "prenotazione" — proposta formale ----------------

export async function inviaPropostaFormale(
  sfida: Sfida, chi: 'sfidante' | 'sfidato', mittenteNome: string,
  campo: Campo, dataIso: string, dataLabel: string, orari: string[], circolo: Circolo | null
): Promise<void> {
  const giorno = new Date(`${dataIso}T00:00:00`);
  const prezzi = orari.map((ora) => calcolaPrezzo(campo, giorno, ora));

  // Gli slot proposti diventano "sospesi": prenotazioni vere e
  // proprie (così la griglia li mostra occupati a chiunque altro),
  // ma senza scalare credito a nessuno finché non verranno
  // confermati con "Prenota queste ore" — usiamo prezzo 0 e un
  // marcatore dedicato, cancellabili senza rimborso se il timer
  // scade o la proposta non va a buon fine.
  // ⚠️ Anche i segnaposto sospesi occupano il campo, quindi passano
  // dallo stesso identificativo ricavato da circolo/campo/giorno/ora:
  // con un id sorteggiato, due proposte formali sullo stesso orario —
  // o una proposta sopra una prenotazione appena fatta da un altro
  // socio — creavano due documenti per la stessa mezz'ora.
  // ⚠️ Tutte le mezz'ore o nessuna. Senza il disfacimento, se la
  // seconda risultava occupata la prima restava scritta e fuori da
  // ogni elenco: nessun percorso dell'app poteva piu' liberarla —
  // uno slot rosso a prezzo zero per sempre — e riproporre lo stesso
  // orario falliva all'infinito contro il proprio stesso segnaposto.
  const prenotazioneIds: string[] = [];
  try {
  for (const ora of orari) {
    const ref = doc(db, 'prenotazioni', idSlot(sfida.circoloId, campo.id, dataIso, ora));
    await runTransaction(db, async (tx) => {
      const gia = await tx.get(ref);
      if (gia.exists()) throw new Error(SLOT_OCCUPATO);
      tx.set(ref, {
        utenteId: sfida.sfidanteId, circoloId: sfida.circoloId,
        campoId: campo.id, campoNome: campo.nome, data: dataIso, dataLabel, orario: ora,
        prezzo: 0, etichetta: null,
        utenteNome: sfida.sfidanteNome, utenteCognome: sfida.sfidanteCognome,
        compagnoId: sfida.sfidatoId, compagnoNome: sfida.sfidatoNome, compagnoCognome: sfida.sfidatoCognome,
        costoDiviso: true, sfidaId: sfida.id, sospesaSfida: true,
        creataIl: serverTimestamp(),
      });
    });
    prenotazioneIds.push(ref.id);
  }
  } catch (e) {
    await liberaSegnaposto(prenotazioneIds, sfida.id);
    throw e;
  }

  const proposta: PropostaFormale = { campoId: campo.id, campoNome: campo.nome, data: dataIso, dataLabel, orari, prezzi };
  const durata = durataTimerMs(circolo);
  await updateDoc(doc(db, 'sfide', sfida.id), {
    proposta, propostaAccettata: false, prenotazioneIds,
    prenotazioneScadenza: Date.now() + durata,
    ultimaAzioneDi: chi,
  });
  await addDoc(collection(db, 'sfide', sfida.id, 'messaggi'), {
    tipo: 'proposta_formale', mittenteId: chi === 'sfidante' ? sfida.sfidanteId : sfida.sfidatoId, mittenteNome,
    proposta, creatoIl: serverTimestamp(),
  });
  const destinatarioId = chi === 'sfidante' ? sfida.sfidatoId : sfida.sfidanteId;
  await notificaSfidaConRitentativi(destinatarioId, `${mittenteNome} ha proposto un orario formale: ${dataLabel} ore ${orari[0]}. Rispondi entro il tempo indicato in chat.`, sfida.circoloId);
}

export async function accettaPropostaFormale(sfida: Sfida, chi: 'sfidante' | 'sfidato', mittenteNome: string, circolo: Circolo | null): Promise<void> {
  const durata = durataTimerMs(circolo);
  await updateDoc(doc(db, 'sfide', sfida.id), {
    propostaAccettata: true,
    prenotazioneScadenza: Date.now() + durata,
    ultimaAzioneDi: chi,
  });
  await messaggioSistema(sfida.id, `${mittenteNome} ha accettato la proposta. Manca solo la conferma finale per prenotare davvero.`);
  const destinatarioId = chi === 'sfidante' ? sfida.sfidatoId : sfida.sfidanteId;
  await notificaSfidaConRitentativi(destinatarioId, `${mittenteNome} ha accettato la proposta! Conferma per prenotare davvero.`, sfida.circoloId);
}

// Conferma finale: gli slot "sospesi" diventano prenotazioni vere,
// col vero addebito (Fido incluso se serve). Chiunque dei due può
// premere questo bottone finale, non solo chi ha proposto in
// origine — chi arriva per ultimo chiude la trattativa.
// Richiede l'elenco reale dei campi: il Campo salvato nella proposta
// ha solo id/nome, non le tariffe — servono quelle vere per calcolare
// il prezzo corretto, non uno a caso o a zero.
export async function prenotaOrarioSfida(sfida: Sfida, campi: Campo[]): Promise<{ sosUsatoSfidante: boolean; sosUsatoSfidato: boolean }> {
  if (!sfida.proposta || !sfida.prenotazioneIds) throw new Error('PROPOSTA_MANCANTE');
  const { proposta, prenotazioneIds } = sfida;
  const campoReale = campi.find((c) => c.id === proposta.campoId);
  if (!campoReale) throw new Error('CAMPO_NON_TROVATO');

  // Cancella i segnaposto "sospesi" e li ricrea come prenotazioni
  // vere — più semplice e sicuro che provare ad "aggiornare" un
  // segnaposto a metà transazione.
  await liberaSegnaposto(prenotazioneIds, sfida.id);
  try {
    return await fissaMatch(sfida, campoReale, proposta.data, proposta.orari, false);
  } catch (e: any) {
    // ⚠️ I segnaposto sono stati tolti e la ricreazione non e' andata:
    // gli id conservati sulla sfida ora puntano a slot che possono
    // essere di chiunque. Vanno azzerati SUBITO, o il timer o un
    // annullamento successivo cancellerebbero la prenotazione di un
    // altro socio.
    try { await updateDoc(doc(db, 'sfide', sfida.id), { prenotazioneIds: null }); }
    catch (e2) { console.warn('prenotazioneIds non azzerati dopo un fallimento:', e2); }
    throw e;
  }
}

export async function risolviTimerPrenotazione(sfida: Sfida, soci: SocioCircolo[]): Promise<void> {
  if (sfida.fase !== 'prenotazione') return;
  if (!sfida.prenotazioneScadenza || Date.now() < sfida.prenotazioneScadenza) return;

  const sfidaRef = doc(db, 'sfide', sfida.id);
  let colpaDi: 'sfidante' | 'sfidato' | null = null;

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(sfidaRef);
    if (!snap.exists() || snap.data().fase !== 'prenotazione') return;
    const s = snap.data() as Sfida;
    // Chi ha compiuto l'ultima azione stava aspettando l'altro:
    // quindi la colpa è di chi NON ha agito per ultimo.
    colpaDi = s.ultimaAzioneDi === 'sfidante' ? 'sfidato' : 'sfidante';
    // "decaduta", non "annullata": una vera penalità è stata
    // applicata — deve comparire nello storico.
    const vincitoreId = colpaDi === 'sfidante' ? s.sfidatoId : s.sfidanteId;
    tx.update(sfidaRef, { fase: 'decaduta', vincitoreId, risultatoUfficiale: 'Tempo Scaduto', conclusaIl: serverTimestamp() });
  });

  if (!colpaDi) return;

  // Libera gli slot eventualmente sospesi.
  await liberaSegnaposto(sfida.prenotazioneIds, sfida.id);

  if (colpaDi === 'sfidante') {
    await applicaCongelamento(sfida.sfidanteId);
    await messaggioSistema(sfida.id, 'Tempo scaduto senza prenotazione: colpa dello sfidante, congelato dalle sfide per 7 giorni.');
    await notificaSfidaConRitentativi(sfida.sfidanteId, 'Non hai risposto in tempo: sei congelato dal lanciare sfide per 7 giorni.', sfida.circoloId);
    await notificaSfidaConRitentativi(sfida.sfidatoId, 'Lo sfidante non ha risposto in tempo: la sfida decade, nessuna penalità per te.', sfida.circoloId);
  } else {
    await applicaPerditaPosizione(sfida.sfidatoId, sfida.sfidanteId, soci, sfida.circoloId);
    await messaggioSistema(sfida.id, 'Tempo scaduto senza prenotazione: colpa dello sfidato, perde la posizione in classifica.');
    await notificaSfidaConRitentativi(sfida.sfidatoId, 'Non hai risposto in tempo: hai perso la tua posizione in classifica.', sfida.circoloId);
    await notificaSfidaConRitentativi(sfida.sfidanteId, `${sfida.sfidatoNome} non ha risposto in tempo: hai preso la sua posizione in classifica.`, sfida.circoloId);
  }
}

// ---------------- Fase 3 — risultato ----------------

export async function dichiaraRisultato(
  sfidaId: string, chi: 'sfidante' | 'sfidato', esito: 'vinta' | 'persa', punteggio: string
): Promise<void> {
  const campo = chi === 'sfidante' ? 'risultatoSfidante' : 'risultatoSfidato';
  await updateDoc(doc(db, 'sfide', sfidaId), { [campo]: { esito, punteggio: punteggio.trim() } });
}

// circoloId e' indispensabile: le posizioni in classifica vivono
// sulla TESSERA (`uid_circoloId`), non piu' sul profilo. Senza,
// l'aggiornamento veniva scritto su un documento inesistente e la
// classifica restava ferma — senza alcun errore visibile, perche'
// tutto il resto (avvisi, chiusura sfida) andava a buon fine.
export async function concludiSfida(
  sfidaId: string, sfidanteId: string, sfidatoId: string, vincitoreId: string, soci: SocioCircolo[],
  faseAttesa: FaseSfida, risultatoUfficiale: string, circoloId: string
): Promise<boolean> {
  const sfidaRef = doc(db, 'sfide', sfidaId);
  let applicata = false;

  await runTransaction(db, async (tx) => {
    const sfidaSnap = await tx.get(sfidaRef);
    if (!sfidaSnap.exists()) return;
    const faseAttuale = sfidaSnap.data().fase as FaseSfida;
    if (faseAttuale !== faseAttesa) return;

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
          tx.update(doc(db, 'tessere', `${s.uid}_${circoloId}`), { posizioneClassificaSociale: pos + 1 });
        }
      });
      tx.update(doc(db, 'tessere', `${sfidanteId}_${circoloId}`), { posizioneClassificaSociale: posSfidato });
    }

    tx.update(sfidaRef, { fase: 'conclusa', vincitoreId, risultatoUfficiale: risultatoUfficiale.trim(), conclusaIl: serverTimestamp() });
    applicata = true;
  });

  return applicata;
}

// Mancata presentazione: l'Admin, dal pop-up di conclusione, segnala
// esplicitamente chi non si è presentato — penalità diversa da una
// sconfitta giocata normalmente (qui niente scambio di posizione per
// lo sfidante mancante, ma congelamento; per lo sfidato mancante,
// perdita diretta della posizione).
export async function nonPresentatoSfidante(sfida: Sfida): Promise<void> {
  await applicaCongelamento(sfida.sfidanteId);
  await updateDoc(doc(db, 'sfide', sfida.id), { fase: 'conclusa', nonPresentatoId: sfida.sfidanteId, vincitoreId: sfida.sfidatoId, risultatoUfficiale: 'Vinta a Tavolino', conclusaIl: serverTimestamp() });
  await notificaSfidaConRitentativi(sfida.sfidanteId, 'Il circolo ha registrato la tua mancata presentazione: sei congelato dalle sfide per 7 giorni.', sfida.circoloId);
  await notificaSfidaConRitentativi(sfida.sfidatoId, 'Il circolo ha confermato: il tuo avversario non si è presentato.', sfida.circoloId);
}

export async function nonPresentatoSfidato(sfida: Sfida, soci: SocioCircolo[]): Promise<void> {
  await applicaPerditaPosizione(sfida.sfidatoId, sfida.sfidanteId, soci, sfida.circoloId);
  await updateDoc(doc(db, 'sfide', sfida.id), { fase: 'conclusa', nonPresentatoId: sfida.sfidatoId, vincitoreId: sfida.sfidanteId, risultatoUfficiale: 'Vinta a Tavolino', conclusaIl: serverTimestamp() });
  await notificaSfidaConRitentativi(sfida.sfidatoId, 'Il circolo ha registrato la tua mancata presentazione: hai perso la tua posizione in classifica.', sfida.circoloId);
  await notificaSfidaConRitentativi(sfida.sfidanteId, 'Il circolo ha confermato: il tuo avversario non si è presentato, hai preso la sua posizione.', sfida.circoloId);
}

// ---------------- Annullamento manuale (Admin) ----------------

// Correzione di un errore già pubblicato: Admin può cambiare SOLO il
// testo del risultato — non il vincitore, non le posizioni in
// classifica (che restano quelle già assegnate). Se un domani serve
// correggere anche il vincitore, sarà una funzione a parte, con le
// dovute cautele: qui l'obiettivo è solo correggere un refuso/errore
// nel testo scritto in fretta.
export async function modificaRisultatoUfficiale(sfidaId: string, nuovoTesto: string): Promise<void> {
  await updateDoc(doc(db, 'sfide', sfidaId), { risultatoUfficiale: nuovoTesto.trim() });
}

export async function annullaSfida(sfida: Sfida): Promise<void> {
  await liberaSegnaposto(sfida.prenotazioneIds, sfida.id);
  // Il regolamento chiede che una sfida annullata sparisca del tutto
  // dai dati (nessuna traccia in Bacheca né altrove) — cancelliamo
  // anche i messaggi della chat, poi il documento stesso.
  const msgSnap = await getDocs(collection(db, 'sfide', sfida.id, 'messaggi'));
  for (const m of msgSnap.docs) {
    try { await deleteDoc(m.ref); } catch { /* ignorabile */ }
  }
  await deleteDoc(doc(db, 'sfide', sfida.id));
  await notificaSfidaConRitentativi(sfida.sfidanteId, `Il circolo ha annullato la sfida con ${sfida.sfidatoNome} ${sfida.sfidatoCognome}. La classifica non cambia.`, sfida.circoloId);
  await notificaSfidaConRitentativi(sfida.sfidatoId, `Il circolo ha annullato la sfida con ${sfida.sfidanteNome} ${sfida.sfidanteCognome}. La classifica non cambia.`, sfida.circoloId);
}

// ---------------- Reset di test ----------------

export async function resettaSfideTest(circoloId: string, sfide: Sfida[]): Promise<void> {
  const daCancellare = sfide.filter((sf) => sf.circoloId === circoloId);
  for (const sf of daCancellare) {
    await liberaSegnaposto(sf.prenotazioneIds, sf.id);
    try {
      const msgSnap = await getDocs(collection(db, 'sfide', sf.id, 'messaggi'));
      for (const m of msgSnap.docs) {
        try { await deleteDoc(m.ref); } catch { /* ignorabile */ }
      }
    } catch (e) { console.warn('Messaggi già assenti durante il reset:', sf.id, e); }
    try {
      await deleteDoc(doc(db, 'sfide', sf.id));
    } catch (e) {
      console.warn('Sfida già assente durante il reset:', sf.id, e);
    }
  }
}
