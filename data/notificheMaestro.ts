// ============================================================
// NOTIFICHE MAESTRO — collezione parallela a "notifiche" (socio),
// separata per tenere semplici le regole di sicurezza (un maestro
// legge solo le proprie, identificate da maestri/{uid} e non da
// utenti/{uid}).
// ============================================================

import { collection, doc, addDoc, updateDoc, onSnapshot, query, where, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';

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

// ⚠️ Dal 22 agosto 2026 questa scrittura fa squillare il telefono del
// Maestro: `pushDaAvvisoMaestro` ascolta la creazione di questi
// documenti. `categoria` distingue le lezioni (accese di partenza) dai
// messaggi delle loro chat ('chat', spenta di partenza).
// ⚠️ FILE GEMELLO, allineato a racket-fever/data/notificheMaestro.ts.
export async function creaNotificaMaestro(
  maestroId: string, testo: string, circoloId: string,
  categoria?: 'lezioni' | 'chat',
  // ⚠️ PORTATI DALL'APP IL 24 AGOSTO 2026: qui mancavano tutti e tre, e
  // il piu' importante e' il terzo.
  //
  // `richiestaId` dice DOVE PORTARE il Maestro quando tocca la notifica
  // — la chat con l'allievo. `cardId` dice DI QUALE LEZIONE si parla, e
  // serve al server per far sparire l'avviso il giorno che quella
  // lezione viene annullata.
  //
  // ⚠️ `motivo` non e' cosmetico. La pulizia lato server tiene in vita
  // solo gli avvisi con motivo 'annullamento' o 'modifica': un avviso
  // di cancellazione scritto dal sito senza questo campo veniva
  // spazzato via dalla stessa cancellazione che lo aveva generato, e
  // nel frattempo arrivava al Maestro con la faccia grigia «circolo»
  // invece dell'ambra che fa saltare all'occhio.
  richiestaId?: string | null,
  cardId?: string | null,
  motivo?: 'annullamento' | 'modifica',
) {
  // ⚠️ SI RINUNCIA ALL'AVVISO PIUTTOSTO CHE SCRIVERLO SENZA CIRCOLO.
  // Prima il campo si aggiungeva "se c'era", ed era pure facoltativo
  // nella firma. Un avviso senza non e' solo incompleto: e' spazzatura
  // permanente. Tutte le regole che permettono di cancellarlo dal lato
  // circolo passano da quel campo, quindi un documento nato senza non
  // lo puo' piu' togliere nessuno — nemmeno il Super Admin — e lo si
  // continua a pagare per sempre. Adesso le regole lo pretendono.
  if (!circoloId) {
    console.warn('Avviso al Maestro non inviato: manca il circolo.');
    return;
  }
  await addDoc(collection(db, 'notifiche_maestro'), {
    maestroId, testo, letta: false, circoloId,
    ...(categoria ? { categoria } : {}),
    ...(richiestaId ? { richiestaId } : {}),
    ...(cardId ? { cardId } : {}),
    ...(motivo ? { motivo } : {}),
    ...(auth.currentUser?.uid ? { origineUid: auth.currentUser.uid } : {}),
    creataIl: serverTimestamp(),
  });
}

export async function segnaComeLettaMaestro(id: string) {
  await updateDoc(doc(db, 'notifiche_maestro', id), { letta: true });
}
