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
import { doc, setDoc, addDoc, collection } from 'firebase/firestore';
import { db } from '../lib/firebase';

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
  passwordCircolo: string;
  colorePrimario: string;
  coloreAccento: string;
  nomeAdmin: string;
  cognomeAdmin: string;
  emailAdmin: string;
  passwordAdmin: string;
}

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
  const circoloRef = await addDoc(collection(db, 'circoli'), {
    nome: dati.nomeCircolo.trim(),
    citta: dati.citta.trim(),
    sigla: dati.sigla.trim().toUpperCase(),
    password: dati.passwordCircolo.trim(),
    tema: { primario: dati.colorePrimario, accento: dati.coloreAccento },
    limiteOreSettimanali: 0,
  });

  await setDoc(doc(db, 'responsabili', uidAdmin), {
    nome: dati.nomeAdmin.trim(),
    cognome: dati.cognomeAdmin.trim(),
    email: dati.emailAdmin.trim(),
    circoloId: circoloRef.id,
  });

  return circoloRef.id;
}
