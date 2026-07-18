// ============================================================
// UTENTI — Firebase Auth per l'autenticazione, Firestore
// (collezione "utenti") per il profilo, incluso il credito wallet.
// ============================================================

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  sendEmailVerification,
  reload,
  User,
} from 'firebase/auth';
import {
  doc, setDoc, getDoc, updateDoc, onSnapshot,
  collection, query, where,
} from 'firebase/firestore';
import { auth, db } from '../lib/firebase';

export interface ProfiloUtente {
  nome: string;
  cognome: string;
  email: string;
  circoloId: string | null;
  credito: number;
}

export interface SocioCircolo extends ProfiloUtente {
  uid: string;
}

/**
 * Crea l'account su Firebase Auth, il documento profilo su Firestore
 * (con credito iniziale a 0) e invia la vera email di conferma.
 * L'utente viene poi disconnesso: dovrà accedere esplicitamente
 * dopo aver confermato l'email.
 */
export async function registrati(
  nome: string,
  cognome: string,
  email: string,
  password: string
): Promise<void> {
  const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);

  await setDoc(doc(db, 'utenti', cred.user.uid), {
    nome: nome.trim(),
    cognome: cognome.trim(),
    email: email.trim(),
    circoloId: null,
    credito: 0,
  });

  await sendEmailVerification(cred.user);
  await signOut(auth);
}

export async function accedi(email: string, password: string): Promise<User> {
  const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
  await reload(cred.user);

  if (!cred.user.emailVerified) {
    await sendEmailVerification(cred.user);
    await signOut(auth);
    throw new Error('EMAIL_NON_VERIFICATA');
  }

  return cred.user;
}

export async function esciDaAccount(): Promise<void> {
  await signOut(auth);
}

function suUnsub(errore: any) {
  console.warn('Ascolto Firestore interrotto (probabile logout):', errore?.message ?? errore);
}

export async function leggiProfilo(uid: string): Promise<ProfiloUtente | null> {
  const snap = await getDoc(doc(db, 'utenti', uid));
  if (!snap.exists()) return null;
  const v = snap.data() as any;
  return { ...v, credito: v.credito ?? 0 } as ProfiloUtente;
}

// Versione in tempo reale: usata dal context, così il credito si
// aggiorna da solo appena cambia (prenotazione, cancellazione,
// ricarica dalla segreteria), senza bisogno di ricaricare la pagina.
export function ascoltaProfilo(uid: string, callback: (p: ProfiloUtente | null) => void) {
  return onSnapshot(
    doc(db, 'utenti', uid),
    (snap) => {
      if (!snap.exists()) { callback(null); return; }
      const v = snap.data() as any;
      callback({ ...v, credito: v.credito ?? 0 } as ProfiloUtente);
    },
    suUnsub
  );
}

export async function impostaCircoloUtente(uid: string, circoloId: string): Promise<void> {
  await updateDoc(doc(db, 'utenti', uid), { circoloId });
}

// Usata dalla dashboard Admin Circolo per l'elenco soci + wallet.
export function ascoltaSociCircolo(circoloId: string, callback: (soci: SocioCircolo[]) => void) {
  const q = query(collection(db, 'utenti'), where('circoloId', '==', circoloId));
  return onSnapshot(
    q,
    (snap) => {
      callback(snap.docs.map((d) => {
        const v = d.data() as any;
        return { uid: d.id, ...v, credito: v.credito ?? 0 } as SocioCircolo;
      }));
    },
    suUnsub
  );
}
