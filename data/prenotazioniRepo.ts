// ============================================================
// PRENOTAZIONI + WALLET — operazioni transazionali.
// Ogni prenotazione/cancellazione aggiorna insieme, in un'unica
// transazione Firestore, il documento della prenotazione E il
// credito dell'utente: o vanno a buon fine entrambi, o nessuno dei
// due, così credito e prenotazioni non si disallineano mai.
// ============================================================

import { runTransaction, doc, updateDoc, deleteDoc, collection, addDoc, serverTimestamp, query, where, onSnapshot, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { rimuoviDisponibilitaPerSlot } from './disponibilitaLezioni';

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
  note?: string;
  nascondiInfo?: boolean;
  compagnoId?: string | null;
  compagnoNome?: string | null;
  compagnoCognome?: string | null;
}): Promise<{ sosUsato: boolean }> {
  const utenteRef = doc(db, 'utenti', params.uid);
  const prenotazioneRef = doc(collection(db, 'prenotazioni'));
  let sosUsato = false;

  await runTransaction(db, async (tx) => {
    const utenteSnap = await tx.get(utenteRef);
    if (!utenteSnap.exists()) throw new Error('UTENTE_NON_TROVATO');

    const creditoAttuale = (utenteSnap.data().credito as number) ?? 0;
    const sosAttuale = (utenteSnap.data().sosUtilizzato as number) ?? 0;
    const { daCredito, daSOS } = calcolaAddebitoConSOS(creditoAttuale, params.prezzo);
    sosUsato = daSOS > 0;

    tx.update(utenteRef, {
      credito: creditoAttuale - daCredito,
      ...(sosUsato ? { sosUtilizzato: sosAttuale + daSOS } : {}),
    });
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
      note: params.note?.trim() || null,
      nascondiInfo: !!params.nascondiInfo,
      compagnoId: params.compagnoId ?? null,
      compagnoNome: params.compagnoNome ?? null,
      compagnoCognome: params.compagnoCognome ?? null,
      costoDiviso: false,
      creataIl: serverTimestamp(),
    });
  });
  return { sosUsato };
}

// Prenota un campo con un COMPAGNO che paga metà del costo: transazione
// su ENTRAMBI i wallet insieme (o vanno a buon fine tutti e due gli
// addebiti, o nessuno dei due). Va chiamata solo dopo aver già
// verificato — lato chiamante — che il compagno abbia credito
// sufficiente per la sua metà; qui rifacciamo comunque il controllo
// server-side, per sicurezza, prima di scrivere qualunque cosa.
// Calcola come coprire un importo: prima il credito normale, poi —
// per la parte che eventualmente resta scoperta — il Credito S.O.S.,
// che è SEMPRE disponibile e senza limite (da saldare in segreteria).
// Nessun socio deve mai restare bloccato da un blocco di credito
// insufficiente in una prenotazione condivisa (con compagno, o Sfida).
// Conta le prenotazioni campo di UN socio qualsiasi (non necessariamente
// quello loggato) in una settimana — utenteId O compagnoId, contano
// entrambi i ruoli. Serve per verificare il limite settimanale anche
// dell'ALTRA persona coinvolta in una prenotazione condivisa (compagno
// di gioco, Sfida), che altrimenti nessuno controllerebbe mai.
export async function contaPrenotazioniSettimana(uid: string, inizio: string, fine: string): Promise<number> {
  const q1 = query(collection(db, 'prenotazioni'), where('utenteId', '==', uid));
  const q2 = query(collection(db, 'prenotazioni'), where('compagnoId', '==', uid));
  const [snap1, snap2] = await Promise.all([getDocs(q1), getDocs(q2)]);
  const ids = new Set<string>();
  snap1.forEach((d) => {
    const data = d.data().data as string;
    if (data >= inizio && data <= fine) ids.add(d.id);
  });
  snap2.forEach((d) => {
    const data = d.data().data as string;
    if (data >= inizio && data <= fine) ids.add(d.id);
  });
  return ids.size * 0.5;
}

