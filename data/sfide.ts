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
import { auth, db, functions } from '../lib/firebase';
import { httpsCallable } from 'firebase/functions';
import { Campo, Blocco, Circolo, ORARI, orarioFineSlot, circoloOperativo, StatoCircolo } from './circoli';
import { PrenotazioneAdmin, prenotaConCompagno, cancellaConRimborsoDiviso, idSlot, SLOT_OCCUPATO } from './prenotazioniRepo';
import { dividiInParti } from './giocatori';
import { calcolaPrezzo } from './prezzi';
import { SocioCircolo } from './users';
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

// ⚠️ QUI STAVANO circoloAttivoAdesso e rimandaTimer, la rete di
// sicurezza che spostava in avanti i timer quando il circolo era
// sospeso. Sono state tolte perche' quel lavoro adesso lo fa il
// server, dentro risolviTimerSfida: e' li' che si decide se
// penalizzare, quindi e' li' che va guardato lo stato del circolo.
// Lasciarle qui voleva dire due reti di sicurezza che possono
// dissentire, e la piu' permissiva vince sempre.

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
  // ⚠️ I primi due sono della VECCHIA trattativa e restano solo per
  // leggere le sfide nate prima. Tenuti allineati al gemello dell'app,
  // racket-fever/data/sfide.ts.
  proposta: PropostaFormale | null;
  propostaAccettata: boolean;
  prenotazioneIds: string[] | null;

  // ---- La trattativa sugli orari ----
  // Uno propone una lista di mezz'ore, l'altro ne sceglie un blocco.
  // La dashboard web non tratta — le sfide si organizzano nell'app —
  // ma le MOSTRA, e senza questi campi la riga di stato dell'Admin
  // parlerebbe di un meccanismo smontato.
  orariProposti?: { campoId: string; campoNome: string; data: string; dataLabel: string; orario: string }[] | null;
  propostaDi?: 'sfidante' | 'sfidato' | null;
  proposteSfidante?: number;
  proposteSfidato?: number;
  finestraFineMs?: number | null;

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

// ⚠️ 'proposta_orari' e' il tipo della trattativa a lista; il gemello
// dell'app ha anche 'rapido'. Qui non si scrive niente: si legge.
export type TipoMessaggioSfida = 'testo' | 'sistema' | 'proposta_formale' | 'proposta_orari' | 'rapido';

// ⚠️ QUELLO CHE SERVE PER DISEGNARE UNA CARD, non per scrivere una
// frase. I messaggi automatici erano una riga di corsivo grigio in
// mezzo alla conversazione: si leggevano male e si confondevano con i
// messaggi veri — proprio loro, che raccontano le cose che decidono.
// Il tono sceglie colore e icona, niente altro.
export interface DatiSistemaSfida {
  titolo: string;
  tono?: 'neutro' | 'ok' | 'attenzione';
  campoNome?: string;
  dataLabel?: string;
  ore?: string;
  nota?: string;
}

