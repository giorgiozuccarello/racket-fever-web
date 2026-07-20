'use client';

import { useState } from 'react';
import { SocioCircolo } from '../../../data/users';

export default function SezioneSoci({ soci, onSelezionaSocio }: {
  soci: SocioCircolo[]; onSelezionaSocio: (uid: string) => void;
}) {
  const [filtro, setFiltro] = useState('');

  const risultati = filtro.trim().length === 0 ? [] : soci
    .filter((soc) => (soc.nome + ' ' + soc.cognome + ' ' + soc.email).toLowerCase().includes(filtro.trim().toLowerCase()))
    .slice(0, 8);

  return (
    <div className="admin-card">
      <div className="admin-card-title">Soci</div>
      <p className="admin-card-hint">
        Cerca un socio per vedere il suo profilo, ricaricare il credito o
        impostare il limite di ricarica S.O.S.
      </p>

      <input
        className="admin-input" value={filtro} onChange={(e) => setFiltro(e.target.value)}
        placeholder="Cerca socio per nome o email…"
      />

      {risultati.map((soc) => (
        <div
          key={soc.uid} className="admin-list-row admin-list-row-clickable"
          onClick={() => { onSelezionaSocio(soc.uid); setFiltro(''); }}
        >
          {soc.fotoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={soc.fotoUrl} alt="" className="admin-list-avatar" />
          ) : (
            <div className="admin-list-avatar admin-list-avatar-fallback">
              {(soc.nome[0] + soc.cognome[0]).toUpperCase()}
            </div>
          )}
          <div style={{ flex: 1 }}>
            <div className="admin-list-main">{soc.nome} {soc.cognome}</div>
            <div className="admin-list-sub">{soc.email}</div>
          </div>
          <div className="admin-list-credito">€{(soc.credito ?? 0).toFixed(2)}</div>
        </div>
      ))}
      {filtro.trim().length > 0 && risultati.length === 0 && (
        <p className="admin-empty-text">Nessun socio trovato.</p>
      )}
    </div>
  );
}
