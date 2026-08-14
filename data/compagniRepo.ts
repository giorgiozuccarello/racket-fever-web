// ============================================================
// LISTA COMPAGNI — lettura e scrittura.
//
// La collezione sta in cima all'albero e non dentro un circolo: una
// compagnia lega due PERSONE, e le persone possono essere tesserate in
// circoli diversi — un socio di qui è Ospite altrove. Metterla sotto un
// circolo avrebbe voluto dire duplicarla a ogni tessera.
// ============================================================

import {
  collection, doc, setDoc, updateDoc, deleteDoc, onSnapshot, query, where, getDoc,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Compagnia, idCompagnia, membriDi } from './compagni';

const COLLEZIONE = 'compagnie';

// Manda la richiesta. Se esiste già un documento per questa coppia non
// si sovrascrive: potrebbe essere una compagnia già accettata (e la si
// riporterebbe in attesa) o una richiesta che l'altro ha già mandato a
// me — nel qual caso quello che voglio fare è accettarla, non
// rimandarla indietro.
export async function chiediCompagnia(params: {
  mioUid: string; mioNome: string;
  altroUid: string; altroNome: string;
  circoloId: string;
}): Promise<'inviata' | 'gia_in_lista' | 'gia_chiesta' | 'accettata_la_sua'> {
  const id = idCompagnia(params.mioUid, params.altroUid);
  const rif = doc(db, COLLEZIONE, id);
  const gia = await getDoc(rif);
  if (gia.exists()) {
    const d = gia.data() as Compagnia;
    if (d.stato === 'accettata') return 'gia_in_lista';
    // ⚠️ Chi ha chiesto per primo vince: se l'altro mi aveva già
    // scritto, il mio "chiedi" diventa un "accetto". Senza questo, due
    // persone che si cercano nello stesso momento restavano ognuna in
    // attesa dell'altra, con due richieste che si guardavano.
    if (d.richiedenteId === params.altroUid) {
      await accettaCompagnia(id);
      return 'accettata_la_sua';
    }
    return 'gia_chiesta';
  }
  try {
    await setDoc(rif, {
      membri: membriDi(params.mioUid, params.altroUid),
      stato: 'in_attesa',
      richiedenteId: params.mioUid,
      richiedenteNome: params.mioNome,
      destinatarioId: params.altroUid,
      destinatarioNome: params.altroNome,
      circoloId: params.circoloId,
      creataIlMs: Date.now(),
    });
    return 'inviata';
  } catch (e: any) {
    // ⚠️ LA CORSA DELLE RICHIESTE INCROCIATE.
    // Fra la lettura di poco sopra e questa scrittura c'e' un istante,
    // e in quell'istante l'altro puo' aver mandato la SUA richiesta:
    // finisce sullo stesso documento (l'identificativo e' lo stesso per
    // la coppia), e la mia scrittura diventa una sovrascrittura, che le
    // regole rifiutano. Senza questo ramo l'utente leggeva "Non sono
    // riuscito a inviare la richiesta" e riprovava all'infinito, mentre
    // in realta' la richiesta dell'altro era li' che lo aspettava.
    // Si rilegge e si decide di nuovo, questa volta sui fatti.
    if (e?.code !== 'permission-denied') throw e;
    const adesso = await getDoc(rif);
    if (!adesso.exists()) throw e;
    const d = adesso.data() as Compagnia;
    if (d.stato === 'accettata') return 'gia_in_lista';
    if (d.richiedenteId === params.altroUid) {
      await accettaCompagnia(id);
      return 'accettata_la_sua';
    }
    return 'gia_chiesta';
  }
}

export async function accettaCompagnia(id: string): Promise<void> {
  await updateDoc(doc(db, COLLEZIONE, id), {
    stato: 'accettata',
    accettataIlMs: Date.now(),
  });
}

// Rifiutare e rimuovere sono la stessa operazione: il documento
// sparisce. Tenere un "rifiutata" avrebbe voluto dire impedire per
// sempre di richiedere — e le persone cambiano idea.
//
// ⚠️ La rimozione vale per TUTTI E DUE, perché il permesso era
// reciproco: se restasse in piedi da una parte, uno dei due potrebbe
// ancora addebitare l'altro senza che l'altro possa fare altrettanto.
// Con un documento solo, questo stato non è nemmeno rappresentabile.
export async function togliCompagnia(id: string): Promise<void> {
  await deleteDoc(doc(db, COLLEZIONE, id));
}

// Tutte le coppie in cui compaio: quelle accettate sono la mia lista,
// quelle in attesa sono le richieste — mie o dell'altro.
export function ascoltaCompagnie(
  mioUid: string,
  callback: (c: Compagnia[]) => void,
  onErrore?: () => void,
) {
  const q = query(collection(db, COLLEZIONE), where('membri', 'array-contains', mioUid));
  return onSnapshot(
    q,
    (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as Compagnia[]),
    (e) => {
      console.warn('Ascolto lista compagni interrotto:', e?.message ?? e);
      onErrore?.();
    },
  );
}