// Calcola il limite settimanale effettivo di un socio: il suo limite
// personale (se impostato) sostituisce quello generale del circolo.
export function limiteEffettivoDi(
  socio: { limitePrenotazioniPersonale?: number },
  limiteOreSettimanali: number
): number {
  const personale = socio.limitePrenotazioniPersonale ?? 0;
  return personale > 0 ? personale : limiteOreSettimanali;
}

function calcolaAddebitoConSOS(creditoAttuale: number, importo: number): { daCredito: number; daSOS: number } {
  const daCredito = Math.min(creditoAttuale, importo);
  const daSOS = Math.round((importo - daCredito) * 100) / 100;
  return { daCredito, daSOS };
}

export async function prenotaConCompagno(params: {
  uid: string;
  compagnoId: string;
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
  compagnoNome: string;
  compagnoCognome: string;
  note?: string;
  nascondiInfo?: boolean;
  sfidaId?: string | null;
}): Promise<{ id: string; sosUsatoUtente: boolean; sosUsatoCompagno: boolean }> {
  const utenteRef = doc(db, 'utenti', params.uid);
  const compagnoRef = doc(db, 'utenti', params.compagnoId);
  const prenotazioneRef = doc(collection(db, 'prenotazioni'));
  const meta = Math.round((params.prezzo / 2) * 100) / 100;

  let sosUsatoUtente = false;
  let sosUsatoCompagno = false;

  await runTransaction(db, async (tx) => {
    const utenteSnap = await tx.get(utenteRef);
    const compagnoSnap = await tx.get(compagnoRef);
    if (!utenteSnap.exists() || !compagnoSnap.exists()) throw new Error('UTENTE_NON_TROVATO');

    const creditoUtente = (utenteSnap.data().credito as number) ?? 0;
    const creditoCompagno = (compagnoSnap.data().credito as number) ?? 0;
    const sosUtenteAttuale = (utenteSnap.data().sosUtilizzato as number) ?? 0;
    const sosCompagnoAttuale = (compagnoSnap.data().sosUtilizzato as number) ?? 0;

    const { daCredito: daCreditoUtente, daSOS: daSOSUtente } = calcolaAddebitoConSOS(creditoUtente, meta);
    const { daCredito: daCreditoCompagno, daSOS: daSOSCompagno } = calcolaAddebitoConSOS(creditoCompagno, meta);
    sosUsatoUtente = daSOSUtente > 0;
    sosUsatoCompagno = daSOSCompagno > 0;

    tx.update(utenteRef, {
      credito: creditoUtente - daCreditoUtente,
      ...(sosUsatoUtente ? { sosUtilizzato: sosUtenteAttuale + daSOSUtente } : {}),
    });
    tx.update(compagnoRef, {
      credito: creditoCompagno - daCreditoCompagno,
      ...(sosUsatoCompagno ? { sosUtilizzato: sosCompagnoAttuale + daSOSCompagno } : {}),
    });
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
      note: params.note?.trim() || null,
      nascondiInfo: !!params.nascondiInfo,
      compagnoId: params.compagnoId,
      compagnoNome: params.compagnoNome,
      compagnoCognome: params.compagnoCognome,
      costoDiviso: true,
      sfidaId: params.sfidaId ?? null,
      creataIl: serverTimestamp(),
    });
  });
  return { id: prenotazioneRef.id, sosUsatoUtente, sosUsatoCompagno };
}

