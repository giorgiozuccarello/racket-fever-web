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
import { db } from '../lib/firebase';
import { creaAperturePerCircolo } from './movimenti';
import { raggruppaConsecutive } from './raggruppamento';

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
export function ascoltaTessereCircolo(circoloId: string, callback: (tessere: Tessera[]) => void) {
  const q = query(collection(db, 'tessere'), where('circoloId', '==', circoloId));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => normalizza(d.id, d.data())));
  });
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

export async function ricaricaCreditoTessera(uid: string, circoloId: string, importo: number): Promise<void> {
  const ref = doc(db, 'tessere', idTessera(uid, circoloId));
  const snap = await getDoc(ref);
  const attuale = (snap.data()?.credito as number) ?? 0;
  await updateDoc(ref, { credito: attuale + importo });
}

export async function azzeraCreditoTessera(uid: string, circoloId: string): Promise<void> {
  await updateDoc(doc(db, 'tessere', idTessera(uid, circoloId)), { credito: 0 });
}

export async function azzeraSosTessera(uid: string, circoloId: string): Promise<void> {
  await updateDoc(doc(db, 'tessere', idTessera(uid, circoloId)), { sosUtilizzato: 0 });
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
export async function saldaTessera(uid: string, circoloId: string): Promise<void> {
  await updateDoc(doc(db, 'tessere', idTessera(uid, circoloId)), {
    credito: 0,
    sosUtilizzato: 0,
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
  for (const d of snapT.docs) {
    const uid = d.data().uid as string | undefined;
    if (!uid) continue;
    try {
      const snap = await getDocs(query(collection(db, 'notifiche'), where('utenteId', '==', uid)));
      for (const n of snap.docs) {
        if (giaVisti.has(`notifiche/${n.id}`)) continue;
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
    aperture, avvisiCancellati, sfideCancellate,
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
      } catch (e) {
        console.warn('Prenotazione non cancellata durante la rimozione:', p.id, e);
        break;
      }
    }
  }

  // Classifica: chi stava sotto risale di una posizione, altrimenti
  // resterebbe un buco permanente nella numerazione.
  if (posizioneLiberata != null) {
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

  await chiudiTessera(uid, circoloId);
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
