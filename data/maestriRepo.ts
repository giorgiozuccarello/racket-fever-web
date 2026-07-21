// ============================================================
// MAESTRI — Layer distinto da Admin Circolo e da Socio.
// Provisionati dall'Admin Circolo del proprio club (non dal Super
// Admin: è personale del singolo circolo, non della piattaforma).
//
// Stessa nota tecnica già vista per l'onboarding Super Admin: creare
// un nuovo account Firebase Auth sull'istanza "principale" (quella
// con cui l'Admin Circolo ha fatto login) sostituirebbe la sua
// sessione con quella del Maestro appena creato. Lo evitiamo con
// un'istanza Firebase secondaria e "usa e getta".
// ============================================================

import { initializeApp, deleteApp } from 'firebase/app';
import {
  getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword,
  signOut as signOutSecondaria, User,
} from 'firebase/auth';
import {
  doc, setDoc, getDoc, deleteDoc, collection, onSnapshot, query, where,
} from 'firebase/firestore';
import { auth, db } from '../lib/firebase';

// Stessa configurazione di lib/firebase.ts — duplicata qui solo per
// poter inizializzare l'istanza Firebase separata descritta sopra.
const firebaseConfig = {
  apiKey: 'AIzaSyBWoZ7tkJyMDQqYgPMNEdkgDY5RD1Y2ta0',
  authDomain: 'racquet-fever.firebaseapp.com',
  projectId: 'racquet-fever',
  storageBucket: 'racquet-fever.firebasestorage.app',
  messagingSenderId: '855486484632',
  appId: '1:855486484632:web:dd84b4e27e2a5525f980ed',
};

export interface ProfiloMaestro {
  nome: string;
  cognome: string;
  email: string;
  circoloId: string;
}

export interface MaestroConUid extends ProfiloMaestro {
  uid: string;
}

export async function leggiMaestro(uid: string): Promise<ProfiloMaestro | null> {
  const snap = await getDoc(doc(db, 'maestri', uid));
  return snap.exists() ? (snap.data() as ProfiloMaestro) : null;
}

export async function accediMaestro(email: string, password: string): Promise<User> {
  const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
  return cred.user;
}

export function ascoltaMaestriCircolo(circoloId: string, callback: (m: MaestroConUid[]) => void) {
  const q = query(collection(db, 'maestri'), where('circoloId', '==', circoloId));
  return onSnapshot(
    q,
    (snap) => callback(snap.docs.map((d) => ({ uid: d.id, ...(d.data() as any) })) as MaestroConUid[]),
    (errore) => console.warn('Ascolto maestri interrotto:', errore?.message ?? errore)
  );
}

export async function creaMaestro(
  circoloId: string, nome: string, cognome: string, email: string, password: string
): Promise<string> {
  const nomeAppTemporanea = `maestro-onboarding-${Date.now()}`;
  const appSecondaria = initializeApp(firebaseConfig, nomeAppTemporanea);
  const authSecondaria = getAuth(appSecondaria);

  let uid: string;
  try {
    const cred = await createUserWithEmailAndPassword(authSecondaria, email.trim(), password);
    uid = cred.user.uid;
    await signOutSecondaria(authSecondaria);
  } finally {
    await deleteApp(appSecondaria);
  }

  await setDoc(doc(db, 'maestri', uid), {
    nome: nome.trim(), cognome: cognome.trim(), email: email.trim(), circoloId,
  });
  return uid;
}

export async function rimuoviMaestro(uid: string) {
  // Rimuove solo il profilo/i permessi: l'account Auth resta (come
  // già facciamo per i Responsabili) — la cancellazione account va
  // gestita separatamente se mai servisse.
  await deleteDoc(doc(db, 'maestri', uid));
}
