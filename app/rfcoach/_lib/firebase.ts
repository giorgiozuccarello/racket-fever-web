// ============================================================
// FIREBASE, DAL BROWSER — e le tre righe che non si sbagliano.
//
// ⚠️ 1. IL DATABASE HA UN NOME. `getFirestore(app)` senza secondo
// argomento apre il database PREDEFINITO del progetto, cioe' quello di
// RACKET FEVER: i circoli in esercizio. Non darebbe nessun errore —
// leggerebbe circoli invece di spazi, e il pannello mostrerebbe un
// elenco vuoto o, peggio, comincerebbe a scriverci. E' la stessa
// trappola scritta in testa a `functions/src/db.ts` dell'app, spostata
// nel browser.
//
// ⚠️ 2. LE FUNCTIONS HANNO UNA REGIONE. `getFunctions(app)` senza
// regione chiama `us-central1`, dove le nostre funzioni non esistono: la
// chiamata fallisce con «not-found», che sembra un errore di nome.
//
// ⚠️ 3. IL BUCKET E' QUELLO DI RF COACH. Non serve ancora a nessuna
// schermata di questo pannello, ma il giorno che servira' — il logo di
// uno spazio caricato da qui — un bucket sbagliato scriverebbe nel
// deposito dei circoli, dove le regole sono di un altro prodotto.
//
// ============================================================
// ⚠️ E QUESTI VALORI NON SONO SEGRETI, malgrado si chiamino «chiavi».
//
// La regola del progetto e' «nessun segreto va scritto in un file del
// repository», e questa configurazione non la viola: sono gli
// identificativi PUBBLICI del progetto Firebase — gli stessi che
// viaggiano dentro ogni copia dell'app su ogni telefono, e che
// qualunque browser legge aprendo la pagina. Non aprono niente da soli.
//
// Cio' che decide chi puo' fare cosa sta in due posti, e nessuno dei due
// e' qui: `firestore.rules` e il documento `superadmin/{uid}`. Il
// segreto vero — la chiave di servizio — non sta in nessun repository e
// si carica solo su EAS.
// ============================================================

import { getApp, getApps, initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getFunctions } from 'firebase/functions';
import { getStorage } from 'firebase/storage';

// ⚠️ Gli stessi valori di `lib/firebase.ts` dell'app RF Coach — non
// quelli di `racket-fever-web`, che porta l'`appId` e il bucket
// dell'app dei circoli.
const configurazione = {
  apiKey: 'AIzaSyBWoZ7tkJyMDQqYgPMNEdkgDY5RD1Y2ta0',
  authDomain: 'racquet-fever.firebaseapp.com',
  projectId: 'racquet-fever',
  storageBucket: 'rf-coach-racquet-fever',
  messagingSenderId: '855486484632',
  appId: '1:855486484632:web:a630a9e581e50528f980ed',
};

// ⚠️ In un posto solo, come nell'app: chi ne ha bisogno importa da qui.
export const NOME_DATABASE = 'rf-coach';
export const REGIONE = 'europe-west1';

// ============================================================
// ⚠️ UN'APP FIREBASE CON UN NOME, E NON QUELLA PREDEFINITA — ed e' la
// riga piu' importante del trasloco del 16 settembre.
//
// Questo pannello adesso vive DENTRO `racket-fever-web`, che ha gia' un
// `lib/firebase.ts` suo: apre l'app predefinita, con il bucket dei
// circoli e il database PREDEFINITO. Con `getApps().length ? getApp()`
// — com'era scritto qui quando il pannello stava in un repository a se'
// — bastava che una pagina caricasse per prima il modulo del sito
// perche' il nostro si agganciasse alla SUA app: stesso progetto,
// bucket sbagliato, e la nostra configurazione semplicemente ignorata.
// Senza nessun errore.
//
// Con un nome, le due non si toccano mai, qualunque cosa faccia il
// sito e in qualunque ordine i moduli vengano caricati.
//
// ⚠️ E LA SESSIONE E' SEPARATA, che qui e' un pregio e non un effetto
// collaterale: chi entra nel Super Admin non eredita il login dell'Admin
// Circolo, e viceversa. Sono due porte diverse dello stesso palazzo.
// ============================================================
const NOME_APP = 'rfcoach';

export const app = getApps().find((a) => a.name === NOME_APP)
  ?? initializeApp(configurazione, NOME_APP);

export const auth = getAuth(app);
export const db = getFirestore(app, NOME_DATABASE);
export const funzioni = getFunctions(app, REGIONE);
export const deposito = getStorage(app);
