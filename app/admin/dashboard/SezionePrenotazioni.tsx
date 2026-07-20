'use client';

import { useEffect, useState } from 'react';
import { Campo, Blocco, ORARI } from '../../../data/circoli';
import { PrenotazioneAdmin, cancellaConRimborso } from '../../../data/prenotazioniRepo';
import { creaNotifica } from '../../../data/notifiche';
import { formatISO } from '../../../data/settimana';
import Modal from './Modal';

const GIORNI_IT_BREVE = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'];

export default function SezionePrenotazioni({ campi, blocchi, prenotazioni }: {
  campi: Campo[]; blocchi: Blocco[]; prenotazioni: PrenotazioneAdmin[];
}) {
  const [selDay, setSelDay] = useState(0);
  const [selCampoId, setSelCampoId] = useState('');
  const [daAnnullare, setDaAnnullare] = useState<PrenotazioneAdmin | null>(null);
  const [elaborando, setElaborando] = useState(false);

  useEffect(() => {
    if ((!selCampoId || !campi.some((c) => c.id === selCampoId)) && campi[0]) {
      setSelCampoId(campi[0].id);
    }
  }, [campi]);

  const giorni = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    return d;
  });
  const giornoSel = giorni[selDay];
  const dataSelIso = formatISO(giornoSel);

  const bloccoAttivo = (ora: string): Blocco | undefined => {
    if (!selCampoId) return undefined;
    return blocchi.find((b) => {
      if (b.campoId !== selCampoId) return false;
      if (ora < b.orarioInizio || ora >= b.orarioFine) return false;
      if (b.tipo === 'data') return b.data === dataSelIso;
      return (b.giorniSettimana ?? []).includes(giornoSel.getDay());
    });
  };

  const prenotazioneSlot = (ora: string) =>
    prenotazioni.find((p) => p.campoId === selCampoId && p.data === dataSelIso && p.orario === ora);

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
      <div className="admin-card-title">Prenotazione Campi</div>
      <p className="admin-card-hint">
        Clicca su uno slot occupato per vedere chi ha prenotato ed eventualmente annullare.
      </p>

      <div className="pc-row">
        {giorni.map((d, i) => (
          <button
            key={i} onClick={() => setSelDay(i)}
            className={`pc-day ${i === selDay ? 'selected' : ''}`}
          >
            <div className="pc-day-label">{i === 0 ? 'Oggi' : GIORNI_IT_BREVE[d.getDay()]}</div>
            <div className="pc-day-num">{d.getDate()}</div>
          </button>
        ))}
      </div>

      <div className="pc-row">
        {campi.map((c) => (
          <button
            key={c.id} onClick={() => setSelCampoId(c.id)}
            className={`pc-court ${c.id === selCampoId ? 'selected' : ''}`}
          >
            {c.nome}
          </button>
        ))}
      </div>

      <div className="pc-legend">
        <span className="pc-legend-item"><span className="pc-legend-dot pc-legend-libero" /> Libero</span>
        <span className="pc-legend-item"><span className="pc-legend-dot pc-legend-occupato" /> Prenotato</span>
        <span className="pc-legend-item"><span className="pc-legend-dot pc-legend-riservato" /> Riservato</span>
      </div>

      <div className="pc-grid">
        {ORARI.map((ora) => {
          const blocco = bloccoAttivo(ora);
          const p = !blocco ? prenotazioneSlot(ora) : undefined;
          return (
            <button
              key={ora} disabled={!p} onClick={() => p && setDaAnnullare(p)}
              className={`pc-slot ${p ? 'occupato' : ''} ${blocco ? 'riservato' : ''}`}
            >
              <div className="pc-slot-ora">{ora}</div>
              <div className="pc-slot-sotto">
                {p ? `${p.utenteNome} ${p.utenteCognome[0]}.` : blocco ? 'Riservato' : 'Libero'}
              </div>
            </button>
          );
        })}
      </div>

      <Modal visible={!!daAnnullare} onClose={() => setDaAnnullare(null)}>
        <div className="admin-modal-title">Prenotazione</div>
        <div className="admin-modal-sub">
          {daAnnullare?.utenteNome} {daAnnullare?.utenteCognome}
          <br />
          {daAnnullare?.campoNome} · {daAnnullare?.dataLabel} {daAnnullare?.orario}
          {daAnnullare?.etichetta ? ` · ${daAnnullare.etichetta}` : ''}
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
