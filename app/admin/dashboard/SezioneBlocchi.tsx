'use client';

import { useEffect, useState } from 'react';
import { Campo, Blocco, ORARI_ESTESI } from '../../../data/circoli';
import { aggiungiBlocco, modificaBlocco, rimuoviBlocco } from '../../../data/circoliRepo';
import Modal from './Modal';

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
  const [nascondiInfo, setNascondiInfo] = useState(false);
  const [errore, setErrore] = useState('');

  const [modificaBloccoObj, setModificaBloccoObj] = useState<Blocco | null>(null);
  const [modCampoId, setModCampoId] = useState('');
  const [modTipo, setModTipo] = useState<'ricorrente' | 'data'>('ricorrente');
  const [modGiorniSel, setModGiorniSel] = useState<number[]>([]);
  const [modData, setModData] = useState('');
  const [modOrarioInizio, setModOrarioInizio] = useState('');
  const [modOrarioFine, setModOrarioFine] = useState('');
  const [modEtichetta, setModEtichetta] = useState('');
  const [modNascondiInfo, setModNascondiInfo] = useState(false);
  const [modErrore, setModErrore] = useState('');

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

    const nuovoBlocco: any = { campoId, tipo, orarioInizio, orarioFine, etichetta: etichetta.trim(), nascondiInfo };
    if (tipo === 'ricorrente') nuovoBlocco.giorniSettimana = giorniSel;
    else nuovoBlocco.data = data.trim();

    await aggiungiBlocco(circoloId, nuovoBlocco);
    setEtichetta('');
    setData('');
    setGiorniSel([]);
    setNascondiInfo(false);
  };

  const apriModifica = (b: Blocco) => {
    setModificaBloccoObj(b);
    setModCampoId(b.campoId);
    setModTipo(b.tipo);
    setModGiorniSel(b.giorniSettimana ?? []);
    setModData(b.data ?? '');
    setModOrarioInizio(b.orarioInizio);
    setModOrarioFine(b.orarioFine);
    setModEtichetta(b.etichetta);
    setModNascondiInfo(!!b.nascondiInfo);
    setModErrore('');
  };

  const toggleModGiorno = (i: number) => {
    setModGiorniSel((prev) => (prev.includes(i) ? prev.filter((x) => x !== i) : [...prev, i]));
  };

  const salvaModifica = async () => {
    if (!modificaBloccoObj) return;
    setModErrore('');
    if (!modCampoId) { setModErrore('Seleziona un campo.'); return; }
    if (!modOrarioInizio || !modOrarioFine) { setModErrore("Seleziona l'orario di inizio e di fine."); return; }
    if (!modEtichetta.trim()) { setModErrore("Inserisci un'etichetta."); return; }
    if (modTipo === 'ricorrente' && modGiorniSel.length === 0) { setModErrore('Seleziona almeno un giorno.'); return; }
    if (modTipo === 'data' && !modData.trim()) { setModErrore('Inserisci una data.'); return; }

    const dati: any = {
      campoId: modCampoId, tipo: modTipo, orarioInizio: modOrarioInizio, orarioFine: modOrarioFine,
      etichetta: modEtichetta.trim(), nascondiInfo: modNascondiInfo,
    };
    if (modTipo === 'ricorrente') dati.giorniSettimana = modGiorniSel;
    else dati.data = modData.trim();

    await modificaBlocco(circoloId, modificaBloccoObj.id, dati);
    setModificaBloccoObj(null);
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
          <button className="admin-icon-btn" onClick={() => apriModifica(b)} aria-label="Modifica">✎</button>
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

      <label className="admin-checkbox-row">
        <input type="checkbox" checked={nascondiInfo} onChange={(e) => setNascondiInfo(e.target.checked)} />
        <span>Nascondi Informazioni sulla griglia (i soci vedranno solo &quot;Riservato&quot;)</span>
      </label>

      {errore && <div className="admin-error-text">{errore}</div>}

      <button className="admin-btn-full" onClick={aggiungi}>+ Aggiungi blocco</button>

      <Modal visible={!!modificaBloccoObj} onClose={() => setModificaBloccoObj(null)}>
        <div className="admin-modal-title">Modifica orario riservato</div>

        <label className="admin-label">Campo</label>
        <div className="admin-chip-row">
          {campi.map((c) => (
            <button key={c.id} className={`admin-chip ${modCampoId === c.id ? 'selected' : ''}`} onClick={() => setModCampoId(c.id)}>
              {c.nome}
            </button>
          ))}
        </div>

        <label className="admin-label">Ricorrenza</label>
        <div className="admin-chip-row">
          <button className={`admin-chip ${modTipo === 'ricorrente' ? 'selected' : ''}`} onClick={() => setModTipo('ricorrente')}>Ogni settimana</button>
          <button className={`admin-chip ${modTipo === 'data' ? 'selected' : ''}`} onClick={() => setModTipo('data')}>Data singola</button>
        </div>

        {modTipo === 'ricorrente' ? (
          <>
            <label className="admin-label">Giorni</label>
            <div className="admin-chip-row">
              {GIORNI_SETTIMANA.map((g, i) => (
                <button key={i} className={`admin-chip ${modGiorniSel.includes(i) ? 'selected' : ''}`} onClick={() => toggleModGiorno(i)}>
                  {g.slice(0, 3)}
                </button>
              ))}
            </div>
          </>
        ) : (
          <>
            <label className="admin-label">Data (AAAA-MM-GG)</label>
            <input className="admin-input" value={modData} onChange={(e) => setModData(e.target.value)} placeholder="2026-08-15" />
          </>
        )}

        <div className="admin-row">
          <div>
            <label className="admin-label">Dalle</label>
            <select className="admin-select" value={modOrarioInizio} onChange={(e) => setModOrarioInizio(e.target.value)}>
              <option value="">--</option>
              {ORARI_ESTESI.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
          <div>
            <label className="admin-label">Alle</label>
            <select className="admin-select" value={modOrarioFine} onChange={(e) => setModOrarioFine(e.target.value)}>
              <option value="">--</option>
              {ORARI_ESTESI.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
        </div>

        <label className="admin-label">Etichetta</label>
        <input className="admin-input" value={modEtichetta} onChange={(e) => setModEtichetta(e.target.value)} placeholder="Scuola Tennis" />

        <label className="admin-checkbox-row">
          <input type="checkbox" checked={modNascondiInfo} onChange={(e) => setModNascondiInfo(e.target.checked)} />
          <span>Nascondi Informazioni sulla griglia (i soci vedranno solo &quot;Riservato&quot;)</span>
        </label>

        {modErrore && <div className="admin-error-text">{modErrore}</div>}

        <div className="admin-modal-btn-row">
          <button className="admin-modal-btn-cancel" onClick={() => setModificaBloccoObj(null)}>Annulla</button>
          <button className="admin-modal-btn-confirm" onClick={salvaModifica}>Salva</button>
        </div>
      </Modal>
    </div>
  );
}
