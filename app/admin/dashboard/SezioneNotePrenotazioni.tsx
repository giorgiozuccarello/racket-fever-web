'use client';

import { useState } from 'react';
import { PrenotazioneAdmin } from '../../../data/prenotazioniRepo';
import { fasciaOraria } from '../../../data/circoli';
import Modal from './Modal';

export default function SezioneNotePrenotazioni({ prenotazioni }: { prenotazioni: PrenotazioneAdmin[] }) {
  const [selezionata, setSelezionata] = useState<PrenotazioneAdmin | null>(null);
  const oggi = new Date().toISOString().slice(0, 10);
  const conNote = prenotazioni
    .filter((p) => !!p.note && p.data >= oggi)
    .sort((a, b) => (a.data + a.orario).localeCompare(b.data + b.orario));

  return (
    <div className="admin-card">
      <div className="admin-card-title">Note alle Prenotazioni</div>
      <p className="admin-card-hint">
        Richieste lasciate dai soci al momento della prenotazione (es. materiale da preparare).
      </p>

      {conNote.length === 0 && <p className="admin-empty-text">Nessuna nota al momento.</p>}

      {conNote.map((p) => (
        <div
          key={p.id} className="admin-list-row admin-list-row-clickable"
          onClick={() => setSelezionata(p)}
        >
          <div style={{ flex: 1 }}>
            <div className="admin-list-main">{p.utenteNome} {p.utenteCognome}</div>
            <div className="admin-list-sub">{p.campoNome} · {p.dataLabel} {fasciaOraria(p.orario)}</div>
          </div>
        </div>
      ))}

      <Modal visible={!!selezionata} onClose={() => setSelezionata(null)}>
        <div className="admin-modal-title">Nota alla prenotazione</div>
        <div className="admin-modal-sub">
          {selezionata?.utenteNome} {selezionata?.utenteCognome}
          <br />
          {selezionata?.campoNome} · {selezionata?.dataLabel} {selezionata ? fasciaOraria(selezionata.orario) : ''}
        </div>
        <p style={{ marginTop: '1rem', lineHeight: 1.5 }}>
          Il Socio ha allegato questa nota alla prenotazione: {selezionata?.note}
        </p>
        <button className="admin-modal-btn-cancel" onClick={() => setSelezionata(null)} style={{ marginTop: '1rem' }}>
          Chiudi
        </button>
      </Modal>
    </div>
  );
}
