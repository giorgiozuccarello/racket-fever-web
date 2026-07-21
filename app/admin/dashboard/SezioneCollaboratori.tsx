'use client';

import { useEffect, useState } from 'react';
import { ascoltaPasswordCollaboratore, impostaPasswordCollaboratore } from '../../../data/circoliRepo';

export default function SezioneCollaboratori({ circoloId }: { circoloId: string }) {
  const [passwordAttuale, setPasswordAttuale] = useState<string | null>(null);
  const [pass, setPass] = useState('');
  const [caricato, setCaricato] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [ok, setOk] = useState(false);

  useEffect(() => {
    const unsub = ascoltaPasswordCollaboratore(circoloId, (p) => {
      setPasswordAttuale(p);
      setCaricato((giaCaricato) => {
        if (!giaCaricato) setPass(p ?? '');
        return true;
      });
    });
    return unsub;
  }, [circoloId]);

  const salva = async () => {
    if (!pass.trim()) return;
    setSalvando(true);
    await impostaPasswordCollaboratore(circoloId, pass);
    setSalvando(false);
    setOk(true);
    setTimeout(() => setOk(false), 2000);
  };

  return (
    <div className="admin-card">
      <div className="admin-card-title">Accesso Collaboratori</div>
      <p className="admin-card-hint">
        Una seconda password, distinta da quella dei soci, per far entrare nella
        Dashboard Admin chi ti aiuta in segreteria — senza dovergli dare le tue
        credenziali personali. Cambiala quando vuoi per revocare l&apos;accesso
        a tutti insieme.
      </p>
      <div className="admin-row">
        <input
          className="admin-input" value={pass}
          onChange={(e) => setPass(e.target.value)} autoCapitalize="none"
          placeholder="Imposta una password"
        />
        <button className="admin-btn-small" onClick={salva} disabled={salvando}>
          {ok ? 'Salvato ✓' : passwordAttuale ? 'Aggiorna' : 'Attiva'}
        </button>
      </div>
      {!passwordAttuale && caricato && (
        <p className="admin-card-hint" style={{ marginTop: '.5rem' }}>
          Non ancora attivata: finché non imposti una password, nessuno può entrare come Collaboratore.
        </p>
      )}
    </div>
  );
}
