// ============================================================
// NOTIFICHE IN-APP — E DA QUI PARTONO ANCHE LE PUSH.
//
// ⚠️ NON SONO PIU' UN «SOSTITUTO PROVVISORIO DI EMAIL E PUSH REALI»,
// come diceva questa intestazione fino al 22 agosto 2026: ne sono la
// SORGENTE. Una Cloud Function (`pushDaAvviso`) ascolta la creazione di
// ogni documento in questa collezione e manda la notifica al telefono
// del destinatario. Un Admin che da questa dashboard web annulla una
// prenotazione non scrive piu' soltanto una riga in Home: fa squillare
// il telefono di un socio.
//
// ⚠️ QUATTRO COSE QUI NON SI POSSONO SCRIVERE, e valgono anche per
// questa dashboard perche' le regole non distinguono un browser da un
// telefono: `categoria: 'promemoria'` (scavalca il silenzio notturno),
// `categoria: 'bacheca'` (si comprerebbe il titolo «Avviso del
// circolo»), `senzaPush` (zittirebbe l'avviso di un altro) e un
// `origineUid` che non sia il proprio. Gli avvisi di bacheca veri li
// manda la Cloud Function `avvisaBacheca`, che le regole le scavalca.
//
// ⚠️ FILE GEMELLO, allineato a racket-fever/data/notifiche.ts. La firma
// deve restare la stessa nei due progetti: e' lo stesso documento che
// finisce nella stessa collezione, letto dalla stessa Function.
// ============================================================

import {
  collection, addDoc, doc, updateDoc, onSnapshot, query, where, serverTimestamp,
} from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { CategoriaNotifica } from './preferenzeNotifiche';

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
// ⚠️ I DUE PARAMETRI IN FONDO SERVONO ALLA PUSH, non all'avviso in
// Home. `categoria` decide sotto quale interruttore cade la notifica
// nelle impostazioni del socio e su quale canale Android arriva; chi non
// la dichiara la lascia indovinare al server, che la ricava da `tipo`.
// `origineUid` e' chi ha provocato l'avviso, e si ricava da solo: senza,
// l'Admin che annulla la PROPRIA prenotazione — stesso codice di quando
// annulla quella di un socio — si manderebbe una notifica da se'.
//
// ⚠️ La posizione dei parametri e' quella del gemello dell'app, che ne
// ha due in mezzo (richiestaId, motivo) che qui non servono ma che
// vanno lasciati al loro posto: e' la stessa funzione vista da due
// progetti, e due firme diverse sono il modo piu' rapido per scrivere
// un giorno la categoria dentro il campo del motivo.
export async function creaNotifica(
  utenteId: string,
  testo: string,
  tipo?: 'lezione',
  circoloId?: string,
  globale?: boolean,
  richiestaId?: string,
  motivo?: 'messaggio',
  categoria?: CategoriaNotifica,
  origineUid?: string | null,
): Promise<void> {
  const origine = origineUid !== undefined ? origineUid : (auth.currentUser?.uid ?? null);
  await addDoc(collection(db, 'notifiche'), {
    utenteId,
    testo,
    letta: false,
    tipo: tipo ?? null,
    ...(circoloId ? { circoloId } : {}),
    ...(globale ? { globale: true } : {}),
    ...(richiestaId ? { richiestaId } : {}),
    ...(motivo ? { motivo } : {}),
    ...(categoria ? { categoria } : {}),
    ...(origine ? { origineUid: origine } : {}),
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
