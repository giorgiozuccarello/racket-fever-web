// ============================================================
// TESSERE — la relazione fra un utente e un circolo.
//
// Prima di questo modulo l'appartenenza era un attributo del
// profilo (utenti/{uid}.circoloId) e il portafoglio viveva lì:
// un utente = un circolo = un credito.
//
// Con le tessere la relazione diventa un oggetto a sé: un utente
// può averne più di una, e OGNI tessera ha il proprio credito e il
// proprio debito.
//
// REGOLA FONDAMENTALE — i portafogli non comunicano mai fra loro.
// Il credito versato in segreteria al circolo A resta al circolo A:
// cambiando circolo con lo switch, l'utente vede il portafoglio di
// quel circolo, mai un saldo trasportato o sommato. Ogni segreteria
// gestisce e risponde solo del proprio.
// ============================================================

import {
  doc, getDoc, setDoc, updateDoc, collection, query, where,
  onSnapshot, getDocs, serverTimestamp, deleteField, deleteDoc,
} from 'firebase/firestore';
import { db, functions } from '../lib/firebase';
import { httpsCallable } from 'firebase/functions';
import { creaAperturePerCircolo } from './movimenti';
import { raggruppaConsecutive } from './raggruppamento';
import { chiudiConversazioneLezione } from './conversazioneLezione';

export type StatoTessera = 'in_attesa' | 'approvata' | 'sospesa' | 'chiusa' | 'rifiutata';

// Il ruolo NON è modificabile: un ospite non "diventa" socio dello
// stesso circolo. Se cambia il circolo di tesseramento FITP, sarà
// l'admin del nuovo circolo ad assegnargli la tessera principale.
export type RuoloTessera = 'socio_tesserato' | 'ospite';

export interface Tessera {
  id: string;              // `${uid}_${circoloId}`
  uid: string;
  circoloId: string;
  stato: StatoTessera;
  ruolo: RuoloTessera;
  principale: boolean;     // true solo per il circolo di tesseramento FITP
  credito: number;
  sosUtilizzato: number;
  limiteRicaricaSOS?: number;
  limitePrenotazioniPersonale?: number;
  posizioneClassificaSociale?: number | null;
  temaAppPersonale?: string | null; // tema scelto dal socio PER QUESTO circolo
  // Telefono lasciato dal richiedente per essere ricontattato sull'esito.
  // Sta sulla TESSERA e non sul profilo: ogni circolo vede solo il numero
  // che l'utente ha dato A QUEL circolo, non quello dato ad altri.
  // Facoltativo, e cancellato in caso di rifiuto.
  telefono?: string | null;
  richiestaIl?: unknown;
  approvataIl?: unknown;
  approvataDa?: string | null;
  // Dati anagrafici duplicati dal profilo: servono all'admin per
  // elencare e cercare i propri tesserati senza dover leggere il
  // documento utente di ognuno.
  nome: string;
  cognome: string;
  email: string;
}

export function idTessera(uid: string, circoloId: string): string {
  return `${uid}_${circoloId}`;
}

// ---------- LETTURA ----------

export async function leggiTessera(uid: string, circoloId: string): Promise<Tessera | null> {
  const snap = await getDoc(doc(db, 'tessere', idTessera(uid, circoloId)));
  if (!snap.exists()) return null;
  return normalizza(snap.id, snap.data());
}

// Tutte le tessere di un utente: alimenta lo switcher dei circoli.
export function ascoltaTessereUtente(uid: string, callback: (tessere: Tessera[]) => void) {
  const q = query(collection(db, 'tessere'), where('uid', '==', uid));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => normalizza(d.id, d.data())));
  });
}

// Tutte le tessere di un circolo: elenco unico lato admin.
// Soci tesserati e ospiti stanno insieme — per prenotazioni,
// classifica e sfide sono la stessa cosa; il ruolo serve solo a
// distinguerli visivamente e per il costo di attivazione.
// ⚠️ onErrore non e' un lusso. Un ascolto respinto e un ascolto lento
// si assomigliano troppo: senza distinguerli, una schermata mostra
// "0 tessere" — che e' un'informazione, e sbagliata — invece di dire
// che il dato non e' arrivato. Sulla Scheda Circolo del Super Admin
// quel numero serve a giudicare un circolo, quindi la differenza
// conta due volte.
export function ascoltaTessereCircolo(
  circoloId: string,
  callback: (tessere: Tessera[]) => void,
  onErrore?: () => void,
) {
  const q = query(collection(db, 'tessere'), where('circoloId', '==', circoloId));
  return onSnapshot(
    q,
    (snap) => callback(snap.docs.map((d) => normalizza(d.id, d.data()))),
    (errore) => {
      console.warn('Ascolto tessere del circolo interrotto:', errore?.message ?? errore);
      onErrore?.();
    },
  );
}

