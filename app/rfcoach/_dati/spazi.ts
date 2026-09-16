'use client';

// ============================================================
// GLI SPAZI, VISTI DAL PANNELLO — e si legge soltanto.
//
// ⚠️ DA QUI NON SI SCRIVE NIENTE. Ogni cambiamento passa da una Cloud
// Function (`data/onboarding.ts`), per tre ragioni scritte per esteso in
// testa a `functions/src/spazi.ts` dell'app: `titolari/{uid}` e' chiuso
// a qualunque client, i documenti devono nascere insieme o non nascere,
// e le regole del prodotto in esercizio non si toccano per una
// schermata che usano tre persone.
//
// ⚠️ E LEGGERE NON HA BISOGNO DI NESSUNA REGOLA NUOVA: `spazi` e
// `membri` sono gia' `allow get, list: if true` — sono i documenti che
// ogni allievo consulta cercando un maestro. Questo pannello vede cio'
// che vede il mondo, e cio' che non vede il mondo (l'IBAN, in
// `spazi/{id}/riservato/`) non lo vede nemmeno lui.
// ============================================================

import {
  collection, doc, getDoc, getDocs, onSnapshot, query, where,
} from 'firebase/firestore';
import { db } from '../_lib/firebase';

export type SpazioRiga = {
  id: string;
  nome: string;
  tipo: string;
  citta: string;
  zona: string;
  paese: string;
  valuta: string;
  attivo: boolean;
  visibile: boolean;
  creatoIlMs: number;
  sospesoIlMs: number | null;
  chiusoIlMs: number | null;
  // ⚠️ Se l'account del titolare e' nato insieme allo spazio. Decide che
  // genere di link puo' chiedere il pannello — vedi la nota in testa a
  // `coachLinkAccesso`. Assente vale falso, ed e' la direzione giusta in
  // cui sbagliare: gli spazi creati a mano non ce l'hanno.
  accountNuovo: boolean;
};

// ⚠️ OGNI CAMPO HA UN RIPIEGO, e non e' pigrizia difensiva: gli spazi
// creati a mano dalla console prima del 16 settembre non hanno
// `creatoIlMs`, `sospesoIlMs` ne' `chiusoIlMs` — quei campi nascono con
// l'onboarding. Un lettore che li desse per scontati mostrerebbe
// «Invalid Date» sui clienti veri, che sono esattamente quelli che
// contano.
function leggiSpazio(id: string, d: Record<string, unknown>): SpazioRiga {
  const numero = (v: unknown): number | null => (typeof v === 'number' ? v : null);
  return {
    id,
    nome: typeof d.nome === 'string' ? d.nome : '',
    tipo: typeof d.tipo === 'string' ? d.tipo : 'persona',
    citta: typeof d.citta === 'string' ? d.citta : '',
    zona: typeof d.zona === 'string' ? d.zona : '',
    paese: typeof d.paese === 'string' ? d.paese : '',
    valuta: typeof d.valuta === 'string' ? d.valuta : '',
    // ⚠️ ASSENTE VALE FALSO, come nelle regole e come nell'app: uno
    // spazio senza `attivo` non e' attivo, e il pannello deve dire la
    // stessa cosa che dice la ricerca degli allievi — o si passerebbe
    // un pomeriggio a cercare perche' un maestro «attivo» non si trova.
    attivo: d.attivo === true,
    visibile: d.visibile === true,
    creatoIlMs: numero(d.creatoIlMs) ?? 0,
    sospesoIlMs: numero(d.sospesoIlMs),
    chiusoIlMs: numero(d.chiusoIlMs),
    accountNuovo: d.accountNuovo === true,
  };
}

export type StatoSpazio = 'attivo' | 'sospeso' | 'chiuso';

export function statoDi(s: SpazioRiga): StatoSpazio {
  // ⚠️ L'ORDINE CONTA: chiuso vince su sospeso. Uno spazio chiuso ha
  // tutte e due le date, e raccontarlo come «sospeso» farebbe credere
  // che basti riattivarlo — mentre chiudere ha tolto `titolari/{uid}`,
  // che e' un'altra cosa e si rimette apposta.
  if (s.chiusoIlMs != null) return 'chiuso';
  if (!s.attivo) return 'sospeso';
  return 'attivo';
}

