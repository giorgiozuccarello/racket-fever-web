'use client';

import { PrenotazioneAdmin } from '../../../data/prenotazioniRepo';

export default function SezioneLezioniPrenotate({ prenotazioni }: { prenotazioni: PrenotazioneAdmin[] }) {
  const oggi = new Date().toISOString().slice(0, 10);
  const lezioni = prenotazioni
    .filter((p) => p.tipo === 'lezione' && p.data >= oggi)
    .sort((a, b) => (a.data + a.orario).localeCompare(b.data + b.orario));

  return (
    <div className="admin-card">
      <div className="admin-card-title">Lezioni Prenotate</div>
      <p className="admin-card-hint">
        Le lezioni con un Maestro, separate dalle prenotazioni di solo campo.
      </p>

      {lezioni.length === 0 && <p className="admin-empty-text">Nessuna lezione prenotata.</p>}

      {lezioni.map((p) => (
        <div key={p.id} className="admin-list-row">
          <div style={{ flex: 1 }}>
            <div className="admin-list-main">
              {p.utenteNome} {p.utenteCognome} — Maestro {p.maestroNome} {p.maestroCognome}
            </div>
            <div className="admin-list-sub">
              {p.campoNome} · {p.dataLabel} {p.orario} · €{p.prezzo.toFixed(2)}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