function normalizza(id: string, v: Record<string, unknown>): Tessera {
  return {
    id,
    uid: (v.uid as string) ?? '',
    circoloId: (v.circoloId as string) ?? '',
    stato: (v.stato as StatoTessera) ?? 'in_attesa',
    ruolo: (v.ruolo as RuoloTessera) ?? 'socio_tesserato',
    principale: !!v.principale,
    credito: (v.credito as number) ?? 0,
    sosUtilizzato: (v.sosUtilizzato as number) ?? 0,
    limiteRicaricaSOS: (v.limiteRicaricaSOS as number) ?? 0,
    limitePrenotazioniPersonale: (v.limitePrenotazioniPersonale as number) ?? 0,
    posizioneClassificaSociale: (v.posizioneClassificaSociale as number | null) ?? null,
    temaAppPersonale: (v.temaAppPersonale as string | null) ?? null,
    telefono: (v.telefono as string | null) ?? null,
    richiestaIl: v.richiestaIl,
    approvataIl: v.approvataIl,
    approvataDa: (v.approvataDa as string | null) ?? null,
    nome: (v.nome as string) ?? '',
    cognome: (v.cognome as string) ?? '',
    email: (v.email as string) ?? '',
  };
}

// ---------- SCRITTURA ----------

export async function creaRichiestaTessera(params: {
  uid: string;
  circoloId: string;
  ruolo: RuoloTessera;
  principale: boolean;
  nome: string;
  cognome: string;
  email: string;
  telefono?: string;
}): Promise<void> {
  const id = idTessera(params.uid, params.circoloId);
  await setDoc(doc(db, 'tessere', id), {
    uid: params.uid,
    circoloId: params.circoloId,
    stato: 'in_attesa',
    ruolo: params.ruolo,
    principale: params.principale,
    credito: 0,
    sosUtilizzato: 0,
    limiteRicaricaSOS: 0,
    limitePrenotazioniPersonale: 0,
    posizioneClassificaSociale: null,
    nome: params.nome,
    cognome: params.cognome,
    email: params.email,
    telefono: params.telefono?.trim() || null,
    richiestaIl: serverTimestamp(),
  }, { merge: true });
}

// Le sole richieste ancora da valutare da parte dell'admin.
export function ascoltaRichiesteInSospeso(circoloId: string, callback: (tessere: Tessera[]) => void) {
  const q = query(
    collection(db, 'tessere'),
    where('circoloId', '==', circoloId),
    where('stato', '==', 'in_attesa')
  );
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => normalizza(d.id, d.data())));
  });
}

// Rifiuto: la tessera resta come traccia dell'esito, ma il socio può
// ripresentare la richiesta (creaRichiestaTessera la riporta in
// "in_attesa" con merge). Nessun blocco permanente.
export async function rifiutaTessera(uid: string, circoloId: string): Promise<void> {
  await updateDoc(doc(db, 'tessere', idTessera(uid, circoloId)), {
    stato: 'rifiutata',
    rifiutataIl: serverTimestamp(),
    // Il numero era stato dato per essere ricontattati su QUESTA
    // richiesta: se il circolo rifiuta, non ha piu' motivo di tenerlo.
    telefono: deleteField(),
  });
}

export async function approvaTessera(uid: string, circoloId: string, approvataDa: string): Promise<void> {
  const rifTessera = doc(db, 'tessere', idTessera(uid, circoloId));
  await updateDoc(rifTessera, {
    stato: 'approvata',
    approvataIl: serverTimestamp(),
    approvataDa,
  });

  // Se e' la tessera PRINCIPALE (il circolo di tesseramento), si
  // allinea anche il campo circoloId del profilo. Serve a due cose:
  //  - login e avvio dell'app decidono da li' se l'utente ha gia' un
  //    circolo: senza, un socio appena approvato si ritroverebbe
  //    di nuovo davanti alla scelta del circolo;
  //  - alcune regole Firestore risalgono al circolo di un socio
  //    proprio da quel campo (notifiche, lettura profili).
  try {
    const snap = await getDoc(rifTessera);
    if (snap.exists() && snap.data().principale === true) {
      await updateDoc(doc(db, 'utenti', uid), { circoloId });
    }
  } catch (e) {
    console.warn('Profilo non allineato dopo approvazione tessera:', uid, e);
  }
}

export async function cambiaStatoTessera(uid: string, circoloId: string, stato: StatoTessera): Promise<void> {
  await updateDoc(doc(db, 'tessere', idTessera(uid, circoloId)), { stato });
}

