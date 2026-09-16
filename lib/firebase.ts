// ============================================================
// CONFIGURAZIONE FIREBASE — WEB
// Stesso progetto Firebase dell'app mobile: stessi utenti, stessi
// circoli, stesso database. Sul web non serve la persistenza
// AsyncStorage usata in React Native — il browser gestisce già
// la sessione da solo.
//
// NOTA SUL NOME: il prodotto si chiama "Racket Fever", ma l'ID del
// progetto Firebase ("racquet-fever") è permanente e non rinominabile
// — per questo authDomain/projectId/storageBucket restano invariati.
// È un dettaglio tecnico invisibile, non riguarda il brand.
// ============================================================

import { initializeApp, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getFunctions } from 'firebase/functions';

const firebaseConfig = {
  apiKey: 'AIzaSyBWoZ7tkJyMDQqYgPMNEdkgDY5RD1Y2ta0',
  authDomain: 'racquet-fever.firebaseapp.com',
  projectId: 'racquet-fever',
  storageBucket: 'racquet-fever.firebasestorage.app',
  messagingSenderId: '855486484632',
  appId: '1:855486484632:web:dd84b4e27e2a5525f980ed',
};

// ============================================================
// ⚠️ «ESISTE L'APP PREDEFINITA?» E NON «ESISTE QUALCHE APP?»
//
// Qui c'era scritto:
//
//     const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
//
// Sembra corretto e non lo è, per un motivo che non si vede leggendo:
// `getApps()` restituisce TUTTE le app, comprese quelle con un NOME.
// Basta che un altro modulo nello stesso processo ne abbia registrata
// una — e dal 16 settembre il pannello RF Coach in `app/rfcoach/` ne
// registra una sua, di proposito, per non mescolarsi con questa —
// perché quel conteggio non sia più zero: il `if` non fa niente,
// `getApp()` va a cercare l'app PREDEFINITA che nessuno ha creato, e
// tutto cade con `app/no-app`.
//
// ⚠️ È SUCCESSO DAVVERO, e si è visto in build: «Error occurred
// prerendering page /admin/login — No Firebase App '[DEFAULT]' has been
// created». Una pagina del sito, rotta da un modulo che non c'entrava
// niente con lei.
//
// ⚠️ ED È LA STESSA IDENTICA TRAPPOLA GIÀ COSTATA UN POMERIGGIO l'11
// settembre 2026 dall'altra parte, in `functions/src/db.ts` di RF
// Coach, dove `firebase-functions` registrava un'app sua
// (`__FIREBASE_FUNCTIONS_SDK__`) e ogni notifica falliva. La domanda era
// sbagliata nello stesso modo, e la cura è la stessa: chiedere
// dell'app predefinita, che è una domanda che si può porre in un modo
// solo — provando a prenderla.
//
// ⚠️ Il difetto era qui da prima, latente: il pannello l'ha soltanto
// fatto emergere. Con questa riga, chiunque registri un'app con un nome
// non può più rompere il sito.
// ============================================================
function appPredefinita() {
  try {
    return getApp();
  } catch {
    return initializeApp(firebaseConfig);
  }
}

const app = appPredefinita();

export const auth = getAuth(app);

// ============================================================
// ⚠️ LE EMAIL DI FIREBASE IN ITALIANO, e non era così.
//
// Senza questa riga ogni messaggio che Firebase manda per conto nostro
// — reimpostazione password, conferma di un cambio di indirizzo — parte
// con il testo predefinito, cioè in inglese. Arriva da un mittente che
// il destinatario non conosce (`noreply@racquet-fever.firebaseapp.com`)
// e porta un link su un dominio che non ha mai visto: un'email in
// inglese, da uno sconosciuto, con dentro un link. È la descrizione di
// un tentativo di truffa, e finisce cestinata o nello spam.
//
// ⚠️ E non è un dettaglio di cortesia: su quell'email si regge l'unica
// strada di recupero di un account. Il giorno che serve, deve essere
// riconoscibile al primo sguardo.
//
// ⚠️ Resta da fare, e va fatto dalla console (non dal codice):
// personalizzare i modelli in Authentication → Templates, almeno
// «Password reset» e «Email address change».
// ============================================================
auth.languageCode = 'it';
export const db = getFirestore(app);
export const storage = getStorage(app);

// ============================================================
// CLOUD FUNCTIONS — la regione conta.
// Le funzioni girano a europe-west1 (Belgio): senza indicarlo qui,
// l'SDK le cercherebbe a us-central1 e ogni chiamata risponderebbe
// "funzione non trovata". La latenza verso l'Italia e' circa un terzo
// di quella americana, e su una cancellazione si aspetta la risposta
// prima di poter dire al socio com'e' andata.
// ============================================================
export const functions = getFunctions(app, 'europe-west1');
