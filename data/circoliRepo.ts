// ============================================================
// REPOSITORY CIRCOLI — operazioni Firestore su circoli, campi
// (sottocollezione, con prezzo incorporato) e blocchi orari.
//
// Ogni ascolto (onSnapshot) gestisce esplicitamente gli errori:
// se un ascolto resta attivo dopo un logout o un cambio di utente
// (es. schermata precedente non ancora smontata), un eventuale
// errore di permessi viene solo loggato, non mostrato come crash.
// ============================================================

import {
  collection, doc, getDoc, setDoc, onSnapshot, updateDoc, addDoc, deleteDoc, query, orderBy,
  where, getDocs, writeBatch,
} from 'firebase/firestore';
import { db, functions } from '../lib/firebase';
import { archiviaRegistro } from './resetCircolo';
import { httpsCallable } from 'firebase/functions';
import { Circolo, Campo, Blocco, StatoCircolo, statoCircolo } from './circoli';
import { durataTimerMs } from './sfide';

function suUnsub(errore: any) {
  console.warn('Ascolto Firestore interrotto (probabile logout):', errore?.message ?? errore);
}

// ---------------- Circoli ----------------

export async function leggiCircolo(circoloId: string): Promise<Circolo | null> {
  const snap = await getDoc(doc(db, 'circoli', circoloId));
  return snap.exists() ? ({ id: snap.id, ...(snap.data() as any) } as Circolo) : null;
}

export function ascoltaCircoli(callback: (circoli: Circolo[]) => void) {
  return onSnapshot(
    collection(db, 'circoli'),
    (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as Circolo[]),
    suUnsub
  );
}

export function ascoltaCircolo(circoloId: string, callback: (c: Circolo | null) => void) {
  return onSnapshot(
    doc(db, 'circoli', circoloId),
    (snap) => callback(snap.exists() ? ({ id: snap.id, ...(snap.data() as any) } as Circolo) : null),
    suUnsub
  );
}

// ⚠️ L'ANAGRAFICA DI RETE E' ESCLUSA DAL TIPO, e non e' pedanteria.
// Finche' la firma accettava un Partial<Circolo> qualunque, una
// chiamata come aggiornaCircolo(id, { stato: 'attivo' }) compilava
// senza un lamento e riapriva un circolo chiuso scavalcando la
// macchina a stati qui sotto. Il compilatore fa la stessa guardia che
// fanno le regole Firestore, ma la fa a chi scrive il codice.
export type CampiCircoloModificabili = Partial<Omit<Circolo,
  // ⚠️ Fuori anche i campi di rete: geografia e approvazione
  // automatica li scrive solo il Super Admin, e le regole li
  // respingono (vedi campiDiRete in firestore.rules). Tenendoli qui
  // dentro, il codice dell'Admin compilava benissimo e si prendeva un
  // «permesso negato» opaco a runtime.
  'id' | 'stato' | 'creatoIlMs' | 'sospesoIlMs' | 'chiusoIlMs'
  | 'regione' | 'provincia' | 'comune' | 'approvazioneAutomatica'>>;

export async function aggiornaCircolo(circoloId: string, dati: CampiCircoloModificabili) {
  await updateDoc(doc(db, 'circoli', circoloId), dati as any);
}

// ============================================================
// STATO DEL CIRCOLO — solo Super Admin.
//
// Tre stati, due gesti. "sospeso" e' reversibile ed e' quello che si
// usa davvero: il circolo esce dall'elenco di scelta, non accetta piu'
// nuove tessere ne' nuove prenotazioni, ma tutto il resto resta
// leggibile — i soci gia' dentro vedono lo storico, la classifica, le
// chat. "chiuso" e' definitivo e si puo' raggiungere SOLO da sospeso:
// e' una porta con due maniglie, perche' non esiste un annulla.
//
// ⚠️ Non si cancella mai il documento del circolo. Le prenotazioni, le
// tessere, le sfide e i tornei lo citano per id: cancellarlo lascia
// centinaia di documenti che puntano al nulla, e nell'app significa
// schermate vuote senza spiegazione. Un circolo che se ne va diventa
// "chiuso", non sparisce.
// ============================================================

