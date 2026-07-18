'use client';

import { useEffect, useState } from 'react';
import { Campo, ORARI_ESTESI } from '../../../data/circoli';
import { aggiornaCampo } from '../../../data/circoliRepo';
import Modal from './Modal';

const GIORNI_SETTIMANA = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato'];
const PREZZI_DISPONIBILI = Array.from({ length: 33 }, (_, i) => Math.round(i * 0.5 * 100) / 100);

export default function SezionePrezzi({ circoloId, campi }: { circoloId: string; campi: Campo[] }) {
  const [selCampoId, setSelCampoId] = useState<string | null>(campi[0]?.id ?? null);

  useEffect(() => {
    if ((!selCampoId || !campi.some((c) => c.id === selCampoId)) && campi[0]) {
      setSelCampoId(campi[0].id);
    }
  }, [campi]);

  const campo = campi.find((c) => c.id === selCampoId);

  const [salvandoBase, setSalvandoBase] = useState(false);
  const salvaPrezzoBase = async (v: string) => {
    if (!campo) return;
    setSalvandoBase(true);
    await aggiornaCampo(circoloId, campo.id, { prezzoOraDefault: v === '' ? null : parseFloat(v) } as any);
    setSalvandoBase(false);
  };

  const [modificaAperta, setModificaAperta] = useState(false);
  const [orarioInizio, setOrarioInizio] = useState('');
  const [orarioFine, setOrarioFine] = useState('');
  const [prezzoSpeciale, setPrezzoSpeciale] = useState('');
  const [etichetta, setEtichetta] = useState('');
  const [giorniSel, setGiorniSel] = useState<number[]>([]);
  const [errore, setErrore] = useState('');

  const apriForm = () => {
    const esistente = campo?.tariffaSpeciale;
    if (esistente) {
      setOrarioInizio(esistente.orarioInizio);
      setOrarioFine(esistente.orarioFine);
      setPrezzoSpeciale(String(esistente.prezzo));
      setEtichetta(esistente.etichetta);
      setGiorniSel(esistente.giorni ?? []);
    } else {
      setOrarioInizio('');
      setOrarioFine('');
      setPrezzoSpeciale('');
      setEtichetta('Con illuminazione');
      setGiorniSel([]);
    }
    setErrore('');
    setModificaAperta(true);
  };

  const toggleGiorno = (i: number) => {
    setGiorniSel((prev) => (prev.includes(i) ? prev.filter((x) => x !== i) : [...prev, i]));
  };

  const salvaTariffa = async () => {
    if (!campo) return;
    if (!orarioInizio || !orarioFine) { setErrore("Seleziona l'orario di inizio e di fine."); return; }
    if (prezzoSpeciale === '') { setErrore('Seleziona un prezzo.'); return; }
    if (!etichetta.trim()) { setErrore("Inserisci un'etichetta."); return; }

    await aggiornaCampo(circoloId, campo.id, {
      tariffaSpeciale: {
        orarioInizio, orarioFine, prezzo: parseFloat(prezzoSpeciale), etichetta: etichetta.trim(), giorni: giorniSel,
      },
    } as any);
    setModificaAperta(false);
  };

  const rimuoviTariffaSpeciale = async () => {
    if (!campo) return;
    await aggiornaCampo(circoloId, campo.id, { tariffaSpeciale: null } as any);
    setModificaAperta(false);
  };

  const esistente = campo?.tariffaSpeciale;

  return (
    <div className="admin-card">
      <div className="admin-card-title">Prezzi delle ore</div>
      <p className="admin-card-hint">
        Scegli un campo per impostare il suo prezzo base e, se vuoi, una
        tariffa speciale per una fascia oraria (es. con illuminazione).
      </p>

      <div className="admin-chip-row">
        {campi.map((c) => (
          <button
            key={c.id} className={`admin-chip ${selCampoId === c.id ? 'selected' : ''}`}
            onClick={() => setSelCampoId(c.id)}
          >
            {c.nome}
          </button>
        ))}
      </div>

      {campo && (
        <>
          <label className="admin-label">Prezzo base — {campo.nome}</label>
          <select
            className="admin-select"
            value={campo.prezzoOraDefault === null || campo.prezzoOraDefault === undefined ? '' : String(campo.prezzoOraDefault)}
            onChange={(e) => salvaPrezzoBase(e.target.value)}
          >
            <option value="">--</option>
            {PREZZI_DISPONIBILI.map((p) => (
              <option key={p} value={p}>€ {p.toFixed(2)}</option>
            ))}
          </select>
          {salvandoBase && <div className="admin-saving">Salvataggio…</div>}

          <label className="admin-label">Tariffa speciale</label>
          {esistente ? (
            <div className="admin-list-row">
              <div style={{ flex: 1 }}>
                <div className="admin-list-main">{esistente.etichetta} · €{esistente.prezzo.toFixed(2)}</div>
                <div className="admin-list-sub">
                  {esistente.orarioInizio}–{esistente.orarioFine}
                  {esistente.giorni && esistente.giorni.length > 0
                    ? `  ·  ${esistente.giorni.map((g) => GIORNI_SETTIMANA[g].slice(0, 3)).join(', ')}`
                    : '  ·  Tutti i giorni'}
                </div>
              </div>
              <button className="admin-icon-btn" onClick={apriForm} aria-label="Modifica">✎</button>
              <button className="admin-icon-btn danger" onClick={rimuoviTariffaSpeciale} aria-label="Rimuovi">🗑</button>
            </div>
          ) : (
            <button className="admin-btn-full" onClick={apriForm}>+ Aggiungi tariffa speciale</button>
          )}
        </>
      )}

      <Modal visible={modificaAperta} onClose={() => setModificaAperta(false)}>
        <div className="admin-modal-title">Tariffa speciale{campo ? ` — ${campo.nome}` : ''}</div>

        <label className="admin-label">Dalle</label>
        <select className="admin-select" value={orarioInizio} onChange={(e) => setOrarioInizio(e.target.value)}>
          <option value="">--</option>
          {ORARI_ESTESI.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>

        <label className="admin-label">Alle</label>
        <select className="admin-select" value={orarioFine} onChange={(e) => setOrarioFine(e.target.value)}>
          <option value="">--</option>
          {ORARI_ESTESI.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>

        <label className="admin-label">Prezzo</label>
        <select className="admin-select" value={prezzoSpeciale} onChange={(e) => setPrezzoSpeciale(e.target.value)}>
          <option value="">--</option>
          {PREZZI_DISPONIBILI.map((p) => <option key={p} value={p}>€ {p.toFixed(2)}</option>)}
        </select>

        <label className="admin-label">Etichetta</label>
        <input className="admin-input" value={etichetta} onChange={(e) => setEtichetta(e.target.value)} placeholder="Con illuminazione" />

        <label className="admin-label">Giorni (nessuno selezionato = tutti i giorni)</label>
        <div className="admin-chip-row">
          {GIORNI_SETTIMANA.map((g, i) => (
            <button key={i} className={`admin-chip ${giorniSel.includes(i) ? 'selected' : ''}`} onClick={() => toggleGiorno(i)}>
              {g.slice(0, 3)}
            </button>
          ))}
        </div>

        {errore && <div className="admin-error-text">{errore}</div>}

        <div className="admin-modal-btn-row">
          <button className="admin-modal-btn-cancel" onClick={() => setModificaAperta(false)}>Annulla</button>
          <button className="admin-modal-btn-confirm" onClick={salvaTariffa}>Salva</button>
        </div>
      </Modal>
    </div>
  );
}