// ============================================================
// ⚠️ L'ASCOLTO HA DUE USCITE, E LA SECONDA E' IL PUNTO.
//
// `onSnapshot` senza il secondo argomento fa sparire gli errori: regole
// cambiate, rete caduta, quota finita — non arriva niente e non lo dice
// nessuno. La schermata resta su «un momento» per sempre, che e' la
// forma di guasto peggiore perche' somiglia a un caricamento lento.
//
// ⚠️ E LA PRIMA STESURA CI AVEVA MESSO UN OROLOGIO AL POSTO DI QUESTO:
// dodici secondi e poi «l'elenco non arriva». Rilievo della revisione
// del 16 settembre, ed era peggio del male che curava — la closure del
// `setTimeout` leggeva lo stato del PRIMO render, dove l'elenco e'
// sempre vuoto, quindi l'allarme scattava SEMPRE, anche sopra una
// tabella piena di spazi. Un allarme che suona sempre e' un allarme a
// cui nessuno crede il giorno che conta.
//
// Qui il guasto lo dice Firestore, quando c'e', e non lo dice quando non
// c'e'.
// ============================================================
export function ascoltaSpazi(
  quando: (spazi: SpazioRiga[]) => void,
  seFallisce: (motivo: string) => void,
): () => void {
  return onSnapshot(collection(db, 'spazi'), (fotografia) => {
    const tutti = fotografia.docs.map((d) => leggiSpazio(d.id, d.data() as Record<string, unknown>));
    // ⚠️ L'ORDINE SI FA QUI E NON CON `orderBy`: ordinare su Firestore
    // per un campo che a meta' degli spazi manca li ESCLUDE dal
    // risultato — silenziosamente. E' la trappola nota degli indici: un
    // documento senza il campo ordinato non esiste per quella query.
    tutti.sort((a, b) => (b.creatoIlMs - a.creatoIlMs) || a.nome.localeCompare(b.nome));
    quando(tutti);
  }, (e) => {
    seFallisce(e.message || 'L’elenco degli spazi non arriva.');
  });
}

export type TesseraRiga = {
  uid: string;
  ruolo: string;
  stato: string;
  insegna: boolean;
  nome: string;
  cognome: string;
  dashboardUnica: boolean;
};

export async function tessereDi(spazioId: string): Promise<TesseraRiga[]> {
  // ⚠️ Una uguaglianza sola: Firestore la serve con l'indice automatico
  // di un campo, e nessun indice composto va creato a mano. Il resto —
  // il ruolo, lo stato — si guarda qui.
  const trovate = await getDocs(query(collection(db, 'membri'), where('spazioId', '==', spazioId)));
  return trovate.docs.map((t) => {
    const d = t.data() as Record<string, unknown>;
    return {
      uid: typeof d.uid === 'string' ? d.uid : '',
      ruolo: typeof d.ruolo === 'string' ? d.ruolo : '',
      stato: typeof d.stato === 'string' ? d.stato : '',
      insegna: d.insegna === true,
      nome: typeof d.nome === 'string' ? d.nome : '',
      cognome: typeof d.cognome === 'string' ? d.cognome : '',
      dashboardUnica: d.dashboardUnica === true,
    };
  });
}

export async function unoSpazio(spazioId: string): Promise<SpazioRiga | null> {
  const suo = await getDoc(doc(db, 'spazi', spazioId));
  if (!suo.exists()) return null;
  return leggiSpazio(suo.id, suo.data() as Record<string, unknown>);
}

// ============================================================
// ⚠️ QUANTI ALLIEVI HA UNO SPAZIO — NON C'E', ED E' UNA SCELTA.
//
// Sarebbe il primo numero che si vuole guardare, e si scriverebbe in
// quattro righe: una interrogazione su `appartenenze` per spazio. Ma
// quella collezione ha `allow list` solo per il diretto interessato e
// per chi lavora in quello spazio — cioe' il Super Admin, dal browser,
// riceverebbe `permission-denied`.
//
// Le strade sarebbero due, e nessuna delle due si fa oggi:
//
//   • aprire `appartenenze` al Super Admin, che vuol dire riscrivere una
//     regola del prodotto in esercizio — l'unica cosa che questa tornata
//     ha promesso di non fare — per un numero su una schermata;
//   • un contatore mantenuto da un trigger su `spazi`, che e' lavoro
//     vero e va deciso, non improvvisato dentro una tornata di guscio.
//
// Finche' non si decide, il numero non c'e'. Un numero sbagliato o un
// «—» che nessuno sa spiegare sarebbero peggio.
// ============================================================
