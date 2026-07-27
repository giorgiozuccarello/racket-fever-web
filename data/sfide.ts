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
import { PrenotazioneAdmin, prenotaConCompagno } from './prenotazioniRepo';
import { calcolaPrezzo } from './prezzi';
import { SocioCircolo, impostaCongelamentoSfide } from './users';
import { formatISO } from './settimana';
import { creaNotifica } from './notifiche';

// Le notifiche delle Sfide non devono mai "sparire nel nulla" se il
// primo tentativo fallisce (rete instabile, momento di contesa su
// Firestore, ecc.): qui si riprova fino a 3 volte con una breve
// pausa, prima di arrendersi davvero.
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
    `${params.sfidanteNome} ${params.sfidanteCognome} ti ha lanciato una sfida! Apri la chat per organizzarvi — avete 24 ore per dirvi se avete trovato un accordo di massima.`
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
  await notificaSfidaConRitentativi(destinatarioId, `${mittenteNome}: ${pulito}`);
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
async function applicaPerditaPosizione(perdenteId: string, vincitoreId: string, soci: SocioCircolo[]): Promise<void> {
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
        tx.update(doc(db, 'utenti', s.uid), { posizioneClassificaSociale: pos + 1 });
      }
    });
    tx.update(doc(db, 'utenti', vincitoreId), { posizioneClassificaSociale: posPerdente });
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
    await notificaSfidaConRitentativi(sfida.sfidanteId, 'Accordo trovato con lo sfidato: ora potete proporre l\'orario formale.');
    await notificaSfidaConRitentativi(sfida.sfidatoId, 'Accordo trovato con lo sfidante: ora potete proporre l\'orario formale.');
  } else {
    const destinatarioId = chi === 'sfidante' ? sfida.sfidatoId : sfida.sfidanteId;
    await notificaSfidaConRitentativi(destinatarioId, `${mittenteNome} ha cliccato "Accordo Trovato" nella vostra sfida.`);
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
        await fissaMatch(sfida, campo, dataIso, ORARIO_UFFICIO, true);
        return;
      }
    }
    domenica = new Date(domenica);
    domenica.setDate(domenica.getDate() + 7);
  }

  // Nessun campo libero in nessuna delle due domeniche: annullata, senza penalità.
  await updateDoc(doc(db, 'sfide', sfida.id), { fase: 'annullata' });
  await messaggioSistema(sfida.id, 'Nessun campo libero la domenica: la sfida è annullata, senza penalità per nessuno.');
  await notificaSfidaConRitentativi(sfida.sfidanteId, 'Sfida Annullata: nessun campo libero la domenica per la regola del circolo.');
  await notificaSfidaConRitentativi(sfida.sfidatoId, 'Sfida Annullata: nessun campo libero la domenica per la regola del circolo.');
}

