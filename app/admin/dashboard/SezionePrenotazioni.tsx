'use client';

import { useEffect, useState } from 'react';
import { Campo, Blocco, ORARI, fasciaOraria } from '../../../data/circoli';
import { PrenotazioneAdmin, cancellaConRimborso, cancellaConRimborsoDiviso, cancellaSenzaRimborso } from '../../../data/prenotazioniRepo';
import { creaNotifica } from '../../../data/notifiche';
import { creaNotificaMaestro } from '../../../data/notificheMaestro';
import { formatISO } from '../../../data/settimana';
import Modal from './Modal';

const GIORNI_IT_BREVE = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'];

// Titolo prominente del pop-up di una prenotazione: chi gioca, con chi —
// la stessa regola in tutta l'app: le info contano più dell'azione.
function intestazionePrenotazione(p: PrenotazioneAdmin): string {
  if (p.tipo === 'lezione') {
    return p.prenotataDa === 'maestro'
      ? `${p.maestroNome} ${p.maestroCognome} lezione con ${p.utenteNome} ${p.utenteCognome}`
      : `${p.utenteNome} ${p.utenteCognome} lezione con ${p.maestroNome} ${p.maestroCognome}`;
  }
  if (p.compagnoNome) {
    return `${p.utenteNome} ${p.utenteCognome} gioca con ${p.compagnoNome} ${p.compagnoCognome}`;
  }
  return `${p.utenteNome} ${p.utenteCognome}`;
}

export default function SezionePrenotazioni({ campi, blocchi, prenotazioni }: {
  campi: Campo[]; blocchi: Blocco[]; prenotazioni: PrenotazioneAdmin[];
}) {
  const [selDay, setSelDay] = useState(0);
  const [selCampoId, setSelCampoId] = useState('');
  const [daAnnullare, setDaAnnullare] = useState<PrenotazioneAdmin | null>(null);
  const [bloccoInfo, setBloccoInfo] = useState<Blocco | null>(null);
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
      if (!daAnnullare.utenteId) {
        await cancellaSenzaRimborso(daAnnullare.id);
      } else if (daAnnullare.costoDiviso && daAnnullare.compagnoId) {
        const meta = (daAnnullare.prezzo / 2).toFixed(2);
        await cancellaConRimborsoDiviso({
          utenteId: daAnnullare.utenteId,
          compagnoId: daAnnullare.compagnoId,
          prenotazioneId: daAnnullare.id,
          prezzoTotale: daAnnullare.prezzo,
        });
        await creaNotifica(
          daAnnullare.utenteId,
          `Il circolo ha annullato la tua prenotazione: ${daAnnullare.campoNome}, ${daAnnullare.dataLabel} ore ${fasciaOraria(daAnnullare.orario)}. Ti è stata rimborsata la tua metà: €${meta}.`
        );
        await creaNotifica(
          daAnnullare.compagnoId,
          `Il circolo ha annullato la prenotazione con ${daAnnullare.utenteNome} ${daAnnullare.utenteCognome}: ${daAnnullare.campoNome}, ${daAnnullare.dataLabel} ore ${fasciaOraria(daAnnullare.orario)}. Ti è stata rimborsata la tua metà: €${meta}.`
        );
      } else {
        await cancellaConRimborso({
          uid: daAnnullare.utenteId,
          prenotazioneId: daAnnullare.id,
          prezzo: daAnnullare.prezzo,
        });
        await creaNotifica(
          daAnnullare.utenteId,
          `Il circolo ha annullato la tua prenotazione: ${daAnnullare.campoNome}, ${daAnnullare.dataLabel} ore ${fasciaOraria(daAnnullare.orario)}. Credito rimborsato: €${daAnnullare.prezzo.toFixed(2)}.`
        );
      }
      if (daAnnullare.tipo === 'lezione' && daAnnullare.maestroId) {
        await creaNotificaMaestro(
          daAnnullare.maestroId,
          `Il circolo ha annullato la lezione: ${daAnnullare.campoNome}, ${daAnnullare.dataLabel} ore ${fasciaOraria(daAnnullare.orario)}.`
        );
      }
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
        <span className="pc-legend-item"><span className="pc-legend-dot pc-legend-lezione" /> Lezione</span>
        <span className="pc-legend-item"><span className="pc-legend-dot pc-legend-riservato" /> Riservato</span>
      </div>

      <div className="pc-grid">
        {ORARI.map((ora) => {
          const blocco = bloccoAttivo(ora);
          const p = !blocco ? prenotazioneSlot(ora) : undefined;
          const eLezione = p?.tipo === 'lezione';
          let sotto = 'Libero';
          if (p) sotto = p.utenteCognome ? `${p.utenteNome} ${p.utenteCognome[0]}.` : p.utenteNome;
          else if (blocco) sotto = 'Riservato';
          return (
            <button
              key={ora}
              onClick={() => { if (p) setDaAnnullare(p); else if (blocco) setBloccoInfo(blocco); }}
              className={`pc-slot ${p ? 'occupato' : ''} ${eLezione ? 'lezione' : ''} ${blocco ? 'riservato' : ''}`}
            >
              <div className="pc-slot-ora">{ora}</div>
              <div className="pc-slot-sotto">{sotto}</div>
            </button>
          );
        })}
      </div>

      <Modal visible={!!bloccoInfo} onClose={() => setBloccoInfo(null)}>
        <div className="admin-modal-title">Orario riservato</div>
        <div className="admin-modal-sub">
          {campi.find((c) => c.id === bloccoInfo?.campoId)?.nome} · {bloccoInfo?.orarioInizio} - {bloccoInfo?.orarioFine}
        </div>
        <p style={{ marginTop: '1rem', fontWeight: 700 }}>{bloccoInfo?.etichetta}</p>
        <button className="admin-modal-btn-cancel" onClick={() => setBloccoInfo(null)} style={{ marginTop: '1rem' }}>
          Chiudi
        </button>
      </Modal>

      <Modal visible={!!daAnnullare} onClose={() => setDaAnnullare(null)}>
        <div className="admin-modal-title" style={{ textTransform: 'none', fontSize: '1rem' }}>
          {daAnnullare ? intestazionePrenotazione(daAnnullare) : ''}
        </div>
        <div className="admin-modal-sub">
          {daAnnullare?.campoNome} · {daAnnullare?.dataLabel} {daAnnullare ? fasciaOraria(daAnnullare.orario) : ''}
          {daAnnullare?.etichetta ? ` · ${daAnnullare.etichetta}` : ''}
        </div>
        <div className="admin-modal-amount" style={{ fontSize: '.9rem', opacity: 0.75 }}>
          {!daAnnullare?.utenteId
            ? 'Nessun rimborso (allievo non socio)'
            : daAnnullare?.costoDiviso
              ? `Saranno rimborsati entrambi: ${daAnnullare.utenteNome} e ${daAnnullare.compagnoNome} · €${(daAnnullare.prezzo / 2).toFixed(2)} a testa`
              : `Rimborso: €${daAnnullare?.prezzo.toFixed(2)}`}
        </div>
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
