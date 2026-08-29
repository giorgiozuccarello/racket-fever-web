// ============================================================
// ONBOARDING CIRCOLI — crea un nuovo circolo e il suo primo
// Admin Circolo, in sostituzione dello script seed.js.
//
// NOTA TECNICA IMPORTANTE:
// creare un account con createUserWithEmailAndPassword sull'istanza
// Firebase "principale" (quella con cui il Super Admin ha fatto
// login) sostituirebbe automaticamente la sua sessione con quella
// del nuovo account appena creato — è un comportamento nativo di
// Firebase Auth, non un bug nostro: l'SDK considera "loggato" chi
// ha appena fatto l'ultima createUser/signIn su una data istanza.
//
// Per evitarlo, il nuovo account viene creato su un'istanza
// Firebase SECONDARIA e "usa e getta", del tutto scollegata dalla
// sessione del Super Admin. I documenti Firestore (circolo,
// responsabile) vengono invece scritti con l'istanza PRINCIPALE,
// quindi con i permessi del Super Admin — la sua sessione non si
// muove mai.
// ============================================================

import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signOut as signOutSecondaria } from 'firebase/auth';
import { doc, setDoc, addDoc, updateDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { TEMA_APP_DEFAULT } from './circoli';

// Stessa configurazione di lib/firebase.ts — duplicata qui perché
// serve per inizializzare l'istanza Firebase separata descritta sopra.
const firebaseConfig = {
  apiKey: 'AIzaSyBWoZ7tkJyMDQqYgPMNEdkgDY5RD1Y2ta0',
  authDomain: 'racquet-fever.firebaseapp.com',
  projectId: 'racquet-fever',
  storageBucket: 'racquet-fever.firebasestorage.app',
  messagingSenderId: '855486484632',
  appId: '1:855486484632:web:dd84b4e27e2a5525f980ed',
};

export interface DatiOnboarding {
  nomeCircolo: string;
  citta: string;
  sigla: string;
  regione: string;
  // ⚠️ Chieste alla NASCITA e non dopo. Da quando la geografia e' di
  // rete, l'Admin non puo' piu' aggiungerle da solo: un circolo che
  // entra senza provincia resta invisibile alla vendita provinciale e
  // pubblica tornei che nessuno trova filtrando per provincia, finche'
  // qualcuno di noi non riapre la sua scheda. Il momento in cui il dato
  // costa zero e' questo.
  provincia: string;
  comune: string;
  passwordCircolo: string;
  nomeAdmin: string;
  cognomeAdmin: string;
  emailAdmin: string;
  passwordAdmin: string;

  // ---- Anagrafica di rete (facoltativa in fase di creazione) ----
  // Chi ha chiesto l'adesione e chi ha firmato: si compilano qui se si
  // sanno già, altrimenti si aggiungono dopo dalla scheda circolo. Non
  // devono bloccare la creazione — un circolo che vuole partire oggi
  // non può aspettare che arrivi il contratto firmato.
  richiedenteNome?: string;
  richiedenteRuolo?: string;
  richiedenteEmail?: string;
  richiedenteTelefono?: string;
  firmatarioNome?: string;
  firmatarioRuolo?: string;
  firmaIl?: string; // 'YYYY-MM-DD'
  richiestaId?: string;
  noteInterne?: string;
}

// Firestore rifiuta il valore undefined (ignoreUndefinedProperties non
// è attivo).
// ⚠️ Ritorna null e non undefined: un campo vuoto va scritto come
// null, non omesso. La modifica dall'anagrafica scrive null, e avere
// due rappresentazioni dello stesso "vuoto" sullo stesso campo —
// assente qui, null la' — e' la divergenza che morde alla prima query
// o al primo confronto con != null.
function testoOpzionale(v?: string | null): string | null {
  const t = (v ?? '').trim();
  return t.length > 0 ? t : null;
}

// Rete di sicurezza contro undefined: oggi nessun campo qui sotto lo
// produce, ma basta un campo nuovo aggiunto in fretta perche' l'intera
// creazione del circolo venga respinta da Firestore con un errore che
// non dice quale campo sia.
function ripulisci<T extends Record<string, any>>(oggetto: T): T {
  const pulito: Record<string, any> = {};
  Object.keys(oggetto).forEach((k) => {
    if (oggetto[k] !== undefined) pulito[k] = oggetto[k];
  });
  return pulito as T;
}

// ⚠️ L'ONBOARDING NON E' ATOMICO, e non puo' esserlo: l'account Auth
// e i documenti Firestore stanno su due servizi diversi, e dal browser
// non c'e' modo di legarli in un'unica transazione. Se si rompe in
// mezzo, chi sta creando il circolo deve sapere ESATTAMENTE a che
// punto si e' fermato — altrimenti riprova da capo, si sente dire che
// l'email e' gia' in uso, e non capisce perche'.
export const ONBOARDING_ACCOUNT_ORFANO = 'ONBOARDING_ACCOUNT_ORFANO';
export const ONBOARDING_CIRCOLO_SENZA_ADMIN = 'ONBOARDING_CIRCOLO_SENZA_ADMIN';

export async function creaCircoloConAdmin(dati: DatiOnboarding): Promise<string> {
  // ---- 1. Crea l'account Auth dell'Admin su un'istanza usa-e-getta ----
  const nomeAppTemporanea = `onboarding-${Date.now()}`;
  const appSecondaria = initializeApp(firebaseConfig, nomeAppTemporanea);
  const authSecondaria = getAuth(appSecondaria);

  let uidAdmin: string;
  try {
    const cred = await createUserWithEmailAndPassword(
      authSecondaria, dati.emailAdmin.trim(), dati.passwordAdmin
    );
    uidAdmin = cred.user.uid;
    await signOutSecondaria(authSecondaria);
  } finally {
    await deleteApp(appSecondaria);
  }

  // ---- 2. Da qui in poi si scrive con l'istanza principale (db),
  //         quindi con i permessi del Super Admin loggato ----
  //
  // ⚠️ temaApp, NON tema. "tema" era il campo di due versioni fa (una
  // coppia di colori liberi); oggi l'app legge una chiave fra gli otto
  // TEMI_APP. Un circolo creato con il campo vecchio nasceva senza
  // tema e ricadeva sul default a ogni avvio.
  //
  // ⚠️ stato e creatoIlMs si scrivono QUI, alla nascita: sono gli unici
  // due momenti in cui la data d'ingresso in rete è nota con certezza.
  // Ricostruirla dopo, per un circolo già attivo, non si può.
  let circoloRef;
  try {
  circoloRef = await addDoc(collection(db, 'circoli'), ripulisci({
    nome: dati.nomeCircolo.trim(),
    citta: dati.citta.trim(),
    sigla: dati.sigla.trim().toUpperCase(),
    password: dati.passwordCircolo.trim(),
    temaApp: TEMA_APP_DEFAULT,
    limiteOreSettimanali: 0,
    regione: testoOpzionale(dati.regione) ?? null,
    provincia: testoOpzionale(dati.provincia) ?? null,
    comune: testoOpzionale(dati.comune) ?? null,

    // ---- Anagrafica di rete ----
    stato: 'attivo',
    creatoIlMs: Date.now(),
    // Il doppio orario è voluto: creatoIlMs si legge subito, anche
    // mentre la scrittura è ancora in volo (latency compensation);
    // creatoIl è quello che fa fede, scritto dal server e immune
    // all'orologio sballato del PC di chi crea il circolo.
    creatoIl: serverTimestamp(),
    sospesoIlMs: null,
    chiusoIlMs: null,

    richiedenteNome: testoOpzionale(dati.richiedenteNome),
    richiedenteRuolo: testoOpzionale(dati.richiedenteRuolo),
    richiedenteEmail: testoOpzionale(dati.richiedenteEmail),
    richiedenteTelefono: testoOpzionale(dati.richiedenteTelefono),
    firmatarioNome: testoOpzionale(dati.firmatarioNome),
    firmatarioRuolo: testoOpzionale(dati.firmatarioRuolo),
    firmaIl: testoOpzionale(dati.firmaIl),
    richiestaId: testoOpzionale(dati.richiestaId),
    noteInterne: testoOpzionale(dati.noteInterne),
  }));
  } catch (errore) {
    // L'account esiste gia' su Auth ma il circolo no: al secondo
    // tentativo con la stessa email si otterrebbe "email gia' in uso"
    // senza nessuna spiegazione.
    console.warn('Circolo non creato dopo l\'account Auth:', errore);
    throw new Error(ONBOARDING_ACCOUNT_ORFANO);
  }

  try {
    await setDoc(doc(db, 'responsabili', uidAdmin), {
      nome: dati.nomeAdmin.trim(),
      cognome: dati.cognomeAdmin.trim(),
      email: dati.emailAdmin.trim(),
      circoloId: circoloRef.id,
      // ============================================================
      // ⚠️ IL SEGNO DEL PRIMO ACCESSO — «questa password gliel'abbiamo
      // data noi».
      //
      // La password dell'Admin la scegliamo qui, compare in chiaro nel
      // riepilogo di fine onboarding e da li' viaggia su WhatsApp, per
      // email o su un foglio. Finche' resta quella, l'account del
      // presidente lo aprono almeno due persone — e una delle due siamo
      // noi. Con questo segno acceso la dashboard non si disegna: al
      // suo posto compare la scelta della password, e finito quel
      // passaggio il segno si spegne per sempre.
      //
      // ⚠️ Vale solo da qui in avanti. I circoli gia' attivi non hanno
      // il campo, e «assente» vuol dire «non fermarlo»: a loro la
      // sezione «Sicurezza Accesso» resta disponibile quando vogliono.
      // ============================================================
      passwordDaCambiare: true,
    });
  } catch (errore) {
    // Il circolo esiste ma nessuno puo' amministrarlo: comparirebbe
    // nell'elenco dei soci senza campi, senza orari e senza nessuno
    // che possa configurarlo.
    console.warn('Admin non collegato al circolo appena creato:', errore);
    throw new Error(ONBOARDING_CIRCOLO_SENZA_ADMIN);
  }

  // ---- 3. Se il circolo nasce da una richiesta arrivata dal sito,
  //         quella richiesta si chiude da sola e resta legata al
  //         circolo creato. Se questo passaggio fallisce il circolo
  //         esiste comunque: è una cucitura, non una condizione.
  const idRichiesta = testoOpzionale(dati.richiestaId);
  if (idRichiesta) {
    try {
      await updateDoc(doc(db, 'richieste_attivazione', idRichiesta), {
        stato: 'attivata',
        circoloId: circoloRef.id,
      });
    } catch (errore: any) {
      console.warn('Richiesta non aggiornata:', errore?.message ?? errore);
    }
  }

  return circoloRef.id;
}
