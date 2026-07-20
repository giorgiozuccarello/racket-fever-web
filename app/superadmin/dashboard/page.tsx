'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import { auth } from '../../../lib/firebase';
import { leggiSuperAdmin, ProfiloSuperAdmin } from '../../../data/superadmin';
import SezioneOnboarding from './SezioneOnboarding';
import SezioneRichieste from './SezioneRichieste';
import SezioneCircoli from './SezioneCircoli';

export default function SuperAdminDashboard() {
  const router = useRouter();
  const [profilo, setProfilo] = useState<ProfiloSuperAdmin | null>(null);
  const [caricando, setCaricando] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user: User | null) => {
      if (!user) {
        router.replace('/superadmin/login');
        return;
      }
      const p = await leggiSuperAdmin(user.uid);
      if (!p) {
        await signOut(auth);
        router.replace('/superadmin/login');
        return;
      }
      setProfilo(p);
      setCaricando(false);
    });
    return unsub;
  }, [router]);

  const logout = async () => {
    await signOut(auth);
    router.replace('/superadmin/login');
  };

  if (caricando || !profilo) {
    return (
      <div className="admin-splash">
        <div className="logo-mark" aria-hidden="true" />
        <p className="mono" style={{ marginTop: '1rem', opacity: 0.8 }}>Caricamento…</p>
      </div>
    );
  }

  return (
    <div className="admin-shell">
      <header className="admin-header">
        <div className="admin-header-brand">
          <div className="logo-mark admin-header-logo-mark" aria-hidden="true" />
          <div>
            <div className="mono" style={{ opacity: 0.75 }}>SUPER ADMIN</div>
            <h1 className="display" style={{ fontSize: '1.7rem', marginTop: '.2rem' }}>Ciao, {profilo.nome}</h1>
          </div>
        </div>
        <button className="btn btn-outline admin-logout-btn" onClick={logout}>Esci</button>
      </header>

      <main className="admin-main">
        <SezioneOnboarding />
        <SezioneRichieste />
        <SezioneCircoli />
      </main>
    </div>
  );
}
