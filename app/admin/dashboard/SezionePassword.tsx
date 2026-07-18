'use client';

import { useState } from 'react';
import { Circolo } from '../../../data/circoli';
import { aggiornaCircolo } from '../../../data/circoliRepo';

export default function SezionePassword({ circolo }: { circolo: Circolo }) {
  const [pass, setPass] = useState(circolo.password);
  const [salvando, setSalvando] = useState(false);
  const [ok, setOk] = useState(false);

  const salva = async () => {
    if (!pass.trim()) return;
    setSalvando(true);
    await aggiornaCircolo(circolo.id, { password: pass.trim() });
    setSalvando(false);
    setOk(true);
    setTimeout(() => setOk(false), 2000);
  };

  return (
    <div className="admin-card">
      <div className="admin-card-title">Password del circolo</div>
      <p className="admin-card-hint">
        È la password che i tuoi soci inseriscono per accedere all&apos;app.
      </p>
      <div className="admin-row">
        <input
          className="admin-input" value={pass}
          onChange={(e) => setPass(e.target.value)} autoCapitalize="none"
        />
        <button className="admin-btn-small" onClick={salva} disabled={salvando}>
          {ok ? 'Salvato ✓' : 'Salva'}
        </button>
      </div>
    </div>
  );
}
