// ============================================================
// RESPONSABILI — account degli Admin Circolo (Layer 2).
// Sono account Firebase Auth distinti dai soci: la presenza di un
// documento in "responsabili/{uid}" è ciò che identifica un utente
// come Admin Circolo (e di quale circolo). In questa fase gli
// account vengono creati dal team Racket Fever (script di seeding),
// non dall'app: non c'è un flusso di autoregistrazione per i presidenti.
// ============================================================

import { signInWithEmailAndPassword, User } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';

export interface ProfiloResponsabile {
  nome: string;
  cognome: string;
  email: string;
  circoloId: string;
}

export async function accediResponsabile(email: string, password: string): Promise<User> {
  const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
  return cred.user;
}

export async function leggiResponsabile(uid: string): Promise<ProfiloResponsabile | null> {
  const snap = await getDoc(doc(db, 'responsabili', uid));
  return snap.exists() ? (snap.data() as ProfiloResponsabile) : null;
}
