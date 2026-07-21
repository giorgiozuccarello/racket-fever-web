// ============================================================
// DISPONIBILITÀ MAESTRO — slot che un Maestro marca come "libero
// per lezione" su uno slot altrimenti libero della griglia.
// Più maestri possono segnare disponibilità sullo stesso slot: il
// socio sceglie con chi fare lezione. Appena lo slot viene prenotato
// (da chiunque, per una lezione), TUTTE le disponibilità su quello
// slot esatto vengono rimosse: non ha più senso offrirlo, il campo
// è occupato.
// ============================================================

import {
  collection, doc, addDoc, deleteDoc, getDocs, writeBatch, onSnapshot, query, where,
} from 'firebase/firestore';
import { db } from '../lib/firebase';

export interface DisponibilitaMaestro {
  id: string;
  circoloId: string;
  maestroId: string;
  maestroNome: string;
  maestroCognome: string;
  campoId: string;
  campoNome: string;
  data: string;
  orario: string;
}

export function ascoltaDisponibilitaCircolo(
  circoloId: string, callback: (d: DisponibilitaMaestro[]) => void
) {
  const q = query(collection(db, 'disponibilita_maestro'), where('circoloId', '==', circoloId));
  return onSnapshot(
    q,
    (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as DisponibilitaMaestro[]),
    (errore) => console.warn('Ascolto disponibilità interrotto:', errore?.message ?? errore)
  );
}

export async function aggiungiDisponibilita(dati: Omit<DisponibilitaMaestro, 'id'>) {
  await addDoc(collection(db, 'disponibilita_maestro'), dati);
}

export async function rimuoviDisponibilita(id: string) {
  await deleteDoc(doc(db, 'disponibilita_maestro', id));
}

export async function rimuoviDisponibilitaPerSlot(
  circoloId: string, campoId: string, data: string, orario: string
) {
  const q = query(
    collection(db, 'disponibilita_maestro'),
    where('circoloId', '==', circoloId), where('campoId', '==', campoId),
    where('data', '==', data), where('orario', '==', orario)
  );
  const istantanea = await getDocs(q);
  if (istantanea.empty) return;
  const batch = writeBatch(db);
  istantanea.docs.forEach((d) => batch.delete(d.ref));
  await batch.commit();
}
