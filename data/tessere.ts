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
  doc, getDoc, updateDoc, collection, query, where,
  onSnapshot, getDocs, serverTimestamp, deleteField,
} from 'firebase/firestore';
import { db, functions } from '../lib/firebase';
import { httpsCallable } from 'firebase/functions';
import { raggruppaConsecutive } from './raggruppamento';
import { chiudiConversazioneLezione } from './conversazioneLezione';
import { creaNotificaMaestro } from './notificheMaestro';
import { orarioFineSlot } from './circoli';

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
  // ============================================================
  // ⚠️ LE TRE DATE IN MILLISECONDI, ricavate dai campi qui sopra.
  //
  // Servono alla fatturazione, che conta le persone accettate e attive
  // in un periodo: per farlo deve poter confrontare dei numeri, e i
  // Timestamp di Firestore in un modulo puro non si toccano.
  //
  // ⚠️ NON SONO CAMPI NUOVI DA SCRIVERE: `normalizza` li ricava dai
  // Timestamp che il progetto scrive da sempre (`approvataIl`,
  // `chiusaIl`). Vuol dire che la storia dei circoli che gia' esistono
  // e' gia' tutta li', senza nessuna migrazione.
  // ============================================================
  chiusaIlMs?: number | null;
  // ⚠️ QUESTO INVECE E' NUOVO, e lo scrive l'app la prima volta che il
  // socio entra nel circolo con la tessera approvata. E' cio' che
  // distingue un utente da una riga di anagrafica: una tessera creata
  // dalla segreteria per qualcuno che non ha mai installato niente non
  // e' un utente, e farla pagare al circolo vorrebbe dire fatturare
  // l'anagrafica invece del servizio. Si scrive UNA VOLTA SOLA e non si
  // puo' cancellare (firestore.rules).
  primoUsoMs?: number | null;
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

// ⚠️ Firestore restituisce Timestamp, il resto del progetto lavora in
// millisecondi, e i documenti piu' vecchi possono avere gia' un numero.
// Un solo posto che li riconosce tutti e tre, invece di tre `as any`
// sparsi.
function msDa(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (v && typeof (v as { toMillis?: () => number }).toMillis === 'function') {
    return (v as { toMillis: () => number }).toMillis();
  }
  return null;
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
    posizioneClassificaSociale: (v.posizioneClassificaSociale as number | null) ?? null,
    temaAppPersonale: (v.temaAppPersonale as string | null) ?? null,
    telefono: (v.telefono as string | null) ?? null,
    richiestaIl: v.richiestaIl,
    approvataIl: v.approvataIl,
    approvataDa: (v.approvataDa as string | null) ?? null,
    // ⚠️ SOLO `chiusaIl`, NON `chiusaIlMs`. Il ripiego sembrava
    // prudenza e apriva una porta: `chiusaIlMs` non lo scrive nessuno —
    // verificato su tutti e due i progetti e sulle Cloud Functions — e
    // un campo che nessuno scrive, se compare su un documento, puo'
    // venire da un posto solo. Vale a dire dal browser di un Admin che
    // voleva vedere il proprio conteggio scendere: `chiusaIlMs: 0` su
    // tutti i soci portava la Panoramica a zero utenti lasciando i soci
    // dentro il circolo — e la fotografia notturna, che legge
    // `chiusaIl`, continuava a dire il numero vero. Due numeri diversi
    // per la stessa cosa, e nessuna delle due schermate lo diceva.
    chiusaIlMs: msDa(v.chiusaIl),
    primoUsoMs: msDa(v.primoUsoMs),
    nome: (v.nome as string) ?? '',
    cognome: (v.cognome as string) ?? '',
    email: (v.email as string) ?? '',
  };
}

// ---------- SCRITTURA ----------

