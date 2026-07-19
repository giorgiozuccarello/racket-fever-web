'use client';

import { useEffect, useState } from 'react';
import { ascoltaRichieste, aggiornaStatoRichiesta, RichiestaAttivazione } from '../../../data/richiesteAttivazione';

export default function SezioneRichieste() {
  const [richieste, setRichieste] = useState<RichiestaAttivazione[]>([]);

  useEffect(() => ascoltaRichieste(setRichieste), []);

  const nuove = richieste.filter((r) => r.stato === 'nuova');
  const gestite = richieste.filter((r) => r.stato !== 'nuova');

  return (
    <div className="admin-card">
      <div className="admin-card-title">Richieste di attivazione {nuove.length > 0 ? `(${nuove.length} nuove)` : ''}</div>
      <p className="admin-card-hint">Arrivano dal form pubblico del sito istituzionale.</p>

      {richieste.length === 0 && <p className="admin-empty-text">Nessuna richiesta ricevuta finora.</p>}

      {nuove.map((r) => (
        <div key={r.id} className="admin-list-row">
          <div style={{ flex: 1 }}>
            <div className="admin-list-main">{r.nomeCircolo} · {r.citta}</div>
            <div className="admin-list-sub">{r.email}</div>
            {r.messaggio && (
              <div className="admin-list-sub" style={{ marginTop: 4, fontStyle: 'italic' }}>&quot;{r.messaggio}&quot;</div>
            )}
          </div>
          <button className="admin-btn-small" onClick={() => aggiornaStatoRichiesta(r.id, 'contattata')}>
            Segna contattata
          </button>
        </div>
      ))}

      {gestite.length > 0 && (
        <>
          <label className="admin-label" style={{ marginTop: '1rem' }}>Già gestite</label>
          {gestite.map((r) => (
            <div key={r.id} className="admin-list-row" style={{ opacity: 0.5 }}>
              <div style={{ flex: 1 }}>
                <div className="admin-list-main">{r.nomeCircolo} · {r.citta}</div>
                <div className="admin-list-sub">{r.email}</div>
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
