'use client';

import { useState } from 'react';
import { Circolo } from '../../../data/circoli';
import { aggiornaCircolo } from '../../../data/circoliRepo';
import { useLingua } from '../../../lib/lingua';

export default function SezionePassword({ circolo }: { circolo: Circolo }) {
  const { t } = useLingua();
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
      <div className="admin-card-title">{t('adm.pwd.titolo')}</div>
      <p className="admin-card-hint">{t('adm.pwd.hint')}</p>
      <div className="admin-row">
        <input
          className="admin-input" value={pass}
          onChange={(e) => setPass(e.target.value)} autoCapitalize="none"
        />
        <button className="admin-btn-small" onClick={salva} disabled={salvando}>
          {ok ? t('adm.pwd.salvato') : t('com.salva')}
        </button>
      </div>
    </div>
  );
}
