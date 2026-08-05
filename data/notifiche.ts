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
  circoloId?: string;      // circolo di provenienza: l'avviso si vede solo lì
  globale?: boolean;       // vero = si vede in qualsiasi circolo
  creataIl?: { seconds: number };
}

// circoloId: da quale circolo parte l'avviso. Va indicato quando chi
// scrive NON e' del circolo d'origine del destinatario — ad esempio
// l'admin che approva un Ospite tesserato altrove. Senza, le regole
// non avrebbero modo di autorizzare la scrittura.
// globale: avviso che deve raggiungere l'utente in QUALSIASI circolo
// stia guardando. Serve per l'approvazione come Ospite: l'utente non
// e' ancora nel circolo che lo ha approvato, quindi un avviso legato
// a quel circolo non lo vedrebbe mai.
export async function creaNotifica(
  utenteId: string,
  testo: string,
  tipo?: 'lezione',
  circoloId?: string,
  globale?: boolean
): Promise<void> {
  await addDoc(collection(db, 'notifiche'), {
    utenteId,
    testo,
    letta: false,
    tipo: tipo ?? null,
    ...(circoloId ? { circoloId } : {}),
    ...(globale ? { globale: true } : {}),
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
