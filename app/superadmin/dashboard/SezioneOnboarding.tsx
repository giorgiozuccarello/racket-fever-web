'use client';

import { useState } from 'react';
import { creaCircoloConAdmin } from '../../../data/onboarding';

interface Credenziali {
  nomeCircolo: string;
  passwordCircolo: string;
  emailAdmin: string;
  passwordAdmin: string;
}

export default function SezioneOnboarding() {
  const [nomeCircolo, setNomeCircolo] = useState('');
  const [citta, setCitta] = useState('');
  const [sigla, setSigla] = useState('');
  const [passwordCircolo, setPasswordCircolo] = useState('');
  const [colorePrimario, setColorePrimario] = useState('#0E3B2E');
  const [coloreAccento, setColoreAccento] = useState('#B0451F');
  const [nomeAdmin, setNomeAdmin] = useState('');
  const [cognomeAdmin, setCognomeAdmin] = useState('');
  const [emailAdmin, setEmailAdmin] = useState('');
  const [passwordAdmin, setPasswordAdmin] = useState('');
  const [errore, setErrore] = useState('');
  const [creando, setCreando] = useState(false);
  const [successo, setSuccesso] = useState<Credenziali | null>(null);

  const reset = () => {
    setNomeCircolo(''); setCitta(''); setSigla(''); setPasswordCircolo('');
    setColorePrimario('#0E3B2E'); setColoreAccento('#B0451F');
    setNomeAdmin(''); setCognomeAdmin(''); setEmailAdmin(''); setPasswordAdmin('');
  };

  const crea = async () => {
    setErrore('');
    if (!nomeCircolo.trim() || !citta.trim() || !sigla.trim() || !passwordCircolo.trim()) {
      setErrore('Compila tutti i campi del circolo.');
      return;
    }
    if (!nomeAdmin.trim() || !cognomeAdmin.trim() || !emailAdmin.trim() || !passwordAdmin) {
      setErrore("Compila tutti i campi dell'Admin Circolo.");
      return;
    }
    if (passwordAdmin.length < 6) {
      setErrore("La password dell'Admin deve avere almeno 6 caratteri.");
      return;
    }
    setCreando(true);
    try {
      await creaCircoloConAdmin({
        nomeCircolo, citta, sigla, passwordCircolo, colorePrimario, coloreAccento,
        nomeAdmin, cognomeAdmin, emailAdmin, passwordAdmin,
      });
      setSuccesso({ nomeCircolo, passwordCircolo, emailAdmin, passwordAdmin });
      reset();
    } catch (err: any) {
      if (err.code === 'auth/email-already-in-use') {
        setErrore('Esiste già un account con questa email.');
      } else if (err.code === 'auth/weak-password') {
        setErrore('Password troppo debole.');
      } else {
        setErrore('Si è verificato un errore. Riprova.');
      }
    } finally {
      setCreando(false);
    }
  };

  if (successo) {
    return (
      <div className="admin-card">
        <div className="admin-card-title">Circolo creato ✓</div>
        <p className="admin-card-hint">
          Comunica queste credenziali al presidente/segreteria di <b>{successo.nomeCircolo}</b>:
        </p>
        <div className="superadmin-credenziali">
          <div><span>Password circolo (per i soci)</span><code>{successo.passwordCircolo}</code></div>
          <div><span>Email Admin</span><code>{successo.emailAdmin}</code></div>
          <div><span>Password Admin</span><code>{successo.passwordAdmin}</code></div>
        </div>
        <button className="admin-btn-full" onClick={() => setSuccesso(null)}>+ Crea un altro circolo</button>
      </div>
    );
  }

  return (
    <div className="admin-card">
      <div className="admin-card-title">Nuovo circolo</div>
      <p className="admin-card-hint">
        Crea il circolo e il suo primo account Admin. Il presidente potrà poi impostare
        campi, prezzi e tutto il resto dalla propria Dashboard.
      </p>

      <label className="admin-label">Nome del circolo</label>
      <input className="admin-input" value={nomeCircolo} onChange={(e) => setNomeCircolo(e.target.value)} placeholder="ASD Tennis Esempio" />

      <div className="admin-row">
        <div style={{ flex: 2 }}>
          <label className="admin-label">Città</label>
          <input className="admin-input" value={citta} onChange={(e) => setCitta(e.target.value)} placeholder="Milazzo (ME)" />
        </div>
        <div style={{ flex: 1 }}>
          <label className="admin-label">Sigla</label>
          <input className="admin-input" value={sigla} onChange={(e) => setSigla(e.target.value)} placeholder="TM" maxLength={4} />
        </div>
      </div>

      <label className="admin-label">Password d&apos;accesso soci</label>
      <input className="admin-input" value={passwordCircolo} onChange={(e) => setPasswordCircolo(e.target.value)} placeholder="es. esempio2026" />

      <div className="admin-row">
        <div>
          <label className="admin-label">Colore primario</label>
          <input type="color" className="superadmin-color" value={colorePrimario} onChange={(e) => setColorePrimario(e.target.value)} />
        </div>
        <div>
          <label className="admin-label">Colore accento</label>
          <input type="color" className="superadmin-color" value={coloreAccento} onChange={(e) => setColoreAccento(e.target.value)} />
        </div>
      </div>

      <div className="superadmin-subtitolo">Primo Admin Circolo</div>

      <div className="admin-row">
        <div>
          <label className="admin-label">Nome</label>
          <input className="admin-input" value={nomeAdmin} onChange={(e) => setNomeAdmin(e.target.value)} placeholder="Mario" />
        </div>
        <div>
          <label className="admin-label">Cognome</label>
          <input className="admin-input" value={cognomeAdmin} onChange={(e) => setCognomeAdmin(e.target.value)} placeholder="Rossi" />
        </div>
      </div>

      <label className="admin-label">Email</label>
      <input className="admin-input" type="email" value={emailAdmin} onChange={(e) => setEmailAdmin(e.target.value)} placeholder="presidente@circolo.it" />

      <label className="admin-label">Password</label>
      <input className="admin-input" type="password" value={passwordAdmin} onChange={(e) => setPasswordAdmin(e.target.value)} placeholder="Almeno 6 caratteri" />

      {errore && <div className="admin-error-text">{errore}</div>}

      <button className="admin-btn-full" onClick={crea} disabled={creando}>
        {creando ? 'Creazione in corso…' : '+ Crea circolo'}
      </button>
    </div>
  );
}
