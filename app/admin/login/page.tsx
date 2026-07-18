'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../../../lib/firebase';

export default function AdminLogin() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errore, setErrore] = useState('');
  const [caricando, setCaricando] = useState(false);

  const accedi = async (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setErrore('Inserisci email e password.');
      return;
    }
    setCaricando(true);
    setErrore('');
    try {
      const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
      const snap = await getDoc(doc(db, 'responsabili', cred.user.uid));
      if (!snap.exists()) {
        await signOut(auth);
        setErrore('Questo account non è abilitato come Admin Circolo.');
        return;
      }
      router.replace('/admin/dashboard');
    } catch (err: any) {
      if (['auth/invalid-credential', 'auth/wrong-password', 'auth/user-not-found'].includes(err.code)) {
        setErrore('Email o password non corretti.');
      } else {
        setErrore('Si è verificato un errore. Riprova.');
      }
    } finally {
      setCaricando(false);
    }
  };

  return (
    <div className="admin-login-root">
      <form className="admin-login-card" onSubmit={accedi}>
        <div className="admin-login-brand">
          <div className="logo-mark" aria-hidden="true" />
          <div className="mono" style={{ marginTop: '.9rem', opacity: 0.85 }}>AREA RISERVATA</div>
          <h1 className="display" style={{ fontSize: '1.5rem', marginTop: '.3rem' }}>Admin Circolo</h1>
        </div>

        <label htmlFor="email">Email</label>
        <input
          id="email" type="email" value={email} autoComplete="username"
          onChange={(e) => { setEmail(e.target.value); setErrore(''); }}
          placeholder="presidente@circolo.it"
        />

        <label htmlFor="password">Password</label>
        <input
          id="password" type="password" value={password} autoComplete="current-password"
          onChange={(e) => { setPassword(e.target.value); setErrore(''); }}
          placeholder="••••••••"
        />

        {errore && <p className="admin-login-error">{errore}</p>}

        <button className="btn" type="submit" disabled={caricando}>
          {caricando ? 'Accesso in corso…' : 'Accedi'}
        </button>

        <p className="admin-login-hint">
          Le credenziali sono fornite dal team Racket Fever in fase di attivazione del circolo.
        </p>
      </form>
    </div>
  );
}