// ⚠️ QUESTA FUNZIONE NON E' COLLEGATA A NIENTE, E OGGI NON
// FUNZIONEREBBE. Nessuna schermata la chiama — verificato su
// entrambi i progetti — e le regole Firestore la respingerebbero in
// due punti: la query cerca fra le tessere di TUTTI i circoli (un
// Admin puo' leggere solo quelle del proprio, e una query che
// potrebbe restituire documenti non leggibili viene rifiutata
// interamente), e il declassamento scrive sulla tessera di un ALTRO
// circolo, che nessuna regola consente.
//
// Non e' un difetto da tappare aprendo permessi: il gesto e'
// intrinsecamente fra due circoli, e nessuno dei due Admin ha titolo
// per agire dentro l'altro. Va rifatto come Cloud Function, che
// scavalca le regole perche' e' il server. Finche' non lo e', resta
// qui come specifica di cosa deve fare — non chiamarla.
//
// L'admin del NUOVO circolo assegna a sé la tessera principale
// (l'utente ha rifatto il tesseramento FITP altrove). Toglie il flag
// dalla vecchia principale, così ne resta sempre una sola.
// Restituisce i circoli DECLASSATI, cioe' quelli che erano
// principali e diventano Ospite: il chiamante deve avvisarli, perche'
// altrimenti scoprirebbero il cambio per caso — e magari hanno ancora
// un conto aperto con quella persona.
export async function assegnaTesseraPrincipale(uid: string, circoloId: string): Promise<string[]> {
  const q = query(collection(db, 'tessere'), where('uid', '==', uid), where('principale', '==', true));
  const snap = await getDocs(q);
  const declassati: string[] = [];

  for (const d of snap.docs) {
    if (d.id === idTessera(uid, circoloId)) continue;
    // Il vecchio circolo di tesseramento non sparisce: la persona vi
    // resta come Ospite, quindi puo' continuare a prenotare li' e il
    // suo credito residuo resta dov'e'.
    await updateDoc(d.ref, { principale: false, ruolo: 'ospite' });
    declassati.push(d.data().circoloId as string);
  }

  await updateDoc(doc(db, 'tessere', idTessera(uid, circoloId)), {
    principale: true,
    ruolo: 'socio_tesserato',
  });

  // Il profilo punta al nuovo circolo di tesseramento: e' da li' che
  // login e avvio dell'app capiscono dove mandare l'utente.
  try {
    await updateDoc(doc(db, 'utenti', uid), { circoloId });
  } catch (e) {
    console.warn('Profilo non allineato dopo cambio circolo principale:', uid, e);
  }

  return declassati;
}

// ---------- PORTAFOGLIO (per circolo) ----------

// ⚠️ IL PORTAFOGLIO NON LO SCRIVE PIU' IL CLIENT.
// Queste tre restano perche' qualcuno potrebbe chiamarle, ma il
// lavoro lo fa la Cloud Function: le regole Firestore adesso vietano a
// qualunque client di aumentare il valore netto di una tessera, quindi
// una updateDoc diretta verrebbe respinta comunque.
export async function ricaricaCreditoTessera(uid: string, circoloId: string, importo: number): Promise<void> {
  const chiama = httpsCallable(functions, 'movimentoCredito');
  await chiama({ tipo: 'ricarica', uid, circoloId, importo });
}

export async function azzeraCreditoTessera(uid: string, circoloId: string): Promise<void> {
  const chiama = httpsCallable(functions, 'movimentoCredito');
  await chiama({ tipo: 'azzeramento', uid, circoloId });
}

export async function azzeraSosTessera(uid: string, circoloId: string): Promise<void> {
  const chiama = httpsCallable(functions, 'movimentoCredito');
  await chiama({ tipo: 'saldoDebito', uid, circoloId });
}

export async function impostaLimiteSosTessera(uid: string, circoloId: string, limite: number): Promise<void> {
  await updateDoc(doc(db, 'tessere', idTessera(uid, circoloId)), { limiteRicaricaSOS: limite });
}

export async function impostaLimitePersonaleTessera(uid: string, circoloId: string, limite: number): Promise<void> {
  await updateDoc(doc(db, 'tessere', idTessera(uid, circoloId)), { limitePrenotazioniPersonale: limite });
}

export async function impostaPosizioneClassificaTessera(
  uid: string, circoloId: string, posizione: number | null
): Promise<void> {
  await updateDoc(doc(db, 'tessere', idTessera(uid, circoloId)), {
    posizioneClassificaSociale: posizione === null ? deleteField() : posizione,
  });
}

// ---------- CHIUSURA E SALDO ----------

