// ============================================================
// BACHECA — lettura e scrittura.
//
// La collezione sta in cima all'albero con il campo `circoloId`, come
// prenotazioni e tornei. Ma a differenza dei tornei, che sono un
// cartellone aperto a tutta la rete, qui la lettura e' riservata ai
// soci del circolo: un avviso di chiusura o una quota da rinnovare non
// riguardano nessun altro, e a imporlo sono le regole — non la
// schermata, che e' solo il posto dove si vede.
// ============================================================

import {
  collection, doc, addDoc, updateDoc, deleteDoc, onSnapshot, query, where,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Avviso } from './bacheca';
import { oggiIso } from './giorni';

const COLLEZIONE = 'avvisi';

export type DatiAvviso = Omit<Avviso, 'id' | 'creatoIlMs'>;

export async function pubblicaAvviso(dati: DatiAvviso): Promise<string> {
  const rif = await addDoc(collection(db, COLLEZIONE), {
    ...ripulisci(dati),
    creatoIlMs: Date.now(),
    creatoIl: serverTimestamp(),
  });
  return rif.id;
}

export async function aggiornaAvviso(id: string, dati: Partial<DatiAvviso>): Promise<void> {
  await updateDoc(doc(db, COLLEZIONE, id), ripulisci(dati));
}

export async function rimuoviAvviso(id: string): Promise<void> {
  await deleteDoc(doc(db, COLLEZIONE, id));
}

// ⚠️ Firestore rifiuta l'INTERA scrittura se trova un solo campo a
// "undefined", e in un avviso i facoltativi sono tre: il testo, il
// volantino e il link. E' lo stesso inciampo che aveva bloccato la
// conferma delle lezioni e la pubblicazione dei tornei — la terza
// volta conviene che il filtro stia in ogni repo che scrive.
function ripulisci<T extends Record<string, any>>(dati: T): T {
  const fuori: Record<string, any> = {};
  for (const [k, v] of Object.entries(dati)) {
    if (v === undefined) continue;
    fuori[k] = typeof v === 'string' ? v.trim() : v;
  }
  return fuori as T;
}

// ---- Quello che vede il socio ----
//
// ⚠️ Il filtro sulla scadenza e' NELL'INTERROGAZIONE, non nella
// schermata. Con il solo circoloId ogni socio si sarebbe portato a
// casa l'intero archivio del circolo — tre anni di fogli — per
// mostrarne otto, a ogni apertura della pagina e a ogni riconnessione.
// Serve l'indice composto circoloId + visibileFinoA, che sta in
// firestore.indexes.json.
export function ascoltaBacheca(
  circoloId: string,
  callback: (a: Avviso[]) => void,
  onErrore?: () => void,
) {
  const q = query(
    collection(db, COLLEZIONE),
    where('circoloId', '==', circoloId),
    where('visibileFinoA', '>=', oggiIso()),
  );
  return onSnapshot(
    q,
    (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as Avviso[]),
    (e) => {
      // ⚠️ Il ramo d'errore non e' cortesia: senza, un indice mancante
      // o un permesso negato lasciavano la pagina in caricamento per
      // sempre, senza una riga in console e senza niente a schermo.
      console.warn('Ascolto bacheca interrotto:', (e as any)?.message ?? e);
      onErrore?.();
    },
  );
}

// ---- Quello che vede l'Admin ----
// Tutto, scaduti compresi: e' l'archivio da cui si ripesca la
// "chiusura di Ferragosto" l'anno dopo invece di riscriverla.
export function ascoltaBachecaAdmin(
  circoloId: string,
  callback: (a: Avviso[]) => void,
  onErrore?: () => void,
) {
  const q = query(collection(db, COLLEZIONE), where('circoloId', '==', circoloId));
  return onSnapshot(
    q,
    (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as Avviso[]),
    (e) => {
      console.warn('Ascolto archivio bacheca interrotto:', (e as any)?.message ?? e);
      onErrore?.();
    },
  );
}

// ---- I due segni di lettura ----
//
// Stanno sul profilo di chi guarda, in due mappe per circolo. Non e'
// un dettaglio: e' cio' che permette di non scrivere NIENTE quando si
// pubblica. Vedi il commento lungo in bacheca.ts.
//
// La scrittura fallisce in silenzio di proposito: e' un segnalibro,
// non un dato. Se non passa, il pallino resta acceso un momento in
// piu' — nessuno se ne accorge — mentre un errore a schermo su un
// gesto che l'utente non ha nemmeno fatto sarebbe incomprensibile.
export async function segnaBachecaLetta(
  uid: string, circoloId: string, istanteMs: number,
): Promise<void> {
  if (!uid || !circoloId || istanteMs <= 0) return;
  try {
    await updateDoc(doc(db, 'utenti', uid), {
      [`bachecaLettaAlMs.${circoloId}`]: istanteMs,
    });
  } catch (e) {
    console.warn('Segno di lettura della bacheca non salvato:', (e as any)?.message ?? e);
  }
}

export async function spegniAvvisoHome(
  uid: string, circoloId: string, istanteMs: number,
): Promise<void> {
  if (!uid || !circoloId || istanteMs <= 0) return;
  try {
    await updateDoc(doc(db, 'utenti', uid), {
      [`bachecaHomeSpentaAlMs.${circoloId}`]: istanteMs,
    });
  } catch (e) {
    console.warn('Spegnimento della card bacheca non salvato:', (e as any)?.message ?? e);
  }
}
