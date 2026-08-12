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
  doc, setDoc, getDoc, updateDoc, deleteDoc, collection, onSnapshot, query, where,
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

export async function creaMaestro(
  circoloId: string, nome: string, cognome: string, email: string, password: string,
  consentiAdmin: boolean = false
): Promise<string> {
  const nomeAppTemporanea = `maestro-onboarding-${Date.now()}`;
  const appSecondaria = initializeApp(firebaseConfig, nomeAppTemporanea);
  const authSecondaria = getAuth(appSecondaria);

  let uid: string;
  try {
    const cred = await createUserWithEmailAndPassword(authSecondaria, email.trim(), password.trim());
    uid = cred.user.uid;
    await signOutSecondaria(authSecondaria);
  } finally {
    await deleteApp(appSecondaria);
  }

  await setDoc(doc(db, 'maestri', uid), {
    nome: nome.trim(), cognome: cognome.trim(), email: email.trim(), circoloId,
    puoAccedereAdmin: consentiAdmin,
  });

  if (consentiAdmin) {
    await setDoc(doc(db, 'responsabili', uid), {
      nome: nome.trim(), cognome: cognome.trim(), email: email.trim(), circoloId,
    });
  }

  return uid;
}

// Concede o revoca, per un Maestro già esistente, il permesso di
// accedere ANCHE come Admin Circolo (stesso account, stesso login).
// Concedere crea un documento "responsabili" gemello con lo stesso
// uid; revocare lo elimina. Senza questo, un Maestro non può in
// alcun modo entrare in Admin — è bloccato lato regole, non solo
// lato interfaccia.
export async function impostaAccessoAdmin(maestro: MaestroConUid, consentito: boolean) {
  if (consentito) {
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

export async function rimuoviMaestro(maestro: MaestroConUid) {
  // Rimuove il profilo Maestro e, se presente, anche il gemello
  // "responsabili" (altrimenti resterebbe un accesso Admin fantasma
  // per un account che dall'elenco Maestri sembra sparito).
  if (maestro.puoAccedereAdmin) {
    await deleteDoc(doc(db, 'responsabili', maestro.uid));
  }
  await deleteDoc(doc(db, 'maestri', maestro.uid));
}
