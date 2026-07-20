// ============================================================
// PRENOTAZIONI + WALLET — operazioni transazionali.
// Ogni prenotazione/cancellazione aggiorna insieme, in un'unica
// transazione Firestore, il documento della prenotazione E il
// credito dell'utente: o vanno a buon fine entrambi, o nessuno dei
// due, così credito e prenotazioni non si disallineano mai.
// ============================================================

import { runTransaction, doc, collection, serverTimestamp, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';

export async function prenotaConCredito(params: {
  uid: string;
  circoloId: string;
  campoId: string;
  campoNome: string;
  data: string;
  dataLabel: string;
  orario: string;
  prezzo: number;
  etichetta?: string | null;
  utenteNome: string;
  utenteCognome: string;
}): Promise<void> {
  const utenteRef = doc(db, 'utenti', params.uid);
  const prenotazioneRef = doc(collection(db, 'prenotazioni'));

  await runTransaction(db, async (tx) => {
    const utenteSnap = await tx.get(utenteRef);
    if (!utenteSnap.exists()) throw new Error('UTENTE_NON_TROVATO');

    const creditoAttuale = (utenteSnap.data().credito as number) ?? 0;
    if (creditoAttuale < params.prezzo) throw new Error('CREDITO_INSUFFICIENTE');

    tx.update(utenteRef, { credito: creditoAttuale - params.prezzo });
    tx.set(prenotazioneRef, {
      utenteId: params.uid,
      circoloId: params.circoloId,
      campoId: params.campoId,
      campoNome: params.campoNome,
      data: params.data,
      dataLabel: params.dataLabel,
      orario: params.orario,
      prezzo: params.prezzo,
      etichetta: params.etichetta ?? null,
      utenteNome: params.utenteNome,
      utenteCognome: params.utenteCognome,
      creataIl: serverTimestamp(),
    });
  });
}

// Usata sia quando il socio annulla la propria prenotazione, sia
// quando l'Admin Circolo annulla la prenotazione di un socio: in
// entrambi i casi va rimborsato esattamente il prezzo pagato allora
// (non il prezzo attuale della tariffa, che potrebbe essere cambiato).
export async function cancellaConRimborso(params: {
  uid: string;
  prenotazioneId: string;
  prezzo: number;
}): Promise<void> {
  const utenteRef = doc(db, 'utenti', params.uid);
  const prenotazioneRef = doc(db, 'prenotazioni', params.prenotazioneId);

  await runTransaction(db, async (tx) => {
    const utenteSnap = await tx.get(utenteRef);
    const creditoAttuale = utenteSnap.exists() ? ((utenteSnap.data().credito as number) ?? 0) : 0;

    tx.update(utenteRef, { credito: creditoAttuale + params.prezzo });
    tx.delete(prenotazioneRef);
  });
}

// Ricarica del wallet da parte della segreteria/Admin Circolo.
export async function ricaricaCredito(uid: string, importo: number): Promise<void> {
  const utenteRef = doc(db, 'utenti', uid);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(utenteRef);
    const attuale = snap.exists() ? ((snap.data().credito as number) ?? 0) : 0;
    tx.update(utenteRef, { credito: attuale + importo });
  });
}

// ---------------- Vista Admin: tutte le prenotazioni del circolo ----------------

export interface PrenotazioneAdmin {
  id: string;
  utenteId: string;
  utenteNome: string;
  utenteCognome: string;
  campoId: string;
  campoNome: string;
  data: string;
  dataLabel: string;
  orario: string;
  prezzo: number;
  etichetta?: string | null;
}

export function ascoltaPrenotazioniCircolo(
  circoloId: string,
  callback: (p: PrenotazioneAdmin[]) => void
) {
  const q = query(collection(db, 'prenotazioni'), where('circoloId', '==', circoloId));
  return onSnapshot(
    q,
    (snap) => {
      const elenco = snap.docs.map((d) => {
        const v = d.data() as any;
        return {
          id: d.id,
          utenteId: v.utenteId,
          utenteNome: v.utenteNome ?? '',
          utenteCognome: v.utenteCognome ?? '',
          campoId: v.campoId ?? '',
          campoNome: v.campoNome ?? '',
          data: v.data,
          dataLabel: v.dataLabel ?? v.data,
          orario: v.orario,
          prezzo: v.prezzo ?? 0,
          etichetta: v.etichetta ?? null,
        } as PrenotazioneAdmin;
      });
      elenco.sort((a, b) => (a.data + a.orario).localeCompare(b.data + b.orario));
      callback(elenco);
    },
    (errore) => console.warn('Ascolto prenotazioni interrotto (probabile logout):', errore?.message ?? errore)
  );
}

// ---------------- Occupazione reale del circolo (vista Socio) ----------------
// Serve a mostrare quali slot sono già presi da ALTRI soci, evitando
// doppie prenotazioni sullo stesso campo/giorno/ora.

export interface SlotOccupato {
  campoId: string;
  data: string;
  orario: string;
  mia: boolean; // true se è una prenotazione dell'utente corrente
}

export function ascoltaOccupazioneCircolo(
  circoloId: string,
  uidCorrente: string,
  callback: (occupati: SlotOccupato[]) => void
) {
  const q = query(collection(db, 'prenotazioni'), where('circoloId', '==', circoloId));
  return onSnapshot(
    q,
    (snap) => {
      callback(
        snap.docs.map((d) => {
          const v = d.data() as any;
          return {
            campoId: v.campoId,
            data: v.data,
            orario: v.orario,
            mia: v.utenteId === uidCorrente,
          };
        })
      );
    },
    (errore) => console.warn('Ascolto occupazione interrotto (probabile logout):', errore?.message ?? errore)
  );
}
