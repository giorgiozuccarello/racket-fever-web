// ============================================================
// SUPER ADMIN — profilo del team Racket Fever (Layer 1).
// Provisionato manualmente (script di seed), come i responsabili
// dei circoli: nessuna autoregistrazione dall'app/sito.
// ============================================================

import { doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

export interface ProfiloSuperAdmin {
  nome: string;
  cognome: string;
  email: string;
}

export async function leggiSuperAdmin(uid: string): Promise<ProfiloSuperAdmin | null> {
  const snap = await getDoc(doc(db, 'super_admin', uid));
  return snap.exists() ? (snap.data() as ProfiloSuperAdmin) : null;
}
