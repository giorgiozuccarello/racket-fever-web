'use client';

import { useEffect, useState } from 'react';
import { Campo, Blocco, ORARI_ESTESI } from '../../../data/circoli';
import { aggiungiBlocco, rimuoviBlocco } from '../../../data/circoliRepo';

const GIORNI_SETTIMANA = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato'];

export default function SezioneBlocchi({ circoloId, campi, blocchi }: {
  circoloId: string; campi: Campo[]; blocchi: Blocco[];
}) {
  const [campoId, setCampoId] = useState('');
  const [tipo, setTipo] = useState<'ricorrente' | 'data'>('ricorrente');
  const [giorniSel, setGiorniSel] = useState<number[]>([]);
  const [data, setData] = useState('');
  const [orarioInizio, setOrarioInizio] = useState('');
  const [orarioFine, setOrarioFine] = useState('');
  const [etichetta, setEtichetta] = useState('');
  const [errore, setErrore] = useState('');

  useEffect(() => {
    if (!campoId && campi[0]) setCampoId(campi[0].id);
  }, [campi]);

  const toggleGiorno = (i: number) => {
    setGiorniSel((prev) => (prev.includes(i) ? prev.filter((x) => x !== i) : [...prev, i]));
  };

  const aggiungi = async () => {
    setErrore('');
    if (!campoId) { setErrore('Seleziona un campo.'); return; }
    if (!orarioInizio || !orarioFine) { setErrore("Seleziona l'orario di inizio e di fine."); return; }
    if (!etichetta.trim()) { setErrore("Inserisci un'etichetta."); return; }
    if (tipo === 'ricorrente' && giorniSel.length === 0) { setErrore('Seleziona almeno un giorno.'); return; }
    if (tipo === 'data' && !data.trim()) { setErrore('Inserisci una data.'); return; }

    const nuovoBlocco: any = { campoId, tipo, orarioInizio, orarioFine, etichetta: etichetta.trim() };
    if (tipo === 'ricorrente') nuovoBlocco.giorniSettimana = giorniSel;
    else nuovoBlocco.data = data.trim();

    await aggiungiBlocco(circoloId, nuovoBlocco);
    setEtichetta('');
    setData('');
    setGiorniSel([]);
  };

  const nomeCampo = (id: string) => campi.find((c) => c.id === id)?.nome ?? '—';

  return (
    <div className="admin-card">
      <div className="admin-card-title">Orari riservati</div>
      <p className="admin-card-hint">
        Nascondi ore di un campo per scuola tennis, tornei o altre attività.
        I soci non potranno prenotare in questi orari.
      </p>

      {blocchi.map((b) => (
        <div key={b.id} className="admin-list-row">
          <div style={{ flex: 1 }}>
            <div className="admin-list-main">{nomeCampo(b.campoId)} · {b.etichetta}</div>
            <div className="admin-list-sub">
              {b.tipo === 'ricorrente'
                ? `Ogni ${(b.giorniSettimana ?? []).map((g) => GIORNI_SETTIMANA[g].slice(0, 3)).join(', ')}`
                : b.data}
              {'  '}{b.orarioInizio}–{b.orarioFine}
            </div>
          </div>
          <button className="admin-icon-btn danger" onClick={() => rimuoviBlocco(circoloId, b.id)} aria-label="Rimuovi">🗑</button>
        </div>
      ))}
      {blocchi.length === 0 && <p className="admin-empty-text">Nessun orario riservato al momento.</p>}

      <label className="admin-label">Campo</label>
      <div className="admin-chip-row">
        {campi.map((c) => (
          <button key={c.id} className={`admin-chip ${campoId === c.id ? 'selected' : ''}`} onClick={() => setCampoId(c.id)}>
            {c.nome}
          </button>
        ))}
      </div>

      <label className="admin-label">Ricorrenza</label>
      <div className="admin-chip-row">
        <button className={`admin-chip ${tipo === 'ricorrente' ? 'selected' : ''}`} onClick={() => setTipo('ricorrente')}>Ogni settimana</button>
        <button className={`admin-chip ${tipo === 'data' ? 'selected' : ''}`} onClick={() => setTipo('data')}>Data singola</button>
      </div>

      {tipo === 'ricorrente' ? (
        <>
          <label className="admin-label">Giorni</label>
          <div className="admin-chip-row">
            {GIORNI_SETTIMANA.map((g, i) => (
              <button key={i} className={`admin-chip ${giorniSel.includes(i) ? 'selected' : ''}`} onClick={() => toggleGiorno(i)}>
                {g.slice(0, 3)}
              </button>
            ))}
          </div>
        </>
      ) : (
        <>
          <label className="admin-label">Data (AAAA-MM-GG)</label>
          <input className="admin-input" value={data} onChange={(e) => setData(e.target.value)} placeholder="2026-08-15" />
        </>
      )}

      <div className="admin-row">
        <div>
          <label className="admin-label">Dalle</label>
          <select className="admin-select" value={orarioInizio} onChange={(e) => setOrarioInizio(e.target.value)}>
            <option value="">--</option>
            {ORARI_ESTESI.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>
        <div>
          <label className="admin-label">Alle</label>
          <select className="admin-select" value={orarioFine} onChange={(e) => setOrarioFine(e.target.value)}>
            <option value="">--</option>
            {ORARI_ESTESI.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>
      </div>

      <label className="admin-label">Etichetta</label>
      <input className="admin-input" value={etichetta} onChange={(e) => setEtichetta(e.target.value)} placeholder="Scuola Tennis" />

      {errore && <div className="admin-error-text">{errore}</div>}

      <button className="admin-btn-full" onClick={aggiungi}>+ Aggiungi blocco</button>
    </div>
  );
}
