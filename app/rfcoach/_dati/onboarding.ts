'use client';

// ============================================================
// LE CHIAMATE — l'unica strada per cui qualcosa cambia davvero.
//
// ⚠️ QUATTRO FUNZIONI E NESSUNA SCRITTURA DIRETTA. Dal browser questo
// pannello non scrive su Firestore nemmeno un campo: `coachCreaSpazio`,
// `coachCambiaStatoSpazio`, `coachModificaSpazio` e `coachLinkAccesso`
// fanno tutto con l'Admin SDK, dove `titolari/{uid}` si puo' scrivere e
// dove i tre documenti nascono nello stesso `batch`.
//
// ⚠️ I NOMI SONO STRINGHE, e una lettera sbagliata qui non la prende
// nessun compilatore: si scoprirebbe come `functions/not-found` davanti
// a un cliente. Per questo `npm run prove` legge
// `../rf-coach/functions/src/index.ts` e pretende che ogni nome usato
// qui sia una funzione davvero esportata di la'. E' l'unico punto in
// cui i due repository si tengono a mano.
//
// ⚠️ E QUI NON C'E' NESSUNA PASSWORD. Racket Fever fa scegliere la
// password dell'Admin nel modulo, la mostra in chiaro nel riepilogo, e
// da li' viaggia su WhatsApp: da quel momento l'account del cliente lo
// aprono due persone, e una delle due siamo noi — tanto che ha dovuto
// aggiungere un campo (`passwordDaCambiare`) per rimediare. Qui il
// server restituisce un LINK: la password la sceglie il maestro, e noi
// non la sappiamo in nessun momento.
//
// ⚠️ GLI ERRORI SI RACCONTANO COME ARRIVANO. Il server risponde con
// frasi scritte apposta — «questa persona ha gia' uno spazio suo»,
// «lavora gia' in un altro spazio: deve uscirne prima» — e questo file
// non le sostituisce con un «operazione non riuscita». Un rifiuto che
// non dice il motivo e' un pomeriggio perso a indovinarlo.
// ============================================================

import { httpsCallable } from 'firebase/functions';
import { funzioni } from '../_lib/firebase';

export type DatiNuovoSpazio = {
  email: string;
  nome: string;
  cognome: string;
  nomeSpazio: string;
  tipo: 'persona' | 'scuola';
  citta: string;
  zona: string;
  paese: 'CH' | 'IT';
  valuta: 'CHF' | 'EUR';
  insegna: boolean;
  dashboardUnica: boolean;
  visibile: boolean;
  tariffaOraCent: number;
  telefono: string;
  emailPubblica: string;
};

export type EsitoNuovoSpazio = {
  spazioId: string;
  uid: string;
  nuovoAccount: boolean;
  // ⚠️ Vero quando l'account esisteva gia' ma non ha mai verificato
  // l'indirizzo: le regole pretendono `verificato()` per quasi ogni
  // scrittura, quindi quel maestro entrerebbe e non riuscirebbe a fare
  // niente. Senza questo campo il pannello mostrava un riquadro verde
  // tranquillo proprio nel caso in cui non lo e'.
  daVerificare: boolean;
  link: string;
};

export async function creaSpazio(dati: DatiNuovoSpazio): Promise<EsitoNuovoSpazio> {
  const chiama = httpsCallable<DatiNuovoSpazio, EsitoNuovoSpazio>(funzioni, 'coachCreaSpazio');
  const risposta = await chiama(dati);
  return risposta.data;
}

export type Azione = 'sospendi' | 'riattiva' | 'chiudi';

export async function cambiaStato(spazioId: string, azione: Azione): Promise<void> {
  const chiama = httpsCallable(funzioni, 'coachCambiaStatoSpazio');
  await chiama({ spazioId, azione });
}

// ⚠️ DUE GENERI DI LINK, e la differenza conta: `password` fa ENTRARE e
// si genera solo per gli account nati insieme allo spazio; `verifica`
// non fa entrare nessuno, dimostra soltanto che quell'indirizzo si
// legge. Il perche' sta per esteso in testa a `coachLinkAccesso`.
export type EsitoLink = {
  email: string;
  link: string;
  tipo: 'password' | 'verifica';
  gia: boolean;
};

export async function linkAccesso(spazioId: string): Promise<EsitoLink> {
  const chiama = httpsCallable<{ spazioId: string }, EsitoLink>(funzioni, 'coachLinkAccesso');
  const risposta = await chiama({ spazioId });
  return risposta.data;
}

export type Anagrafica = {
  nome: string;
  tipo: 'persona' | 'scuola';
  citta: string;
  zona: string;
  telefono: string;
  emailPubblica: string;
  presentazione: string;
  visibile: boolean;
};

// ⚠️ SERVE PERCHE' ALTRIMENTI LA CONSOLE NON SPARIVA DAVVERO: nome,
// tipo, citta', zona, telefono ed email pubblica NON sono fra i campi
// che il titolare puo' toccare dall'app. Un nome scritto male il giorno
// della creazione tornava in console Firebase.
export async function modificaSpazio(
  spazioId: string, dati: Partial<Anagrafica>,
): Promise<void> {
  const chiama = httpsCallable(funzioni, 'coachModificaSpazio');
  await chiama({ spazioId, ...dati });
}

// ⚠️ Il messaggio del server sta in `message`, e le `HttpsError` di
// Firebase lo portano fin qui intatto. Senza questa funzione ogni
// schermata scriverebbe `String(e)`, che su un errore di Firebase
// produce «FirebaseError: internal» — vero e inutile.
export function motivo(e: unknown): string {
  const messaggio = (e as { message?: string })?.message ?? '';
  return messaggio.trim() || 'Non e’ riuscita, e il server non ha detto perche’.';
}

// ============================================================
// ⚠️ «NON E' STATO CREATO NIENTE» NON SI PUO' DIRE SEMPRE — rilievo
// della revisione del 16 settembre.
//
// Quella frase e' vera solo quando a rifiutare e' stata la funzione. Il
// client `callable` di Firebase pero' scade a settanta secondi, e la
// funzione ne ha centoventi: in una giornata storta il browser riceve
// `deadline-exceeded` mentre il server LO SPAZIO L'HA CREATO. Il Super
// Admin leggeva «non e' stato creato niente», riprovava con la stessa
// email, e si sentiva rispondere «questa persona ha gia' uno spazio suo»
// — a quel punto non sa piu' a quale delle due frasi credere.
//
// Questi sono i codici con cui la funzione dice di NO: un rifiuto suo,
// prima di scrivere. Tutto il resto e' «non lo so», e si dice cosi'.
// ============================================================
const RIFIUTI = [
  'invalid-argument', 'failed-precondition', 'already-exists',
  'permission-denied', 'unauthenticated', 'not-found',
];

export function eUnRifiuto(e: unknown): boolean {
  return RIFIUTI.includes(String((e as { code?: string })?.code ?? '').replace('functions/', ''));
}
