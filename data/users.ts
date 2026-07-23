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
  fotoUrl?: string | null; // se assente, si mostrano le iniziali nel cerchio
  limiteRicaricaSOS?: number; // 0/assente = S.O.S. non ancora attivato per questo socio
  sosUtilizzato?: number; // quanto del plafond S.O.S. è già stato usato dall'ultimo Ripristina
  limitePrenotazioniPersonale?: number; // 0/assente = usa il limite generale del circolo
  classificaFitp?: string | null; // dichiarata dal socio stesso, es. "3.4" o "NC" — non verificata
  posizioneClassificaSociale?: number | null; // assente = il socio non è (ancora) in classifica
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

// Imposta il limite di ricarica S.O.S. che il socio può applicarsi da
// solo in caso di emergenza. 0 = funzione disattivata per quel socio.
export async function aggiornaLimiteSOS(uid: string, limite: number) {
  await updateDoc(doc(db, 'utenti', uid), { limiteRicaricaSOS: limite });
}

// Limite di prenotazioni settimanali specifico per un socio — se
// impostato (> 0), sostituisce quello generale del circolo solo per
// lui. 0 = usa il limite del circolo.
export async function aggiornaLimitePersonale(uid: string, limite: number) {
  await updateDoc(doc(db, 'utenti', uid), { limitePrenotazioniPersonale: limite });
}

// L'Admin usa questo quando il socio è passato fisicamente in
// segreteria a saldare quanto usato in S.O.S.: azzera il contatore,
// restituendogli tutto il plafond da usare di nuovo in emergenza.
export async function ripristinaSOS(uid: string) {
  await updateDoc(doc(db, 'utenti', uid), { sosUtilizzato: 0 });
}

// ============================================================
// CLASSIFICA — FITP (dichiarata dal socio) e Sociale (gestita
// dall'Admin, posizione numerica intera e univoca all'interno del
// circolo — le sfide future si baseranno su queste posizioni per
// riordinare la classifica, quindi devono restare sempre coerenti).
// ============================================================

// Il socio dichiara da sé la propria classifica FITP — nessuna
// verifica automatica, è un dato "sulla parola".
export async function impostaClassificaFitp(uid: string, valore: string) {
  await updateDoc(doc(db, 'utenti', uid), { classificaFitp: valore });
}

// L'Admin assegna o modifica la posizione di un socio in Classifica
// Sociale. Il controllo "la posizione è già occupata?" va fatto PRIMA
// di chiamare questa funzione (lato chiamante, con l'elenco soci già
// caricato) — qui scriviamo soltanto.
export async function impostaPosizioneClassificaSociale(uid: string, posizione: number) {
  await updateDoc(doc(db, 'utenti', uid), { posizioneClassificaSociale: posizione });
}

// Toglie un socio dalla Classifica Sociale (resta comunque socio del
// circolo, semplicemente non compare più in classifica).
export async function rimuoviDaClassificaSociale(uid: string) {
  await updateDoc(doc(db, 'utenti', uid), { posizioneClassificaSociale: null });
}