// Prenota davvero un campo/orario per la sfida (usato sia dalla
// regola del circolo sia dalla conferma finale della proposta
// formale) — riusa prenotaConCompagno: stesso meccanismo di costo
// diviso 50/50 con fallback S.O.S. automatico già in uso ovunque.
async function fissaMatch(
  sfida: Sfida, campo: Campo, dataIso: string, orari: string[], viaRegolaCircolo: boolean
): Promise<{ sosUsatoSfidante: boolean; sosUsatoSfidato: boolean }> {
  const giorno = new Date(`${dataIso}T00:00:00`);
  const dataLabel = `${giorno.getDate()}/${giorno.getMonth() + 1}`;
  const prenotazioneIds: string[] = [];
  let sosUsatoSfidante = false;
  let sosUsatoSfidato = false;
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
    });
    prenotazioneIds.push(risultato.id);
    if (risultato.sosUsatoUtente) sosUsatoSfidante = true;
    if (risultato.sosUsatoCompagno) sosUsatoSfidato = true;
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
  await notificaSfidaConRitentativi(sfida.sfidanteId, testoNotifica);
  await notificaSfidaConRitentativi(sfida.sfidatoId, testoNotifica);
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
    await applicaPerditaPosizione(sfida.sfidatoId, sfida.sfidanteId, soci);
    await messaggioSistema(sfida.id, 'Le 24 ore sono scadute senza risposta dallo sfidato: perde la posizione in classifica.');
    await notificaSfidaConRitentativi(sfida.sfidatoId, 'Non hai risposto in tempo alla sfida: hai perso la tua posizione in classifica.');
    await notificaSfidaConRitentativi(sfida.sfidanteId, `${sfida.sfidatoNome} non ha risposto in tempo: hai preso la sua posizione in classifica.`);
  } else if (daApplicare === 'sfidante_muto') {
    await applicaCongelamento(sfida.sfidanteId);
    await messaggioSistema(sfida.id, 'Le 24 ore sono scadute senza risposta dallo sfidante: è congelato dalle sfide per 7 giorni.');
    await notificaSfidaConRitentativi(sfida.sfidanteId, 'Non hai risposto in tempo alla tua stessa sfida: sei congelato dal lanciarne altre per 7 giorni.');
    await notificaSfidaConRitentativi(sfida.sfidatoId, `${sfida.sfidanteNome} non ha risposto in tempo: la sfida decade, nessuna penalità per te.`);
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
  const prenotazioneIds: string[] = [];
  for (const ora of orari) {
    const ref = await addDoc(collection(db, 'prenotazioni'), {
      utenteId: sfida.sfidanteId, circoloId: sfida.circoloId,
      campoId: campo.id, campoNome: campo.nome, data: dataIso, dataLabel, orario: ora,
      prezzo: 0, etichetta: null,
      utenteNome: sfida.sfidanteNome, utenteCognome: sfida.sfidanteCognome,
      compagnoId: sfida.sfidatoId, compagnoNome: sfida.sfidatoNome, compagnoCognome: sfida.sfidatoCognome,
      costoDiviso: true, sfidaId: sfida.id, sospesaSfida: true,
      creataIl: serverTimestamp(),
    });
    prenotazioneIds.push(ref.id);
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
  await notificaSfidaConRitentativi(destinatarioId, `${mittenteNome} ha proposto un orario formale: ${dataLabel} ore ${orari[0]}. Rispondi entro il tempo indicato in chat.`);
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
  await notificaSfidaConRitentativi(destinatarioId, `${mittenteNome} ha accettato la proposta! Conferma per prenotare davvero.`);
}

// Conferma finale: gli slot "sospesi" diventano prenotazioni vere,
// col vero addebito (S.O.S. incluso se serve). Chiunque dei due può
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
  for (const id of prenotazioneIds) {
    try { await deleteDoc(doc(db, 'prenotazioni', id)); } catch { /* già assente, va bene comunque */ }
  }
  return await fissaMatch(sfida, campoReale, proposta.data, proposta.orari, false);
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
  if (sfida.prenotazioneIds && sfida.prenotazioneIds.length > 0) {
    for (const id of sfida.prenotazioneIds) {
      try { await deleteDoc(doc(db, 'prenotazioni', id)); } catch { /* già assente */ }
    }
  }

  if (colpaDi === 'sfidante') {
    await applicaCongelamento(sfida.sfidanteId);
    await messaggioSistema(sfida.id, 'Tempo scaduto senza prenotazione: colpa dello sfidante, congelato dalle sfide per 7 giorni.');
    await notificaSfidaConRitentativi(sfida.sfidanteId, 'Non hai risposto in tempo: sei congelato dal lanciare sfide per 7 giorni.');
    await notificaSfidaConRitentativi(sfida.sfidatoId, 'Lo sfidante non ha risposto in tempo: la sfida decade, nessuna penalità per te.');
  } else {
    await applicaPerditaPosizione(sfida.sfidatoId, sfida.sfidanteId, soci);
    await messaggioSistema(sfida.id, 'Tempo scaduto senza prenotazione: colpa dello sfidato, perde la posizione in classifica.');
    await notificaSfidaConRitentativi(sfida.sfidatoId, 'Non hai risposto in tempo: hai perso la tua posizione in classifica.');
    await notificaSfidaConRitentativi(sfida.sfidanteId, `${sfida.sfidatoNome} non ha risposto in tempo: hai preso la sua posizione in classifica.`);
  }
}

