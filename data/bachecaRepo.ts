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
  serverTimestamp, runTransaction,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Avviso } from './bacheca';
import { oggiIso } from './giorni';

const COLLEZIONE = 'avvisi';

export type DatiAvviso = Omit<Avviso, 'id' | 'creatoIlMs'>;

export async function pubblicaAvviso(dati: DatiAvviso): Promise<string> {
  const rif = await addDoc(collection(db, COLLEZIONE), {
    ...ripulisci(dati),
    // ⚠️ UN AVVISO NUOVO NASCE IN CIMA, e ci vuole un numero per dirlo.
    // Chi non ha `ordine` va in FONDO — e' la regola che tiene al loro
    // posto gli avvisi appesi prima che l'ordine esistesse. Ma appena
    // il circolo usa una freccia tutti gli altri un ordine ce l'hanno,
    // e da quel momento ogni avviso appena scritto sarebbe finito
    // ultimo: la card in Home avrebbe annunciato «c'e' un nuovo
    // avviso» e il socio se lo sarebbe trovato in basso a destra,
    // sotto roba di un mese fa, con il posto d'onore occupato da un
    // foglio vecchio.
    //
    // Negativo perche' `spostaAvviso` rinumera sempre da zero in su:
    // qualunque negativo sta prima di qualunque ordine gia' scritto. E
    // piu' e' recente, piu' e' negativo — cosi' fra due avvisi nuovi
    // vince comunque l'ultimo arrivato. Al primo riordino successivo
    // il numero si normalizza da solo.
    ordine: -Date.now(),
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

// ============================================================
// L'ORDINE DEI FOGLI.
//
// ⚠️ QUI NON C'E' UN ARRAY DA RIORDINARE, e questa e' la differenza
// con i banner degli sponsor, da cui il gesto e' copiato. Gli sponsor
// sono un elenco dentro UN documento: si legge, si scambiano due
// caselle, si riscrive. Gli avvisi sono N documenti separati, e
// l'ordine e' un numero su ciascuno.
//
// Quindi non si scambiano due numeri: si RINUMERA tutto l'elenco da
// zero. Sembra piu' lavoro, ed e' l'unica cosa che regge il caso vero:
// in bacheca ci sono avvisi senza `ordine` — appesi prima che
// esistesse — e scambiare due valori mancanti non produce nessun
// ordine. Rinumerando, il primo spostamento sistema anche tutti gli
// altri.
//
// ⚠️ E si scrive SOLO chi cambia davvero: rinumerare venti avvisi a
// ogni freccia sarebbe venti scritture per uno spostamento.
// ============================================================

// Oltre questo non si riordina: sono i fogli appesi di UN circolo, e
// sessanta sono gia' piu' di quanti se ne possano leggere. Il tetto
// esiste perche' la transazione li legge tutti, non per la bacheca.
export const MAX_AVVISI_ORDINABILI = 60;

export async function spostaAvviso(
  idsInOrdine: string[], indice: number, verso: -1 | 1,
): Promise<void> {
  const destinazione = indice + verso;
  if (indice < 0 || indice >= idsInOrdine.length) return;
  if (destinazione < 0 || destinazione >= idsInOrdine.length) return;

  // ⚠️ OLTRE IL TETTO SI DICE, non si tace. L'elenco dell'Admin
  // contiene anche gli avvisi scaduti, che si accumulano: dopo un anno
  // possono essere piu' di sessanta. Uscendo in silenzio, la freccia in
  // fondo all'elenco non avrebbe fatto niente e non avrebbe detto
  // niente — il modo piu' rapido per far credere che il riordino sia
  // rotto.
  if (Math.max(indice, destinazione) >= MAX_AVVISI_ORDINABILI) {
    throw new Error(
      `Si riordina fra i primi ${MAX_AVVISI_ORDINABILI} avvisi. Togli quelli scaduti che non ti servono più.`,
    );
  }
  const ids = idsInOrdine.slice(0, MAX_AVVISI_ORDINABILI);
  if (indice >= ids.length || destinazione >= ids.length) return;

  const daSpostare = ids[indice];
  const conCuiScambiare = ids[destinazione];

  await runTransaction(db, async (tx) => {
    // ⚠️ TUTTE LE LETTURE PRIMA DI OGNI SCRITTURA: una transazione
    // Firestore che legge dopo aver scritto viene rifiutata. E tutte
    // insieme, non in fila indiana: ognuna e' un viaggio fino al
    // server, e sessanta viaggi uno dopo l'altro sono qualche secondo
    // di attesa a ogni freccia.
    const riferimenti = ids.map((id) => doc(db, COLLEZIONE, id));
    const letti = await Promise.all(riferimenti.map((r) => tx.get(r)));

    // Qualcuno puo' aver tolto un avviso mentre questa schermata era
    // aperta. Si rinumera su quelli vivi, non su quelli che c'erano.
    const vivi = ids.filter((_, i) => letti[i].exists());
    const a = vivi.indexOf(daSpostare);
    const b = vivi.indexOf(conCuiScambiare);
    // ⚠️ Si alza, non si esce in silenzio: uscendo, la freccia sembrava
    // semplicemente morta. Qui e' successa una cosa precisa — un altro
    // Admin ha tolto quell'avviso — e va detta, perche' la cura e'
    // ricaricare, non ripremere.
    if (a < 0 || b < 0) {
      throw new Error('Qualcuno ha tolto questo avviso nel frattempo: ricarica l’elenco.');
    }

    const nuovo = [...vivi];
    [nuovo[a], nuovo[b]] = [nuovo[b], nuovo[a]];

    nuovo.forEach((id, posizione) => {
      const letto = letti[ids.indexOf(id)];
      if (letto.get('ordine') === posizione) return;
      tx.update(doc(db, COLLEZIONE, id), { ordine: posizione });
    });
  });
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

// ⚠️ L'ISTANTE BUONO E' QUELLO DEL SERVER, non quello di chi scrive.
// `creatoIlMs` lo mette il telefono o il PC dell'Admin con Date.now(),
// e su tutto quel numero poggiano due cose: l'ordine della griglia e
// il "nuovo" di ogni socio. Con l'orologio indietro di un giorno —
// capita, ed e' invisibile a chi lo ha — l'avviso appena appeso nasce
// gia' piu' vecchio del segno di lettura di tutti: nessun pallino,
// nessuna card in Home, e in fondo alla griglia. Il campo affidabile
// c'era gia' ma non lo leggeva nessuno.
//
// Si tiene comunque `creatoIlMs` come ripiego: finche' la scrittura
// non e' confermata dal server, `creatoIl` arriva nullo — e' la
// compensazione locale di Firestore — e senza il ripiego l'avviso
// appena pubblicato saltava in fondo per un istante.
function conIstante(d: any): Avviso {
  const dati = d.data() as any;
  const dalServer = dati?.creatoIl?.toMillis?.();
  return {
    id: d.id,
    ...dati,
    creatoIlMs: typeof dalServer === 'number' ? dalServer : (dati?.creatoIlMs ?? 0),
  } as Avviso;
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
    (snap) => callback(snap.docs.map(conIstante)),
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
    (snap) => callback(snap.docs.map(conIstante)),
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
