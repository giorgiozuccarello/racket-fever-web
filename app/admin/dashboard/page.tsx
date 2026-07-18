'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import { auth } from '../../../lib/firebase';
import { leggiResponsabile, ProfiloResponsabile } from '../../../data/responsabili';
import { ascoltaSociCircolo, SocioCircolo } from '../../../data/users';
import { Circolo, Campo, Blocco } from '../../../data/circoli';
import { ascoltaCircolo, ascoltaCampi, ascoltaBlocchi } from '../../../data/circoliRepo';
import { ascoltaPrenotazioniCircolo, PrenotazioneAdmin } from '../../../data/prenotazioniRepo';
import InstallPrompt from '../InstallPrompt';
import SezionePassword from './SezionePassword';
import SezioneCampi from './SezioneCampi';
import SezioneLimite from './SezioneLimite';
import SezionePrezzi from './SezionePrezzi';
import SezioneBlocchi from './SezioneBlocchi';
import SezioneSoci from './SezioneSoci';
import SezionePrenotazioni from './SezionePrenotazioni';

export default function AdminDashboard() {
  const router = useRouter();
  const [responsabile, setResponsabile] = useState<ProfiloResponsabile | null>(null);
  const [circolo, setCircolo] = useState<Circolo | null>(null);
  const [campi, setCampi] = useState<Campo[]>([]);
  const [blocchi, setBlocchi] = useState<Blocco[]>([]);
  const [soci, setSoci] = useState<SocioCircolo[]>([]);
  const [prenotazioni, setPrenotazioni] = useState<PrenotazioneAdmin[]>([]);
  const [caricando, setCaricando] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user: User | null) => {
      if (!user) {
        router.replace('/admin/login');
        return;
      }
      const r = await leggiResponsabile(user.uid);
      if (!r) {
        await signOut(auth);
        router.replace('/admin/login');
        return;
      }
      setResponsabile(r);
      setCaricando(false);
    });
    return unsub;
  }, [router]);

  useEffect(() => {
    if (!responsabile) return;
    const u1 = ascoltaCircolo(responsabile.circoloId, setCircolo);
    const u2 = ascoltaCampi(responsabile.circoloId, setCampi);
    const u3 = ascoltaBlocchi(responsabile.circoloId, setBlocchi);
    const u4 = ascoltaSociCircolo(responsabile.circoloId, setSoci);
    const u5 = ascoltaPrenotazioniCircolo(responsabile.circoloId, setPrenotazioni);
    return () => { u1(); u2(); u3(); u4(); u5(); };
  }, [responsabile]);

  const logout = async () => {
    await signOut(auth);
    router.replace('/admin/login');
  };

  if (caricando || !responsabile || !circolo) {
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
          <h1 className="display" style={{ fontSize: '1.7rem', marginTop: '.2rem' }}>{circolo.nome}</h1>
        </div>
        <button className="btn btn-outline admin-logout-btn" onClick={logout}>Esci</button>
      </header>

      <main className="admin-main">
        <SezionePassword circolo={circolo} />
        <SezioneCampi circoloId={circolo.id} campi={campi} />
        <SezioneLimite circolo={circolo} />
        <SezionePrezzi circoloId={circolo.id} campi={campi} />
        <SezioneBlocchi circoloId={circolo.id} campi={campi} blocchi={blocchi} />
        <SezioneSoci soci={soci} />
        <SezionePrenotazioni prenotazioni={prenotazioni} />
      </main>
    </div>
  );
}
