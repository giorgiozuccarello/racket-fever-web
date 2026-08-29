// ============================================================
// RESPONSABILI — account degli Admin Circolo (Layer 2).
// Sono account Firebase Auth distinti dai soci: la presenza di un
// documento in "responsabili/{uid}" è ciò che identifica un utente
// come Admin Circolo (e di quale circolo). In questa fase gli
// account vengono creati dal team Racket Fever (script di seeding),
// non dall'app: non c'è un flusso di autoregistrazione per i presidenti.
// ============================================================

import { signInWithEmailAndPassword, User } from 'firebase/auth';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';

export interface ProfiloResponsabile {
  nome: string;
  cognome: string;
  email: string;
  circoloId: string;
  // ⚠️ Acceso solo sui circoli creati dal team dopo il 29 agosto 2026:
  // dice che la password d'accesso e' ancora quella data da noi.
  // Assente vuol dire «gia' a posto», ed e' giusto cosi': i circoli
  // gia' attivi non vanno fermati al prossimo accesso.
  passwordDaCambiare?: boolean;
}

export async function accediResponsabile(email: string, password: string): Promise<User> {
  const cred = await signInWithEmailAndPassword(auth, email.trim(), password.trim());
  return cred.user;
}

export async function leggiResponsabile(uid: string): Promise<ProfiloResponsabile | null> {
  const snap = await getDoc(doc(db, 'responsabili', uid));
  return snap.exists() ? (snap.data() as ProfiloResponsabile) : null;
}

// ⚠️ IL SEGNO DEL PRIMO ACCESSO — si spegne e non si riaccende.
//
// Lo scrive l'onboarding quando il team crea il circolo, e vuol dire
// una cosa sola: «questa password gliel'abbiamo data noi». La
// dashboard, finche' lo trova acceso, non si disegna e mostra al suo
// posto la scelta della password.
//
// ⚠️ LE REGOLE LASCIANO CAMBIARE QUESTO CAMPO E NIENT'ALTRO. Il
// documento dei responsabili e' l'unico posto dove e' scritto DI QUALE
// circolo si e' Admin: se fosse scrivibile per intero, un Admin
// potrebbe spostarsi sul circolo di un altro riscrivendosi `circoloId`
// — e l'elenco dei circoli e' pubblico. Vedi il commento in
// firestore.rules, che questa riga non deve mai allargare.
//
// Restituisce se ha funzionato: chi chiama non deve togliere dallo
// schermo un passaggio obbligatorio che sul database non e' stato
// registrato.
export async function segnaPasswordCambiata(uid: string): Promise<boolean> {
  if (!uid) return false;
  try {
    await updateDoc(doc(db, 'responsabili', uid), { passwordDaCambiare: false });
    return true;
  } catch {
    return false;
  }
}
