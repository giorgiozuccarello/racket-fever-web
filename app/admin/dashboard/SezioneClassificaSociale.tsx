'use client';

import { useState } from 'react';
import { SocioCircolo, impostaPosizioneClassificaSociale, rimuoviDaClassificaSociale } from '../../../data/users';
import { Circolo, GRADIENTI_CLASSIFICA } from '../../../data/circoli';
import { aggiornaCircolo } from '../../../data/circoliRepo';
import Modal from './Modal';

export default function SezioneClassificaSociale({ circolo, soci }: { circolo: Circolo; soci: SocioCircolo[] }) {
  const [formAperto, setFormAperto] = useState(false);
  const [filtroSocio, setFiltroSocio] = useState('');
  const [socioScelto, setSocioScelto] = useState<SocioCircolo | null>(null);
  const [posizione, setPosizione] = useState('');
  const [errore, setErrore] = useState('');
  const [salvando, setSalvando] = useState(false);

  const [modificaSocio, setModificaSocio] = useState<SocioCircolo | null>(null);
  const [modPosizione, setModPosizione] = useState('');
  const [modErrore, setModErrore] = useState('');
  const [modSalvando, setModSalvando] = useState(false);

  const inClassifica = soci
    .filter((s) => s.posizioneClassificaSociale != null)
    .sort((a, b) => (a.posizioneClassificaSociale! - b.posizioneClassificaSociale!));

  const risultatiRicerca = filtroSocio.trim().length === 0 ? [] : soci
    .filter((s) => s.posizioneClassificaSociale == null)
    .filter((s) => (s.nome + ' ' + s.cognome).toLowerCase().includes(filtroSocio.trim().toLowerCase()))
    .slice(0, 8);

  const posizioneOccupataDa = (pos: number, escludiUid?: string) =>
    soci.find((s) => s.posizioneClassificaSociale === pos && s.uid !== escludiUid);

  const resetForm = () => {
    setFormAperto(false); setSocioScelto(null); setPosizione(''); setFiltroSocio(''); setErrore('');
  };

  const aggiungi = async () => {
    setErrore('');
    if (!socioScelto) { setErrore('Scegli un socio.'); return; }
    const pos = parseInt(posizione, 10);
    if (!pos || pos < 1) { setErrore('Inserisci una posizione valida (numero intero, da 1 in su).'); return; }
    const occupante = posizioneOccupataDa(pos);
    if (occupante) { setErrore(`Posizione già occupata da ${occupante.nome} ${occupante.cognome}.`); return; }
    setSalvando(true);
    await impostaPosizioneClassificaSociale(socioScelto.uid, pos);
    setSalvando(false);
    resetForm();
  };

  const apriModifica = (soc: SocioCircolo) => {
    setModificaSocio(soc);
    setModPosizione(String(soc.posizioneClassificaSociale ?? ''));
    setModErrore('');
  };

  const salvaModifica = async () => {
    if (!modificaSocio) return;
    setModErrore('');
    const pos = parseInt(modPosizione, 10);
    if (!pos || pos < 1) { setModErrore('Inserisci una posizione valida.'); return; }
    const occupante = posizioneOccupataDa(pos, modificaSocio.uid);
    if (occupante) { setModErrore(`Posizione già occupata da ${occupante.nome} ${occupante.cognome}.`); return; }
    setModSalvando(true);
    await impostaPosizioneClassificaSociale(modificaSocio.uid, pos);
    setModSalvando(false);
    setModificaSocio(null);
  };

  const rimuovi = async (uid: string) => {
    await rimuoviDaClassificaSociale(uid);
  };

  const [salvandoGradiente, setSalvandoGradiente] = useState(false);
  const gradienteAttuale = circolo.gradienteClassifica ?? GRADIENTI_CLASSIFICA[0];
  const scegliGradiente = async (g: { da: string; a: string }) => {
    setSalvandoGradiente(true);
    await aggiornaCircolo(circolo.id, { gradienteClassifica: { da: g.da, a: g.a } });
    setSalvandoGradiente(false);
  };

  return (
    <div className="admin-card">
      <div className="admin-card-title">Classifica Sociale</div>
      <p className="admin-card-hint">
        Classifica interna del circolo (non ufficiale FITP). Al primo avvio, importa qui
        la posizione attuale di ogni socio dalla vecchia lista — in seguito potrai comunque
        correggerla in qualunque momento.
      </p>

      <label className="admin-label">Sfondo della schermata Classifica</label>
      <div className="tema-grid">
        {GRADIENTI_CLASSIFICA.map((g) => {
          const selezionato = gradienteAttuale.da === g.da && gradienteAttuale.a === g.a;
          return (
            <button key={g.nome} type="button" className="tema-box" onClick={() => scegliGradiente(g)}>
              <span
                className={`tema-swatch${selezionato ? ' tema-swatch-sel' : ''}`}
                style={{ background: `linear-gradient(160deg, ${g.da}, ${g.a})` }}
              />
              <span className="tema-label">{g.nome}</span>
            </button>
          );
        })}
      </div>
      {salvandoGradiente && <p className="admin-card-hint" style={{ marginTop: '.3rem' }}>Salvataggio…</p>}

      {inClassifica.length === 0 && !formAperto && (
        <p className="admin-empty-text">Nessun socio ancora in classifica.</p>
      )}

      {inClassifica.map((soc) => (
        <div key={soc.uid} className="admin-list-row">
          <div
            style={{ flex: 1, cursor: 'pointer' }}
            className="admin-list-row-clickable"
            onClick={() => apriModifica(soc)}
          >
            <div className="admin-list-main">{soc.nome} {soc.cognome}</div>
            <div className="admin-list-sub">Posizione #{soc.posizioneClassificaSociale}</div>
          </div>
          <button className="admin-icon-btn danger" onClick={() => rimuovi(soc.uid)} aria-label="Rimuovi">🗑</button>
        </div>
      ))}

      {formAperto ? (
        <>
          {socioScelto ? (
            <div className="admin-list-row" style={{ background: '#fff', border: '1.5px solid var(--bordo)', borderRadius: 10, padding: '.7rem 1rem' }}>
              <span style={{ flex: 1, fontWeight: 700 }}>{socioScelto.nome} {socioScelto.cognome}</span>
              <button type="button" className="admin-btn-small" onClick={() => setSocioScelto(null)}>Cambia</button>
            </div>
          ) : (
            <>
              <input
                className="admin-input" value={filtroSocio} onChange={(e) => setFiltroSocio(e.target.value)}
                placeholder="Cerca socio da aggiungere…"
              />
              {risultatiRicerca.map((soc) => (
                <div
                  key={soc.uid} className="admin-list-row admin-list-row-clickable"
                  onClick={() => { setSocioScelto(soc); setFiltroSocio(''); }}
                >
                  <span>{soc.nome} {soc.cognome}</span>
                </div>
              ))}
            </>
          )}
          <label className="admin-label">Posizione</label>
          <input
            className="admin-input" value={posizione} onChange={(e) => setPosizione(e.target.value)}
            placeholder="Es. 7" type="number" min={1}
          />
          {errore && <div className="admin-error-text">{errore}</div>}
          <div className="admin-row" style={{ marginTop: '.8rem' }}>
            <button className="admin-btn-full" style={{ background: '#fff', color: 'var(--grigio)', border: '2px solid var(--bordo)' }} onClick={resetForm}>
              Annulla
            </button>
            <button className="admin-btn-full" onClick={aggiungi} disabled={salvando}>
              {salvando ? 'Salvataggio…' : 'Aggiungi'}
            </button>
          </div>
        </>
      ) : (
        <button className="admin-btn-full" onClick={() => setFormAperto(true)}>
          + Aggiungi Socio
        </button>
      )}

      <Modal visible={!!modificaSocio} onClose={() => setModificaSocio(null)}>
        <div className="admin-modal-title" style={{ textTransform: 'none' }}>
          {modificaSocio?.nome} {modificaSocio?.cognome}
        </div>
        <label className="admin-label">Posizione</label>
        <input
          className="admin-input" value={modPosizione} onChange={(e) => setModPosizione(e.target.value)}
          type="number" min={1}
        />
        {modErrore && <div className="admin-error-text">{modErrore}</div>}
        <div className="admin-modal-btn-row">
          <button className="admin-modal-btn-cancel" onClick={() => setModificaSocio(null)}>Annulla</button>
          <button className="admin-modal-btn-confirm" onClick={salvaModifica} disabled={modSalvando}>
            {modSalvando ? 'Attendere…' : 'Salva'}
          </button>
        </div>
      </Modal>
    </div>
  );
}