// Chiude la tessera lasciando visibile il saldo da regolare: la
// restituzione del credito (o il recupero del debito) avviene in
// segreteria, fuori dall'app, come ogni altro movimento di denaro.
export async function chiudiTessera(uid: string, circoloId: string): Promise<void> {
  await updateDoc(doc(db, 'tessere', idTessera(uid, circoloId)), {
    stato: 'chiusa',
    chiusaIl: serverTimestamp(),
    // Il flag "principale" va tolto: chi esce dal circolo di
    // tesseramento non ha piu' un circolo principale, e senza questo
    // lo switcher continuerebbe a cercarlo li'.
    principale: false,
  });
}

// Anteprima delle conseguenze di una rimozione, da mostrare all'admin
// PRIMA di confermare: quante prenotazioni future verranno cancellate,
// quante sfide chiuse, e quale saldo restera' da regolare.
export async function anteprimaRimozione(uid: string, circoloId: string): Promise<{
  prenotazioniFuture: number;
  credito: number;
  debito: number;
  inClassifica: boolean;
}> {
  const oggi = new Date().toISOString().slice(0, 10);
  const t = await leggiTessera(uid, circoloId);

  const qP = query(
    collection(db, 'prenotazioni'),
    where('circoloId', '==', circoloId),
    where('utenteId', '==', uid)
  );
  const snapP = await getDocs(qP);
  const future = snapP.docs.filter((d) => (d.data().data as string) >= oggi).length;

  return {
    prenotazioniFuture: future,
    credito: t?.credito ?? 0,
    debito: t?.sosUtilizzato ?? 0,
    inClassifica: t?.posizioneClassificaSociale != null,
  };
}

// Tessere chiuse con un saldo ancora aperto: sono le posizioni che
// la segreteria deve regolare (restituire un credito o recuperare un
// debito). Chi ha saldo zero non compare: non c'e' nulla da fare.
export function ascoltaTessereDaSaldare(circoloId: string, callback: (t: Tessera[]) => void) {
  const q = query(
    collection(db, 'tessere'),
    where('circoloId', '==', circoloId),
    where('stato', '==', 'chiusa')
  );
  return onSnapshot(q, (snap) => {
    const elenco = snap.docs
      .map((d) => normalizza(d.id, d.data()))
      .filter((t) => (t.credito ?? 0) > 0 || (t.sosUtilizzato ?? 0) > 0);
    callback(elenco);
  });
}

// Le pendenze di UN utente su tutti i circoli: alimenta il riepilogo
// che vede lui, quando e' stato rimosso e ha conti in sospeso.
export function ascoltaPendenzeUtente(uid: string, callback: (t: Tessera[]) => void) {
  const q = query(collection(db, 'tessere'), where('uid', '==', uid));
  return onSnapshot(q, (snap) => {
    const elenco = snap.docs
      .map((d) => normalizza(d.id, d.data()))
      .filter((t) => t.stato === 'chiusa' && ((t.credito ?? 0) > 0 || (t.sosUtilizzato ?? 0) > 0));
    callback(elenco);
  });
}

// Saldo regolato in segreteria: azzera i contatori della tessera.
// ⚠️ "Saldato" vuol dire due cose in una: il socio ha pagato il debito
// e ha ritirato il credito residuo. Una sola chiamata e una sola
// transazione lato server, e una sola riga nel registro — erano due
// chiamate separate, e se la seconda non andava il socio usciva dalla
// segreteria con il debito incassato e il credito ancora scritto.
export async function saldaTessera(uid: string, circoloId: string): Promise<void> {
  const chiama = httpsCallable(functions, 'movimentoCredito');
  await chiama({ tipo: 'saldoChiusura', uid, circoloId });
  await updateDoc(doc(db, 'tessere', idTessera(uid, circoloId)), {
    saldataIl: serverTimestamp(),
  });
}