// Prenota una LEZIONE: stessa identica logica di pagamento di
// prenotaConCredito (il socio paga solo il normale costo del
// campo — la lezione vera si accorda direttamente con il maestro,
// fuori piattaforma), con in più il collegamento al maestro e la
// rimozione delle disponibilità ormai superate su quello slot.
// Usata sia quando è il socio a prenotare (sceglie tra i maestri
// disponibili), sia quando è il maestro a prenotare per un socio.
export async function prenotaLezione(params: {
  uid: string; // socio che paga e per cui viene creata la prenotazione
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
  maestroId: string;
  maestroNome: string;
  maestroCognome: string;
  nascondiInfo?: boolean;
  prenotataDa: 'socio' | 'maestro';
}): Promise<void> {
  const utenteRef = doc(db, 'utenti', params.uid);
  const prenotazioneRef = doc(collection(db, 'prenotazioni'));

  await runTransaction(db, async (tx) => {
    const utenteSnap = await tx.get(utenteRef);
    if (!utenteSnap.exists()) throw new Error('UTENTE_NON_TROVATO');

    const creditoAttuale = (utenteSnap.data().credito as number) ?? 0;
    const sosAttuale = (utenteSnap.data().sosUtilizzato as number) ?? 0;
    const { daCredito, daSOS } = calcolaAddebitoConSOS(creditoAttuale, params.prezzo);

    tx.update(utenteRef, {
      credito: creditoAttuale - daCredito,
      ...(daSOS > 0 ? { sosUtilizzato: sosAttuale + daSOS } : {}),
    });
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
      tipo: 'lezione',
      maestroId: params.maestroId,
      maestroNome: params.maestroNome,
      maestroCognome: params.maestroCognome,
      nascondiInfo: !!params.nascondiInfo,
      prenotataDa: params.prenotataDa,
      creataIl: serverTimestamp(),
    });
  });

  // Fuori dalla transazione: tocca un'altra collezione con una query,
  // non un singolo documento noto in anticipo.
  await rimuoviDisponibilitaPerSlot(params.circoloId, params.campoId, params.data, params.orario);
}

// Prenota una lezione con un allievo che NON è socio del circolo
// (non ha un account/wallet nel sistema): nessuna transazione sul
// credito, solo un documento che occupa lo slot sulla griglia e
// tiene traccia della lezione. Il costo del campo, in questo caso,
// si salda direttamente in segreteria — non c'è un wallet da cui
// scalarlo. "prezzo" resta comunque calcolato e mostrato (a chi
// gestisce il circolo/il maestro) come riferimento di quanto va
// raccolto in contanti, ma non genera alcun addebito automatico.
export async function prenotaLezioneOspite(params: {
  circoloId: string;
  campoId: string;
  campoNome: string;
  data: string;
  dataLabel: string;
  orario: string;
  prezzo: number;
  nomeOspite: string;
  maestroId: string;
  maestroNome: string;
  maestroCognome: string;
  nascondiInfo?: boolean;
}): Promise<void> {
  await addDoc(collection(db, 'prenotazioni'), {
    utenteId: '',
    utenteNome: params.nomeOspite,
    utenteCognome: '',
    circoloId: params.circoloId,
    campoId: params.campoId,
    campoNome: params.campoNome,
    data: params.data,
    dataLabel: params.dataLabel,
    orario: params.orario,
    prezzo: params.prezzo,
    etichetta: null,
    tipo: 'lezione',
    ospite: true,
    maestroId: params.maestroId,
    maestroNome: params.maestroNome,
    maestroCognome: params.maestroCognome,
    prenotataDa: 'maestro',
    nascondiInfo: !!params.nascondiInfo,
    creataIl: serverTimestamp(),
  });

  await rimuoviDisponibilitaPerSlot(params.circoloId, params.campoId, params.data, params.orario);
}

// Usata quando il socio annulla la propria prenotazione, quando
// l'Admin Circolo annulla la prenotazione di un socio, o quando il
// Maestro annulla una lezione: in tutti i casi va rimborsato
// esattamente il prezzo pagato allora (non il prezzo attuale della
// tariffa, che potrebbe essere cambiato).
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