export async function sospendiCircolo(circoloId: string) {
  // Anche questa rilegge lo stato, come le altre due: senza, una
  // sospensione su un circolo gia' chiuso lo riportava a "sospeso" —
  // e da li' riattivarlo era di nuovo permesso. Sarebbe stata la
  // scala di servizio che aggira il "definitivo".
  const attuale = await leggiCircolo(circoloId);
  if (!attuale) throw new Error('Circolo non trovato.');
  if (statoCircolo(attuale) === 'chiuso') {
    throw new Error('Un circolo chiuso e\' gia\' fuori dalla rete.');
  }
  await updateDoc(doc(db, 'circoli', circoloId), {
    stato: 'sospeso' as StatoCircolo,
    sospesoIlMs: Date.now(),
  });
}

export async function riattivaCircolo(circoloId: string) {
  const attuale = await leggiCircolo(circoloId);
  if (!attuale) throw new Error('Circolo non trovato.');
  // Da "chiuso" non si torna indietro: se si potesse, "definitivo" non
  // vorrebbe dire niente e il gesto in due passaggi sarebbe teatro.
  if (statoCircolo(attuale) === 'chiuso') {
    throw new Error('Un circolo chiuso non puo\' essere riattivato.');
  }
  await updateDoc(doc(db, 'circoli', circoloId), {
    stato: 'attivo' as StatoCircolo,
    sospesoIlMs: null,
  });
  await faiRipartireITimerDelleSfide(circoloId, attuale);
}

// ⚠️ RIATTIVARE UN CIRCOLO NON BASTA A RIMETTERE IN MOTO LE SFIDE.
// Durante la sospensione i due timer delle Sfide non possono scadere
// senza punire chi non c'entra (vedi data/sfide.ts), e l'app li
// sposta in avanti ogni volta che se ne accorge. Ma se in quei giorni
// nessuno apre l'applicazione, nessuno li sposta: alla riattivazione
// il primo che entra trova una scadenza vecchia di giorni, e la
// penalita' — congelamento o perdita della posizione in classifica —
// scatta senza che i due soci abbiano mai avuto una finestra utile
// per rispondere. Le scadenze si rimettono quindi da qui, nel momento
// esatto in cui il circolo torna operativo.
//
// La query e' sul solo circoloId e la fase si filtra in memoria: due
// uguaglianze su campi diversi vorrebbero un indice composito, e un
// indice serve a scorrere migliaia di documenti — le sfide aperte di
// un circolo sono decine.
async function faiRipartireITimerDelleSfide(circoloId: string, circolo: Circolo) {
  const durata = durataTimerMs(circolo);
  const adesso = Date.now();
  try {
    const istantanea = await getDocs(query(collection(db, 'sfide'), where('circoloId', '==', circoloId)));
    const batch = writeBatch(db);
    let quante = 0;
    istantanea.docs.forEach((d) => {
      const v = d.data() as { fase?: string; accordoScadenza?: number; prenotazioneScadenza?: number };
      // Solo le scadenze GIA' passate: una sfida nata poco prima della
      // sospensione ha ancora il suo tempo, e allungarglielo sarebbe
      // un regalo che nessuno ha chiesto.
      if (v.fase === 'accordo' && (v.accordoScadenza ?? 0) < adesso) {
        batch.update(d.ref, { accordoScadenza: adesso + durata });
        quante += 1;
      } else if (v.fase === 'prenotazione' && (v.prenotazioneScadenza ?? 0) < adesso) {
        batch.update(d.ref, { prenotazioneScadenza: adesso + durata });
        quante += 1;
      }
    });
    if (quante > 0) await batch.commit();
  } catch (errore) {
    // Il circolo e' comunque riattivato: questa e' una rifinitura, non
    // una condizione. Se fallisce resta la rete di sicurezza lato app,
    // che rimanda il timer appena qualcuno apre le Sfide.
    console.warn('Timer delle sfide non riavviati:', errore);
  }
}

