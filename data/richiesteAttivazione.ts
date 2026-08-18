// ============================================================
// RICHIESTE ATTIVAZIONE — i lead inviati dal form pubblico del
// sito istituzionale. Visibili solo al Super Admin.
// ============================================================

import { collection, onSnapshot, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

export interface RichiestaAttivazione {
  id: string;
  nomeCircolo: string;
  // Chi ha scritto, e con che ruolo. Da quando il modulo non ha piu'
  // testo libero, sono questi due a dirci con chi stiamo parlando.
  referente?: string;
  ruolo?: string;
  regione?: string;
  provincia?: string;
  email: string;
  telefono?: string;
  contattami?: boolean;
  // ⚠️ Campi VECCHI, delle richieste arrivate prima che il modulo
  // diventasse a scelte. Non si scrivono piu': si leggono soltanto,
  // per non far sparire quello che e' gia' arrivato.
  citta?: string;
  messaggio?: string;
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

// ⚠️ Serve al Super Admin per buttare via lo spam, ed e' l'unico modo:
// una richiesta arrivata da un modulo pubblico non la puo' togliere chi
// l'ha mandata, perche' non ha un account. Le regole lo permettono
// gia' solo al Super Admin.
export async function eliminaRichiesta(id: string): Promise<void> {
  await deleteDoc(doc(db, 'richieste_attivazione', id));
}