// Cancella una prenotazione con costo diviso: rimborsa metà a ciascuno
// dei due soci coinvolti, in un'unica transazione (o vanno a buon fine
// entrambi gli accrediti, o nessuno dei due). Va usata SOLO quando
// costoDiviso è davvero true — se il compagno non aveva pagato nulla
// (credito insufficiente al momento della prenotazione), la cancellazione
// resta quella normale a carico del solo socio che ha prenotato.
export async function cancellaConRimborsoDiviso(params: {
  utenteId: string;
  compagnoId: string;
  prenotazioneId: string;
  prezzoTotale: number;
}): Promise<void> {
  const utenteRef = doc(db, 'utenti', params.utenteId);
  const compagnoRef = doc(db, 'utenti', params.compagnoId);
  const prenotazioneRef = doc(db, 'prenotazioni', params.prenotazioneId);
  const meta = Math.round((params.prezzoTotale / 2) * 100) / 100;

  await runTransaction(db, async (tx) => {
    const utenteSnap = await tx.get(utenteRef);
    const compagnoSnap = await tx.get(compagnoRef);
    const creditoUtente = utenteSnap.exists() ? ((utenteSnap.data().credito as number) ?? 0) : 0;
    const creditoCompagno = compagnoSnap.exists() ? ((compagnoSnap.data().credito as number) ?? 0) : 0;

    tx.update(utenteRef, { credito: creditoUtente + meta });
    tx.update(compagnoRef, { credito: creditoCompagno + meta });
    tx.delete(prenotazioneRef);
  });
}

// Cancella una lezione con un allievo NON socio: nessun wallet da cui
// era stato scalato nulla in origine (vedi prenotaLezioneOspite), quindi
// qui non c'è alcun rimborso da fare — solo la rimozione dello slot.
export async function cancellaSenzaRimborso(prenotazioneId: string): Promise<void> {
  await deleteDoc(doc(db, 'prenotazioni', prenotazioneId));
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

// Azzera del tutto il credito di un socio — per i casi in cui smette
// di usare il wallet e la segreteria lo rimborsa in contanti/altro
// canale reale, fuori dall'app.
export async function azzeraCredito(uid: string): Promise<void> {
  await updateDoc(doc(db, 'utenti', uid), { credito: 0 });
}

// Ricarica S.O.S. self-service del socio: aggiorna credito E il
// contatore di quanto plafond S.O.S. è stato consumato, in un'unica
// transazione atomica (le due cose devono sempre restare coerenti).
export async function ricaricaSOS(uid: string, importo: number): Promise<void> {
  const utenteRef = doc(db, 'utenti', uid);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(utenteRef);
    const creditoAttuale = snap.exists() ? ((snap.data().credito as number) ?? 0) : 0;
    const sosAttuale = snap.exists() ? ((snap.data().sosUtilizzato as number) ?? 0) : 0;
    tx.update(utenteRef, {
      credito: creditoAttuale + importo,
      sosUtilizzato: sosAttuale + importo,
    });
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
  tipo?: 'campo' | 'lezione';
  prenotataDa?: 'socio' | 'maestro'; // solo per tipo==='lezione': chi ha avviato la prenotazione
  sfidaId?: string | null; // presente se questa prenotazione nasce da una Sfida Sociale accettata
  ospite?: boolean;
  maestroId?: string;
  maestroNome?: string;
  maestroCognome?: string;
  compagnoId?: string;
  compagnoNome?: string;
  compagnoCognome?: string;
  costoDiviso?: boolean; // true se il prezzo è stato effettivamente diviso col compagno
  note?: string;
  nascondiInfo?: boolean; // se true, altri soci vedono solo "Prenotato", non i dettagli
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
          tipo: v.tipo ?? 'campo',
          prenotataDa: v.prenotataDa,
          sfidaId: v.sfidaId ?? null,
          ospite: v.ospite ?? false,
          maestroId: v.maestroId,
          maestroNome: v.maestroNome,
          maestroCognome: v.maestroCognome,
          compagnoId: v.compagnoId,
          compagnoNome: v.compagnoNome,
          compagnoCognome: v.compagnoCognome,
          costoDiviso: v.costoDiviso ?? false,
          note: v.note ?? '',
          nascondiInfo: v.nascondiInfo ?? false,
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
