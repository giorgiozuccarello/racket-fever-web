'use client';

import { useState } from 'react';
import { MaestroConUid, creaMaestro, rimuoviMaestro } from '../../../data/maestriRepo';

export default function SezioneMaestri({ circoloId, maestri }: {
  circoloId: string; maestri: MaestroConUid[];
}) {
  const [formAperto, setFormAperto] = useState(false);
  const [nome, setNome] = useState('');
  const [cognome, setCognome] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errore, setErrore] = useState('');
  const [creando, setCreando] = useState(false);
  const [datiCreati, setDatiCreati] = useState<{ nome: string; email: string; password: string } | null>(null);

  const reset = () => { setNome(''); setCognome(''); setEmail(''); setPassword(''); setErrore(''); };

  const crea = async () => {
    setErrore('');
    if (!nome.trim() || !cognome.trim() || !email.trim() || !password) {
      setErrore('Compila tutti i campi.');
      return;
    }
    if (password.length < 6) {
      setErrore('La password deve avere almeno 6 caratteri.');
      return;
    }
    setCreando(true);
    try {
      await creaMaestro(circoloId, nome, cognome, email, password);
      setDatiCreati({ nome: `${nome.trim()} ${cognome.trim()}`, email: email.trim(), password });
      reset();
      setFormAperto(false);
    } catch (err: any) {
      if (err.code === 'auth/email-already-in-use') setErrore('Esiste già un account con questa email.');
      else setErrore('Si è verificato un errore. Riprova.');
    } finally {
      setCreando(false);
    }
  };

  return (
    <div className="admin-card">
      <div className="admin-card-title">Maestri</div>
      <p className="admin-card-hint">
        Ogni Maestro ha un proprio account, separato dal tuo: gestisce solo la
        disponibilità per le lezioni, non prezzi, soci o incassi.
      </p>

      {maestri.length === 0 && !formAperto && (
        <p className="admin-empty-text">Nessun Maestro ancora aggiunto.</p>
      )}

      {maestri.map((m) => (
        <div key={m.uid} className="admin-list-row">
          <div style={{ flex: 1 }}>
            <div className="admin-list-main">{m.nome} {m.cognome}</div>
            <div className="admin-list-sub">{m.email}</div>
          </div>
          <button className="admin-icon-btn danger" onClick={() => rimuoviMaestro(m.uid)} aria-label="Rimuovi">🗑</button>
        </div>
      ))}

      {datiCreati && (
        <>
          <p className="admin-card-hint">Maestro creato ✓ — comunica queste credenziali:</p>
          <div className="superadmin-credenziali">
            <div><span>Nome</span><code>{datiCreati.nome}</code></div>
            <div><span>Email</span><code>{datiCreati.email}</code></div>
            <div><span>Password</span><code>{datiCreati.password}</code></div>
          </div>
        </>
      )}

      {formAperto ? (
        <>
          <label className="admin-label">Nome</label>
          <input className="admin-input" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Mario" />
          <label className="admin-label">Cognome</label>
          <input className="admin-input" value={cognome} onChange={(e) => setCognome(e.target.value)} placeholder="Rossi" />
          <label className="admin-label">Email</label>
          <input className="admin-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="maestro@circolo.it" />
          <label className="admin-label">Password</label>
          <input className="admin-input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Almeno 6 caratteri" />

          {errore && <div className="admin-error-text">{errore}</div>}

          <div className="admin-row" style={{ marginTop: '.8rem' }}>
            <button className="admin-btn-full" style={{ background: '#fff', color: 'var(--grigio)', border: '2px solid var(--bordo)' }} onClick={() => { setFormAperto(false); reset(); }}>
              Annulla
            </button>
            <button className="admin-btn-full" onClick={crea} disabled={creando}>
              {creando ? 'Creazione…' : 'Crea Maestro'}
            </button>
          </div>
        </>
      ) : (
        <button className="admin-btn-full" onClick={() => { setDatiCreati(null); setFormAperto(true); }}>
          + Aggiungi Maestro
        </button>
      )}
    </div>
  );
}
