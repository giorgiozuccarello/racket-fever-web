'use client';

import { useState } from 'react';
import { SocioCircolo } from '../../../data/users';
import { ricaricaCredito } from '../../../data/prenotazioniRepo';
import Modal from './Modal';

export default function SezioneSoci({ soci }: { soci: SocioCircolo[] }) {
  const [ricaricaId, setRicaricaId] = useState<string | null>(null);
  const [importo, setImporto] = useState('');
  const [inviando, setInviando] = useState(false);

  const socioSel = soci.find((x) => x.uid === ricaricaId);

  const confermaRicarica = async () => {
    const v = parseFloat(importo.replace(',', '.'));
    if (!ricaricaId || Number.isNaN(v) || v <= 0) return;
    setInviando(true);
    await ricaricaCredito(ricaricaId, v);
    setInviando(false);
    setRicaricaId(null);
    setImporto('');
  };

  return (
    <div className="admin-card">
      <div className="admin-card-title">Soci e wallet</div>
      <p className="admin-card-hint">
        Ricarica il credito di un socio dopo aver ricevuto il pagamento in segreteria.
      </p>

      {soci.length === 0 && <p className="admin-empty-text">Nessun socio ancora registrato.</p>}

      {soci.map((soc) => (
        <div key={soc.uid} className="admin-list-row">
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
          <button className="admin-btn-small" onClick={() => { setRicaricaId(soc.uid); setImporto(''); }}>
            + Ricarica
          </button>
        </div>
      ))}

      <Modal visible={!!ricaricaId} onClose={() => setRicaricaId(null)}>
        <div className="admin-modal-title">Ricarica wallet</div>
        <div className="admin-modal-sub">{socioSel?.nome} {socioSel?.cognome}</div>
        <input
          className="admin-input" style={{ marginTop: '1rem', textAlign: 'center' }}
          value={importo} onChange={(e) => setImporto(e.target.value)}
          placeholder="Importo, es. 20.00" inputMode="decimal" autoFocus
        />
        <div className="admin-modal-btn-row">
          <button className="admin-modal-btn-cancel" onClick={() => setRicaricaId(null)}>Annulla</button>
          <button className="admin-modal-btn-confirm" onClick={confermaRicarica} disabled={inviando}>
            {inviando ? 'Attendere…' : 'Ricarica'}
          </button>
        </div>
      </Modal>
    </div>
  );
}