export interface MessaggioSfida {
  id: string;
  tipo: TipoMessaggioSfida;
  mittenteId: string; // 'sistema' per i messaggi automatici
  mittenteNome: string;
  testo?: string;
  proposta?: PropostaFormale;
  // Le mezz'ore proposte, sui messaggi 'proposta_orari'. La dashboard
  // web non tratta, ma se un giorno mostrasse la chat di una sfida
  // deve saperli leggere.
  orariProposti?: { campoId: string; campoNome: string; data: string; dataLabel: string; orario: string }[];
  // ⚠️ Assente sui messaggi scritti prima di questa versione: la card
  // deve saperli mostrare lo stesso, con la sola frase.
  dati?: DatiSistemaSfida;
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

// ⚠️ DUE MOTIVI PER NON POTER ESSERE SFIDATI, e vanno guardati
// entrambi: la PENALITA' (sfideCongelateFino, che applica il server) e
// la RINUNCIA volontaria (rinunciaSfideFino, che sceglie il socio).
// Erano lo stesso campo; separandoli, chi guardasse solo il primo
// lascerebbe sfidare chi ha rinunciato.
export function socioCongelato(socio: SocioCircolo): boolean {
  const oggi = formatISO(new Date());
  const perPenalita = !!socio.sfideCongelateFino && socio.sfideCongelateFino >= oggi;
  const perRinuncia = !!socio.rinunciaSfideFino && socio.rinunciaSfideFino >= oggi;
  return perPenalita || perRinuncia;
}

// ---------------- Fase 0 — Lancio ----------------

// ============================================================
// ⚠️ QUI STAVA IL MOTORE DELLA SFIDA — `lanciaSfidaV2`,
// `cliccaAccordoTrovato`, `cliccaAccordoNonTrovato`,
// `applicaRegolaCircolo`, `fissaMatch`, `inviaMessaggioRapido` — ed e'
// stato tolto, non lasciato a dormire.
//
// Non lo chiamava nessuna pagina del sito, ma era codice ESPORTATO e
// rimasto indietro di una tornata intera. `cliccaAccordoTrovato` non
// era in transazione, cioe' portava dentro lo stallo definitivo che
// nell'app e' appena stato chiuso: due soci che cliccano insieme e la
// sfida si blocca per sempre. `cliccaAccordoNonTrovato` non prendeva
// nessun impegno prima di prenotare, cioe' la doppia prenotazione con
// doppio addebito. E `applicaRegolaCircolo` cercava ancora «la prima
// domenica futura» invece della prima dopo i sette giorni.
//
// Il prossimo che avesse cercato «come si lancia una sfida dal web» le
// avrebbe trovate e rimesse in produzione, difetti compresi. Il motore
// e' uno solo e sta in racket-fever/data/sfide.ts.
//
// ⚠️ Qui restano solo le due cose che la Dashboard usa davvero: la
// lettura delle sfide e la richiesta di risoluzione dei timer — che e'
// una chiamata al server, non una decisione.
// ============================================================

// Il client fa una cosa sola: dice al server «guarda se e' scaduto».
// Chi ha sbagliato, se la classifica si muove e di quanto, lo decide
// risolviTimerSfida dentro una transazione.
async function chiediRisoluzioneTimer(sfidaId: string): Promise<void> {
  try {
    const chiama = httpsCallable(functions, 'risolviTimerSfida');
    await chiama({ sfidaId });
  } catch (e) {
    // Non blocca e non allarma: se non e' andata, al prossimo giro
    // qualcuno riprovera'. Una penalita' rimandata non fa danno; una
    // schermata che dice "errore" su un timer scaduto, si'.
    console.warn('Timer non risolto:', e);
  }
}

export async function risolviTimerAccordo(sfida: Sfida, _soci: SocioCircolo[], _circolo?: Circolo | null): Promise<void> {
  if (sfida.fase !== 'accordo') return;
  if (Date.now() < sfida.accordoScadenza) return;
  await chiediRisoluzioneTimer(sfida.id);
}

export async function risolviTimerPrenotazione(sfida: Sfida, _soci: SocioCircolo[], _circolo?: Circolo | null): Promise<void> {
  if (sfida.fase !== 'prenotazione') return;
  if (!sfida.prenotazioneScadenza || Date.now() < sfida.prenotazioneScadenza) return;
  await chiediRisoluzioneTimer(sfida.id);
}


// ============================================================
// ⚠️ QUI STAVA TUTTA LA VECCHIA TRATTATIVA — `liberaSegnaposto`,
// `inviaPropostaFormale`, `accettaPropostaFormale`,
// `prenotaOrarioSfida` — ed e' stata tolta, non lasciata a dormire.
//
// Nessuna pagina del sito la chiamava, ma erano funzioni ESPORTATE che
// creavano i segnaposto sulla griglia: esattamente il meccanismo che
// questa tornata ha abolito. Il prossimo che avesse cercato «come
// propongo un orario dal web» le avrebbe trovate e rimesse in
// produzione, segnaposto compresi — e' lo stesso ragionamento con cui,
// da questo stesso file, erano gia' state tolte `inviaMessaggioTesto`
// e `applicaPerditaPosizione`.
//
// La trattativa si fa nell'app: uno propone una lista di mezz'ore,
// l'altro ne sceglie un blocco e con quello la sfida e' prenotata. Il
// codice vero sta in racket-fever/data/sfide.ts.
// ============================================================

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
// ⚠️ IL RISULTATO UFFICIALE LO REGISTRA IL CIRCOLO, sul server.
// E' quello che sposta la classifica, e i due in campo sono parte in
// causa: prima potevano scriverlo entrambi con una chiamata diretta.
// La firma resta identica — `soci` non serve piu', la classifica il
// server se la legge da solo dalle tessere.
export async function concludiSfida(
  sfidaId: string, _sfidanteId: string, _sfidatoId: string, vincitoreId: string, _soci: SocioCircolo[],
  _faseAttesa: FaseSfida, risultatoUfficiale: string, _circoloId: string
): Promise<boolean> {
  const chiama = httpsCallable(functions, 'concludiSfidaAdmin');
  const esito = await chiama({
    sfidaId, modo: 'risultato', vincitoreId, risultatoUfficiale,
  });
  return (esito.data as { applicata?: boolean })?.applicata === true;
}

// Mancata presentazione: l'Admin, dal pop-up di conclusione, segnala
// esplicitamente chi non si è presentato — penalità diversa da una
// sconfitta giocata normalmente (qui niente scambio di posizione per
// lo sfidante mancante, ma congelamento; per lo sfidato mancante,
// perdita diretta della posizione).
export async function nonPresentatoSfidante(sfida: Sfida): Promise<void> {
  const chiama = httpsCallable(functions, 'concludiSfidaAdmin');
  await chiama({ sfidaId: sfida.id, modo: 'nonPresentatoSfidante' });
}

export async function nonPresentatoSfidato(sfida: Sfida, _soci: SocioCircolo[]): Promise<void> {
  const chiama = httpsCallable(functions, 'concludiSfidaAdmin');
  await chiama({ sfidaId: sfida.id, modo: 'nonPresentatoSfidato' });
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

// ============================================================
// ⚠️ QUESTO GEMELLO ERA RIMASTO INDIETRO, ed era il pericolo peggiore
// della riparazione: la dashboard web ha una copia propria di questo
// file, e mentre l'app passava alla Cloud Function questa continuava a
// fare tutto dal browser — con lo stesso identico guasto. Il pulsante
// «Annulla sfida» del pannello web dava «Errore di connessione» dopo
// aver gia' liberato i segnaposto, e il «Reset Sfide» continuava a
// lasciare chat orfane che nessun client puo' piu' toccare.
//
// Adesso i due gemelli chiamano lo stesso server. Il ragionamento per
// esteso sta nel gemello dell'app, racket-fever/data/sfide.ts.
// ============================================================
export async function annullaSfida(sfida: Sfida): Promise<{ giaAnnullata: boolean; oreVere: number }> {
  const chiama = httpsCallable(functions, 'annullaSfidaAdmin');
  const esito = await chiama({ sfidaId: sfida.id });
  const dati = (esito.data ?? {}) as { annullata?: boolean; giaAnnullata?: boolean; oreVere?: number };
  return { giaAnnullata: dati.giaAnnullata === true, oreVere: dati.oreVere ?? 0 };
}

// ---------------- Reset di test ----------------

export async function resettaSfideTest(circoloId: string): Promise<{ cancellate: number; fallite: number }> {
  const chiama = httpsCallable(functions, 'resettaSfideCircolo', { timeout: 540000 });
  const esito = await chiama({ circoloId });
  const dati = (esito.data ?? {}) as { cancellate?: number; fallite?: number };
  return { cancellate: dati.cancellate ?? 0, fallite: dati.fallite ?? 0 };
}
