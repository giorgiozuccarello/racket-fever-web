// ============================================================
// PRENOTAZIONI + WALLET — operazioni transazionali.
// Ogni prenotazione/cancellazione aggiorna insieme, in un'unica
// transazione Firestore, il documento della prenotazione E il
// credito dell'utente: o vanno a buon fine entrambi, o nessuno dei
// due, così credito e prenotazioni non si disallineano mai.
// ============================================================

import { runTransaction, doc, updateDoc, deleteDoc, collection, addDoc, serverTimestamp, query, where, onSnapshot, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { registraMovimentoInTransazione, registraMovimentoSemplice } from './movimenti';
import { idTessera } from './tessere';
import { orarioFineSlot } from './circoli';
import { raggruppaConsecutive } from './raggruppamento';
import {
  Giocatore, ModificaGiocatori, MAX_GIOCATORI_AGGIUNTI, giocatoriDi, quotaChiPrenota,
  dividiInParti, applicaModifica, differenzeQuote, elencoNomi,
} from './giocatori';

// Il portafoglio NON vive più sul profilo utente ma sulla TESSERA
// (una per ogni coppia utente-circolo): il credito versato in
// segreteria al circolo A resta al circolo A e non viene mai
// trasportato o sommato a quello di un altro circolo.

// ============================================================
// ⚠️ L'IDENTIFICATIVO DI UNA PRENOTAZIONE NON E' CASUALE
//
// E' ricavato da circolo, campo, giorno e orario. E' l'unica cosa che
// rende IMPOSSIBILE prenotare due volte la stessa mezz'ora: con un id
// sorteggiato, due persone che confermavano nello stesso istante
// scrivevano due documenti diversi sullo stesso campo alla stessa ora,
// nessuno se ne accorgeva, e la griglia — che cerca la prima
// prenotazione che trova — ne mostrava una sola. Due giocatori sul
// campo, e in segreteria nessuna traccia del problema.
//
// I controlli "e' ancora libero?" che le schermate fanno prima di
// scrivere restano utili per dirlo bene all'utente, ma non possono
// bastare: guardano una fotografia che arriva con qualche istante di
// ritardo. Questa e' la rete che non ha buchi.
//
// Con l'id fisso la seconda scrittura finisce sullo STESSO documento:
// dentro la transazione ce ne accorgiamo e ci fermiamo, e se anche
// qualcuno provasse a scavalcare il codice le regole rifiutano — una
// create su un documento che esiste gia' non e' una create, e l'unico
// update consentito su una prenotazione riguarda il nome del campo.
// ============================================================
export const SLOT_OCCUPATO = 'SLOT_OCCUPATO';

export function idSlot(circoloId: string, campoId: string, data: string, orario: string): string {
  // ⚠️ Nessun trattino basso dentro i pezzi, o la scomposizione non e'
  // piu' univoca: con un circolo "tennis_milazzo", il campo "A" del
  // circolo "tennis" e il campo "milazzo_A" del circolo "tennis"
  // darebbero lo stesso identificativo, e due circoli diversi si
  // cancellerebbero gli slot a vicenda. Oggi circoli e campi nascono
  // con identificativi automatici (soli caratteri alfanumerici),
  // quindi non succede: questa riga serve al giorno in cui qualcuno
  // ne creera' uno a mano.
  if (circoloId.includes('_') || campoId.includes('_')) {
    throw new Error('ID_CIRCOLO_O_CAMPO_NON_AMMESSO');
  }
  return `${circoloId}_${campoId}_${data}_${orario}`;
}

function rifSlot(circoloId: string, campoId: string, data: string, orario: string) {
  return doc(db, 'prenotazioni', idSlot(circoloId, campoId, data, orario));
}

export async function prenotaConCredito(params: {
  uid: string;
  circoloId: string;
  // Chi prenota puo' essere socio tesserato QUI oppure Ospite
  // (tesserato altrove): lo si registra sulla prenotazione, cosi'
  // la griglia e gli elenchi lo mostrano senza doverlo ricavare.
  tipoUtente?: 'socio' | 'ospite';
  gruppoId?: string;
  cardId?: string;
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
  const prenotazioneRef = rifSlot(params.circoloId, params.campoId, params.data, params.orario);
  let sosUsato = false;

  await runTransaction(db, async (tx) => {
    const utenteSnap = await tx.get(utenteRef);
    if (!utenteSnap.exists()) throw new Error('UTENTE_NON_TROVATO');
    // ⚠️ Il campo e' ancora libero? La domanda si fa QUI dentro, non
    // prima: fra il controllo della schermata e la scrittura passa
    // sempre un momento, e in quel momento chiunque puo' aver preso la
    // stessa mezz'ora. Dentro la transazione, invece, o siamo i primi o
    // ci fermiamo.
    const slotSnap = await tx.get(prenotazioneRef);
    if (slotSnap.exists()) throw new Error(SLOT_OCCUPATO);

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
      cardId: params.cardId ?? null,
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
        gruppoId: params.gruppoId ?? null,
        cardId: params.cardId ?? null,
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
// normale (credito + copertura col Fido, tutto in una transazione).
export async function prenotaPerSocioDaAdmin(params: {
  uid: string;
  circoloId: string;
  tipoUtente?: 'socio' | 'ospite';
  // Lega le mezz'ore prenotate insieme, nel documento e nel registro.
  gruppoId?: string;
  cardId?: string;
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
  const prenotazioneRef = rifSlot(params.circoloId, params.campoId, params.data, params.orario);
  let sosUsato = false;

  await runTransaction(db, async (tx) => {
    const utenteSnap = await tx.get(utenteRef);
    if (!utenteSnap.exists()) throw new Error('UTENTE_NON_TROVATO');
    // ⚠️ Il campo e' ancora libero? La domanda si fa QUI dentro, non
    // prima: fra il controllo della schermata e la scrittura passa
    // sempre un momento, e in quel momento chiunque puo' aver preso la
    // stessa mezz'ora. Dentro la transazione, invece, o siamo i primi o
    // ci fermiamo.
    const slotSnap = await tx.get(prenotazioneRef);
    if (slotSnap.exists()) throw new Error(SLOT_OCCUPATO);

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
      cardId: params.cardId ?? null,
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
        cardId: params.cardId ?? null,
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
  cardId?: string;
  eseguitoDaUid?: string | null;
  eseguitoDaNome?: string | null;
}): Promise<void> {
  // Anche qui l'id e' quello dello slot, e la verifica sta dentro una
  // transazione: senza, l'Admin poteva prenotare un esterno sopra la
  // prenotazione di un socio arrivata un istante prima.
  const prenotazioneRef = rifSlot(params.circoloId, params.campoId, params.data, params.orario);
  await runTransaction(db, async (tx) => {
    const slotSnap = await tx.get(prenotazioneRef);
    if (slotSnap.exists()) throw new Error(SLOT_OCCUPATO);
    tx.set(prenotazioneRef, {
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
      cardId: params.cardId ?? null,
      creataIl: serverTimestamp(),
    });
  });

  // Nessun portafoglio da muovere, ma l'occupazione del campo va
  // comunque documentata: l'admin deve poter risalire a chi ha usato
  // quell'ora e capire perche' non c'e' stato addebito.
  await registraMovimentoSemplice({
    circoloId: params.circoloId, uid: '',
    socioNome: params.nomeEsterno,
    tipo: 'addebito', gruppoId: params.gruppoId ?? null,
    cardId: params.cardId ?? null,
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
// per la parte che eventualmente resta scoperta — il Fido,
// che è SEMPRE disponibile e senza limite (da saldare in segreteria).
// Nessun socio deve mai restare bloccato da un blocco di credito
// insufficiente in una prenotazione condivisa (con compagno, o Sfida).
// Conta le prenotazioni campo di UN socio qualsiasi (non necessariamente
// quello loggato) in una settimana — utenteId O compagnoId, contano
// entrambi i ruoli. Serve per verificare il limite settimanale anche
// dell'ALTRA persona coinvolta in una prenotazione condivisa (compagno
// di gioco, Sfida), che altrimenti nessuno controllerebbe mai.
export async function contaPrenotazioniSettimana(uid: string, inizio: string, fine: string): Promise<number> {
  // ⚠️ TRE interrogazioni e non due. L'ora di gioco pesa sul limite
  // settimanale di TUTTI quelli che scendono in campo, non solo di chi
  // prenota: senza, un gruppo di quattro gioca tutti i giorni facendo
  // prenotare a turno uno diverso, e il limite del circolo diventa un
  // suggerimento. La terza serve alle prenotazioni fatte con il vecchio
  // modello a un compagno solo, che non hanno l'elenco dei giocatori e
  // sparirebbero dal conto il giorno dell'aggiornamento.
  const q1 = query(collection(db, 'prenotazioni'), where('utenteId', '==', uid));
  const q2 = query(collection(db, 'prenotazioni'), where('giocatoriIds', 'array-contains', uid));
  const q3 = query(collection(db, 'prenotazioni'), where('compagnoId', '==', uid));
  const [snap1, snap2, snap3] = await Promise.all([getDocs(q1), getDocs(q2), getDocs(q3)]);
  const ids = new Set<string>();
  // Un insieme e non una somma: la stessa mezz'ora puo' arrivare da due
  // interrogazioni diverse e conterebbe doppio.
  for (const snap of [snap1, snap2, snap3]) {
    snap.forEach((d) => {
      const data = d.data().data as string;
      if (data >= inizio && data <= fine) ids.add(d.id);
    });
  }
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
// Fido si ritrovava, dopo la cancellazione, con credito e debito
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

export function calcolaAddebitoConSOS(creditoAttuale: number, importo: number): { daCredito: number; daSOS: number } {
  const daCredito = Math.min(creditoAttuale, importo);
  const daSOS = Math.round((importo - daCredito) * 100) / 100;
  return { daCredito, daSOS };
}

// ============================================================
// PRENOTAZIONE CON PIU' GIOCATORI — fino a quattro in campo.
//
// Il prezzo si divide in parti uguali fra i presenti e ogni quota
// viene addebitata SUBITO al portafoglio del suo giocatore, con lo
// stesso meccanismo di tutte le altre prenotazioni: prima il credito,
// poi l'eventuale scoperto sul Credito S.O.S.
//
// ⚠️ Le quote vengono SCRITTE sul documento, una per giocatore. Non e'
// un doppione del prezzo: e' cio' che permette, piu' avanti, di
// cambiare un giocatore senza toccare il conto degli altri. Chi ha
// accettato tre euro e trentatre continua a pagare quelli, qualunque
// cosa succeda intorno.
//
// ⚠️ Tutte le letture PRIMA di ogni scrittura: e' una regola delle
// transazioni Firestore, e con quattro portafogli piu' lo slot e'
// facile perderla di vista mettendo un tx.update in mezzo al ciclo.
// ============================================================
export async function prenotaConGiocatori(params: {
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
  // Gli altri in campo, da uno a tre. Senza quota: la decide questa
  // funzione, cosi' non puo' arrivare storta da una schermata.
  giocatori: { uid: string; nome: string; cognome: string }[];
  note?: string;
  nascondiInfo?: boolean;
  sfidaId?: string | null;
  gruppoId?: string;
  cardId?: string;
  tipoUtente?: 'socio' | 'ospite';
  nuovaPrenotazione?: boolean;
  // ⚠️ Solo per le Sfide Sociali, che sono uno contro uno: scrive anche
  // i vecchi campi compagnoId/Nome/Cognome. Servono alle regole, che
  // per la Sfida lasciano creare e cancellare la prenotazione anche
  // allo sfidato. Per una partita normale restano vuoti: chi e' stato
  // aggiunto guarda e basta, la gestisce chi ha prenotato.
  compagnoLegacy?: boolean;
}): Promise<{ id: string; sosUsatoUtente: boolean; sosUsatoDaAltri: string[] }> {
  const altri = params.giocatori;
  if (altri.length === 0) throw new Error('NESSUN_GIOCATORE');
  if (altri.length > MAX_GIOCATORI_AGGIUNTI) throw new Error('TROPPI_GIOCATORI');
  if (new Set(altri.map((g) => g.uid)).size !== altri.length) throw new Error('GIOCATORE_DUPLICATO');
  if (altri.some((g) => g.uid === params.uid)) throw new Error('GIOCATORE_DUPLICATO');

  const utenteRef = doc(db, 'tessere', idTessera(params.uid, params.circoloId));
  const rifAltri = altri.map((g) => doc(db, 'tessere', idTessera(g.uid, params.circoloId)));
  const prenotazioneRef = rifSlot(params.circoloId, params.campoId, params.data, params.orario);
  const { quotaCiascuno, quotaChiPrenota: miaQuota } = dividiInParti(params.prezzo, altri.length);

  let sosUsatoUtente = false;
  const sosUsatoDaAltri: string[] = [];

  await runTransaction(db, async (tx) => {
    // --- letture ---
    const utenteSnap = await tx.get(utenteRef);
    const snapAltri: any[] = [];
    for (const rif of rifAltri) snapAltri.push(await tx.get(rif));
    if (!utenteSnap.exists() || snapAltri.some((x) => !x.exists())) throw new Error('UTENTE_NON_TROVATO');
    // ⚠️ Il campo e' ancora libero? La domanda si fa QUI dentro, non
    // prima: fra il controllo della schermata e la scrittura passa
    // sempre un momento, e in quel momento chiunque puo' aver preso la
    // stessa mezz'ora. Dentro la transazione, invece, o siamo i primi o
    // ci fermiamo.
    const slotSnap = await tx.get(prenotazioneRef);
    if (slotSnap.exists()) throw new Error(SLOT_OCCUPATO);

    // --- scritture ---
    const nomeChiPrenota = `${params.utenteNome} ${params.utenteCognome}`;
    const conMe = elencoNomi(altri);

    const creditoUtente = (utenteSnap.data()!.credito as number) ?? 0;
    const sosUtente = (utenteSnap.data()!.sosUtilizzato as number) ?? 0;
    const mio = calcolaAddebitoConSOS(creditoUtente, miaQuota);
    sosUsatoUtente = mio.daSOS > 0;
    tx.update(utenteRef, {
      credito: creditoUtente - mio.daCredito,
      ...(sosUsatoUtente ? { sosUtilizzato: sosUtente + mio.daSOS } : {}),
    });
    registraMovimentoInTransazione(tx, {
      circoloId: params.circoloId, uid: params.uid, socioNome: nomeChiPrenota,
      socioRuolo: params.tipoUtente === 'ospite' ? 'ospite' : 'socio_tesserato',
      tipo: 'addebito', gruppoId: params.gruppoId ?? null, cardId: params.cardId ?? null,
      nuovaPrenotazione: !!params.nuovaPrenotazione,
      dataISO: params.data, campoId: params.campoId, campoNome: params.campoNome,
      dataLabel: params.dataLabel, orario: params.orario, orarioFine: orarioFineSlot(params.orario),
      importo: -miaQuota,
      saldoPrima: creditoUtente, saldoDopo: creditoUtente - mio.daCredito,
      debitoPrima: sosUtente, debitoDopo: sosUtente + mio.daSOS,
      eseguitoDaUid: params.uid, eseguitoDaNome: nomeChiPrenota, eseguitoDaRuolo: 'socio',
      prenotazioneId: prenotazioneRef.id,
      compagnoNome: conMe,
      sonoCompagno: false,
      descrizione: `Prenotazione con ${conMe} — la tua quota`,
    });

    altri.forEach((g, i) => {
      const credito = (snapAltri[i].data()!.credito as number) ?? 0;
      const sos = (snapAltri[i].data()!.sosUtilizzato as number) ?? 0;
      const suo = calcolaAddebitoConSOS(credito, quotaCiascuno);
      if (suo.daSOS > 0) sosUsatoDaAltri.push(g.uid);
      tx.update(rifAltri[i], {
        credito: credito - suo.daCredito,
        ...(suo.daSOS > 0 ? { sosUtilizzato: sos + suo.daSOS } : {}),
      });
      registraMovimentoInTransazione(tx, {
        circoloId: params.circoloId, uid: g.uid, socioNome: `${g.nome} ${g.cognome}`,
        tipo: 'addebito', gruppoId: params.gruppoId ?? null, cardId: params.cardId ?? null,
        nuovaPrenotazione: !!params.nuovaPrenotazione,
        dataISO: params.data, campoId: params.campoId, campoNome: params.campoNome,
        dataLabel: params.dataLabel, orario: params.orario, orarioFine: orarioFineSlot(params.orario),
        importo: -quotaCiascuno,
        saldoPrima: credito, saldoDopo: credito - suo.daCredito,
        debitoPrima: sos, debitoDopo: sos + suo.daSOS,
        eseguitoDaUid: params.uid, eseguitoDaNome: nomeChiPrenota,
        // Chi ha prenotato non e' il titolare di questo portafoglio.
        eseguitoDaRuolo: 'compagno',
        prenotazioneId: prenotazioneRef.id,
        compagnoNome: nomeChiPrenota,
        sonoCompagno: true,
        descrizione: `Sei stato aggiunto da ${nomeChiPrenota} — la tua quota`,
      });
    });

    const conQuota: Giocatore[] = altri.map((g) => ({ ...g, quota: quotaCiascuno }));
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
      giocatori: conQuota,
      // L'elenco dei soli identificativi esiste per una ragione sola:
      // e' l'unica forma su cui Firestore sa interrogare (array-contains).
      // Senza, per sapere "in quali partite gioco" bisognerebbe leggere
      // tutte le prenotazioni del circolo.
      giocatoriIds: conQuota.map((g) => g.uid),
      compagnoId: params.compagnoLegacy ? altri[0].uid : null,
      compagnoNome: params.compagnoLegacy ? altri[0].nome : null,
      compagnoCognome: params.compagnoLegacy ? altri[0].cognome : null,
      costoDiviso: true,
      gruppoId: params.gruppoId ?? null,
      cardId: params.cardId ?? null,
      tipoUtente: params.tipoUtente ?? 'socio',
      sfidaId: params.sfidaId ?? null,
      creataIl: serverTimestamp(),
    });
  });
  return { id: prenotazioneRef.id, sosUsatoUtente, sosUsatoDaAltri };
}

// La vecchia porta d'ingresso, per la Sfida Sociale: uno contro uno,
// con i campi compagno* scritti come prima perche' le regole della
// Sfida ci si appoggiano.
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
  cardId?: string;
  tipoUtente?: 'socio' | 'ospite';
  nuovaPrenotazione?: boolean;
}): Promise<{ id: string; sosUsatoUtente: boolean; sosUsatoCompagno: boolean }> {
  const esito = await prenotaConGiocatori({
    ...params,
    giocatori: [{ uid: params.compagnoId, nome: params.compagnoNome, cognome: params.compagnoCognome }],
    compagnoLegacy: true,
  });
  return {
    id: esito.id,
    sosUsatoUtente: esito.sosUsatoUtente,
    sosUsatoCompagno: esito.sosUsatoDaAltri.includes(params.compagnoId),
  };
}

// ============================================================
// CAMBIO GIOCATORE A PARTITA GIA' PRENOTATA
//
// Tre operazioni sole — sostituisci, togli, aggiungi — applicate in
// UNA transazione a TUTTE le mezz'ore della stessa partita. Il perche'
// dell'atomicita': un'ora e mezza sono tre documenti, e se il cambio
// riuscisse su due e non sul terzo resterebbe una partita in cui la
// stessa persona gioca la prima mezz'ora e non la seconda, con i
// portafogli scalati a meta' strada.
//
// ⚠️ Le differenze si calcolano DENTRO la transazione, confrontando le
// quote scritte sui documenti con quelle che ci devono finire. Non le
// manda la schermata: quella lavora su una fotografia che puo' avere
// qualche secondo, e basterebbe un secondo cambio partito da un altro
// telefono per addebitare due volte la stessa quota.
//
// ⚠️ E i prezzi si leggono dai documenti, uno per uno: le mezz'ore di
// una stessa partita possono costare diverso (fascia serale, tariffa
// speciale), e dividere il totale per il numero di mezz'ore darebbe
// quote sbagliate su tutte.
// ============================================================
export async function aggiornaGiocatori(params: {
  circoloId: string;
  // Tutte le mezz'ore della partita, non solo quella toccata.
  prenotazioniIds: string[];
  chiPrenotaUid: string;
  chiPrenotaNome: string;
  // ⚠️ Il nome di OGNI persona toccata dal cambio. Senza, le righe del
  // registro nascevano con il nome vuoto: in segreteria comparivano
  // come "nome non registrato" e — peggio — sparivano dal filtro per
  // socio, cioe' un addebito reale non era piu' rintracciabile.
  nomiPerUid?: Record<string, string>;
  modifica: ModificaGiocatori;
  gruppoId?: string | null;
  cardId?: string | null;
}): Promise<void> {
  if (params.prenotazioniIds.length === 0) return;
  const rifPrenotazioni = params.prenotazioniIds.map((id) => doc(db, 'prenotazioni', id));

  await runTransaction(db, async (tx) => {
    // --- 1. leggo le mezz'ore e calcolo il nuovo elenco di ciascuna ---
    const snapPrenotazioni: any[] = [];
    for (const rif of rifPrenotazioni) snapPrenotazioni.push(await tx.get(rif));
    if (snapPrenotazioni.some((x) => !x.exists())) throw new Error('PRENOTAZIONE_NON_TROVATA');

    const delta = new Map<string, number>();
    const nuoviElenchi: Giocatore[][] = [];
    let riferimento: { data: string; dataLabel: string; campoId: string; campoNome: string; orario: string } | null = null;

    snapPrenotazioni.forEach((snap) => {
      const dati = snap.data() as any;
      if (dati.utenteId !== params.chiPrenotaUid) throw new Error('NON_E_TUA');
      const prezzo = (dati.prezzo as number) ?? 0;
      const prima = giocatoriDi(dati);
      const dopo = applicaModifica(prima, prezzo, params.modifica);
      if (dopo.length > MAX_GIOCATORI_AGGIUNTI) throw new Error('TROPPI_GIOCATORI');
      if (new Set(dopo.map((g) => g.uid)).size !== dopo.length) throw new Error('GIOCATORE_DUPLICATO');
      if (dopo.some((g) => g.uid === params.chiPrenotaUid)) throw new Error('GIOCATORE_DUPLICATO');
      nuoviElenchi.push(dopo);
      for (const [uid, v] of differenzeQuote(prima, dopo, prezzo, params.chiPrenotaUid)) {
        delta.set(uid, Math.round(((delta.get(uid) ?? 0) + v) * 100) / 100);
      }
      if (!riferimento) {
        riferimento = {
          data: dati.data, dataLabel: dati.dataLabel, campoId: dati.campoId,
          campoNome: dati.campoNome, orario: dati.orario,
        };
      }
    });

    // --- 2. leggo i portafogli toccati (tutte le letture prima) ---
    const coinvolti = [...delta.entries()].filter(([, v]) => v !== 0);
    const rifTessere = coinvolti.map(([uid]) => doc(db, 'tessere', idTessera(uid, params.circoloId)));
    const snapTessere: any[] = [];
    for (const rif of rifTessere) snapTessere.push(await tx.get(rif));

    // --- 3. scritture ---
    const rif = riferimento as any;
    coinvolti.forEach(([uid, importo], i) => {
      const snap = snapTessere[i];
      if (!snap.exists()) throw new Error('UTENTE_NON_TROVATO');
      const credito = (snap.data()!.credito as number) ?? 0;
      const sos = (snap.data()!.sosUtilizzato as number) ?? 0;
      let saldoDopo = credito;
      let debitoDopo = sos;
      if (importo > 0) {
        const addebito = calcolaAddebitoConSOS(credito, importo);
        saldoDopo = credito - addebito.daCredito;
        debitoDopo = sos + addebito.daSOS;
        tx.update(rifTessere[i], {
          credito: saldoDopo,
          ...(addebito.daSOS > 0 ? { sosUtilizzato: debitoDopo } : {}),
        });
      } else {
        // Un rimborso estingue prima il debito S.O.S., come ovunque.
        const dopo = applicaRimborso(credito, sos, -importo);
        saldoDopo = dopo.credito;
        debitoDopo = dopo.sosUtilizzato;
        tx.update(rifTessere[i], dopo);
      }
      registraMovimentoInTransazione(tx, {
        circoloId: params.circoloId, uid,
        socioNome: uid === params.chiPrenotaUid
          ? params.chiPrenotaNome
          : (params.nomiPerUid?.[uid] ?? null),
        tipo: importo > 0 ? 'addebito' : 'rimborso',
        gruppoId: params.gruppoId ?? null, cardId: params.cardId ?? null,
        dataISO: rif?.data ?? null, campoId: rif?.campoId ?? null,
        campoNome: rif?.campoNome ?? null, dataLabel: rif?.dataLabel ?? null,
        orario: rif?.orario ?? null, orarioFine: rif?.orario ? orarioFineSlot(rif.orario) : null,
        // ⚠️ UNA riga sola per tutta la partita, non una per mezz'ora:
        // cambiare un giocatore su un'ora e mezza avrebbe riempito lo
        // storico di tre righe identiche da pochi centesimi l'una.
        // Negativo quando esce dal portafoglio, positivo quando ci
        // rientra: e' la convenzione di tutto il registro.
        importo: -importo,
        saldoPrima: credito, saldoDopo,
        debitoPrima: sos, debitoDopo,
        eseguitoDaUid: params.chiPrenotaUid, eseguitoDaNome: params.chiPrenotaNome,
        eseguitoDaRuolo: uid === params.chiPrenotaUid ? 'socio' : 'compagno',
        // Con chi ha giocato: e' cio' che fa comparire nel registro la
        // riga "Aggiunto da …" invece di un addebito senza spiegazione.
        compagnoNome: uid === params.chiPrenotaUid ? null : params.chiPrenotaNome,
        sonoCompagno: uid !== params.chiPrenotaUid,
        prenotazioneId: params.prenotazioniIds[0],
        descrizione: uid === params.chiPrenotaUid
          ? 'Cambio giocatori nella tua prenotazione'
          : (importo > 0
            ? `Sei stato aggiunto da ${params.chiPrenotaNome}`
            : `${params.chiPrenotaNome} ti ha tolto dalla prenotazione`),
      });
    });

    rifPrenotazioni.forEach((rifP, i) => {
      tx.update(rifP, {
        giocatori: nuoviElenchi[i],
        giocatoriIds: nuoviElenchi[i].map((g) => g.uid),
        costoDiviso: nuoviElenchi[i].length > 0,
        // I vecchi campi si spengono: da qui in poi comanda l'elenco.
        // Lasciarli scritti avrebbe fatto comparire in Home e nelle
        // dashboard non aggiornate una persona che non c'e' piu'.
        compagnoId: null, compagnoNome: null, compagnoCognome: null,
      });
    });
  });
}

// Prenota una LEZIONE: stessa identica logica di pagamento di
// prenotaConCredito (il socio paga solo il normale costo del
// campo — la lezione vera si accorda direttamente con il maestro,
// fuori piattaforma), con in più il collegamento al maestro.
// ⚠️ La crea sempre il MAESTRO, dalla sua dashboard: il socio non
// prenota più lezioni da solo, le chiede e il maestro conferma.
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
  // Identificativo della prenotazione logica: senza, ogni mezz'ora di
  // lezione diventerebbe una card a se' in Home e nella dashboard
  // Maestro, perche' il raggruppamento ricadrebbe sull'id documento.
  cardId?: string;
  // Scelta nel pop-up: partita distinta o prolungamento di una attiva.
  nuovaPrenotazione?: boolean;
  prenotataDa: 'socio' | 'maestro';
}): Promise<void> {
  const utenteRef = doc(db, 'tessere', idTessera(params.uid, params.circoloId));
  const prenotazioneRef = rifSlot(params.circoloId, params.campoId, params.data, params.orario);

  await runTransaction(db, async (tx) => {
    const utenteSnap = await tx.get(utenteRef);
    if (!utenteSnap.exists()) throw new Error('UTENTE_NON_TROVATO');
    // ⚠️ Il campo e' ancora libero? La domanda si fa QUI dentro, non
    // prima: fra il controllo della schermata e la scrittura passa
    // sempre un momento, e in quel momento chiunque puo' aver preso la
    // stessa mezz'ora. Dentro la transazione, invece, o siamo i primi o
    // ci fermiamo.
    const slotSnap = await tx.get(prenotazioneRef);
    if (slotSnap.exists()) throw new Error(SLOT_OCCUPATO);

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
      cardId: params.cardId ?? null,
      nuovaPrenotazione: !!params.nuovaPrenotazione,
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
        gruppoId: params.gruppoId ?? null,
        cardId: params.cardId ?? null,
        creataIl: serverTimestamp(),
    });
  });

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
  gruppoId?: string;
  cardId?: string;
}): Promise<void> {
  const prenotazioneRef = rifSlot(params.circoloId, params.campoId, params.data, params.orario);
  await runTransaction(db, async (tx) => {
    const slotSnap = await tx.get(prenotazioneRef);
    if (slotSnap.exists()) throw new Error(SLOT_OCCUPATO);
    tx.set(prenotazioneRef, {
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
      gruppoId: params.gruppoId ?? null,
      cardId: params.cardId ?? null,
      creataIl: serverTimestamp(),
    });
  });

  // L'allievo esterno non ha un portafoglio, ma la lezione occupa il
  // campo: va documentata come tutte le altre.
  await registraMovimentoSemplice({
    circoloId: params.circoloId, uid: '',
    socioNome: params.nomeEsterno,
    tipo: 'addebito', gruppoId: params.gruppoId ?? null,
    cardId: params.cardId ?? null,
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

}

// Quanto va restituito annullando questa prenotazione.
//
// Una LEZIONE non si paga nell'app: il Maestro chiede un importo unico
// che comprende lezione e campo, e regola il campo con la segreteria
// per conto suo. Il prezzo resta scritto sul documento come
// riferimento di quanto vale l'ora di campo, ma dal portafoglio non e'
// mai uscito nulla — quindi annullandola non deve rientrare nulla.
// Rimborsare il prezzo scritto sarebbe regalare credito mai versato.
//
// Passa da qui OGNI cancellazione, in app e sul web: e' l'unico posto
// dove la regola "le lezioni sono a costo zero" viene applicata.
export function importoDaRimborsare(
  p: { tipo?: 'campo' | 'lezione'; prezzo?: number } | null | undefined
): number {
  if (!p) return 0;
  if (p.tipo === 'lezione') return 0;
  return p.prezzo ?? 0;
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
  // Identificativo della prenotazione cancellata: il rimborso deve
  // finire sulla SUA card, non su quella che risulta aperta in quel
  // momento nel registro.
  cardId?: string;
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
      cardId: params.cardId ?? null,
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
  // ⚠️ Vuoto quando i giocatori sono piu' di uno: in quel caso comanda
  // `giocatori`, e questo campo esiste solo per le Sfide e per le
  // prenotazioni fatte con il vecchio modello.
  compagnoId: string;
  // I giocatori con la loro quota, letti dal documento. Quando c'e',
  // ognuno riceve indietro ESATTAMENTE quello che aveva pagato — che
  // dopo un cambio giocatore non e' piu' detto sia una divisione in
  // parti uguali. Senza, si torna al vecchio meta' e meta'.
  giocatori?: Giocatore[];
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
  // Identificativo della prenotazione cancellata: il rimborso deve
  // finire sulla SUA card, non su quella che risulta aperta in quel
  // momento nel registro.
  cardId?: string;
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
  // Da uno a tre. Se non arriva l'elenco si ricade sul vecchio
  // compagno singolo con meta' del prezzo: e' il caso delle Sfide e
  // delle prenotazioni scritte prima di questa versione.
  const altri: Giocatore[] = params.giocatori && params.giocatori.length > 0
    ? params.giocatori
    : [{
      uid: params.compagnoId,
      nome: params.compagnoNome ?? '',
      cognome: '',
      quota: Math.round((params.prezzoTotale / 2) * 100) / 100,
    }];
  const rifAltri = altri.map((g) => doc(db, 'tessere', idTessera(g.uid, params.circoloId)));
  const prenotazioneRef = doc(db, 'prenotazioni', params.prenotazioneId);
  // Quello che torna a chi ha prenotato e' cio' che resta: cosi' la
  // somma dei rimborsi fa esattamente il prezzo pagato, anche quando le
  // quote sono diseguali per via di un cambio giocatore.
  const miaQuota = Math.round(
    (params.prezzoTotale - altri.reduce((t, g) => t + g.quota, 0)) * 100,
  ) / 100;

  await runTransaction(db, async (tx) => {
    const utenteSnap = await tx.get(utenteRef);
    const snapAltri: any[] = [];
    for (const rif of rifAltri) snapAltri.push(await tx.get(rif));
    const creditoUtente = utenteSnap.exists() ? ((utenteSnap.data().credito as number) ?? 0) : 0;
    const debitoUtente = utenteSnap.exists() ? ((utenteSnap.data().sosUtilizzato as number) ?? 0) : 0;

    const dopoUtente = applicaRimborso(creditoUtente, debitoUtente, miaQuota);
    tx.update(utenteRef, dopoUtente);

    // Un movimento per portafoglio: ciascuno deve poter leggere il
    // proprio registro e ritrovarci la propria quota.
    const chiHaCancellato = params.eseguitoDaRuolo ?? 'socio';
    const descr = params.descrizione ?? 'Rimborso della tua quota per cancellazione prenotazione condivisa';
    registraMovimentoInTransazione(tx, {
      circoloId: params.circoloId,
      uid: params.utenteId,
      socioNome: params.socioNome ?? null,
      tipo: 'rimborso',
      gruppoId: params.gruppoId ?? null,
      cardId: params.cardId ?? null,
      dataISO: params.dataISO ?? null,
      campoId: params.campoId ?? null,
      campoNome: params.campoNome ?? null,
      dataLabel: params.dataLabel ?? null,
      orario: params.orario ?? null,
      orarioFine: params.orario ? orarioFineSlot(params.orario) : null,
      parziale: !!params.parziale,
      importo: miaQuota,
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
    altri.forEach((g, i) => {
      const snap = snapAltri[i];
      const credito = snap.exists() ? ((snap.data().credito as number) ?? 0) : 0;
      const debito = snap.exists() ? ((snap.data().sosUtilizzato as number) ?? 0) : 0;
      const dopo = applicaRimborso(credito, debito, g.quota);
      tx.update(rifAltri[i], dopo);
      registraMovimentoInTransazione(tx, {
        circoloId: params.circoloId,
        uid: g.uid,
        socioNome: `${g.nome} ${g.cognome}`.trim() || params.compagnoNome || null,
        tipo: 'rimborso',
        gruppoId: params.gruppoId ?? null,
        cardId: params.cardId ?? null,
        dataISO: params.dataISO ?? null,
        campoId: params.campoId ?? null,
        campoNome: params.campoNome ?? null,
        dataLabel: params.dataLabel ?? null,
        orario: params.orario ?? null,
        orarioFine: params.orario ? orarioFineSlot(params.orario) : null,
        parziale: !!params.parziale,
        importo: g.quota,
        saldoPrima: credito,
        saldoDopo: dopo.credito,
        debitoPrima: debito,
        debitoDopo: dopo.sosUtilizzato,
        eseguitoDaUid: params.eseguitoDaUid ?? null,
        eseguitoDaNome: params.eseguitoDaNome ?? null,
        eseguitoDaRuolo: chiHaCancellato,
        prenotazioneId: params.prenotazioneId,
        descrizione: descr,
      });
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

// Ricarica col Fido, self-service del socio: aggiorna credito E il
// contatore di quanto Fido è stato consumato, in un'unica
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
      descrizione: 'Ricarica con il Fido — da saldare in segreteria',
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
  // Identificativo della prenotazione logica: separa le card in Home
  // anche quando gli orari sono adiacenti.
  cardId?: string | null;
  maestroId?: string;
  maestroNome?: string;
  maestroCognome?: string;
  // Gli altri in campo, con la quota che ciascuno ha pagato per QUESTA
  // mezz'ora. E' l'elenco che comanda: i tre campi qui sotto restano
  // solo per le Sfide e per le prenotazioni scritte prima.
  giocatori?: Giocatore[] | null;
  // Gli stessi identificativi in forma piatta: e' l'unica su cui
  // Firestore sa interrogare (array-contains).
  giocatoriIds?: string[] | null;
  compagnoId?: string;
  compagnoNome?: string;
  compagnoCognome?: string;
  costoDiviso?: boolean; // true se il prezzo è stato davvero diviso fra i giocatori
  note?: string;
  nascondiInfo?: boolean; // se true, altri soci vedono solo "Prenotato", non i dettagli
}

// Quante PARTITE ha prenotato un socio in questo circolo, in tutta la
// sua storia. Serve alla scheda del socio, e per due motivi non usa
// l'ascolto di tutte le prenotazioni del circolo:
//  - e' una lettura sola, non un flusso: la scheda non deve
//    aggiornarsi mentre la si guarda;
//  - il filtro sta sul server. Scaricare l'intera collezione per
//    contarne una manciata, con un documento per ogni mezz'ora e
//    nessuna cancellazione dello storico, vuol dire decine di migliaia
//    di letture a ogni apertura della scheda.
//
// Si contano le PARTITE, non le mezz'ore: mezz'ore consecutive sullo
// stesso campo sono una prenotazione sola. Restano fuori le lezioni,
// che sono un'altra cosa, e tutto quello che nasce da una Sfida —
// le sfide hanno i loro numeri nella stessa scheda, e fra quelle
// prenotazioni ci sono anche i segnaposto sospesi in attesa che il
// timer scada.
export async function contaPartiteSocio(circoloId: string, uid: string): Promise<number> {
  const q = query(
    collection(db, 'prenotazioni'),
    where('circoloId', '==', circoloId),
    where('utenteId', '==', uid)
  );
  const snap = await getDocs(q);
  const righe = snap.docs
    .map((d) => ({ id: d.id, ...(d.data() as any) }))
    .filter((p) => p.tipo !== 'lezione' && !p.sfidaId);
  return raggruppaConsecutive(righe as any).length;
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
          cardId: v.cardId ?? null,
          maestroId: v.maestroId,
          maestroNome: v.maestroNome,
          maestroCognome: v.maestroCognome,
          giocatori: v.giocatori ?? null,
          giocatoriIds: v.giocatoriIds ?? null,
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
