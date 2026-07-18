// ============================================================
// REPOSITORY CIRCOLI — operazioni Firestore su circoli, campi
// (sottocollezione, con prezzo incorporato) e blocchi orari.
//
// Ogni ascolto (onSnapshot) gestisce esplicitamente gli errori:
// se un ascolto resta attivo dopo un logout o un cambio di utente
// (es. schermata precedente non ancora smontata), un eventuale
// errore di permessi viene solo loggato, non mostrato come crash.
// ============================================================

import {
  collection, doc, getDoc, onSnapshot, updateDoc, addDoc, deleteDoc, query, orderBy,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Circolo, Campo, Blocco } from './circoli';

function suUnsub(errore: any) {
  console.warn('Ascolto Firestore interrotto (probabile logout):', errore?.message ?? errore);
}

// ---------------- Circoli ----------------

export async function leggiCircolo(circoloId: string): Promise<Circolo | null> {
  const snap = await getDoc(doc(db, 'circoli', circoloId));
  return snap.exists() ? ({ id: snap.id, ...(snap.data() as any) } as Circolo) : null;
}

export function ascoltaCircoli(callback: (circoli: Circolo[]) => void) {
  return onSnapshot(
    collection(db, 'circoli'),
    (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as Circolo[]),
    suUnsub
  );
}

export function ascoltaCircolo(circoloId: string, callback: (c: Circolo | null) => void) {
  return onSnapshot(
    doc(db, 'circoli', circoloId),
    (snap) => callback(snap.exists() ? ({ id: snap.id, ...(snap.data() as any) } as Circolo) : null),
    suUnsub
  );
}

export async function aggiornaCircolo(circoloId: string, dati: Partial<Omit<Circolo, 'id'>>) {
  await updateDoc(doc(db, 'circoli', circoloId), dati as any);
}

// ---------------- Campi (sottocollezione) ----------------

export function ascoltaCampi(circoloId: string, callback: (campi: Campo[]) => void) {
  const q = query(collection(db, 'circoli', circoloId, 'campi'), orderBy('ordine'));
  return onSnapshot(
    q,
    (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as Campo[]),
    suUnsub
  );
}

export async function aggiungiCampo(
  circoloId: string, nome: string, superficie: string, ordine: number
) {
  await addDoc(collection(db, 'circoli', circoloId, 'campi'), {
    nome, superficie, ordine, prezzoOraDefault: null, tariffaSpeciale: null,
  });
}

export async function rinominaCampo(
  circoloId: string, campoId: string, nome: string, superficie: string
) {
  await updateDoc(doc(db, 'circoli', circoloId, 'campi', campoId), { nome, superficie });
}

export async function aggiornaCampo(
  circoloId: string, campoId: string, dati: Partial<Omit<Campo, 'id'>>
) {
  await updateDoc(doc(db, 'circoli', circoloId, 'campi', campoId), dati as any);
}

export async function rimuoviCampo(circoloId: string, campoId: string) {
  await deleteDoc(doc(db, 'circoli', circoloId, 'campi', campoId));
}

// ---------------- Blocchi orari (sottocollezione) ----------------

export function ascoltaBlocchi(circoloId: string, callback: (blocchi: Blocco[]) => void) {
  return onSnapshot(
    collection(db, 'circoli', circoloId, 'blocchi'),
    (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as Blocco[]),
    suUnsub
  );
}

export async function aggiungiBlocco(circoloId: string, blocco: Omit<Blocco, 'id'>) {
  await addDoc(collection(db, 'circoli', circoloId, 'blocchi'), blocco);
}

export async function rimuoviBlocco(circoloId: string, bloccoId: string) {
  await deleteDoc(doc(db, 'circoli', circoloId, 'blocchi', bloccoId));
}
