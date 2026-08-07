// ============================================================
// NOTIFICHE MAESTRO — collezione parallela a "notifiche" (socio),
// separata per tenere semplici le regole di sicurezza (un maestro
// legge solo le proprie, identificate da maestri/{uid} e non da
// utenti/{uid}).
// ============================================================

import { collection, doc, addDoc, updateDoc, onSnapshot, query, where, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';

export interface NotificaMaestro {
  id: string;
  maestroId: string;
  // Circolo da cui parte l'avviso. Non serve alla lettura (un maestro
  // appartiene a un solo circolo), ma senza di esso l'Admin non ha modo
  // di ritrovare questi avvisi e il "Reset Completo Soci" li lascia
  // indietro — erano gli unici a sopravvivere al reset.
  circoloId?: string;
  testo: string;
  letta: boolean;
  creataIl?: { seconds: number };
}

export function ascoltaNotificheMaestro(maestroId: string, callback: (n: NotificaMaestro[]) => void) {
  const q = query(collection(db, 'notifiche_maestro'), where('maestroId', '==', maestroId));
  return onSnapshot(
    q,
    (snap) => {
      const elenco = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as NotificaMaestro[];
      elenco.sort((a, b) => (b.creataIl?.seconds ?? 0) - (a.creataIl?.seconds ?? 0));
      callback(elenco);
    },
    (errore) => console.warn('Ascolto notifiche maestro interrotto:', errore?.message ?? errore)
  );
}

export async function creaNotificaMaestro(maestroId: string, testo: string, circoloId?: string) {
  await addDoc(collection(db, 'notifiche_maestro'), {
    maestroId, testo, letta: false,
    ...(circoloId ? { circoloId } : {}),
    creataIl: serverTimestamp(),
  });
}

export async function segnaComeLettaMaestro(id: string) {
  await updateDoc(doc(db, 'notifiche_maestro', id), { letta: true });
}
