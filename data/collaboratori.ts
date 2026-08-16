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
import {
  doc, setDoc, getDoc, getDocs, deleteDoc, collection, query, where, serverTimestamp,
} from 'firebase/firestore';
import { auth, db } from '../lib/firebase';

export interface SessioneCollaboratore {
  circoloId: string;
  // Millisecondi. Assente vuol dire "sessione di prima che le scadenze
  // esistessero", ed e' trattata come gia' scaduta — sono proprio
  // quelle il motivo per cui la scadenza e' stata introdotta.
  scadeIlMs?: number;
}

// Prende qualunque cosa porti una scadenza: il documento intero della
// sessione o la riga ridotta usata nell'elenco delle revoche.
export function sessioneScaduta(s?: { scadeIlMs?: number } | null): boolean {
  return !s || (s.scadeIlMs ?? 0) <= Date.now();
}

// Se la password non è corretta (o l'Admin non ne ha ancora
// impostata una), la regola Firestore rifiuta la scrittura: qui
// intercettiamo l'errore, chiudiamo la sessione anonima appena
// creata (per non lasciarla "a vuoto") e rilanciamo l'errore perché
// la UI possa mostrare un messaggio chiaro.
// ⚠️ DODICI ORE, E POI SI RIENTRA.
// La password si verifica UNA VOLTA SOLA, qui: da questo momento in
// poi i permessi di Admin dipendono solo dal fatto che questo
// documento esista. Senza una scadenza restava valido per sempre — il
// ragazzo che aiuta in segreteria d'estate conservava a settembre il
// diritto di muovere il credito di tutti i soci — e la schermata
// diceva all'Admin che cambiare la password revocava l'accesso, cosa
// che non era vera. Dodici ore coprono la giornata di lavoro piu'
// lunga; il giorno dopo si ridigita, ed e' li' che una password
// cambiata fa il suo effetto.
// Il valore e' vincolato anche dalle regole: chiedere una scadenza
// piu' lontana fa respingere la scrittura.
export const DURATA_SESSIONE_COLLABORATORE_MS = 12 * 60 * 60 * 1000;

export async function accediComeCollaboratore(circoloId: string, password: string): Promise<void> {
  const cred = await signInAnonymously(auth);
  try {
    await setDoc(doc(db, 'sessioni_collaboratore', cred.user.uid), {
      circoloId,
      password: password.trim(),
      creataIl: serverTimestamp(),
      scadeIlMs: Date.now() + DURATA_SESSIONE_COLLABORATORE_MS,
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

// ============================================================
// REVOCA — chiudere le sessioni aperte su un circolo.
//
// ⚠️ Serve perche' la schermata dice all'Admin che cambiare la
// password revoca l'accesso a tutti, e finora non era vero: la
// password si controlla SOLO quando la sessione nasce, quindi chi era
// gia' entrato restava dentro. Adesso le sessioni scadono da sole in
// dodici ore, e da qui si possono chiudere subito — quando qualcuno
// se n'e' andato e non si vuole aspettare domani.
//
// ⚠️ Solo il responsabile vero, non il Collaboratore: le regole lo
// impongono, e ha senso — un collaboratore che sbatte fuori i colleghi
// non e' una funzione, e' un dispetto.
// ============================================================
export interface SessioneAperta {
  uid: string;
  scadeIlMs?: number;
}

export async function sessioniAperteDelCircolo(circoloId: string): Promise<SessioneAperta[]> {
  const istantanea = await getDocs(
    query(collection(db, 'sessioni_collaboratore'), where('circoloId', '==', circoloId))
  );
  return istantanea.docs
    .map((d) => ({ uid: d.id, scadeIlMs: (d.data() as { scadeIlMs?: number }).scadeIlMs }))
    .filter((s) => !sessioneScaduta(s));
}

// Ritorna quante ne ha chiuse davvero. Le scadute si cancellano
// comunque: sono documenti che non servono piu' a nessuno e che
// continueremmo a pagare.
export async function revocaSessioniDelCircolo(circoloId: string): Promise<number> {
  const istantanea = await getDocs(
    query(collection(db, 'sessioni_collaboratore'), where('circoloId', '==', circoloId))
  );
  let chiuse = 0;
  for (const d of istantanea.docs) {
    try {
      await deleteDoc(d.ref);
      chiuse += 1;
    } catch (errore) {
      console.warn('Sessione non revocata:', errore);
    }
  }
  return chiuse;
}
