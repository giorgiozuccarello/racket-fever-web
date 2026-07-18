'use client';

import { useState } from 'react';
import { Campo } from '../../../data/circoli';
import { aggiungiCampo, rinominaCampo, rimuoviCampo } from '../../../data/circoliRepo';

export default function SezioneCampi({ circoloId, campi }: { circoloId: string; campi: Campo[] }) {
  const [nuovoNome, setNuovoNome] = useState('');
  const [nuovaSuperficie, setNuovaSuperficie] = useState('Terra rossa');
  const [modificaId, setModificaId] = useState<string | null>(null);
  const [modificaNome, setModificaNome] = useState('');
  const [modificaSuperficie, setModificaSuperficie] = useState('');

  const aggiungi = async () => {
    if (!nuovoNome.trim()) return;
    await aggiungiCampo(circoloId, nuovoNome.trim(), nuovaSuperficie, campi.length);
    setNuovoNome('');
  };

  const iniziaModifica = (c: Campo) => {
    setModificaId(c.id);
    setModificaNome(c.nome);
    setModificaSuperficie(c.superficie);
  };

  const salvaModifica = async () => {
    if (!modificaId || !modificaNome.trim()) return;
    await rinominaCampo(circoloId, modificaId, modificaNome.trim(), modificaSuperficie);
    setModificaId(null);
  };

  return (
    <div className="admin-card">
      <div className="admin-card-title">Campi del circolo</div>
      <p className="admin-card-hint">
        Aggiungi, rinomina o rimuovi i campi in base a quelli reali della struttura.
      </p>

      {campi.map((c) => (
        <div key={c.id} className="admin-list-row">
          {modificaId === c.id ? (
            <>
              <input className="admin-input" style={{ flex: 1 }} value={modificaNome} onChange={(e) => setModificaNome(e.target.value)} />
              <input className="admin-input" style={{ width: 160 }} value={modificaSuperficie} onChange={(e) => setModificaSuperficie(e.target.value)} />
              <button className="admin-icon-btn" onClick={salvaModifica} aria-label="Salva">✓</button>
            </>
          ) : (
            <>
              <div style={{ flex: 1 }}>
                <div className="admin-list-main">{c.nome}</div>
                <div className="admin-list-sub">{c.superficie}</div>
              </div>
              <button className="admin-icon-btn" onClick={() => iniziaModifica(c)} aria-label="Rinomina">✎</button>
              <button className="admin-icon-btn danger" onClick={() => rimuoviCampo(circoloId, c.id)} aria-label="Rimuovi">🗑</button>
            </>
          )}
        </div>
      ))}

      <div className="admin-row" style={{ marginTop: '.8rem' }}>
        <input
          className="admin-input" value={nuovoNome} onChange={(e) => setNuovoNome(e.target.value)}
          placeholder="Nome nuovo campo"
        />
        <input
          className="admin-input" value={nuovaSuperficie} onChange={(e) => setNuovaSuperficie(e.target.value)}
          placeholder="Superficie"
        />
      </div>
      <button className="admin-btn-full" onClick={aggiungi}>+ Aggiungi campo</button>
    </div>
  );
}