// ============================================================
// ⚠️ CHIUDERE ARCHIVIA ANCHE IL REGISTRO, dal 29 agosto 2026.
//
// Un circolo chiuso resta consultabile dal pannello del team, ma il
// registro dei movimenti riga per riga si legge SOLO dagli «Archivi del
// registro» — e l'archivio esisteva solo se qualcuno si ricordava di
// premere il pulsante. Una contestazione arriva due mesi dopo, quando
// non se lo ricorda piu' nessuno.
//
// La chiusura e' il momento naturale per fissare una copia: e' un gesto
// che si fa una volta sola, e' irreversibile, e da li' in poi i conti
// non cambiano piu'.
//
// ⚠️ PRIMA SI ARCHIVIA, POI SI CHIUDE. Se l'archiviazione fallisce, il
// circolo NON viene chiuso: chiudere e' irreversibile, e farlo sapendo
// che la copia dei conti non c'e' vorrebbe dire accettare di restare
// senza. Non chiudere invece si rimedia — si riprova.
// ============================================================
export async function chiudiCircolo(circoloId: string): Promise<{ righeArchiviate: number }> {
  const attuale = await leggiCircolo(circoloId);
  if (!attuale) throw new Error('Circolo non trovato.');
  if (statoCircolo(attuale) !== 'sospeso') {
    throw new Error('Si puo\' chiudere solo un circolo gia\' sospeso.');
  }

  let righeArchiviate = 0;
  try {
    const esito = await archiviaRegistro(circoloId);
    righeArchiviate = esito.righe;
  } catch (e) {
    throw new Error(
      'Il registro non e\' stato archiviato, quindi il circolo non e\' stato chiuso. '
      + 'Riprova, oppure archivia a mano dagli «Archivi del registro» e richiudi.',
    );
  }

  await updateDoc(doc(db, 'circoli', circoloId), {
    stato: 'chiuso' as StatoCircolo,
    chiusoIlMs: Date.now(),
  });
  return { righeArchiviate };
}

// ============================================================
// ELIMINARE UN CIRCOLO — per davvero, e non e' «chiudi».
//
// ⚠️ CHIUDERE E ELIMINARE SONO DUE COSE DIVERSE. «Chiudi» mette lo
// stato a 'chiuso' e lascia tutto dov'e': tessere, prenotazioni,
// movimenti, portafogli e registro restano scritti e consultabili dal
// pannello del team, e gli account continuano a funzionare. E' quello
// che serve per un club che smette, perche' due anni dopo una
// contestazione ha ancora una risposta.
//
// ⚠️ MA CHIUSO NON SI RIAPRE — e qui, fino al 29 agosto 2026, questo
// commento diceva il contrario («una riattivazione e' possibile»).
// Non e' vero e non lo e' mai stato: `riattivaCircolo` qui sopra
// rifiuta esplicitamente i circoli chiusi, perche' se si potesse
// tornare indietro «definitivo» non vorrebbe dire niente e il gesto in
// due passaggi sarebbe teatro. Un commento rimasto indietro rispetto al
// codice e' costato a questo progetto due tornate intere ad agosto: se
// leggendo trovi una differenza fra quello che c'e' scritto qui e
// quello che fa il codice, ha ragione il codice.
//
// Questa funzione invece porta via i dati e non torna indietro: serve a
// ripulire i circoli di prova prima di andare sugli store. Su un
// circolo vero non si usa.
// ⚠️ E porta via anche gli ARCHIVI del registro, che sono l'unica copia
// consultabile dei conti dopo una chiusura.
//
// Il lavoro lo fa una Cloud Function: da qui non si potrebbe fare
// nemmeno volendo, perche' significa cancellare tessere, movimenti e
// accessi di altre persone.
export async function eliminaCircoloDefinitivo(
  circoloId: string, confermaNome: string, ancheAccessi: boolean,
): Promise<{ nome: string; accessiRimossi: number }> {
  const chiama = httpsCallable(functions, 'eliminaCircolo', { timeout: 540000 });
  const esito = await chiama({ circoloId, confermaNome, ancheAccessi });
  return esito.data as { nome: string; accessiRimossi: number };
}

