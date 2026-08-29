'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { signInWithEmailAndPassword, signOut, sendPasswordResetEmail } from 'firebase/auth';
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

  // ============================================================
  // ⚠️ «PASSWORD DIMENTICATA» — prima da qui non si usciva.
  //
  // Le credenziali le dava il team, quindi «chiedile a noi» sembrava
  // la risposta. Non lo e' piu': dalla sezione Sicurezza Accesso il
  // circolo si sceglie la propria password, e da quel momento noi non
  // la sappiamo. Senza questo collegamento un presidente che la
  // dimentica non ha nessuna strada — ed e' esattamente quello che e'
  // successo il 29 agosto 2026.
  //
  // ⚠️ NON DICIAMO SE L'INDIRIZZO ESISTE. Rispondere «questa email non
  // e' registrata» permetterebbe a chiunque di scoprire quali indirizzi
  // hanno un account. La risposta e' la stessa in tutti i casi, tranne
  // l'indirizzo scritto male: quello e' un errore di battitura e va
  // detto.
  // ============================================================
  const [reset, setReset] = useState('');
  const [inviandoReset, setInviandoReset] = useState(false);

  const richiediReset = async () => {
    if (!email.trim() || !email.includes('@')) {
      setErrore('Scrivi qui sopra la tua email, poi premi di nuovo «Password dimenticata?».');
      return;
    }
    setErrore('');
    setInviandoReset(true);
    try {
      await sendPasswordResetEmail(auth, email.trim());
      setReset(`Se l'indirizzo è registrato, fra poco arriverà a ${email.trim()} un'email con il link per scegliere una nuova password.`);
    } catch (err: any) {
      if (err?.code === 'auth/invalid-email') setErrore('L’indirizzo non è scritto in modo valido.');
      else setReset('Se l’indirizzo è registrato, fra poco arriverà un’email con il link per scegliere una nuova password.');
    } finally {
      setInviandoReset(false);
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

        {/* ⚠️ `type="button"`: dentro un <form> un bottone senza tipo
            è un bottone di invio, e premerlo avrebbe tentato l'accesso
            invece di mandare l'email. */}
        <button
          type="button"
          className="admin-login-link-reset"
          onClick={richiediReset}
          disabled={inviandoReset}
        >
          {inviandoReset ? 'Invio in corso…' : 'Password dimenticata?'}
        </button>

        {errore && <p className="admin-login-error">{errore}</p>}
        {reset && <p className="admin-login-ok">{reset}</p>}

        <button className="btn" type="submit" disabled={caricando}>
          {caricando ? 'Accesso in corso…' : 'Accedi'}
        </button>

        <p className="admin-login-hint">
          Le credenziali sono fornite dal team Racket Fever in fase di attivazione del circolo.
        </p>
        <p className="admin-login-hint">
          <a href="/admin/collaboratore">Sei un Collaboratore senza account? Entra qui</a>
        </p>
      </form>
    </div>
  );
}
