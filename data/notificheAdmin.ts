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
//
// ⚠️ QUESTI AVVISI NON DIVENTANO PUSH, e va detto perche' gli altri due
// si'. Dal 22 agosto 2026 una Cloud Function manda la notifica al
// telefono per ogni documento scritto in "notifiche" (socio) e in
// "notifiche_maestro"; questa collezione no, ed e' una conseguenza di
// com'e' fatta: il destinatario e' un circolo, non una persona, e un
// telefono a cui mandare non c'e'. Per farlo bisognerebbe risolvere
// l'elenco dei responsabili e dei collaboratori di quel circolo e
// mandare a tutti — e per il Collaboratore, che e' un accesso con
// password condivisa senza nome, «tutti» non vuol nemmeno dire una
// persona precisa.
//
// La conseguenza pratica, per chi legge: l'Admin scopre una richiesta
// di tessera quando apre la dashboard, non quando arriva. Se un
// giorno la si vuole anche sul telefono, il posto e' una Function che
// ascolta questa collezione e risolve i destinatari — non una riga in
// piu' qui.
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
