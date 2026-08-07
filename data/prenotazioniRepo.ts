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
import { registraMovimentoInTransazione, registraMovimentoSemplice } from './movimenti';
import { idTessera } from './tessere';
import { orarioFineSlot } from './circoli';

// Il portafoglio NON vive più sul profilo utente ma sulla TESSERA
// (una per ogni coppia utente-circolo): il credito versato in
// segreteria al circolo A resta al circolo A e non viene mai
// trasportato o sommato a quello di un altro circolo.

export async function prenotaConCredito(params: {
  uid: string;
  circoloId: string;
  // Chi prenota puo' essere socio tesserato QUI oppure Ospite
  // (tesserato altrove): lo si registra sulla prenotazione, cosi'
  // la griglia e gli elenchi lo mostrano senza doverlo ricavare.
  tipoUtente?: 'socio' | 'ospite';
  gruppoId?: string;
  // Scelta dell'utente nel pop-up: partita distinta o prolungamento.
  nuovaPrenotazione?: boolean;
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
  const utenteRef = doc(db, 'tessere', idTessera(params.uid, params.circoloId));
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

    registraMovimentoInTransazione(tx, {
      circoloId: params.circoloId,
      uid: params.uid,
      socioNome: `${params.utenteNome} ${params.utenteCognome}`,
      socioRuolo: params.tipoUtente === 'ospite' ? 'ospite' : 'socio_tesserato',
      tipo: 'addebito',
      gruppoId: params.gruppoId ?? null,
      nuovaPrenotazione: !!params.nuovaPrenotazione,
      dataISO: params.data,
      campoId: params.campoId,
      campoNome: params.campoNome,
      dataLabel: params.dataLabel,
      orario: params.orario,
      orarioFine: orarioFineSlot(params.orario),
      importo: -params.prezzo,
      saldoPrima: creditoAttuale,
      saldoDopo: creditoAttuale - daCredito,
      debitoPrima: sosAttuale,
      debitoDopo: sosUsato ? sosAttuale + daSOS : sosAttuale,
      eseguitoDaUid: params.uid,
      eseguitoDaNome: `${params.utenteNome} ${params.utenteCognome}`,
      eseguitoDaRuolo: 'socio',
      prenotazioneId: prenotazioneRef.id,
      descrizione: `Prenotazione ${params.campoNome} · ${params.dataLabel} ${params.orario}`,
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
      tipoUtente: params.tipoUtente ?? 'socio',
      creataIl: serverTimestamp(),
    });
  });
  return { sosUsato };
}

// ============================================================
// PRENOTAZIONI CREATE DALL'ADMIN
// Marcate con prenotataDa:'admin' — è questo campo che permette a
// griglia, pop-up e sezione dedicata di distinguerle da quelle
// create dal socio stesso.
// ============================================================

// Admin prenota PER UN SOCIO: il costo viene scalato dal portafoglio
// del socio con lo stesso identico meccanismo di una prenotazione
// normale (credito + copertura S.O.S., tutto in una transazione).
export async function prenotaPerSocioDaAdmin(params: {
  uid: string;
  circoloId: string;
  tipoUtente?: 'socio' | 'ospite';
  // Lega le mezz'ore prenotate insieme, nel documento e nel registro.
  gruppoId?: string;
  // Scelta dell'admin: partita distinta o prolungamento di una attiva.
  nuovaPrenotazione?: boolean;
  // Chi ha materialmente eseguito: finisce nel registro movimenti,
  // dove serve in caso di contestazione.
  eseguitoDaUid?: string | null;
  eseguitoDaNome?: string | null;
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
}): Promise<{ sosUsato: boolean }> {
  const utenteRef = doc(db, 'tessere', idTessera(params.uid, params.circoloId));
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

    registraMovimentoInTransazione(tx, {
      circoloId: params.circoloId,
      uid: params.uid,
      socioNome: `${params.utenteNome} ${params.utenteCognome}`,
      socioRuolo: params.tipoUtente === 'ospite' ? 'ospite' : 'socio_tesserato',
      tipo: 'addebito',
      gruppoId: params.gruppoId ?? null,
      nuovaPrenotazione: !!params.nuovaPrenotazione,
      dataISO: params.data,
      campoId: params.campoId,
      campoNome: params.campoNome,
      dataLabel: params.dataLabel,
      orario: params.orario,
      orarioFine: orarioFineSlot(params.orario),
      importo: -params.prezzo,
      saldoPrima: creditoAttuale,
      saldoDopo: creditoAttuale - daCredito,
      debitoPrima: sosAttuale,
      debitoDopo: sosUsato ? sosAttuale + daSOS : sosAttuale,
      eseguitoDaUid: params.eseguitoDaUid ?? null,
      eseguitoDaNome: params.eseguitoDaNome ?? null,
      eseguitoDaRuolo: 'admin',
      prenotazioneId: prenotazioneRef.id,
      descrizione: params.prezzo === 0
        ? `Prenotazione del circolo (senza addebito) · ${params.campoNome} ${params.dataLabel} ${params.orario}`
        : `Prenotazione del circolo · ${params.campoNome} ${params.dataLabel} ${params.orario}`,
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
      nascondiInfo: false,
      compagnoId: null,
      compagnoNome: null,
      compagnoCognome: null,
      costoDiviso: false,
      tipo: 'campo',
      tipoUtente: params.tipoUtente ?? 'socio',
      gruppoId: params.gruppoId ?? null,
      prenotataDa: 'admin',
      creataIl: serverTimestamp(),
    });
  });
  return { sosUsato };
}

