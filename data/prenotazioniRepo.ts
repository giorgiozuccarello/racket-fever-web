// ============================================================
// PRENOTAZIONI + WALLET — operazioni transazionali.
// Ogni prenotazione/cancellazione aggiorna insieme, in un'unica
// transazione Firestore, il documento della prenotazione E il
// credito dell'utente: o vanno a buon fine entrambi, o nessuno dei
// due, così credito e prenotazioni non si disallineano mai.
// ============================================================

import { runTransaction, doc, updateDoc, collection, addDoc, serverTimestamp, query, where, onSnapshot, getDocs } from 'firebase/firestore';
import { db, functions } from '../lib/firebase';
import { httpsCallable } from 'firebase/functions';
import { registraMovimentoInTransazione, registraMovimentoSemplice } from './movimenti';
import { idTessera } from './tessere';
import { orarioFineSlot, limiteFidoDi, fidoCopre } from './circoli';
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
    // ⚠️ Il tetto del Fido, letto qui dentro e non passato da fuori. Sta
    // fra le LETTURE e non fra le scritture: una transazione Firestore
    // vuole tutte le letture prima della prima scrittura, e messa più in
    // basso avrebbe fatto fallire ogni prenotazione con un errore che
    // del Fido non parla affatto.
    const circoloSnap = await tx.get(doc(db, 'circoli', params.circoloId));

    const creditoAttuale = (utenteSnap.data().credito as number) ?? 0;
    const sosAttuale = (utenteSnap.data().sosUtilizzato as number) ?? 0;
    const { daCredito, daSOS } = calcolaAddebitoConSOS(creditoAttuale, params.prezzo);
    sosUsato = daSOS > 0;
    // ⚠️ TERZA PORTA — vedi il riquadro su FIDO_INSUFFICIENTE.
    if (!fidoCopre(limiteFidoDi(circoloSnap.data() as any), sosAttuale, daSOS)) {
      throw new Error(FIDO_INSUFFICIENTE);
    }

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
//
// ⚠️ IL CIRCOLO È OBBLIGATORIO, E NON È UN DETTAGLIO DI PULIZIA: senza,
// questa funzione non rispondeva affatto. Le tre interrogazioni qui sotto
// chiedevano le prenotazioni di un socio in TUTTI i circoli, mentre le
// regole Firestore permettono di leggere una prenotazione solo a chi è
// membro del circolo di quella prenotazione. Su una lista, Firestore
// rifiuta l'intera richiesta se anche un solo documento non passa: bastava
// che il compagno avesse una tessera in un secondo circolo — il Circolo
// dimostrativo, per dire — perché la lettura venisse negata in blocco.
// E il rifiuto finiva in un `catch` che scriveva una riga nel registro e
// lasciava proseguire: il controllo del limite dei compagni sembrava
// esserci e non c'era. È il difetto segnalato da Giorgio il 25 agosto 2026.
//
// ⚠️ E il conto per circolo è anche l'unico corretto: il limite
// settimanale è una regola DI QUEL circolo. Contando tutti i circoli, le
// ore giocate a Milazzo mangiavano il limite di un altro circolo, e
// viceversa.
export async function contaPrenotazioniSettimana(
  uid: string, circoloId: string, inizio: string, fine: string
): Promise<number> {
  // ⚠️ TRE interrogazioni e non due. L'ora di gioco pesa sul limite
  // settimanale di TUTTI quelli che scendono in campo, non solo di chi
  // prenota: senza, un gruppo di quattro gioca tutti i giorni facendo
  // prenotare a turno uno diverso, e il limite del circolo diventa un
  // suggerimento. La terza serve alle prenotazioni fatte con il vecchio
  // modello a un compagno solo, che non hanno l'elenco dei giocatori e
  // sparirebbero dal conto il giorno dell'aggiornamento.
  //
  // Sono le stesse tre di `BookingsContext`, con lo stesso filtro sul
  // circolo: l'indice composto che serve alla seconda
  // (giocatoriIds array-contains + circoloId) è già in
  // `firestore.indexes.json`, messo lì per quella. Le altre due hanno due
  // soli confronti di uguaglianza e Firestore le serve senza indice.
  const q1 = query(collection(db, 'prenotazioni'), where('utenteId', '==', uid), where('circoloId', '==', circoloId));
  const q2 = query(collection(db, 'prenotazioni'), where('giocatoriIds', 'array-contains', uid), where('circoloId', '==', circoloId));
  const q3 = query(collection(db, 'prenotazioni'), where('compagnoId', '==', uid), where('circoloId', '==', circoloId));
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

// ⚠️ QUI STAVA `limiteEffettivoDi`, che sceglieva fra il limite personale
// di un socio e quello del circolo. Tolta il 25 agosto 2026 insieme al
// limite personale: da oggi il limite settimanale è uno solo, quello del
// circolo, e si legge direttamente da `circolo.limiteOreSettimanali`.

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


// ============================================================
// ⚠️ IL TETTO DEL FIDO, CONTROLLATO DENTRO LA TRANSAZIONE.
//
// È la terza porta, dopo le due della schermata di prenotazione. Le
// prime due guardano prima di scrivere e sono quelle che parlano
// all'utente; questa guarda NEL MOMENTO in cui scrive, ed è l'unica che
// vede il credito vero.
//
// Serve contro una cosa che le altre due non possono vedere: due
// telefoni che prenotano insieme. Entrambi leggono lo stesso debito,
// entrambi concludono che il Fido basta, e la somma sfonda. Dentro la
// transazione il secondo rilegge e si ferma.
//
// ⚠️ Il tetto si legge DAL DOCUMENTO DEL CIRCOLO qui dentro, e non
// arriva come parametro: un numero passato da chi chiama è un numero
// che chi chiama può cambiare.
//
// ⚠️ Questo NON rende il tetto inviolabile. La transazione la esegue il
// telefono, e un'app modificata può semplicemente non fare il
// controllo: le uniche difese vere sarebbero le regole Firestore o una
// Cloud Function. È una scelta consapevole, la stessa fatta per il
// limite settimanale — chi sfonda si prende prenotazioni che gli
// vengono addebitate comunque, e il debito resta scritto nero su bianco
// in «Debiti Soci».
//
// ⚠️ E l'Admin non è soggetto al tetto: quando è il circolo a prenotare
// per un socio, il circolo sta decidendo di concedere quel debito. È lo
// stesso principio del limite settimanale.
// ============================================================
export const FIDO_INSUFFICIENTE = 'FIDO_INSUFFICIENTE';

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
  // ============================================================
  // ⚠️ QUANDO A PRENOTARE E' IL CIRCOLO E NON IL SOCIO.
  //
  // Portato dal mobile il 24 agosto 2026. L'Admin che allunga la
  // partita di un socio con dei compagni passava da
  // `prenotaPerSocioDaAdmin`, che i giocatori non li scrive proprio: la
  // mezz'ora aggiunta nasceva SENZA compagni, il socio se la ritrovava
  // addebitata per intero mentre sulle altre pagava una frazione, e i
  // compagni non venivano nemmeno avvisati. In Home la card restava una
  // sola, quindi non si vedeva: si vedeva solo sul portafoglio.
  //
  // Passa di qui invece di duplicare tutta la transazione altrove:
  // divisione delle quote, addebiti, movimenti e riletture sono gli
  // stessi. Cambia solo CHI risulta aver eseguito, che nel registro non
  // e' un dettaglio — e' la riga che si guarda in caso di contestazione.
  //
  // Lasciato assente, tutto si comporta come prima.
  // ============================================================
  daAdmin?: { uid: string | null; nome: string | null };
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
    // ⚠️ Il tetto del Fido, letto qui dentro e non passato da fuori.
    // Sta fra le LETTURE: Firestore le vuole tutte prima della prima
    // scrittura.
    const circoloSnap = await tx.get(doc(db, 'circoli', params.circoloId));
    const limiteFido = limiteFidoDi(circoloSnap.data() as any);
    // Quando prenota il circolo il tetto non si applica: è il circolo
    // stesso a decidere di concedere quel debito.
    const guardaIlFido = !params.daAdmin;

    // --- scritture ---
    const nomeChiPrenota = `${params.utenteNome} ${params.utenteCognome}`;
    const conMe = elencoNomi(altri);

    const creditoUtente = (utenteSnap.data()!.credito as number) ?? 0;
    const sosUtente = (utenteSnap.data()!.sosUtilizzato as number) ?? 0;
    const mio = calcolaAddebitoConSOS(creditoUtente, miaQuota);
    sosUsatoUtente = mio.daSOS > 0;
    // ⚠️ TERZA PORTA, per chi prenota — vedi il riquadro su
    // FIDO_INSUFFICIENTE.
    if (guardaIlFido && !fidoCopre(limiteFido, sosUtente, mio.daSOS)) {
      throw new Error(FIDO_INSUFFICIENTE);
    }
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
      // ⚠️ `eseguitoDaUid` si passa ma non conta: il registro movimenti
      // lo sovrascrive con la firma di chi sta scrivendo davvero.
      eseguitoDaUid: params.uid,
      eseguitoDaNome: params.daAdmin ? params.daAdmin.nome : nomeChiPrenota,
      eseguitoDaRuolo: params.daAdmin ? 'admin' : 'socio',
      prenotazioneId: prenotazioneRef.id,
      compagnoNome: conMe,
      sonoCompagno: false,
      // A quota zero «la tua quota» fa cercare un addebito che non c'e'.
      descrizione: params.daAdmin
        ? (miaQuota === 0
          ? `Prenotazione del circolo con ${conMe} (senza addebito)`
          : `Prenotazione del circolo con ${conMe} — la tua quota`)
        : `Prenotazione con ${conMe} — la tua quota`,
    });

    altri.forEach((g, i) => {
      const credito = (snapAltri[i].data()!.credito as number) ?? 0;
      const sos = (snapAltri[i].data()!.sosUtilizzato as number) ?? 0;
      const suo = calcolaAddebitoConSOS(credito, quotaCiascuno);
      // ⚠️ TERZA PORTA, per ogni compagno. Il nome viaggia nel messaggio
      // d'errore: la schermata deve poter dire CHI si è fermato, non
      // «qualcuno».
      if (guardaIlFido && !fidoCopre(limiteFido, sos, suo.daSOS)) {
        throw new Error(`${FIDO_INSUFFICIENTE}:${g.nome} ${g.cognome}`.trim());
      }
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
        eseguitoDaUid: params.uid,
        eseguitoDaNome: params.daAdmin ? params.daAdmin.nome : nomeChiPrenota,
        // Chi ha prenotato non e' il titolare di questo portafoglio.
        eseguitoDaRuolo: params.daAdmin ? 'admin' : 'compagno',
        prenotazioneId: prenotazioneRef.id,
        compagnoNome: nomeChiPrenota,
        sonoCompagno: true,
        descrizione: params.daAdmin
          ? (quotaCiascuno === 0
            ? `Il circolo ti ha aggiunto alla partita di ${nomeChiPrenota} (senza addebito)`
            : `Il circolo ti ha aggiunto alla partita di ${nomeChiPrenota} — la tua quota`)
          : `Sei stato aggiunto da ${nomeChiPrenota} — la tua quota`,
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
      // ⚠️ L'origine si scrive solo quando c'e': lasciandola sempre, una
      // prenotazione del socio si sarebbe dichiarata «fatta dal circolo».
      ...(params.daAdmin ? { prenotataDa: 'admin', tipo: 'campo' } : {}),
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
  nomiPerUid?: Record<string, string>;
  modifica: ModificaGiocatori;
  gruppoId?: string | null;
  cardId?: string | null;
}): Promise<void> {
  if (params.prenotazioniIds.length === 0) return;
  // ⚠️ TOGLIERE UN GIOCATORE VUOL DIRE RIMBORSARLO, e un rimborso e'
  // denaro che rientra: le regole non lo concedono piu' a nessun
  // client. Questa operazione girava sul telefono e da oggi non
  // potrebbe piu' funzionare — sta sul server per intero, compreso il
  // controllo della lista compagni che prima facevano le regole.
  const chiama = httpsCallable(functions, 'aggiornaGiocatoriPrenotazione');
  try {
    await chiama({
      circoloId: params.circoloId,
      prenotazioniIds: params.prenotazioniIds,
      modifica: params.modifica,
      nomiPerUid: params.nomiPerUid ?? {},
      gruppoId: params.gruppoId ?? null,
      cardId: params.cardId ?? null,
    });
  } catch (e: any) {
    // ⚠️ I messaggi che la schermata riconosce vanno rilanciati COSI'
    // COME SONO. GestioneGiocatori distingue "questa prenotazione non
    // c'e' piu'" da "l'elenco e' cambiato sotto le mani" e da un
    // errore qualunque, e lo fa confrontando il testo: incartandolo in
    // un errore generico, all'utente resterebbe solo "riprova".
    const dentro = e?.details?.message ?? e?.message ?? '';
    for (const noto of ['PRENOTAZIONE_NON_TROVATA', 'ELENCO_CAMBIATO', 'NON_E_TUA',
      'TROPPI_GIOCATORI', 'GIOCATORE_DUPLICATO', 'UTENTE_NON_TROVATO']) {
      if (String(dentro).includes(noto)) throw new Error(noto);
    }
    throw e;
  }
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
// ============================================================
// ⚠️ DA QUI IN GIU' IL DENARO LO MUOVE IL SERVER.
//
// Le firme di queste funzioni sono rimaste IDENTICHE apposta: sono
// chiamate da diciotto punti fra app e dashboard, e cambiarle tutte
// avrebbe voluto dire diciotto occasioni di sbagliare in una tornata
// in cui l'unica cosa che conta e' non rompere niente. Quello che e'
// cambiato e' il corpo: al posto della transazione locale c'e' una
// chiamata alla Cloud Function, che fa lo stesso lavoro dove nessuno
// puo' suggerirle un prezzo.
//
// ⚠️ I PARAMETRI DI SOLA APPARENZA NON SI MANDANO PIU'. Prezzo, quote,
// nomi, campo, data: il server li rilegge tutti dal documento della
// prenotazione. Prima li mandava il telefono, e bastava cambiare il
// numero del prezzo per farsi restituire piu' di quanto si era
// pagato. Restano accettati nella firma perche' i chiamanti li
// passano ancora — semplicemente non servono piu' a niente, e non
// vanno tolti finche' non si ripuliscono i chiamanti con calma.
// ============================================================
// ============================================================
// ⚠️ QUANTE MEZZ'ORE RESTANO, DETTO DAL SERVER.
//
// Portato dal mobile il 24 agosto 2026. `annullaPrenotazione`
// restituisce `restano`: quante mezz'ore della stessa card sono ancora
// in piedi dopo la cancellazione. E' quel numero a decidere se
// l'avviso deve dire «cancellata» o «modificata», di che colore sara'
// la sua fascetta, e se portare o no il codice della card.
//
// ⚠️ NON SI CONTA NELLA SCHERMATA. L'elenco che la dashboard tiene in
// memoria arriva da un ascolto ed e' indietro di un giro proprio
// nell'istante dopo una cancellazione: contando di li', la risposta
// era sbagliata quasi sempre — ed e' il motivo per cui sul web usciva
// sempre «Annullato».
//
// Zero anche quando il campo manca o non e' un numero: nel dubbio si
// dice «cancellata», che e' l'errore innocuo dei due — la card e' li'
// e si vede. Dire «modificata» su una partita che non esiste piu'
// manderebbe qualcuno a cercarla.
// ============================================================
function mezzoreSuperstiti(esito: unknown): number {
  const dati = ((esito as { data?: unknown })?.data ?? {}) as { restano?: unknown };
  return typeof dati.restano === 'number' && dati.restano > 0 ? dati.restano : 0;
}

export async function cancellaConRimborso(params: {
  uid: string;
  circoloId: string;
  prenotazioneId: string;
  prezzo: number;
  eseguitoDaUid?: string | null;
  eseguitoDaNome?: string | null;
  eseguitoDaRuolo?: 'socio' | 'compagno' | 'admin' | 'maestro';
  descrizione?: string;
  socioNome?: string;
  compagnoNome?: string;
  gruppoId?: string;
  cardId?: string;
  campoNome?: string;
  dataLabel?: string;
  dataISO?: string;
  campoId?: string;
  orario?: string;
  parziale?: boolean;
}): Promise<number> {
  const chiama = httpsCallable(functions, 'annullaPrenotazione');
  const esito = await chiama({
    prenotazioneId: params.prenotazioneId,
    parziale: !!params.parziale,
    descrizione: params.descrizione ?? null,
  });
  return mezzoreSuperstiti(esito);
}

// Stessa Function della cancellazione singola: il server guarda il
// documento e capisce da solo se il costo era diviso e fra quanti —
// era gia' scritto li' dentro, e chiederlo al telefono era solo un
// modo per farselo raccontare da chi aveva interesse a raccontarlo
// diversamente.
export async function cancellaConRimborsoDiviso(params: {
  utenteId: string;
  compagnoId: string;
  giocatori?: Giocatore[];
  circoloId: string;
  prenotazioneId: string;
  prezzoTotale: number;
  eseguitoDaUid?: string | null;
  eseguitoDaNome?: string | null;
  eseguitoDaRuolo?: 'socio' | 'compagno' | 'admin' | 'maestro';
  descrizione?: string;
  socioNome?: string;
  compagnoNome?: string;
  gruppoId?: string;
  cardId?: string;
  campoNome?: string;
  dataLabel?: string;
  dataISO?: string;
  campoId?: string;
  orario?: string;
  parziale?: boolean;
}): Promise<number> {
  const chiama = httpsCallable(functions, 'annullaPrenotazione');
  const esito = await chiama({
    prenotazioneId: params.prenotazioneId,
    parziale: !!params.parziale,
    descrizione: params.descrizione ?? null,
  });
  return mezzoreSuperstiti(esito);
}

// Cancella una lezione con un allievo NON socio: nessun wallet da cui
// era stato scalato nulla in origine (vedi prenotaLezioneEsterno), quindi
// qui non c'è alcun rimborso da fare — solo la rimozione dello slot.
//
// ⚠️ MA PASSA DALLA FUNCTION LO STESSO, e non per il denaro: qui di
// denaro non ce n'è. Cancellando direttamente il documento, la lezione
// spariva senza lasciare traccia in lezioni_annullate — che è proprio
// la collezione nata per contare le disdette degli allievi ESTERNI,
// gli unici che il registro dei movimenti non copre. Il conteggio
// sulla scheda del Maestro avrebbe detto "0 annullate" per un Maestro
// che lavora solo con allievi esterni: un numero falso, e credibile.
// Nessun client può scrivere quella traccia — le regole la vietano —
// quindi l'unica strada è questa.
export async function cancellaSenzaRimborso(prenotazioneId: string): Promise<number> {
  const chiama = httpsCallable(functions, 'annullaPrenotazione');
  const esito = await chiama({ prenotazioneId, parziale: false, descrizione: null });
  return mezzoreSuperstiti(esito);
}

// Ricarica del wallet da parte della segreteria/Admin Circolo.
// Anche qui vale la regola generale: se il socio ha un debito aperto,
// la somma versata lo estingue prima di finire sul credito. Altrimenti
// avrebbe credito e debito accesi insieme dopo aver appena pagato.
export async function ricaricaCredito(
  uid: string, circoloId: string, importo: number,
  eseguitoDa?: { uid: string; nome: string }, socioNome?: string
): Promise<void> {
  // Chi esegue e come si chiama li ricava il server da chi ha chiamato:
  // erano due campi che il telefono poteva scrivere a piacere, ed e'
  // la firma con cui una riga finisce nel registro contabile.
  const chiama = httpsCallable(functions, 'movimentoCredito');
  await chiama({ tipo: 'ricarica', uid, circoloId, importo });
}

// Azzera del tutto il credito di un socio — per i casi in cui smette
// di usare il wallet e la segreteria lo rimborsa in contanti/altro
// canale reale, fuori dall'app.
export async function azzeraCredito(
  uid: string, circoloId: string, eseguitoDa?: { uid: string; nome: string }, socioNome?: string
): Promise<void> {
  const chiama = httpsCallable(functions, 'movimentoCredito');
  await chiama({ tipo: 'azzeramento', uid, circoloId });
}

// ⚠️ QUI STAVA `ricaricaSOS`, con cui il socio si prestava denaro dal
// circolo di propria iniziativa. Tolta il 25 agosto 2026 insieme alla
// Cloud Function `ricaricaFido` che la serviva e al campo per socio
// `limiteRicaricaSOS` che le faceva da tetto.
// Il Fido non si «ricarica» piu': interviene da solo in prenotazione
// quando il credito non basta, fino al tetto che il circolo ha deciso
// (`limiteFido`), e si salda in segreteria. Per aggiungere credito vero
// il socio fa un bonifico al circolo.
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

// ⚠️ QUESTO ASCOLTO NON HA UN LIMITE E NON HA UN FILTRO DI DATA: porta
// nel dispositivo TUTTE le prenotazioni del circolo, comprese quelle di
// due anni fa, e la collezione non viene mai potata. Lo aprono la
// griglia del socio, la dashboard Admin e quella del Maestro — cioe'
// le schermate piu' usate dell'applicazione.
//
// Non e' un difetto di questa funzione: e' il modo in cui la griglia e'
// costruita, e finche' mostra "chi ha prenotato cosa" le serve tutto.
// Ma e' la lettura piu' cara del progetto, ed e' quella da affrontare
// quando i circoli cresceranno — la Scheda Circolo del Super Admin, che
// aveva lo stesso problema, adesso legge una fotografia calcolata a
// notte dal server e non passa piu' di qui.
export function ascoltaPrenotazioniCircolo(
  circoloId: string,
  callback: (p: PrenotazioneAdmin[]) => void,
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
    (errore) => console.warn('Ascolto prenotazioni interrotto (probabile logout):', errore?.message ?? errore),
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
