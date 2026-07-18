'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../../lib/firebase';

// Questo è l'indirizzo che l'icona installata (PWA) apre per prima.
// Controlla se c'è già una sessione valida: se sì, va dritto alla
// Dashboard; altrimenti al login. Stessa logica già usata in
// app/index.tsx sul lato mobile.
export default function AdminEntry() {
  const router = useRouter();

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.replace('/admin/login');
        return;
      }
      const snap = await getDoc(doc(db, 'responsabili', user.uid));
      if (!snap.exists()) {
        router.replace('/admin/login');
        return;
      }
      router.replace('/admin/dashboard');
    });
    return unsub;
  }, [router]);

  return (
    <div className="admin-splash">
      <div className="logo-mark" aria-hidden="true" />
      <p className="mono" style={{ marginTop: '1rem', opacity: 0.8 }}>Verifica sessione…</p>
    </div>
  );
}
