// ============================================================
// MAESTRI — Layer distinto da Admin Circolo e da Socio.
// Provisionati dall'Admin Circolo del proprio club (non dal Super
// Admin: è personale del singolo circolo, non della piattaforma).
//
// ⚠️ L'ACCOUNT NON SI CREA PIU' DA QUI, dal 29 agosto 2026. Prima si
// creava dal browser su un'istanza Firebase secondaria "usa e getta",
// per non far saltare la sessione dell'Admin che stava aggiungendo il
// Maestro. Funzionava, ma dal browser non si puo' CERCARE un utente
// per email: un Maestro che fosse gia' socio del circolo — che e' il
// caso normale, non l'eccezione — sbatteva contro «esiste gia' un
// account con questa email» e non si poteva aggiungere.
//
// Adesso ci pensa la funzione server `assegnaQualifica`: se
// l'indirizzo ha gia' un account lo COLLEGA, altrimenti lo crea. La
// sessione dell'Admin non si muove perche' dal browser non si tocca
// piu' nessun account: si chiama una funzione e basta. Vedi
// functions/src/index.ts.
// ============================================================

import { signInWithEmailAndPassword, User } from 'firebase/auth';
import {
  doc, setDoc, getDoc, updateDoc, deleteDoc, collection, onSnapshot, query, where,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { auth, db, functions } from '../lib/firebase';

export interface ProfiloMaestro {
  nome: string;
  cognome: string;
  email: string;
  circoloId: string;
  puoAccedereAdmin?: boolean; // se true, questo account può accedere ANCHE come Admin Circolo
  // Entro quante ore prima un allievo puo' ancora disdire una LEZIONE
  // con questo Maestro. Sta qui e non sul circolo perche' l'Admin
  // regola i campi, che sono suoi; le lezioni le da' il Maestro.
  //
  // ⚠️ Assente (o null) NON vuol dire "nessun limite": vuol dire che il
  // Maestro non ha ancora scelto e vale quello del circolo. Uno zero
  // scritto davvero e' invece una scelta: nessun limite. La differenza
  // la fa oreLimiteLezioniDi, che guarda null/undefined e non Number().
  oreLimiteCancellazioneLezioni?: number | null;

  // La lingua scelta dal Maestro, copiata qui perché la legga chi gli
  // scrive un avviso — il socio che chiede una lezione, il circolo che
  // gliene cancella una. Stessa logica del campo gemello sul profilo
  // del socio: la preferenza vera vive sul telefono, questa è la copia
  // che serve agli altri.
  // ⚠️ È l'unico campo che il Maestro scrive da sé oltre al termine di
  // disdetta, e le regole vanno tenute allineate: `firestore.rules`
  // elenca esattamente i due nomi.
  lingua?: 'it' | 'en' | 'de' | null;

  // ============================================================
  // ANAGRAFICA — la compila l'Admin del circolo dalla sua dashboard.
  //
  // ⚠️ TUTTO QUELLO CHE STA QUI LO LEGGONO I SOCI. Le regole
  // consentono la lettura di questo documento a ogni membro del
  // circolo, e Firestore non sa filtrare per campo: o un dato e' su
  // questo documento e lo vedono tutti, o sta nella sottocollezione
  // privata qui sotto e non lo vede nessuno all'infuori dell'Admin,
  // del Super Admin e del Maestro stesso.
  //
  // Quindi qui ci va solo cio' che serve al socio per scegliere a chi
  // chiedere una lezione: faccia, titolo, discipline, da quanto
  // insegna, due righe di presentazione. Telefono personale, tariffe e
  // note del circolo stanno di la'.
  // ============================================================
  fotoUrl?: string | null;
  qualifica?: string;
  discipline?: string[];
  // ⚠️ L'ANNO, NON GLI ANNI. "Vent'anni di esperienza" scritto oggi
  // e' sbagliato l'anno prossimo e nessuno se ne accorge: e' un numero
  // che invecchia da solo. L'anno da cui insegna invece non cambia
  // mai, e gli anni si ricavano — vedi anniDiEsperienza().
  insegnaDal?: number | null;
  bio?: string;
}

// Le chiavi che l'Admin puo' scrivere sul documento principale.
// ⚠️ Deve restare identico all'elenco dentro firestore.rules: le
// regole accettano un aggiornamento solo se tocca esattamente queste.
// Se qui ne aggiungi una e li' no, il salvataggio viene respinto in
// blocco e l'Admin vede solo "errore".
export const CAMPI_ANAGRAFICA_MAESTRO = [
  'fotoUrl', 'qualifica', 'discipline', 'insegnaDal', 'bio',
] as const;

// Proposte per il campo Qualifica. Non e' un elenco chiuso: il campo
// resta di testo libero, perche' i nomi dei titoli federali cambiano
// e un circolo puo' avere un preparatore con una dicitura sua.
export const QUALIFICHE_SUGGERITE = [
  'Istruttore di 1º grado',
  'Istruttore di 2º grado',
  'Maestro Nazionale',
  'Tecnico Nazionale',
  'Preparatore fisico',
];

export const DISCIPLINE = [
  'Tennis', 'Padel', 'Beach tennis', 'Mini tennis', 'Preparazione atletica',
];

export const MAX_BIO_MAESTRO = 600;
// ⚠️ Le regole respingono una qualifica oltre gli 80 caratteri, e
// respingono l'INTERO salvataggio della scheda: senza un tetto anche
// qui, chi incollava una riga lunga si vedeva rifiutare tutto con un
// "riprova" che non dice quale campo sia.
export const MAX_QUALIFICA_MAESTRO = 80;

// Anni di insegnamento a partire dall'anno di inizio. Restituisce null
// se l'anno non c'e' o non ha senso: meglio non dire niente che dire
// "-3 anni di esperienza".
export function anniDiEsperienza(m: { insegnaDal?: number | null }, oggi = new Date()): number | null {
  const dal = m.insegnaDal;
  if (!dal || dal < 1900) return null;
  const anni = oggi.getFullYear() - dal;
  return anni >= 0 ? anni : null;
}

// ============================================================
// SCHEDA PRIVATA — sottocollezione maestri/{uid}/privato/scheda.
//
// Sta separata per un motivo solo: i soci leggono il documento
// principale del Maestro (serve al riquadro "Richiedi Lezione"), e
// il numero di telefono personale e le tariffe concordate col circolo
// non sono cose loro.
//
// ⚠️ Le tariffe qui dentro NON toccano in alcun modo il prezzo delle
// prenotazioni. Una lezione in app costa zero — il Maestro chiede al
// socio un importo unico fuori piattaforma e regola il campo con la
// segreteria. Questi numeri sono un promemoria per l'Admin, non un
// listino che il sistema applica. Se un giorno dovranno diventare un
// listino vero, sara' un lavoro a se': cambiare significato a un campo
// gia' compilato e' il modo piu' rapido per far pagare a qualcuno una
// cifra che nessuno ha mai deciso.
// ============================================================
export interface SchedaPrivataMaestro {
  telefono?: string;
  tariffaIndividuale?: number | null;
  tariffaCoppia?: number | null;
  tariffaGruppo?: number | null;
  notaTariffe?: string;
}

export interface MaestroConUid extends ProfiloMaestro {
  uid: string;
}

export async function leggiMaestro(uid: string): Promise<ProfiloMaestro | null> {
  const snap = await getDoc(doc(db, 'maestri', uid));
  return snap.exists() ? (snap.data() as ProfiloMaestro) : null;
}

export async function accediMaestro(email: string, password: string): Promise<User> {
  const cred = await signInWithEmailAndPassword(auth, email.trim(), password.trim());
  return cred.user;
}

// ⚠️ `onErrore` non e' un lusso. Chi usa questo elenco per il TERMINE
// DI DISDETTA delle lezioni deve poter distinguere "l'elenco non e'
// ancora arrivato" da "non arrivera'": nel primo caso non si puo'
// ancora dire niente al socio, nel secondo bisogna ripiegare su
// qualcosa invece di lasciarlo bloccato per sempre. Con il solo
// console.warn di prima, un ascolto respinto era indistinguibile da un
// ascolto lento.
export function ascoltaMaestriCircolo(
  circoloId: string,
  callback: (m: MaestroConUid[]) => void,
  onErrore?: () => void,
) {
  const q = query(collection(db, 'maestri'), where('circoloId', '==', circoloId));
  return onSnapshot(
    q,
    (snap) => callback(snap.docs.map((d) => ({ uid: d.id, ...(d.data() as any) })) as MaestroConUid[]),
    (errore) => {
      console.warn('Ascolto maestri interrotto:', errore?.message ?? errore);
      onErrore?.();
    }
  );
}

// ============================================================
// ⚠️ NON CREA PIU' UN ACCOUNT: NE COLLEGA UNO, SE C'E' GIA'.
//
// Fino al 29 agosto 2026 questa funzione creava sempre un account
// nuovo, e il caso piu' normale che ci sia — il maestro del circolo
// che di quel circolo e' anche socio — sbatteva contro «esiste gia' un
// account con questa email». Era un muro costruito per sbaglio:
// l'architettura del progetto e' sempre stata che la qualifica non e'
// l'account ma un DOCUMENTO, e lo stesso uid puo' averne piu' d'uno.
// Mancava solo che la creazione lo sapesse.
//
// ⚠️ IL LAVORO LO FA IL SERVER, e non e' una preferenza: dal browser
// non si puo' cercare un utente per email. E' un'operazione dell'Admin
// SDK, e l'unico modo di aggirarla sarebbe provare a entrare con
// quell'indirizzo, cioe' avere la password di un altro.
//
// ⚠️ SE L'ACCOUNT ESISTE, LA PASSWORD SCRITTA NEL MODULO SI IGNORA.
// Quella password e' del socio: sovrascriverla vorrebbe dire che un
// Admin puo' impossessarsi dell'account di un proprio socio scrivendo
// il suo indirizzo in un modulo. `creato` dice quale dei due casi e'
// stato, e serve all'interfaccia per non promettere una password che
// non esiste.
// ============================================================
export async function creaMaestro(
  circoloId: string, nome: string, cognome: string, email: string, password: string,
  consentiAdmin: boolean = false
): Promise<{ uid: string; creato: boolean }> {
  const chiama = httpsCallable(functions, 'assegnaQualifica', { timeout: 120000 });
  const esito = await chiama({
    circoloId, qualifica: 'maestro',
    nome: nome.trim(), cognome: cognome.trim(), email: email.trim(), password: password.trim(),
    consentiAdmin,
  });
  return esito.data as { uid: string; creato: boolean };
}

// Concede o revoca, per un Maestro già esistente, il permesso di
// accedere ANCHE come Admin Circolo (stesso account, stesso login).
// Concedere crea un documento "responsabili" gemello con lo stesso
// uid; revocare lo elimina. Senza questo, un Maestro non può in
// alcun modo entrare in Admin — è bloccato lato regole, non solo
// lato interfaccia.
export async function impostaAccessoAdmin(maestro: MaestroConUid, consentito: boolean) {
  if (consentito) {
    // ⚠️ Si cancella PRIMA di scrivere, anche se di norma non c'e'
    // niente da cancellare. Il documento "responsabili" e' quello che
    // decide di quale circolo si e' Admin, quindi le regole lo
    // consentono solo in creazione e mai in modifica: se per un
    // errore a meta' strada (scrittura riuscita, aggiornamento del
    // maestro fallito) ne fosse rimasto uno, ogni tentativo
    // successivo sarebbe diventato una modifica — respinta per sempre,
    // senza nessuna via d'uscita dall'interfaccia.
    try { await deleteDoc(doc(db, 'responsabili', maestro.uid)); } catch { /* non c'era */ }
    await setDoc(doc(db, 'responsabili', maestro.uid), {
      nome: maestro.nome, cognome: maestro.cognome, email: maestro.email, circoloId: maestro.circoloId,
    });
  } else {
    await deleteDoc(doc(db, 'responsabili', maestro.uid));
  }
  await updateDoc(doc(db, 'maestri', maestro.uid), { puoAccedereAdmin: consentito });
}

// Il Maestro scrive il PROPRIO limite, dalle sue Impostazioni. Le
// regole gia' lo consentono (ognuno puo' aggiornare il suo documento);
// nessun altro passa da qui.
export async function impostaLimiteCancellazioneLezioni(uid: string, ore: number): Promise<void> {
  await updateDoc(doc(db, 'maestri', uid), { oreLimiteCancellazioneLezioni: ore });
}

// ============================================================
// ANAGRAFICA — la scrive l'Admin del circolo.
// ============================================================

// Solo le chiavi di CAMPI_ANAGRAFICA_MAESTRO, e sempre tutte.
// ⚠️ Le regole accettano l'aggiornamento se tocca SOLO quelle: una
// chiave in piu' fatta scivolare qui dentro (per esempio copiando
// l'oggetto arrivato dal modulo, che contiene anche uid e circoloId)
// fa respingere l'intero salvataggio.
export async function salvaAnagraficaMaestro(
  uid: string,
  dati: {
    fotoUrl?: string | null;
    qualifica?: string;
    discipline?: string[];
    insegnaDal?: number | null;
    bio?: string;
  },
): Promise<void> {
  const valori: Record<string, unknown> = {
    fotoUrl: dati.fotoUrl ?? null,
    qualifica: (dati.qualifica ?? '').trim().slice(0, MAX_QUALIFICA_MAESTRO),
    discipline: dati.discipline ?? [],
    // ⚠️ null e non undefined: Firestore rifiuta undefined con un
    // errore che parla di "unsupported field value", e il salvataggio
    // dell'intera scheda fallirebbe per un anno lasciato in bianco.
    insegnaDal: typeof dati.insegnaDal === 'number' && !Number.isNaN(dati.insegnaDal)
      ? dati.insegnaDal
      : null,
    bio: (dati.bio ?? '').trim().slice(0, MAX_BIO_MAESTRO),
  };
  // ⚠️ Le chiavi da scrivere si prendono DALLA COSTANTE, non si
  // riscrivono qui a mano. Elencandole due volte, gli elenchi da tenere
  // allineati diventavano tre — la costante, questa funzione e le
  // regole — e l'unico che non faceva niente era proprio quello che si
  // presenta come la fonte di verita'. Cosi', invece, aggiungere un
  // campo qui senza aggiungerlo alla costante non lo salva affatto:
  // l'errore si vede subito, invece di trasformarsi in un rifiuto
  // silenzioso delle regole.
  const daScrivere: Record<string, unknown> = {};
  for (const chiave of CAMPI_ANAGRAFICA_MAESTRO) daScrivere[chiave] = valori[chiave];
  await updateDoc(doc(db, 'maestri', uid), daScrivere);
}

function rifSchedaPrivata(uid: string) {
  return doc(db, 'maestri', uid, 'privato', 'scheda');
}

export async function leggiSchedaPrivata(uid: string): Promise<SchedaPrivataMaestro | null> {
  const snap = await getDoc(rifSchedaPrivata(uid));
  return snap.exists() ? (snap.data() as SchedaPrivataMaestro) : null;
}

// setDoc e non updateDoc: la prima volta il documento non esiste
// ancora, e updateDoc su un documento inesistente non lo crea — dà
// errore. merge: true perché domani questa scheda potrebbe avere
// campi scritti da un'altra schermata.
export async function salvaSchedaPrivata(uid: string, dati: SchedaPrivataMaestro): Promise<void> {
  await setDoc(rifSchedaPrivata(uid), {
    telefono: (dati.telefono ?? '').trim(),
    tariffaIndividuale: numeroOppureNull(dati.tariffaIndividuale),
    tariffaCoppia: numeroOppureNull(dati.tariffaCoppia),
    tariffaGruppo: numeroOppureNull(dati.tariffaGruppo),
    notaTariffe: (dati.notaTariffe ?? '').trim(),
  }, { merge: true });
}

function numeroOppureNull(v: number | null | undefined): number | null {
  return typeof v === 'number' && !Number.isNaN(v) && v >= 0 ? v : null;
}

export async function rimuoviMaestro(maestro: MaestroConUid) {
  // Rimuove il profilo Maestro e, se presente, anche il gemello
  // "responsabili" (altrimenti resterebbe un accesso Admin fantasma
  // per un account che dall'elenco Maestri sembra sparito).
  // ⚠️ SEMPRE, non solo se il flag dice di si'. puoAccedereAdmin sul
  // documento del Maestro e' soltanto uno SPECCHIO: il permesso vero e'
  // il documento "responsabili" con lo stesso identificativo. I due
  // possono disallinearsi — impostaAccessoAdmin scrive prima l'uno e
  // poi l'altro, e un guasto in mezzo lascia il permesso acceso con lo
  // specchio spento. Fidandosi dello specchio si saltava la
  // cancellazione, e restava un accesso Admin a nome di un Maestro che
  // dall'elenco e' sparito: non piu' revocabile da nessuna schermata,
  // perche' le regole consentono di togliere un "responsabili" solo
  // finche' il Maestro esiste. Cancellare un documento che non c'e' non
  // solleva errori: chiederlo sempre non costa niente.
  try {
    await deleteDoc(doc(db, 'responsabili', maestro.uid));
  } catch (e) {
    // Qui invece si SMETTE: proseguire vorrebbe dire cancellare il
    // Maestro lasciando in piedi il suo accesso Admin, e da quel
    // momento non lo toglie piu' nessuno.
    throw new Error('ACCESSO_ADMIN_NON_REVOCATO');
  }
  // ⚠️ LA SCHEDA PRIVATA SI CANCELLA PRIMA DEL MAESTRO, e l'ordine non
  // e' un dettaglio di stile. Le regole decidono chi puo' toccare
  // maestri/{uid}/privato/scheda andando a leggere il circoloId sul
  // documento del Maestro: tolto quello, il documento privato non ha
  // piu' nessuno che possa leggerlo o cancellarlo — resterebbe li'
  // dentro, con un numero di telefono, per sempre e senza che nessuno
  // possa piu' arrivarci. Le sottocollezioni non seguono il padre:
  // cancellare un documento non cancella cio' che sta sotto.
  //
  // ⚠️ E se non riesce ci si FERMA, invece di andare avanti. Il
  // console.warn che c'era prima annullava la garanzia appena
  // spiegata: bastava una rete assente o una sessione Collaboratore
  // scaduta a meta' strada per ottenere esattamente l'orfano che
  // questo blocco deve evitare — un numero di telefono che nessuno,
  // mai piu', puo' leggere o cancellare. Meglio un Maestro che resta
  // nell'elenco e un Admin che riprova.
  //
  // (deleteDoc su un documento inesistente non solleva errori: il caso
  // "la scheda non c'era" passa di qui senza fermare niente.)
  await deleteDoc(rifSchedaPrivata(maestro.uid));
  await deleteDoc(doc(db, 'maestri', maestro.uid));
}