// ============================================================
// RESET DI TEST — azzera crediti, debiti e prenotazioni dei soci
// di un circolo. Serve a ripartire puliti fra due sessioni di prova.
//
// ATTENZIONE: cancella dati reali. Le prenotazioni eliminate
// spariscono anche dalle card in Home e dalla griglia oraria,
// perché sono la stessa cosa: un documento per mezz'ora.
//
// Non tocca: le tessere in sé (nessuno viene espulso dal circolo),
// le posizioni in classifica, le sfide (per quelle c'è il reset
// dedicato).
// ============================================================
export async function resettaSociTest(circoloId: string): Promise<{
  tessereAzzerate: number;
  prenotazioniCancellate: number;
  movimentiCancellati: number;
  aperture: number;
  avvisiCancellati: number;
  sfideCancellate: number;
  richiesteCancellate: number;
  // -1 = l'elenco non si e' proprio potuto leggere (regole non
  // pubblicate?); >0 = lette ma alcune non cancellate.
  richiesteFallite: number;
  // Il motivo vero della prima che non e' andata, da mostrare
  // all'Admin: senza, un fallimento resta un mistero.
  motivoRichieste: string;
}> {
  // Primo passo: portafogli a zero, tessera per tessera.
  const qT = query(collection(db, 'tessere'), where('circoloId', '==', circoloId));
  const snapT = await getDocs(qT);
  let tessereAzzerate = 0;
  for (const d of snapT.docs) {
    try {
      await updateDoc(d.ref, { credito: 0, sosUtilizzato: 0 });
      tessereAzzerate++;
    } catch (e) {
      console.warn('Tessera non azzerata durante il reset:', d.id, e);
    }
  }


  // ⚠️ PRIMA le richieste di lezione e le loro conversazioni, POI le
  // prenotazioni. Nell'ordine inverso, per tutta la durata del reset
  // ogni richiesta confermata del circolo risulta "confermata senza
  // campi" — che e' la fotografia di una conferma andata a meta' — e i
  // soci collegati si vedono comparire in Home "Lezione confermata ma
  // campi non occupati".
  // I messaggi stanno in una sottocollezione e Firestore NON li elimina
  // insieme al documento padre: vanno cancellati PRIMA, o resterebbero
  // conversazioni orfane che nessuno puo' piu' ne' leggere ne'
  // ripulire — nemmeno un reset successivo, che le cerca partendo dal
  // padre.
  let richiesteCancellate = 0;
  let richiesteFallite = 0;
  // ⚠️ Il motivo del fallimento va PORTATO A SCHERMO. Prima finiva solo
  // in console: l'Admin leggeva "una richiesta non cancellata" e non
  // aveva modo di sapere perche', ne' quale.
  let motivoRichieste = '';

  // Cancella una conversazione e i suoi messaggi. Il padre va per
  // ULTIMO e solo a sottocollezione vuota: un messaggio scritto fra la
  // lettura e la cancellazione sopravviverebbe al padre, e da quel
  // momento sarebbe illeggibile e incancellabile per chiunque —
  // nemmeno un reset successivo lo raggiunge, perche' lo cerca
  // partendo dal padre. E un messaggio che non si lascia cancellare
  // non deve far rinunciare a tutti gli altri.
  // (Sul mobile lo stesso giro sta in eliminaRichiesta; qui il modulo
  // delle lezioni non esiste, l'app Maestro e' solo li'.)
  const eliminaConversazione = async (richiestaId: string) => {
    const messaggi = collection(db, 'richieste_lezione', richiestaId, 'messaggi');
    let ultimoErrore: any = null;
    for (let giro = 0; giro < 4; giro++) {
      const msg = await getDocs(messaggi);
      if (msg.empty) break;
      ultimoErrore = null;
      let qualcunoTolto = false;
      for (const m of msg.docs) {
        try { await deleteDoc(m.ref); qualcunoTolto = true; }
        catch (e) { ultimoErrore = e; }
      }
      if (!qualcunoTolto) break;
    }
    const rimasti = await getDocs(messaggi);
    if (!rimasti.empty) {
      const codice = ultimoErrore?.code ?? 'sconosciuto';
      const dettaglio = ultimoErrore?.message ?? 'nessun errore riportato';
      throw new Error(`MESSAGGI_NON_CANCELLATI (${rimasti.size} rimasti, ${codice}: ${dettaglio})`);
    }
    await deleteDoc(doc(db, 'richieste_lezione', richiestaId));
  };

  try {
    // Due giri, non uno: il primo puo' fallire su una conversazione per
    // un motivo passeggero (un messaggio scritto proprio in quel
    // momento), e il secondo la prende.
    for (let giro = 0; giro < 2; giro++) {
      const snap = await getDocs(query(collection(db, 'richieste_lezione'), where('circoloId', '==', circoloId)));
      if (snap.empty) break;
      richiesteFallite = 0;
      motivoRichieste = '';
      for (const d of snap.docs) {
        try {
          await eliminaConversazione(d.id);
          richiesteCancellate++;
        } catch (e: any) {
          richiesteFallite++;
          if (!motivoRichieste) motivoRichieste = `${d.id}: ${e?.code ?? ''} ${e?.message ?? e}`.trim();
          console.warn('Richiesta di lezione non cancellata:', d.id, e);
        }
      }
      if (richiesteFallite === 0) break;
    }
  } catch (e: any) {
    // Distinto dal "non ce n'erano": senza, l'Admin legge "0 richieste
    // cancellate" e non ha modo di capire se il reset ha funzionato o
    // se le regole non sono pubblicate.
    richiesteFallite = -1;
    motivoRichieste = `${e?.code ?? ''} ${e?.message ?? e}`.trim();
    console.warn('Richieste di lezione non lette durante il reset:', e);
  }

  // Secondo passo: tutte le prenotazioni del circolo, anche passate —
  // il reset serve a ripartire da zero, non a fare pulizia parziale.
  const qP = query(collection(db, 'prenotazioni'), where('circoloId', '==', circoloId));
  const snapP = await getDocs(qP);
  let prenotazioniCancellate = 0;
  for (const d of snapP.docs) {
    try {
      await deleteDoc(d.ref);
      prenotazioniCancellate++;
    } catch (e) {
      console.warn('Prenotazione già assente durante il reset:', d.id, e);
    }
  }

  // Terzo passo: svuota il registro movimenti di questo circolo e
  // riscrive una riga di apertura per ogni tessera. Senza, il registro
  // conterrebbe la storia di prenotazioni che non esistono piu' e la
  // catena saldoPrima → saldoDopo risulterebbe incoerente.
  const qM = query(collection(db, 'movimenti'), where('circoloId', '==', circoloId));
  const snapM = await getDocs(qM);
  let movimentiCancellati = 0;
  for (const d of snapM.docs) {
    try {
      await deleteDoc(d.ref);
      movimentiCancellati++;
    } catch (e) {
      console.warn('Movimento non cancellato durante il reset:', d.id, e);
    }
  }

  // Quarto passo: gli avvisi. Restando, l'utente si ritroverebbe
  // notifiche che rimandano a prenotazioni e sfide non piu' esistenti.
  // Tre collezioni, non due: anche il Maestro ha le sue, e prima
  // erano le uniche a sopravvivere al reset.
  let avvisiCancellati = 0;
  const giaVisti = new Set<string>();
  for (const raccolta of ['notifiche', 'notifiche_admin', 'notifiche_maestro']) {
    try {
      const snap = await getDocs(query(collection(db, raccolta), where('circoloId', '==', circoloId)));
      for (const d of snap.docs) {
        try {
          await deleteDoc(d.ref);
          giaVisti.add(`${raccolta}/${d.id}`);
          avvisiCancellati++;
        } catch (e) { console.warn('Avviso non cancellato:', d.id, e); }
      }
    } catch (e) {
      console.warn('Avvisi non letti durante il reset:', raccolta, e);
    }
  }

  // Recupero per gli avvisi nati SENZA circoloId — le vecchie notifiche
  // delle Sfide, e tutto cio' che e' stato scritto prima che il campo
  // esistesse. Il filtro per circolo non li trova, quindi si passa dai
  // destinatari: le tessere di questo circolo, una per una.
  //
  // ⚠️ Solo le tessere PRINCIPALI: la regola che permette all'Admin di
  // leggere gli avvisi di un socio passa dal circolo scritto sul suo
  // profilo, quindi per un Ospite — che ha il profilo su un altro club
  // — la query viene respinta in blocco e non si cancella niente.
  // ⚠️ E si saltano gli avvisi che un circolo ce l'hanno gia': quella
  // regola concede TUTTA la collezione del socio, compresi gli avvisi
  // di un altro club dove e' Ospite, e il reset del circolo A stava
  // cancellando roba del circolo B.
  for (const d of snapT.docs) {
    const uid = d.data().uid as string | undefined;
    if (!uid || d.data().principale !== true) continue;
    try {
      const snap = await getDocs(query(collection(db, 'notifiche'), where('utenteId', '==', uid)));
      for (const n of snap.docs) {
        if (giaVisti.has(`notifiche/${n.id}`)) continue;
        if (n.data().circoloId) continue;
        try { await deleteDoc(n.ref); avvisiCancellati++; } catch (e) { console.warn('Avviso non cancellato:', n.id, e); }
      }
    } catch (e) {
      console.warn('Avvisi del socio non letti durante il reset:', uid, e);
    }
  }

  // Quinto passo: le sfide. Le loro prenotazioni sono gia' state
  // cancellate al secondo passo, qui restano i documenti sfida.
  let sfideCancellate = 0;
  try {
    const snap = await getDocs(query(collection(db, 'sfide'), where('circoloId', '==', circoloId)));
    for (const d of snap.docs) {
      try { await deleteDoc(d.ref); sfideCancellate++; } catch (e) { console.warn('Sfida non cancellata:', d.id, e); }
    }
  } catch (e) {
    console.warn('Sfide non lette durante il reset:', e);
  }

  const aperture = await creaAperturePerCircolo(circoloId);

  return {
    tessereAzzerate, prenotazioniCancellate, movimentiCancellati,
    aperture, avvisiCancellati, sfideCancellate, richiesteCancellate, richiesteFallite,
    motivoRichieste,
  };
}

