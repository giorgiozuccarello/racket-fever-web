// ============================================================
// COLLABORATORI — accesso alla Dashboard Admin senza account
// persistente. Chi conosce la password del circolo entra con una
// sessione anonima Firebase; il confronto della password avviene
// lato server nelle Firestore Security Rules (non è aggirabile dal
// client). Nessun profilo, nessuna scadenza gestita esplicitamente:
// la "strada semplice" concordata — stesso spirito della password
// unica già in uso per l'accesso dei soci.
// ============================================================

import { signInAnonymously, signOut as signOutAnonimo } from 'firebase/auth';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';

export interface SessioneCollaboratore {
  circoloId: string;
}

// Se la password non è corretta (o l'Admin non ne ha ancora
// impostata una), la regola Firestore rifiuta la scrittura: qui
// intercettiamo l'errore, chiudiamo la sessione anonima appena
// creata (per non lasciarla "a vuoto") e rilanciamo l'errore perché
// la UI possa mostrare un messaggio chiaro.
export async function accediComeCollaboratore(circoloId: string, password: string): Promise<void> {
  const cred = await signInAnonymously(auth);
  try {
    await setDoc(doc(db, 'sessioni_collaboratore', cred.user.uid), {
      circoloId,
      password: password.trim(),
      creataIl: serverTimestamp(),
    });
  } catch (e) {
    await signOutAnonimo(auth);
    throw e;
  }
}

export async function leggiSessioneCollaboratore(uid: string): Promise<SessioneCollaboratore | null> {
  const snap = await getDoc(doc(db, 'sessioni_collaboratore', uid));
  return snap.exists() ? (snap.data() as SessioneCollaboratore) : null;
}