// L'interruttore dell'approvazione automatica. Sta fra i campi di rete
// nelle regole, quindi lo puo' scrivere solo il Super Admin.
export async function impostaApprovazioneAutomatica(circoloId: string, attiva: boolean): Promise<void> {
  await updateDoc(doc(db, 'circoli', circoloId), { approvazioneAutomatica: attiva });
}

// I campi anagrafici che il Super Admin puo' correggere dalla scheda.
// Elenco chiuso di proposito: passare di qui un Partial<Circolo>
// qualunque vorrebbe dire poter sovrascrivere per sbaglio il tema, i
// banner o i limiti che l'Admin del circolo ha impostato.
export interface AnagraficaCircolo {
  nome: string;
  citta: string;
  sigla: string;
  regione: string | null;
  provincia: string | null;
  comune: string | null;
  password: string;
  richiedenteNome: string | null;
  richiedenteRuolo: string | null;
  richiedenteEmail: string | null;
  richiedenteTelefono: string | null;
  firmatarioNome: string | null;
  firmatarioRuolo: string | null;
  firmaIl: string | null;
  noteInterne: string | null;
  // ⚠️ L'unico campo di rete che passa di qui, e per un motivo solo:
  // e' la data d'ingresso dei circoli nati prima che il campo
  // esistesse, e si scrive UNA VOLTA, a mano. Chi chiama deve
  // verificare che non ci sia gia' — una data d'ingresso non si
  // "corregge", e' quando e' successo.
  creatoIlMs?: number;
}

export async function aggiornaAnagraficaCircolo(
  circoloId: string, dati: Partial<AnagraficaCircolo>
) {
  const pulito: Record<string, any> = {};
  Object.keys(dati).forEach((k) => {
    const v = (dati as any)[k];
    if (v !== undefined) pulito[k] = v; // Firestore rifiuta undefined
  });
  if (Object.keys(pulito).length === 0) return;
  await updateDoc(doc(db, 'circoli', circoloId), pulito);
}

// ---------------- Campi (sottocollezione) ----------------

export function ascoltaCampi(circoloId: string, callback: (campi: Campo[]) => void) {
  const q = query(collection(db, 'circoli', circoloId, 'campi'), orderBy('ordine'));
  return onSnapshot(
    q,
    (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as Campo[]),
    suUnsub
  );
}

export async function aggiungiCampo(
  circoloId: string, nome: string, disciplina: string, ordine: number
) {
  await addDoc(collection(db, 'circoli', circoloId, 'campi'), {
    nome, disciplina, ordine, prezzoOraDefault: null, tariffaSpeciale: null,
  });
}

export async function rinominaCampo(
  circoloId: string, campoId: string, nome: string, disciplina: string
) {
  await updateDoc(doc(db, 'circoli', circoloId, 'campi', campoId), { nome, disciplina });

  // Il nome del campo viene "congelato" dentro ogni prenotazione al
  // momento della creazione (per mostrarlo velocemente senza dover
  // ricaricare il campo ogni volta). Se l'Admin rinomina il campo,
  // aggiorniamo anche quel nome congelato in tutte le prenotazioni
  // già esistenti, così non restano con il nome vecchio.
  const q = query(
    collection(db, 'prenotazioni'),
    where('circoloId', '==', circoloId),
    where('campoId', '==', campoId)
  );
  const istantanea = await getDocs(q);
  if (!istantanea.empty) {
    const batch = writeBatch(db);
    istantanea.docs.forEach((d) => batch.update(d.ref, { campoNome: nome }));
    await batch.commit();
  }
}

