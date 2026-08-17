// ============================================================
// BANNER DI RETE — lettura e scrittura.
//
// La collezione e' `banner_rete`, in cima all'albero e non sotto il
// circolo: un banner non appartiene a nessun circolo, e' venduto a una
// ZONA. Chi lo legge sono tutti i soci di tutti i circoli coperti; chi
// lo scrive e' solo il Super Admin, e a imporlo sono le regole.
// ============================================================

import {
  collection, doc, addDoc, setDoc, updateDoc, deleteDoc, onSnapshot, query, where, serverTimestamp,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import {
  BannerRete, MAX_BANNER_RETE, COLLEZIONE_NOTE_RETE, bannerInCorso, zoneDelCircolo,
} from './bannerRete';
import { oggiIso } from './giorni';

const COLLEZIONE = 'banner_rete';

function mappa(d: any): BannerRete {
  return { id: d.id, ...(d.data() as any) } as BannerRete;
}

// I banner che valgono per QUESTO circolo, gia' filtrati per periodo e
// gia' tagliati al massimo.
//
// ⚠️ UNA QUERY SOLA, su `zone`. Le tre voci che riguardano il circolo
// — l'Italia, la sua regione, la sua provincia — si cercano insieme
// con array-contains-any: senza, sarebbero tre ascolti per ogni socio
// che apre la Home, e tre indici da mantenere.
//
// ⚠️ Il periodo si filtra QUI e non nella query. Sarebbe stato un
// secondo vincolo su un campo diverso, cioe' un indice composto in
// piu' per una manciata di documenti: si legge tutto e si scarta al
// volo quello che non e' in corso.
export function ascoltaBannerRete(
  circolo: { regione?: string | null; provincia?: string | null } | null | undefined,
  callback: (banner: BannerRete[]) => void,
  onErrore?: (e: unknown) => void,
): () => void {
  const voci = zoneDelCircolo(circolo);
  const q = query(collection(db, COLLEZIONE), where('zone', 'array-contains-any', voci));
  return onSnapshot(
    q,
    (snap) => {
      const oggi = oggiIso();
      const vivi = snap.docs
        .map(mappa)
        .filter((b) => !!b.immagineUrl)
        // ⚠️ Una durata a zero o mancante FERMEREBBE la fascia: il timer
        // si spegne su una durata non positiva, e da li' non riparte —
        // un solo banner scritto male, e la rotazione di quel circolo
        // resta inchiodata. Meglio non mostrarlo affatto.
        .filter((b) => typeof b.durata === 'number' && b.durata > 0)
        .filter((b) => bannerInCorso(b, oggi))
        // ⚠️ L'ordine deve essere STABILE, o la fascia rimescolerebbe
        // gli sponsor a ogni ridisegno. Il piu' vecchio per primo: chi
        // ha comprato prima sta davanti, ed e' anche l'unico ordine
        // che non cambia da solo.
        .sort((a, b) => (a.creatoIlMs ?? 0) - (b.creatoIlMs ?? 0));
      callback(vivi.slice(0, MAX_BANNER_RETE));
    },
    (e) => { console.warn('Banner di rete non letti:', e); onErrore?.(e); },
  );
}

// Tutti quanti, per il pannello Super Admin: anche gli scaduti e
// quelli che non sono ancora cominciati, che sono proprio quelli che
// deve poter sistemare.
export function ascoltaTuttiBannerRete(
  callback: (banner: BannerRete[]) => void,
  onErrore?: (e: unknown) => void,
): () => void {
  return onSnapshot(
    collection(db, COLLEZIONE),
    (snap) => callback(snap.docs.map(mappa).sort((a, b) => (b.creatoIlMs ?? 0) - (a.creatoIlMs ?? 0))),
    (e) => { console.warn('Banner di rete non letti:', e); onErrore?.(e); },
  );
}

export type DatiBannerRete = Omit<BannerRete, 'id' | 'creatoIlMs'>;

// ============================================================
// LE NOTE INTERNE — sponsor, importo, referente.
//
// In una collezione a parte perche' il documento del banner lo legge
// ogni socio: vedi il commento in data/bannerRete.ts. L'identificativo
// della nota E' quello del banner, cosi' non serve nessun collegamento
// e non si possono disallineare.
// ============================================================
export function ascoltaNoteRete(
  callback: (note: Record<string, string>) => void,
): () => void {
  return onSnapshot(
    collection(db, COLLEZIONE_NOTE_RETE),
    (snap) => {
      const fuori: Record<string, string> = {};
      snap.docs.forEach((d) => { fuori[d.id] = (d.data() as any)?.testo ?? ''; });
      callback(fuori);
    },
    // Un Admin che aprisse per sbaglio questa pagina non ha il permesso:
    // e' giusto che non veda le note, e non e' un guasto da annunciare.
    (e) => console.warn('Note dei banner non lette:', e),
  );
}

export async function scriviNotaRete(bannerId: string, testo: string): Promise<void> {
  await setDoc(doc(db, COLLEZIONE_NOTE_RETE, bannerId), { testo: testo.trim() });
}

export async function rimuoviNotaRete(bannerId: string): Promise<void> {
  try { await deleteDoc(doc(db, COLLEZIONE_NOTE_RETE, bannerId)); }
  catch { /* la nota non c'era: il banner se ne va lo stesso */ }
}

export async function creaBannerRete(dati: DatiBannerRete): Promise<string> {
  const rif = await addDoc(collection(db, COLLEZIONE), {
    ...ripulisci(dati),
    creatoIlMs: Date.now(),
    creatoIl: serverTimestamp(),
  });
  return rif.id;
}

export async function aggiornaBannerRete(id: string, dati: Partial<DatiBannerRete>): Promise<void> {
  await updateDoc(doc(db, COLLEZIONE, id), ripulisci(dati));
}

export async function rimuoviBannerRete(id: string): Promise<void> {
  await deleteDoc(doc(db, COLLEZIONE, id));
}

// Firestore rifiuta l'INTERA scrittura se trova un solo campo a
// "undefined". Qui i facoltativi sono quattro: le due date, la nota e
// gli elenchi di zona.
function ripulisci<T extends Record<string, unknown>>(dati: T): Record<string, unknown> {
  const fuori: Record<string, unknown> = {};
  Object.entries(dati).forEach(([chiave, valore]) => {
    if (valore === undefined) return;
    fuori[chiave] = typeof valore === 'string' ? valore.trim() : valore;
  });
  return fuori;
}
