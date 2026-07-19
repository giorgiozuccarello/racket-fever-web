// ============================================================
// RICHIESTE ATTIVAZIONE — i lead inviati dal form pubblico del
// sito istituzionale. Visibili solo al Super Admin.
// ============================================================

import { collection, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

export interface RichiestaAttivazione {
  id: string;
  nomeCircolo: string;
  citta: string;
  email: string;
  messaggio: string;
  stato: string;
  creataIl?: { seconds: number };
}

export function ascoltaRichieste(callback: (r: RichiestaAttivazione[]) => void) {
  return onSnapshot(
    collection(db, 'richieste_attivazione'),
    (snap) => {
      const elenco = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as RichiestaAttivazione[];
      elenco.sort((a, b) => (b.creataIl?.seconds ?? 0) - (a.creataIl?.seconds ?? 0));
      callback(elenco);
    },
    (errore) => console.warn('Ascolto richieste interrotto:', errore?.message ?? errore)
  );
}

export async function aggiornaStatoRichiesta(id: string, stato: string) {
  await updateDoc(doc(db, 'richieste_attivazione', id), { stato });
}
