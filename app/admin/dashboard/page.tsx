'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../../../lib/firebase';
import InstallPrompt from '../InstallPrompt';

export default function AdminDashboard() {
  const router = useRouter();
  const [caricando, setCaricando] = useState(true);
  const [nomeCircolo, setNomeCircolo] = useState('');

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user: User | null) => {
      if (!user) {
        router.replace('/admin/login');
        return;
      }
      const respSnap = await getDoc(doc(db, 'responsabili', user.uid));
      if (!respSnap.exists()) {
        await signOut(auth);
        router.replace('/admin/login');
        return;
      }
      const circoloId = (respSnap.data() as any).circoloId;
      const circoloSnap = await getDoc(doc(db, 'circoli', circoloId));
      setNomeCircolo(circoloSnap.exists() ? ((circoloSnap.data() as any).nome as string) : '');
      setCaricando(false);
    });
    return unsub;
  }, [router]);

  const logout = async () => {
    await signOut(auth);
    router.replace('/admin/login');
  };

  if (caricando) {
    return (
      <div className="admin-splash">
        <div className="logo-mark" aria-hidden="true" />
        <p className="mono" style={{ marginTop: '1rem', opacity: 0.8 }}>Caricamento…</p>
      </div>
    );
  }

  return (
    <div className="admin-shell">
      <InstallPrompt />

      <header className="admin-header">
        <div>
          <div className="mono" style={{ opacity: 0.75 }}>ADMIN CIRCOLO</div>
          <h1 className="display" style={{ fontSize: '1.7rem', marginTop: '.2rem' }}>{nomeCircolo}</h1>
        </div>
        <button className="btn btn-outline admin-logout-btn" onClick={logout}>Esci</button>
      </header>

      <main className="admin-main">
        <div className="admin-placeholder-card">
          <p>
            Login funzionante ✓ — qui arriveranno a breve le sezioni: Password del
            circolo, Campi, Limite ore, Prezzi, Orari riservati, Soci &amp; Wallet,
            Prenotazioni. Stesse funzionalità già operative nell&apos;app mobile.
          </p>
        </div>
      </main>
    </div>
  );
}
