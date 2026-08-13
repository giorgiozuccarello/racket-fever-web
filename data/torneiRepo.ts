// ============================================================
// TORNEI — lettura e scrittura.
//
// La collezione e' in cima all'albero e non dentro il circolo, ed e'
// voluto: un torneo non appartiene solo a chi lo pubblica, deve poter
// comparire nella bacheca di circoli che con quel circolo non hanno
// niente a che vedere. Sotto /circoli/{id}/tornei sarebbe stato
// impossibile leggerli tutti insieme senza sapere prima l'elenco dei
// circoli, e senza un permesso per ciascuno.
// ============================================================

import {
  collection, doc, addDoc, updateDoc, deleteDoc, onSnapshot, query, where,
  serverTimestamp, arrayUnion, arrayRemove,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Torneo, TUTTA_ITALIA, ultimoGiornoVisibile, oggiIso } from './tornei';

const COLLEZIONE = 'tornei';

export type DatiTorneo = Omit<Torneo, 'id' | 'creatoIlMs'>;

export async function creaTorneo(dati: DatiTorneo): Promise<string> {
  const rif = await addDoc(collection(db, COLLEZIONE), {
    ...ripulisci(dati),
    // ⚠️ Si scrive alla creazione e si riscrive a ogni correzione delle
    // date: e' il campo su cui Firestore filtra, e se restasse indietro
    // un torneo sparirebbe (o resterebbe) nel giorno sbagliato.
    visibileFinoA: ultimoGiornoVisibile(dati),
    creatoIlMs: Date.now(),
    creatoIl: serverTimestamp(),
  });
  return rif.id;
}

export async function aggiornaTorneo(id: string, dati: Partial<DatiTorneo>): Promise<void> {
  const pulito: Record<string, any> = ripulisci(dati);
  // Toccando le date va rifatto anche il giorno di scadenza, o il
  // torneo resterebbe visibile secondo le date di prima.
  if (dati.dataInizio) {
    pulito.visibileFinoA = ultimoGiornoVisibile({ dataInizio: dati.dataInizio, dataFine: dati.dataFine });
  }
  await updateDoc(doc(db, COLLEZIONE, id), pulito);
}

export async function rimuoviTorneo(id: string): Promise<void> {
  await deleteDoc(doc(db, COLLEZIONE, id));
}

// ⚠️ Firestore rifiuta l'intera scrittura se trova un solo campo a
// "undefined", e i campi facoltativi di un torneo sono quattro: la
// data di fine, la scadenza, il link e le note. E' lo stesso inciampo
// che aveva gia' bloccato la conferma delle lezioni, con l'errore
// inghiottito da un giro asincrono e nessuno che capiva perche' la
// card non compariva.
function ripulisci<T extends Record<string, any>>(dati: T): T {
  const fuori: Record<string, any> = {};
  for (const [k, v] of Object.entries(dati)) {
    if (v === undefined) continue;
    fuori[k] = typeof v === 'string' ? v.trim() : v;
  }
  return fuori as T;
}

function mappa(d: any): Torneo {
  return { id: d.id, ...(d.data() as any) } as Torneo;
}

// I tornei che si vedono in una regione: quelli che l'hanno spuntata
// piu' quelli a copertura nazionale.
// ⚠️ Una interrogazione sola con 'array-contains-any' e non due unite a
// mano: il segnaposto nazionale sta nello stesso elenco delle regioni
// proprio per rendere possibile questa forma.
// ⚠️ Serve un indice composito (regioni + visibileFinoA): sta in
// firestore.indexes.json e va pubblicato, o Firestore rifiuta la
// lettura e la bacheca resta vuota.
export function ascoltaTorneiRegione(
  regione: string | null | undefined,
  callback: (t: Torneo[]) => void,
  onErrore?: () => void,
) {
  // ⚠️ Nessuna regione vuol dire TUTTA ITALIA, cioe' nessun filtro
  // sulle regioni. Filtrare sul solo segnaposto nazionale — che e'
  // quello che faceva prima — dava l'effetto opposto a quello che il
  // socio si aspetta: toccava "Tutta Italia" per allargare e si
  // ritrovava con meno tornei di prima, spesso zero.
  //
  // ⚠️ E in tutti e due i casi si filtra su `visibileFinoA`: senza,
  // ogni apertura della scheda si portava a casa TUTTI i tornei mai
  // pubblicati nella regione — l'archivio non si cancella mai — per
  // mostrarne dieci.
  const oggi = oggiIso();
  const q = regione
    ? query(
      collection(db, COLLEZIONE),
      where('regioni', 'array-contains-any', [regione, TUTTA_ITALIA]),
      where('visibileFinoA', '>=', oggi),
    )
    : query(collection(db, COLLEZIONE), where('visibileFinoA', '>=', oggi));
  return onSnapshot(
    q,
    (snap) => callback(snap.docs.map(mappa)),
    (e) => {
      console.warn('Ascolto tornei interrotto:', e?.message ?? e);
      onErrore?.();
    },
  );
}

// I tornei pubblicati da un circolo. Serve due volte: all'Admin per il
// suo elenco, e alla bacheca del socio — che i tornei di casa propria
// deve vederli SEMPRE, anche se chi li ha pubblicati si e' dimenticato
// di spuntare la propria regione.
export function ascoltaTorneiCircolo(
  circoloId: string,
  callback: (t: Torneo[]) => void,
  onErrore?: () => void,
  // L'Admin vuole vedere anche l'archivio — e' da li' che ripesca il
  // torneo dell'anno prima. Il socio no: a lui bastano quelli vivi.
  soloVisibili = false,
) {
  const q = soloVisibili
    ? query(
      collection(db, COLLEZIONE),
      where('circoloId', '==', circoloId),
      where('visibileFinoA', '>=', oggiIso()),
    )
    : query(collection(db, COLLEZIONE), where('circoloId', '==', circoloId));
  return onSnapshot(
    q,
    (snap) => callback(snap.docs.map(mappa)),
    (e) => {
      console.warn('Ascolto tornei del circolo interrotto:', e?.message ?? e);
      onErrore?.();
    },
  );
}

// ---- In evidenza ----
// ⚠️ Sta sul profilo di CHI GUARDA, non sul torneo. E' una scelta
// personale: se stesse sul torneo, il primo socio che lo mette in
// evidenza lo metterebbe in cima anche a tutti gli altri.
export async function impostaTorneoInEvidenza(
  utenteId: string, torneoId: string, acceso: boolean,
): Promise<void> {
  await updateDoc(doc(db, 'utenti', utenteId), {
    torneiInEvidenza: acceso ? arrayUnion(torneoId) : arrayRemove(torneoId),
  });
}
