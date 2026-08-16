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

import { initializeApp, getApps, getApp } from 'firebase/app';
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

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

export const auth = getAuth(app);
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
