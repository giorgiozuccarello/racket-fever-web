'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { signInAnonymously } from 'firebase/auth';
import { auth } from '../../../lib/firebase';
import { Circolo } from '../../../data/circoli';
import { ascoltaCircoli } from '../../../data/circoliRepo';
import { accediComeCollaboratore } from '../../../data/collaboratori';

export default function CollaboratoreLogin() {
  const router = useRouter();
  const [pronto, setPronto] = useState(false);
  const [circoli, setCircoli] = useState<Circolo[]>([]);
  const [filtro, setFiltro] = useState('');
  const [circoloScelto, setCircoloScelto] = useState<Circolo | null>(null);
  const [password, setPassword] = useState('');
  const [errore, setErrore] = useState('');
  const [entrando, setEntrando] = useState(false);

  // Serve una sessione (anche solo anonima) per poter leggere l'elenco dei circoli.
  useEffect(() => {
    let unsubCircoli: (() => void) | undefined;
    (async () => {
      if (!auth.currentUser) {
        try { await signInAnonymously(auth); } catch { /* mostrato più avanti, se serve */ }
      }
      unsubCircoli = ascoltaCircoli(setCircoli);
      setPronto(true);
    })();
    return () => unsubCircoli?.();
  }, []);

  const visibili = filtro.trim().length === 0 ? [] : circoli
    .filter((c) => (c.nome + c.citta).toLowerCase().includes(filtro.trim().toLowerCase()))
    .slice(0, 8);

  const entra = async () => {
    if (!circoloScelto || !password.trim()) {
      setErrore('Scegli il circolo e inserisci la password.');
      return;
    }
    setErrore('');
    setEntrando(true);
    try {
      await accediComeCollaboratore(circoloScelto.id, password);
      router.replace('/admin/dashboard');
    } catch {
      setErrore('Password non corretta (o non ancora attivata dal circolo).');
    } finally {
      setEntrando(false);
    }
  };

  return (
    <div className="admin-login-root">
      <div className="admin-login-card">
        <div className="admin-login-brand">
          <div className="logo-mark" aria-hidden="true" />
          <div className="mono" style={{ marginTop: '.9rem', opacity: 0.85 }}>AREA RISERVATA</div>
          <h1 className="display" style={{ fontSize: '1.5rem', marginTop: '.3rem' }}>Accesso Collaboratore</h1>
          <p style={{ fontSize: '.82rem', opacity: 0.7, textAlign: 'center', marginTop: '.5rem' }}>
            Per chi aiuta in segreteria senza avere un account Admin proprio.
          </p>
        </div>

        {!pronto ? (
          <p style={{ textAlign: 'center' }}>Caricamento…</p>
        ) : (
          <>
            <label>Circolo</label>
            {circoloScelto ? (
              <div className="admin-list-row" style={{ background: '#fff', borderRadius: 10, border: '1.5px solid var(--bordo)', padding: '.7rem 1rem' }}>
                <span style={{ flex: 1, fontWeight: 700 }}>{circoloScelto.nome} · {circoloScelto.citta}</span>
                <button type="button" className="admin-btn-small" onClick={() => { setCircoloScelto(null); setFiltro(''); }}>
                  Cambia
                </button>
              </div>
            ) : (
              <>
                <input
                  value={filtro} onChange={(e) => setFiltro(e.target.value)}
                  placeholder="Cerca il circolo per nome o città…"
                />
                {visibili.map((c) => (
                  <div
                    key={c.id} className="admin-list-row admin-list-row-clickable"
                    onClick={() => setCircoloScelto(c)}
                  >
                    <span>{c.nome} · {c.citta}</span>
                  </div>
                ))}
              </>
            )}

            <label htmlFor="password" style={{ marginTop: '1rem' }}>Password Collaboratore</label>
            <input
              id="password" type="password" value={password}
              onChange={(e) => { setPassword(e.target.value); setErrore(''); }}
              placeholder="••••••••"
              onKeyDown={(e) => { if (e.key === 'Enter') entra(); }}
            />

            {errore && <p className="admin-login-error">{errore}</p>}

            <button className="btn" type="button" onClick={entra} disabled={entrando}>
              {entrando ? 'Accesso in corso…' : 'Entra'}
            </button>
          </>
        )}

        <p className="admin-login-hint">
          <a href="/admin/login">Sei l&apos;Admin del circolo? Accedi qui</a>
        </p>
      </div>
    </div>
  );
}
