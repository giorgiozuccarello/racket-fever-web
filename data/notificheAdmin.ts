// ============================================================
// NOTIFICHE ADMIN — collezione parallela a "notifiche" (socio) e
// "notifiche_maestro".
//
// Differenza importante: queste NON sono indirizzate a una persona
// ma al CIRCOLO. Un circolo può avere più responsabili e più
// collaboratori con gli stessi permessi: se l'avviso fosse legato a
// un singolo uid, chi apre la dashboard per secondo non lo vedrebbe
// mai. Indirizzandolo al circolo, lo vedono tutti quelli che ne
// hanno l'accesso — e chi lo archivia lo archivia per tutti.
// ============================================================

import { collection, doc, addDoc, updateDoc, onSnapshot, query, where, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';

export interface NotificaAdmin {
  id: string;
  circoloId: string;
  testo: string;
  tipo?: 'richiesta_tessera' | 'generico';
  letta: boolean;
  creataIl?: { seconds: number };
}

export function ascoltaNotificheAdmin(circoloId: string, callback: (n: NotificaAdmin[]) => void) {
  const q = query(collection(db, 'notifiche_admin'), where('circoloId', '==', circoloId));
  return onSnapshot(
    q,
    (snap) => {
      const elenco = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as NotificaAdmin[];
      elenco.sort((a, b) => (b.creataIl?.seconds ?? 0) - (a.creataIl?.seconds ?? 0));
      callback(elenco);
    },
    (errore) => console.warn('Ascolto notifiche admin interrotto:', errore?.message ?? errore)
  );
}

export async function creaNotificaAdmin(
  circoloId: string,
  testo: string,
  tipo: NotificaAdmin['tipo'] = 'generico'
) {
  await addDoc(collection(db, 'notifiche_admin'), {
    circoloId, testo, tipo, letta: false, creataIl: serverTimestamp(),
  });
}

export async function segnaComeLettaAdmin(id: string) {
  await updateDoc(doc(db, 'notifiche_admin', id), { letta: true });
}
