'use client';

import { useState } from 'react';
import { PrenotazioneAdmin, cancellaConRimborso } from '../../../data/prenotazioniRepo';
import { creaNotifica } from '../../../data/notifiche';
import Modal from './Modal';

export default function SezionePrenotazioni({ prenotazioni }: { prenotazioni: PrenotazioneAdmin[] }) {
  const [daAnnullare, setDaAnnullare] = useState<PrenotazioneAdmin | null>(null);
  const [elaborando, setElaborando] = useState(false);

  const oggi = new Date().toISOString().slice(0, 10);
  const future = prenotazioni.filter((p) => p.data >= oggi);

  const confermaAnnulla = async () => {
    if (!daAnnullare) return;
    setElaborando(true);
    try {
      await cancellaConRimborso({
        uid: daAnnullare.utenteId,
        prenotazioneId: daAnnullare.id,
        prezzo: daAnnullare.prezzo,
      });
      await creaNotifica(
        daAnnullare.utenteId,
        `Il circolo ha annullato la tua prenotazione: ${daAnnullare.campoNome}, ${daAnnullare.dataLabel} ore ${daAnnullare.orario}. Credito rimborsato: €${daAnnullare.prezzo.toFixed(2)}.`
      );
      setDaAnnullare(null);
    } finally {
      setElaborando(false);
    }
  };

  return (
    <div className="admin-card">
      <div className="admin-card-title">Prenotazioni del circolo</div>
      <p className="admin-card-hint">
        Puoi annullare una prenotazione: il credito viene restituito automaticamente
        al socio, che riceve anche un avviso nella sua area Profilo.
      </p>

      {future.length === 0 && <p className="admin-empty-text">Nessuna prenotazione futura.</p>}

      {future.map((p) => (
        <div key={p.id} className="admin-list-row">
          <div style={{ flex: 1 }}>
            <div className="admin-list-main">{p.utenteNome} {p.utenteCognome}</div>
            <div className="admin-list-sub">
              {p.campoNome} · {p.dataLabel} {p.orario} · €{p.prezzo.toFixed(2)}
              {p.etichetta ? ` · ${p.etichetta}` : ''}
            </div>
          </div>
          <button className="admin-icon-btn danger" onClick={() => setDaAnnullare(p)} aria-label="Annulla">🗑</button>
        </div>
      ))}

      <Modal visible={!!daAnnullare} onClose={() => setDaAnnullare(null)}>
        <div className="admin-modal-title">Annullare la prenotazione?</div>
        <div className="admin-modal-sub">
          {daAnnullare?.utenteNome} {daAnnullare?.utenteCognome}
          <br />
          {daAnnullare?.campoNome} · {daAnnullare?.dataLabel} {daAnnullare?.orario}
        </div>
        <div className="admin-modal-amount">Rimborso: €{daAnnullare?.prezzo.toFixed(2)}</div>
        <div className="admin-modal-btn-row">
          <button className="admin-modal-btn-cancel" onClick={() => setDaAnnullare(null)}>Indietro</button>
          <button className="admin-modal-btn-confirm danger" onClick={confermaAnnulla} disabled={elaborando}>
            {elaborando ? 'Attendere…' : 'Annulla e rimborsa'}
          </button>
        </div>
      </Modal>
    </div>
  );
}