// ============================================================
// RIMOZIONE DI UN SOCIO DA UN CIRCOLO
//
// Non e' la cancellazione dell'account: l'utente resta registrato su
// Racket Fever e conserva i circoli dove e' Ospite. Esce solo da
// QUESTO circolo.
//
// La sequenza e' importante: prima si liberano i campi e si chiudono
// le partite in sospeso, poi si sistema la classifica, e solo alla
// fine si chiude la tessera. Cosi', se qualcosa si interrompe a meta',
// non resta una tessera chiusa con prenotazioni ancora attive.
//
// Il saldo NON viene azzerato: se resta un credito o un debito, la
// tessera compare in "Tessere da saldare" e la regolazione avviene in
// segreteria, come ogni altro movimento di denaro.
// ============================================================
export async function rimuoviSocioDaCircolo(params: {
  uid: string;
  circoloId: string;
  // Riceve la prenotazione intera: al rimborso servono anche il tipo
  // (una lezione non si rimborsa) e il cardId (il rimborso deve finire
  // sulla card giusta del registro).
  rimborsa: (p: {
    id: string; prezzo: number; tipo?: 'campo' | 'lezione'; cardId?: string | null;
    gruppoId?: string | null;
    // Campo, giorno e ora: senza, il movimento di rimborso resta
    // fuori dalla Vista Card del registro, che scarta i movimenti
    // privi di questi dati — e la card resterebbe "attiva" per
    // sempre, pur essendo stata cancellata.
    campoId?: string; campoNome?: string; data?: string; dataLabel?: string; orario?: string;
  }) => Promise<void>;
}): Promise<{ prenotazioniCancellate: number; posizioneLiberata: number | null }> {
  const { uid, circoloId, rimborsa } = params;
  const oggi = new Date().toISOString().slice(0, 10);

  const tessera = await leggiTessera(uid, circoloId);
  const posizioneLiberata = tessera?.posizioneClassificaSociale ?? null;

  // Prenotazioni FUTURE: cancellate con rimborso, cosi' lo slot torna
  // libero per gli altri soci. Le passate restano come storico del
  // circolo: cancellarle falserebbe i conti gia' chiusi.
  const qP = query(
    collection(db, 'prenotazioni'),
    where('circoloId', '==', circoloId),
    where('utenteId', '==', uid)
  );
  const snapP = await getDocs(qP);

  const future = snapP.docs
    .filter((d) => (d.data().data as string) >= oggi)
    .map((d) => {
      const v = d.data();
      return {
        id: d.id,
        campoId: (v.campoId as string) ?? '',
        campoNome: (v.campoNome as string) ?? '',
        data: (v.data as string) ?? '',
        dataLabel: (v.dataLabel as string) ?? '',
        orario: (v.orario as string) ?? '',
        prezzo: (v.prezzo as number) ?? 0,
        utenteId: (v.utenteId as string) ?? '',
        utenteNome: (v.utenteNome as string) ?? '',
        tipo: v.tipo as 'campo' | 'lezione' | undefined,
        maestroId: v.maestroId as string | undefined,
        compagnoId: (v.compagnoId as string | null) ?? null,
        cardId: (v.cardId as string | null) ?? null,
        gruppoId: (v.gruppoId as string | null) ?? null,
      };
    });

  // Si cancella UNA PRENOTAZIONE ALLA VOLTA, e dentro ciascuna
  // dall'ultima mezz'ora verso la prima.
  //
  // E' l'unico percorso che cancella senza passare da un'interfaccia,
  // quindi l'unico che potrebbe aggirare il vincolo della mezz'ora
  // centrale: cancellando alla rinfusa, se fallisse proprio quella in
  // mezzo resterebbe un buco e la prenotazione si spezzerebbe in due
  // card. Partendo dal fondo, un'interruzione lascia sempre un blocco
  // iniziale intero. E fermarsi su QUELLA prenotazione, non su tutte,
  // permette comunque di liberare i campi delle altre.
  let prenotazioniCancellate = 0;
  // ⚠️ Le lezioni cancellate qui vanno chiuse anche come CONVERSAZIONE.
  // Rimuovendo un socio si cancellano anche le sue lezioni future, e
  // finche' si cancellavano e basta il risultato era quello che la
  // sezione "Lezioni Prenotate" esiste per evitare: campi liberi, ma
  // richiesta ancora 'confermata' e chat viva nell'elenco del Maestro,
  // su una lezione con un socio che non e' piu' del circolo. Si
  // raccolgono qui le card toccate e si chiudono dopo, quando i campi
  // sono gia' liberi.
  const cardLezioniToccate = new Set<string>();
  for (const gruppo of raggruppaConsecutive(future)) {
    for (const p of [...gruppo].reverse()) {
      try {
        await rimborsa({
          id: p.id,
          prezzo: p.prezzo,
          tipo: p.tipo,
          cardId: p.cardId,
          gruppoId: p.gruppoId,
          campoId: p.campoId,
          campoNome: p.campoNome,
          data: p.data,
          dataLabel: p.dataLabel,
          orario: p.orario,
        });
        prenotazioniCancellate++;
        if (p.tipo === 'lezione' && p.cardId) cardLezioniToccate.add(p.cardId);
      } catch (e) {
        console.warn('Prenotazione non cancellata durante la rimozione:', p.id, e);
        break;
      }
    }
  }

  // ⚠️ Non deve far fallire la rimozione: i campi a questo punto sono
  // gia' liberi e la tessera va chiusa comunque. Una conversazione
  // rimasta aperta e' un fastidio; una rimozione interrotta a meta'
  // lascia un socio meta' dentro e meta' fuori.
  for (const cardId of cardLezioniToccate) {
    try { await chiudiConversazioneLezione(cardId, circoloId); }
    catch (e) { console.warn('Conversazione della lezione non chiusa:', cardId, e); }
  }

  // ⚠️ LA TESSERA SI CHIUDE PRIMA DELLA CLASSIFICA. Nell'ordine
  // inverso, una ricompattazione riuscita seguita da una chiusura
  // fallita lasciava la tessera aperta con la sua posizione: l'Admin
  // vedeva l'errore, ritoccava «Rimuovi», e tutti quelli sotto
  // risalivano UNA SECONDA VOLTA. La chiusura e' anche il segno di
  // «gia' fatto», quindi deve essere la prima cosa a cui si crede.
  await chiudiTessera(uid, circoloId);

  // Classifica: chi stava sotto risale di una posizione, altrimenti
  // resterebbe un buco permanente nella numerazione.
  // ⚠️ Solo per una posizione vera — un intero positivo — e solo per
  // chi era davvero in classifica: un valore storto avrebbe fatto
  // scalare una parte qualunque dell'elenco.
  if (typeof posizioneLiberata === 'number'
    && Number.isInteger(posizioneLiberata) && posizioneLiberata > 0) {
    const qT = query(
      collection(db, 'tessere'),
      where('circoloId', '==', circoloId),
      where('stato', '==', 'approvata')
    );
    const snapT = await getDocs(qT);
    for (const d of snapT.docs) {
      const pos = d.data().posizioneClassificaSociale as number | null;
      if (d.data().uid === uid || pos == null || pos <= posizioneLiberata) continue;
      try {
        await updateDoc(d.ref, { posizioneClassificaSociale: pos - 1 });
      } catch (e) {
        console.warn('Posizione non aggiornata durante la rimozione:', d.id, e);
      }
    }
  }

  return { prenotazioniCancellate, posizioneLiberata };
}

