'use client';

import { useEffect, useState } from 'react';
import { Circolo } from '../../../data/circoli';
import { ascoltaCircoli } from '../../../data/circoliRepo';

export default function SezioneCircoli() {
  const [circoli, setCircoli] = useState<Circolo[]>([]);

  useEffect(() => ascoltaCircoli(setCircoli), []);

  return (
    <div className="admin-card">
      <div className="admin-card-title">Circoli attivi ({circoli.length})</div>
      <p className="admin-card-hint">Tutti i circoli presenti sulla piattaforma, in sola lettura.</p>

      {circoli.length === 0 && <p className="admin-empty-text">Nessun circolo ancora creato.</p>}

      {circoli.map((c) => (
        <div key={c.id} className="admin-list-row">
          {c.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={c.logoUrl} alt="" className="admin-list-avatar" />
          ) : (
            <div className="superadmin-swatch" style={{ background: c.tema.primario }} />
          )}
          <div style={{ flex: 1 }}>
            <div className="admin-list-main">{c.nome}</div>
            <div className="admin-list-sub">{c.citta} · {c.sigla}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