// ============================================================
// ⚠️ `creaRichiestaTessera` E' STATA TOLTA DA QUI, e non e' una
// semplificazione: era una trappola armata.
//
// Nessuna schermata del sito la chiamava — le richieste di tessera si
// fanno dall'app, ed e' giusto cosi'. Ma la copia web era rimasta
// indietro rispetto a quella dell'app su tre cose, e tutte e tre si
// sarebbero viste solo dopo averla collegata a un bottone:
//  · non guardava lo stato del circolo (si entrava anche in un circolo
//    sospeso);
//  · non guardava se la tessera c'era gia', quindi chi rientrava con un
//    conto aperto si prendeva il rifiuto grezzo delle regole invece di
//    «passa in segreteria»;
//  · non ripuliva `chiusaIl`, `approvataIl`, `accountCancellato` e
//    `saldoDaSistemare`. Un rientro dal sito avrebbe quindi lasciato la
//    data di uscita su una tessera riaperta: quella persona sarebbe
//    rimasta FUORI dal conto della fatturazione pur essendo dentro il
//    circolo, e insieme sarebbe ricomparsa fra le «Tessere da saldare».
//
// Un gemello che diverge in silenzio e' peggio di un pezzo mancante: il
// pezzo mancante si nota il giorno in cui serve. Se un domani serve dal
// web, si copia quella dell'app — che e' l'unica mantenuta.
// ============================================================

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
// ripresentare la richiesta dall'app (`creaRichiestaTessera`, che vive
// solo nel progetto mobile, la riporta in "in_attesa" con un merge).
// Nessun blocco permanente.
// ⚠️ SE LA TESSERA ERA GIA' APPROVATA, RIFIUTARLA E' UN'USCITA, e va
// datata come tale. La schermata da cui si chiama questa funzione
// mostra solo le richieste ancora in attesa, quindi in pratica lo stato
// di partenza e' sempre «in_attesa» — ma «in pratica» non regge il
// conto delle persone. Una tessera che passa da approvata a rifiutata
// senza `chiusaIl` resta nel conto per sempre: la persona e' fuori dal
// circolo e continua a comparire fra chi usa l'app, anno dopo anno,
// senza che nessuno dei due possa piu' rimediare. Costa una lettura e
// chiude il caso.
export async function rifiutaTessera(uid: string, circoloId: string): Promise<void> {
  const rifTessera = doc(db, 'tessere', idTessera(uid, circoloId));
  let eraDentro = false;
  let uscitaGiaScritta = false;
  try {
    const snap = await getDoc(rifTessera);
    const dati = snap.exists() ? snap.data() : null;
    const stato = dati?.stato ?? null;
    uscitaGiaScritta = dati?.chiusaIl != null;
    // ⚠️ E ANCHE CHI HA GIA' APERTO L'APP, qualunque sia il suo stato di
    // adesso. Il caso che sfuggiva: un ex socio uscito due anni fa
    // ricompare nello switcher, tocca «chiedi tessera» — e la richiesta
    // azzera `chiusaIl`, quindi da quel momento torna dentro il conto
    // delle persone. Se l'Admin lo rifiuta e il rifiuto non data
    // l'uscita, quella persona resta nel conto PER SEMPRE, in questo
    // periodo e in tutti i successivi, e il circolo non ha nessuna
    // strada per toglierla. Bastavano venti ex soci arrabbiati perche'
    // il circolo leggesse un numero che non era il suo.
    eraDentro = stato === 'approvata' || stato === 'sospesa' || dati?.primoUsoMs != null;
  } catch {
    // Se non si riesce a leggere si procede col rifiuto semplice: e'
    // il caso normale, e bloccare l'Admin qui sarebbe peggio.
  }
  await updateDoc(rifTessera, {
    stato: 'rifiutata',
    rifiutataIl: serverTimestamp(),
    // ⚠️ La data di uscita si scrive solo se non c'e' gia'. Rifiutare
    // una tessera gia' chiusa non e' una seconda uscita, e spostare la
    // data in avanti rimetterebbe quella persona nel periodo di
    // fatturazione corrente. Oggi nessuna schermata ci arriva, ma la
    // funzione non deve dipendere da questo.
    ...(eraDentro && !uscitaGiaScritta ? { chiusaIl: serverTimestamp(), principale: false } : {}),
    // ⚠️ IL NUMERO SI CANCELLA SOLO SE ERA UNA RICHIESTA. Era stato dato
    // per essere ricontattati su QUELLA richiesta, e se il circolo la
    // rifiuta non ha piu' motivo di tenerlo. Ma da questa tornata
    // «rifiuta» su una tessera gia' dentro e' un'ESPULSIONE, e puo'
    // lasciare un conto aperto: la persona compare in «Tessere da
    // saldare» e l'app le dice di passare in segreteria. Cancellando il
    // numero nella stessa scrittura che crea la pendenza, il circolo si
    // ritrovava una riga da chiudere e nessun modo di chiamare chi
    // riguarda — mentre dall'altra parte qualcuno aspetta indietro i
    // propri soldi.
    ...(eraDentro ? {} : { telefono: deleteField() }),
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
  // ⚠️ ANCHE 'rifiutata', e non e' un dettaglio. Da quando rifiutare
  // una tessera gia' approvata e' un'espulsione, esiste un socio
  // rifiutato che ha ancora dei soldi in mezzo — e l'app gli dice
  // «passa in segreteria a chiudere la posizione, poi potrai chiedere
  // di rientrare». Con il filtro sul solo stato 'chiusa', quella
  // persona non compariva su NESSUNA schermata del circolo: la
  // segreteria a cui veniva mandata non aveva niente da vedere e
  // niente da fare, e il rientro restava impossibile per sempre.
  const q = query(
    collection(db, 'tessere'),
    where('circoloId', '==', circoloId),
    where('stato', 'in', ['chiusa', 'rifiutata'])
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
      // Stessa ragione di ascoltaTessereDaSaldare: un rifiutato con del
      // credito residuo ha una pendenza vera, e deve vederla.
      .filter((t) => (t.stato === 'chiusa' || t.stato === 'rifiutata')
        && ((t.credito ?? 0) > 0 || (t.sosUtilizzato ?? 0) > 0));
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
  // ⚠️ E IL MAESTRO VA AVVISATO, che non succedeva ne' qui ne' sull'app
  // fino al 24 agosto 2026. Regola di Giorgio: il circolo puo' solo
  // cancellare una lezione per intero, «avvisando i rispettivi Maestro e
  // socio». Rimuovendo un socio si cancellano anche le sue lezioni
  // future, e il Maestro se ne accorgeva trovando il campo vuoto.
  // Un avviso per LEZIONE, non uno ogni mezz'ora: la chiave e' il
  // gruppo, perche' le lezioni nate prima del `cardId` ne sono prive.
  const lezioniDelMaestro = new Map<string, { maestroId: string; testo: string }>();
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
        if (p.tipo === 'lezione' && p.maestroId) {
          const chiave = p.cardId ?? gruppo[0].id;
          if (!lezioniDelMaestro.has(chiave)) {
            // ⚠️ La fascia dal GRUPPO: il ciclo interno gira al
            // contrario, quindi `p.orario` qui e' la fine della lezione.
            const primo = gruppo[0];
            const ultimo = gruppo[gruppo.length - 1];
            const quando = `${primo.orario} - ${orarioFineSlot(ultimo.orario)}`;
            lezioniDelMaestro.set(chiave, {
              maestroId: p.maestroId,
              testo: 'Il circolo ha cancellato la lezione.'
                + `\n${primo.utenteNome} non fa più parte dei soci.`
                + `\n${primo.campoNome} · ${primo.dataLabel}, ore ${quando}`,
            });
          }
        }
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

  // ⚠️ PRIMA la chiusura delle conversazioni, POI gli avvisi: nell'ordine
  // inverso il Maestro poteva toccare l'avviso e trovarsi in una chat
  // che stava sparendo sotto le dita.
  for (const { maestroId, testo } of lezioniDelMaestro.values()) {
    try {
      await creaNotificaMaestro(maestroId, testo, circoloId, 'lezioni', undefined, undefined, 'annullamento');
    } catch (e) {
      console.warn('Maestro non avvisato della lezione cancellata:', maestroId, e);
    }
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