export async function aggiornaCampo(
  circoloId: string, campoId: string, dati: Partial<Omit<Campo, 'id'>>
) {
  await updateDoc(doc(db, 'circoli', circoloId, 'campi', campoId), dati as any);
}

export async function rimuoviCampo(circoloId: string, campoId: string) {
  await deleteDoc(doc(db, 'circoli', circoloId, 'campi', campoId));
}

// ---------------- Blocchi orari (sottocollezione) ----------------

export function ascoltaBlocchi(circoloId: string, callback: (blocchi: Blocco[]) => void) {
  return onSnapshot(
    collection(db, 'circoli', circoloId, 'blocchi'),
    (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as Blocco[]),
    suUnsub
  );
}

// ============================================================
// ⚠️ FIRESTORE RIFIUTA L'INTERA SCRITTURA se trova un solo campo a
// `undefined`, e in una riserva i facoltativi sono quattro:
// `descrizione`, `nascondiInfo`, `data` e `giorniSettimana`.
//
// Portato dal mobile il 24 agosto 2026 insieme alla riserva creata
// dalla griglia. La Descrizione e' facoltativa e non ha alcun
// controllo: bastava lasciarla vuota — il caso piu' comune — perche'
// la scrittura fallisse con «Unsupported field value: undefined» e
// l'Admin leggesse un errore generico con un «riprova» che non poteva
// funzionare mai.
// ============================================================
function ripulisci<T extends Record<string, any>>(dati: T): T {
  const fuori: Record<string, any> = {};
  for (const [k, v] of Object.entries(dati)) {
    if (v === undefined) continue;
    fuori[k] = v;
  }
  return fuori as T;
}

export async function aggiungiBlocco(circoloId: string, blocco: Omit<Blocco, 'id'>) {
  await addDoc(collection(db, 'circoli', circoloId, 'blocchi'), ripulisci(blocco));
}

export async function modificaBlocco(circoloId: string, bloccoId: string, dati: Omit<Blocco, 'id'>) {
  // Stesso filtro della creazione: qui arriva l'oggetto letto
  // dall'ascolto, e un campo facoltativo assente puo' presentarsi come
  // `undefined` invece che come chiave mancante.
  await updateDoc(doc(db, 'circoli', circoloId, 'blocchi', bloccoId), ripulisci(dati));
}

export async function rimuoviBlocco(circoloId: string, bloccoId: string) {
  await deleteDoc(doc(db, 'circoli', circoloId, 'blocchi', bloccoId));
}

// ============================================================
// ACCESSO COLLABORATORI — una password condivisa a livello di
// circolo (distinta da quella dei soci) che dà accesso alla
// Dashboard Admin senza dover creare un account persistente.
// Vive in un sotto-documento "privato", non nel documento circolo
// pubblico: solo l'Admin del circolo può leggerla o cambiarla — un
// socio qualunque non può vederla semplicemente leggendo i dati del
// circolo, come invece accade (di proposito, per semplicità) con la
// password d'accesso dei soci.
// ============================================================
export function ascoltaPasswordCollaboratore(circoloId: string, callback: (password: string | null) => void) {
  return onSnapshot(
    doc(db, 'circoli', circoloId, 'privato', 'collaboratore'),
    (snap) => callback(snap.exists() ? ((snap.data().password as string) ?? null) : null),
    (errore) => console.warn('Ascolto password collaboratore interrotto:', errore?.message ?? errore)
  );
}

export async function impostaPasswordCollaboratore(circoloId: string, password: string) {
  await setDoc(doc(db, 'circoli', circoloId, 'privato', 'collaboratore'), { password: password.trim() });
}