// Admin prenota PER UN ESTERNO (nessun account): niente portafoglio da
// addebitare, quindi nessuna transazione sui crediti. Il nome arriva
// dal campo di testo compilato dall'admin.
export async function prenotaEsternoDaAdmin(params: {
  circoloId: string;
  campoId: string;
  campoNome: string;
  data: string;
  dataLabel: string;
  orario: string;
  prezzo: number;
  etichetta?: string | null;
  nomeEsterno: string;
  note?: string;
  gruppoId?: string;
  eseguitoDaUid?: string | null;
  eseguitoDaNome?: string | null;
}): Promise<void> {
  await addDoc(collection(db, 'prenotazioni'), {
    utenteId: '',
    utenteNome: params.nomeEsterno,
    utenteCognome: '',
    circoloId: params.circoloId,
    campoId: params.campoId,
    campoNome: params.campoNome,
    data: params.data,
    dataLabel: params.dataLabel,
    orario: params.orario,
    prezzo: params.prezzo,
    etichetta: params.etichetta ?? null,
    note: params.note?.trim() || null,
    nascondiInfo: false,
    compagnoId: null,
    compagnoNome: null,
    compagnoCognome: null,
    costoDiviso: false,
    tipo: 'campo',
    tipoUtente: 'esterno',
    prenotataDa: 'admin',
    gruppoId: params.gruppoId ?? null,
    creataIl: serverTimestamp(),
  });

  // Nessun portafoglio da muovere, ma l'occupazione del campo va
  // comunque documentata: l'admin deve poter risalire a chi ha usato
  // quell'ora e capire perche' non c'e' stato addebito.
  await registraMovimentoSemplice({
    circoloId: params.circoloId, uid: '',
    socioNome: params.nomeEsterno,
    tipo: 'addebito', gruppoId: params.gruppoId ?? null,
    dataISO: params.data, campoId: params.campoId,
    campoNome: params.campoNome, dataLabel: params.dataLabel,
    orario: params.orario, orarioFine: orarioFineSlot(params.orario),
    importo: 0,
    saldoPrima: 0, saldoDopo: 0, debitoPrima: 0, debitoDopo: 0,
    eseguitoDaUid: params.eseguitoDaUid ?? null,
    eseguitoDaNome: params.eseguitoDaNome ?? null,
    eseguitoDaRuolo: 'admin',
    descrizione: 'Prenotazione del circolo per un esterno — nessun addebito, non ha un account',
  });
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

// Un rimborso ESTINGUE PRIMA IL DEBITO, e solo l'eccedenza torna sul
// credito. Senza questa regola un socio che aveva pagato col credito
// S.O.S. si ritrovava, dopo la cancellazione, con credito e debito
// accesi per lo stesso importo: matematicamente pari, ma illeggibile
// per chi guarda il proprio portafoglio e vede due numeri rossi e
// verdi invece di zero.
//
// Esempio: debito 8, rimborso 8  →  debito 0, credito 0
//          debito 8, rimborso 5  →  debito 3, credito 0
//          debito 3, rimborso 8  →  debito 0, credito 5
export function applicaRimborso(
  creditoAttuale: number,
  debitoAttuale: number,
  importo: number
): { credito: number; sosUtilizzato: number } {
  const versoDebito = Math.min(debitoAttuale, importo);
  const versoCredito = importo - versoDebito;
  return {
    credito: Math.round((creditoAttuale + versoCredito) * 100) / 100,
    sosUtilizzato: Math.round((debitoAttuale - versoDebito) * 100) / 100,
  };
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
  gruppoId?: string;
}): Promise<{ id: string; sosUsatoUtente: boolean; sosUsatoCompagno: boolean }> {
  const utenteRef = doc(db, 'tessere', idTessera(params.uid, params.circoloId));
  const compagnoRef = doc(db, 'tessere', idTessera(params.compagnoId, params.circoloId));
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
    // Due movimenti distinti, uno per portafoglio: ciascuno deve
    // ritrovare nella propria storia la meta' che ha pagato.
    registraMovimentoInTransazione(tx, {
      circoloId: params.circoloId, uid: params.uid,
      socioNome: `${params.utenteNome} ${params.utenteCognome}`,
      tipo: 'addebito', gruppoId: params.gruppoId ?? null,
      dataISO: params.data, campoId: params.campoId,
      campoNome: params.campoNome, dataLabel: params.dataLabel,
      orario: params.orario, orarioFine: orarioFineSlot(params.orario),
      importo: -meta,
      saldoPrima: creditoUtente, saldoDopo: creditoUtente - daCreditoUtente,
      debitoPrima: sosUtenteAttuale, debitoDopo: sosUtenteAttuale + daSOSUtente,
      eseguitoDaUid: params.uid,
      eseguitoDaNome: `${params.utenteNome} ${params.utenteCognome}`,
      eseguitoDaRuolo: 'socio',
      prenotazioneId: prenotazioneRef.id,
      compagnoNome: `${params.compagnoNome} ${params.compagnoCognome}`,
      sonoCompagno: false,
      descrizione: `Prenotazione con ${params.compagnoNome} ${params.compagnoCognome} — la tua metà`,
    });
    registraMovimentoInTransazione(tx, {
      circoloId: params.circoloId, uid: params.compagnoId,
      socioNome: `${params.compagnoNome} ${params.compagnoCognome}`,
      tipo: 'addebito', gruppoId: params.gruppoId ?? null,
      dataISO: params.data, campoId: params.campoId,
      campoNome: params.campoNome, dataLabel: params.dataLabel,
      orario: params.orario, orarioFine: orarioFineSlot(params.orario),
      importo: -meta,
      saldoPrima: creditoCompagno, saldoDopo: creditoCompagno - daCreditoCompagno,
      debitoPrima: sosCompagnoAttuale, debitoDopo: sosCompagnoAttuale + daSOSCompagno,
      eseguitoDaUid: params.uid,
      eseguitoDaNome: `${params.utenteNome} ${params.utenteCognome}`,
      // Chi ha prenotato non e' il titolare di questo portafoglio.
      eseguitoDaRuolo: 'compagno',
      prenotazioneId: prenotazioneRef.id,
      compagnoNome: `${params.utenteNome} ${params.utenteCognome}`,
      sonoCompagno: true,
      descrizione: `Sei stato aggiunto da ${params.utenteNome} ${params.utenteCognome} — la tua metà`,
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
  gruppoId?: string;
  prenotataDa: 'socio' | 'maestro';
}): Promise<void> {
  const utenteRef = doc(db, 'tessere', idTessera(params.uid, params.circoloId));
  const prenotazioneRef = doc(collection(db, 'prenotazioni'));

  await runTransaction(db, async (tx) => {
    const utenteSnap = await tx.get(utenteRef);
    if (!utenteSnap.exists()) throw new Error('UTENTE_NON_TROVATO');

    const creditoAttuale = (utenteSnap.data().credito as number) ?? 0;
    const sosAttuale = (utenteSnap.data().sosUtilizzato as number) ?? 0;
    // La lezione non si paga nell'app: nei circoli il Maestro chiede un
    // importo unico che comprende lezione e campo, e regola il campo
    // con la segreteria per conto suo. Addebitare qui significherebbe
    // far pagare due volte il socio.
    const { daCredito, daSOS } = calcolaAddebitoConSOS(creditoAttuale, 0);

    tx.update(utenteRef, {
      credito: creditoAttuale - daCredito,
      ...(daSOS > 0 ? { sosUtilizzato: sosAttuale + daSOS } : {}),
    });

    // Registrata comunque, con importo zero: l'admin deve sapere
    // quante ore di campo sono state usate per lezioni e da chi,
    // anche senza movimento di denaro.
    registraMovimentoInTransazione(tx, {
      circoloId: params.circoloId, uid: params.uid,
      socioNome: `${params.utenteNome} ${params.utenteCognome}`,
      tipo: 'addebito', gruppoId: params.gruppoId ?? null,
      dataISO: params.data, campoId: params.campoId,
      campoNome: params.campoNome, dataLabel: params.dataLabel,
      orario: params.orario, orarioFine: orarioFineSlot(params.orario),
      maestroNome: `${params.maestroNome} ${params.maestroCognome}`,
      importo: 0,
      saldoPrima: creditoAttuale, saldoDopo: creditoAttuale,
      debitoPrima: sosAttuale, debitoDopo: sosAttuale,
      eseguitoDaUid: params.uid,
      eseguitoDaNome: params.prenotataDa === 'maestro'
        ? `${params.maestroNome} ${params.maestroCognome}`
        : `${params.utenteNome} ${params.utenteCognome}`,
      eseguitoDaRuolo: params.prenotataDa === 'maestro' ? 'maestro' : 'socio',
      prenotazioneId: prenotazioneRef.id,
      descrizione: `Lezione con il Maestro ${params.maestroNome} ${params.maestroCognome} — nessun addebito`,
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
export async function prenotaLezioneEsterno(params: {
  circoloId: string;
  campoId: string;
  campoNome: string;
  data: string;
  dataLabel: string;
  orario: string;
  prezzo: number;
  nomeEsterno: string;
  maestroId: string;
  maestroNome: string;
  maestroCognome: string;
  nascondiInfo?: boolean;
}): Promise<void> {
  await addDoc(collection(db, 'prenotazioni'), {
    utenteId: '',
    utenteNome: params.nomeEsterno,
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
    tipoUtente: 'esterno',
    maestroId: params.maestroId,
    maestroNome: params.maestroNome,
    maestroCognome: params.maestroCognome,
    prenotataDa: 'maestro',
    nascondiInfo: !!params.nascondiInfo,
    creataIl: serverTimestamp(),
  });

  // L'allievo esterno non ha un portafoglio, ma la lezione occupa il
  // campo: va documentata come tutte le altre.
  await registraMovimentoSemplice({
    circoloId: params.circoloId, uid: '',
    socioNome: params.nomeEsterno,
    tipo: 'addebito',
    dataISO: params.data, campoId: params.campoId,
    campoNome: params.campoNome, dataLabel: params.dataLabel,
    orario: params.orario, orarioFine: orarioFineSlot(params.orario),
    maestroNome: `${params.maestroNome} ${params.maestroCognome}`,
    importo: 0,
    saldoPrima: 0, saldoDopo: 0, debitoPrima: 0, debitoDopo: 0,
    eseguitoDaUid: params.maestroId,
    eseguitoDaNome: `${params.maestroNome} ${params.maestroCognome}`,
    eseguitoDaRuolo: 'maestro',
    descrizione: 'Lezione con un allievo esterno — nessun addebito, non ha un account',
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
  circoloId: string;
  prenotazioneId: string;
  prezzo: number;
  // Chi ha cancellato: puo' essere il socio stesso, il COMPAGNO di
  // gioco, l'admin o il maestro. Nel registro la differenza conta.
  eseguitoDaUid?: string | null;
  eseguitoDaNome?: string | null;
  eseguitoDaRuolo?: 'socio' | 'compagno' | 'admin' | 'maestro';
  descrizione?: string;
  // Nome del socio, per rendere il registro leggibile lato Admin.
  socioNome?: string;
  compagnoNome?: string;
  gruppoId?: string;
  // Dati della prenotazione cancellata, per rendere il rimborso
  // riconoscibile nel registro anche a distanza di mesi.
  campoNome?: string;
  dataLabel?: string;
  dataISO?: string;
  campoId?: string;
  orario?: string;
  parziale?: boolean;
}): Promise<void> {
  const utenteRef = doc(db, 'tessere', idTessera(params.uid, params.circoloId));
  const prenotazioneRef = doc(db, 'prenotazioni', params.prenotazioneId);

  await runTransaction(db, async (tx) => {
    const utenteSnap = await tx.get(utenteRef);
    const creditoAttuale = utenteSnap.exists() ? ((utenteSnap.data().credito as number) ?? 0) : 0;
    const debitoAttuale = utenteSnap.exists() ? ((utenteSnap.data().sosUtilizzato as number) ?? 0) : 0;

    const dopo = applicaRimborso(creditoAttuale, debitoAttuale, params.prezzo);
    tx.update(utenteRef, dopo);

    registraMovimentoInTransazione(tx, {
      circoloId: params.circoloId,
      uid: params.uid,
      socioNome: params.socioNome ?? null,
      tipo: 'rimborso',
      gruppoId: params.gruppoId ?? null,
      dataISO: params.dataISO ?? null,
      campoId: params.campoId ?? null,
      campoNome: params.campoNome ?? null,
      dataLabel: params.dataLabel ?? null,
      orario: params.orario ?? null,
      orarioFine: params.orario ? orarioFineSlot(params.orario) : null,
      parziale: !!params.parziale,
      importo: params.prezzo,
      saldoPrima: creditoAttuale,
      saldoDopo: dopo.credito,
      debitoPrima: debitoAttuale,
      debitoDopo: dopo.sosUtilizzato,
      eseguitoDaUid: params.eseguitoDaUid ?? null,
      eseguitoDaNome: params.eseguitoDaNome ?? null,
      eseguitoDaRuolo: params.eseguitoDaRuolo ?? 'socio',
      prenotazioneId: params.prenotazioneId,
      descrizione: params.descrizione ?? 'Rimborso per cancellazione prenotazione',
    });
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
  circoloId: string;
  prenotazioneId: string;
  prezzoTotale: number;
  eseguitoDaUid?: string | null;
  eseguitoDaNome?: string | null;
  eseguitoDaRuolo?: 'socio' | 'compagno' | 'admin' | 'maestro';
  descrizione?: string;
  // Nome del socio, per rendere il registro leggibile lato Admin.
  socioNome?: string;
  compagnoNome?: string;
  gruppoId?: string;
  // Dati della prenotazione cancellata, per rendere il rimborso
  // riconoscibile nel registro anche a distanza di mesi.
  campoNome?: string;
  dataLabel?: string;
  dataISO?: string;
  campoId?: string;
  orario?: string;
  parziale?: boolean;
}): Promise<void> {
  const utenteRef = doc(db, 'tessere', idTessera(params.utenteId, params.circoloId));
  const compagnoRef = doc(db, 'tessere', idTessera(params.compagnoId, params.circoloId));
  const prenotazioneRef = doc(db, 'prenotazioni', params.prenotazioneId);
  const meta = Math.round((params.prezzoTotale / 2) * 100) / 100;

  await runTransaction(db, async (tx) => {
    const utenteSnap = await tx.get(utenteRef);
    const compagnoSnap = await tx.get(compagnoRef);
    const creditoUtente = utenteSnap.exists() ? ((utenteSnap.data().credito as number) ?? 0) : 0;
    const debitoUtente = utenteSnap.exists() ? ((utenteSnap.data().sosUtilizzato as number) ?? 0) : 0;
    const creditoCompagno = compagnoSnap.exists() ? ((compagnoSnap.data().credito as number) ?? 0) : 0;
    const debitoCompagno = compagnoSnap.exists() ? ((compagnoSnap.data().sosUtilizzato as number) ?? 0) : 0;

    const dopoUtente = applicaRimborso(creditoUtente, debitoUtente, meta);
    const dopoCompagno = applicaRimborso(creditoCompagno, debitoCompagno, meta);
    tx.update(utenteRef, dopoUtente);
    tx.update(compagnoRef, dopoCompagno);

    // Due movimenti distinti, uno per portafoglio: ciascuno deve
    // poter leggere il proprio registro e ritrovarci la propria meta'.
    const chiHaCancellato = params.eseguitoDaRuolo ?? 'socio';
    const descr = params.descrizione ?? 'Rimborso metà quota per cancellazione prenotazione condivisa';
    registraMovimentoInTransazione(tx, {
      circoloId: params.circoloId,
      uid: params.utenteId,
      socioNome: params.socioNome ?? null,
      tipo: 'rimborso',
      gruppoId: params.gruppoId ?? null,
      dataISO: params.dataISO ?? null,
      campoId: params.campoId ?? null,
      campoNome: params.campoNome ?? null,
      dataLabel: params.dataLabel ?? null,
      orario: params.orario ?? null,
      orarioFine: params.orario ? orarioFineSlot(params.orario) : null,
      parziale: !!params.parziale,
      importo: meta,
      saldoPrima: creditoUtente,
      saldoDopo: dopoUtente.credito,
      debitoPrima: debitoUtente,
      debitoDopo: dopoUtente.sosUtilizzato,
      eseguitoDaUid: params.eseguitoDaUid ?? null,
      eseguitoDaNome: params.eseguitoDaNome ?? null,
      eseguitoDaRuolo: chiHaCancellato,
      prenotazioneId: params.prenotazioneId,
      descrizione: descr,
    });
    registraMovimentoInTransazione(tx, {
      circoloId: params.circoloId,
      uid: params.compagnoId,
      socioNome: params.compagnoNome ?? null,
      tipo: 'rimborso',
      gruppoId: params.gruppoId ?? null,
      dataISO: params.dataISO ?? null,
      campoId: params.campoId ?? null,
      campoNome: params.campoNome ?? null,
      dataLabel: params.dataLabel ?? null,
      orario: params.orario ?? null,
      orarioFine: params.orario ? orarioFineSlot(params.orario) : null,
      parziale: !!params.parziale,
      importo: meta,
      saldoPrima: creditoCompagno,
      saldoDopo: dopoCompagno.credito,
      debitoPrima: debitoCompagno,
      debitoDopo: dopoCompagno.sosUtilizzato,
      eseguitoDaUid: params.eseguitoDaUid ?? null,
      eseguitoDaNome: params.eseguitoDaNome ?? null,
      eseguitoDaRuolo: chiHaCancellato,
      prenotazioneId: params.prenotazioneId,
      descrizione: descr,
    });

    tx.delete(prenotazioneRef);
  });
}

// Cancella una lezione con un allievo NON socio: nessun wallet da cui
// era stato scalato nulla in origine (vedi prenotaLezioneEsterno), quindi
// qui non c'è alcun rimborso da fare — solo la rimozione dello slot.
export async function cancellaSenzaRimborso(prenotazioneId: string): Promise<void> {
  await deleteDoc(doc(db, 'prenotazioni', prenotazioneId));
}

// Ricarica del wallet da parte della segreteria/Admin Circolo.
// Anche qui vale la regola generale: se il socio ha un debito aperto,
// la somma versata lo estingue prima di finire sul credito. Altrimenti
// avrebbe credito e debito accesi insieme dopo aver appena pagato.
export async function ricaricaCredito(
  uid: string, circoloId: string, importo: number,
  eseguitoDa?: { uid: string; nome: string }, socioNome?: string
): Promise<void> {
  const utenteRef = doc(db, 'tessere', idTessera(uid, circoloId));
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(utenteRef);
    const attuale = snap.exists() ? ((snap.data().credito as number) ?? 0) : 0;
    const debito = snap.exists() ? ((snap.data().sosUtilizzato as number) ?? 0) : 0;
    const dopo = applicaRimborso(attuale, debito, importo);
    tx.update(utenteRef, dopo);
    registraMovimentoInTransazione(tx, {
      circoloId, uid,
      socioNome: socioNome ?? null,
      tipo: 'ricarica',
      importo,
      saldoPrima: attuale, saldoDopo: dopo.credito,
      debitoPrima: debito, debitoDopo: dopo.sosUtilizzato,
      eseguitoDaUid: eseguitoDa?.uid ?? null,
      eseguitoDaNome: eseguitoDa?.nome ?? null,
      eseguitoDaRuolo: 'admin',
      descrizione: debito > 0
        ? `Ricarica in segreteria — parte usata per estinguere il debito`
        : `Ricarica in segreteria`,
    });
  });
}

// Azzera del tutto il credito di un socio — per i casi in cui smette
// di usare il wallet e la segreteria lo rimborsa in contanti/altro
// canale reale, fuori dall'app.
export async function azzeraCredito(
  uid: string, circoloId: string, eseguitoDa?: { uid: string; nome: string }, socioNome?: string
): Promise<void> {
  const rif = doc(db, 'tessere', idTessera(uid, circoloId));
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(rif);
    const attuale = snap.exists() ? ((snap.data().credito as number) ?? 0) : 0;
    const debito = snap.exists() ? ((snap.data().sosUtilizzato as number) ?? 0) : 0;
    tx.update(rif, { credito: 0 });
    registraMovimentoInTransazione(tx, {
      circoloId, uid,
      socioNome: socioNome ?? null,
      tipo: 'azzeramento',
      importo: -attuale,
      saldoPrima: attuale, saldoDopo: 0,
      debitoPrima: debito, debitoDopo: debito,
      eseguitoDaUid: eseguitoDa?.uid ?? null,
      eseguitoDaNome: eseguitoDa?.nome ?? null,
      eseguitoDaRuolo: 'admin',
      descrizione: 'Azzeramento credito da parte del circolo',
    });
  });
}

// Ricarica S.O.S. self-service del socio: aggiorna credito E il
// contatore di quanto plafond S.O.S. è stato consumato, in un'unica
// transazione atomica (le due cose devono sempre restare coerenti).
export async function ricaricaSOS(uid: string, circoloId: string, importo: number, socioNome?: string): Promise<void> {
  const utenteRef = doc(db, 'tessere', idTessera(uid, circoloId));
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(utenteRef);
    const creditoAttuale = snap.exists() ? ((snap.data().credito as number) ?? 0) : 0;
    const sosAttuale = snap.exists() ? ((snap.data().sosUtilizzato as number) ?? 0) : 0;
    tx.update(utenteRef, {
      credito: creditoAttuale + importo,
      sosUtilizzato: sosAttuale + importo,
    });
    registraMovimentoInTransazione(tx, {
      circoloId, uid,
      socioNome: socioNome ?? null,
      tipo: 'sos',
      importo,
      saldoPrima: creditoAttuale, saldoDopo: creditoAttuale + importo,
      debitoPrima: sosAttuale, debitoDopo: sosAttuale + importo,
      eseguitoDaUid: uid,
      eseguitoDaNome: null,
      eseguitoDaRuolo: 'socio',
      descrizione: 'Ricarica S.O.S. — da saldare in segreteria',
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
  prenotataDa?: 'socio' | 'maestro' | 'admin'; // chi ha avviato la prenotazione ('admin' anche per tipo==='campo')
  sfidaId?: string | null; // presente se questa prenotazione nasce da una Sfida Sociale accettata
  // Chi gioca in questo slot, in modo NON ambiguo:
  //  - 'socio'   → socio tesserato del circolo
  //  - 'ospite'  → socio tesserato ALTROVE, approvato qui come Ospite
  //  - 'esterno' → nessun account: nome scritto a mano da Admin o
  //                Maestro (una prova, un accompagnatore, un allievo
  //                occasionale)
  // Prima esisteva un solo booleano "ospite" che copriva gli ultimi
  // due casi insieme, rendendoli indistinguibili.
  tipoUtente?: 'socio' | 'ospite' | 'esterno';
  // Lega le mezz'ore di una stessa prenotazione: serve a far ereditare
  // il gruppo anche al movimento di rimborso.
  gruppoId?: string | null;
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
          tipoUtente: v.tipoUtente ?? 'socio',
          gruppoId: v.gruppoId ?? null,
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
