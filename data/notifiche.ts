// ============================================================
// NOTIFICHE IN-APP
// Sostituto provvisorio di email/push reali (che richiederebbero
// un backend dedicato). Usate oggi solo per avvisare un socio
// quando l'Admin Circolo annulla una sua prenotazione.
// ============================================================

import {
  collection, addDoc, doc, updateDoc, onSnapshot, query, where, serverTimestamp,
} from 'firebase/firestore';
import { db } from '../lib/firebase';

export interface Notifica {
  id: string;
  testo: string;
  letta: boolean;
  tipo?: 'lezione' | null; // presente = stile visivo distinto (avviso di lezione)
  creataIl?: { seconds: number };
}

export async function creaNotifica(utenteId: string, testo: string, tipo?: 'lezione'): Promise<void> {
  await addDoc(collection(db, 'notifiche'), {
    utenteId,
    testo,
    letta: false,
    tipo: tipo ?? null,
    creataIl: serverTimestamp(),
  });
}

export function ascoltaNotifiche(uid: string, callback: (n: Notifica[]) => void) {
  const q = query(collection(db, 'notifiche'), where('utenteId', '==', uid));
  return onSnapshot(
    q,
    (snap) => {
      const elenco = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as Notifica[];
      elenco.sort((a, b) => (b.creataIl?.seconds ?? 0) - (a.creataIl?.seconds ?? 0));
      callback(elenco);
    },
    (errore) => console.warn('Ascolto notifiche interrotto (probabile logout):', errore?.message ?? errore)
  );
}

export async function segnaComeLetta(id: string): Promise<void> {
  await updateDoc(doc(db, 'notifiche', id), { letta: true });
}