// ============================================================
// ALLINEAMENTO PROFILI
//
// Il campo circoloId sul profilo utente e' quello che le regole
// Firestore usano per stabilire se due persone appartengono allo
// stesso circolo — serve, per esempio, a leggere il credito di un
// compagno di gioco prima di dividere una prenotazione.
//
// Chi e' stato approvato PRIMA che l'approvazione lo scrivesse ha
// quel campo vuoto: sembra tutto a posto, ma non puo' essere scelto
// come compagno perche' la lettura del suo profilo viene rifiutata.
//
// Questo controllo gira all'apertura della dashboard Admin e rimette
// in riga i profili rimasti indietro. Non tocca nulla se non serve.
// ============================================================
export async function allineaProfiliCircolo(circoloId: string): Promise<number> {
  let allineati = 0;
  try {
    const snap = await getDocs(query(
      collection(db, 'tessere'),
      where('circoloId', '==', circoloId),
      where('stato', '==', 'approvata')
    ));

    for (const d of snap.docs) {
      const t = d.data();
      // Solo la tessera PRINCIPALE determina il circolo del profilo:
      // un Ospite resta legato al proprio circolo di tesseramento.
      if (t.principale !== true) continue;

      try {
        const rifUtente = doc(db, 'utenti', t.uid as string);
        const profilo = await getDoc(rifUtente);
        if (!profilo.exists()) continue;
        if (profilo.data().circoloId === circoloId) continue;

        await updateDoc(rifUtente, { circoloId });
        allineati++;
      } catch (e) {
        // Un profilo che non si riesce ad allineare non deve fermare
        // gli altri: si prosegue e si annota.
        console.warn('Profilo non allineato:', t.uid, e);
      }
    }
  } catch (e) {
    console.warn('Allineamento profili non eseguito:', e);
  }
  return allineati;
}