// ---------------- Fase 3 — risultato ----------------

export async function dichiaraRisultato(
  sfidaId: string, chi: 'sfidante' | 'sfidato', esito: 'vinta' | 'persa', punteggio: string
): Promise<void> {
  const campo = chi === 'sfidante' ? 'risultatoSfidante' : 'risultatoSfidato';
  await updateDoc(doc(db, 'sfide', sfidaId), { [campo]: { esito, punteggio: punteggio.trim() } });
}

export async function concludiSfida(
  sfidaId: string, sfidanteId: string, sfidatoId: string, vincitoreId: string, soci: SocioCircolo[],
  faseAttesa: FaseSfida, risultatoUfficiale: string
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
          tx.update(doc(db, 'utenti', s.uid), { posizioneClassificaSociale: pos + 1 });
        }
      });
      tx.update(doc(db, 'utenti', sfidanteId), { posizioneClassificaSociale: posSfidato });
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
  await notificaSfidaConRitentativi(sfida.sfidanteId, 'Il circolo ha registrato la tua mancata presentazione: sei congelato dalle sfide per 7 giorni.');
  await notificaSfidaConRitentativi(sfida.sfidatoId, 'Il circolo ha confermato: il tuo avversario non si è presentato.');
}

export async function nonPresentatoSfidato(sfida: Sfida, soci: SocioCircolo[]): Promise<void> {
  await applicaPerditaPosizione(sfida.sfidatoId, sfida.sfidanteId, soci);
  await updateDoc(doc(db, 'sfide', sfida.id), { fase: 'conclusa', nonPresentatoId: sfida.sfidatoId, vincitoreId: sfida.sfidanteId, risultatoUfficiale: 'Vinta a Tavolino', conclusaIl: serverTimestamp() });
  await notificaSfidaConRitentativi(sfida.sfidatoId, 'Il circolo ha registrato la tua mancata presentazione: hai perso la tua posizione in classifica.');
  await notificaSfidaConRitentativi(sfida.sfidanteId, 'Il circolo ha confermato: il tuo avversario non si è presentato, hai preso la sua posizione.');
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
  if (sfida.prenotazioneIds && sfida.prenotazioneIds.length > 0) {
    for (const prenId of sfida.prenotazioneIds) {
      try {
        await deleteDoc(doc(db, 'prenotazioni', prenId));
      } catch (e) {
        console.warn('Prenotazione già assente durante annullamento sfida:', prenId, e);
      }
    }
  }
  // Il regolamento chiede che una sfida annullata sparisca del tutto
  // dai dati (nessuna traccia in Bacheca né altrove) — cancelliamo
  // anche i messaggi della chat, poi il documento stesso.
  const msgSnap = await getDocs(collection(db, 'sfide', sfida.id, 'messaggi'));
  for (const m of msgSnap.docs) {
    try { await deleteDoc(m.ref); } catch { /* ignorabile */ }
  }
  await deleteDoc(doc(db, 'sfide', sfida.id));
  await notificaSfidaConRitentativi(sfida.sfidanteId, `Il circolo ha annullato la sfida con ${sfida.sfidatoNome} ${sfida.sfidatoCognome}. La classifica non cambia.`);
  await notificaSfidaConRitentativi(sfida.sfidatoId, `Il circolo ha annullato la sfida con ${sfida.sfidanteNome} ${sfida.sfidanteCognome}. La classifica non cambia.`);
}

// ---------------- Reset di test ----------------

export async function resettaSfideTest(circoloId: string, sfide: Sfida[]): Promise<void> {
  const daCancellare = sfide.filter((sf) => sf.circoloId === circoloId);
  for (const sf of daCancellare) {
    if (sf.prenotazioneIds && sf.prenotazioneIds.length > 0) {
      for (const prenId of sf.prenotazioneIds) {
        try { await deleteDoc(doc(db, 'prenotazioni', prenId)); } catch (e) { console.warn('Prenotazione già assente durante il reset:', prenId, e); }
      }
    }
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
