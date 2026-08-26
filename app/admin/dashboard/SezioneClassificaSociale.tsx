'use client';

import { useState } from 'react';
import { SocioCircolo, impostaPosizioneClassificaSociale, rimuoviDaClassificaSociale } from '../../../data/users';
import { Circolo, GRADIENTI_CLASSIFICA } from '../../../data/circoli';
import { aggiornaCircolo } from '../../../data/circoliRepo';
import { Sfida } from '../../../data/sfide';
import { ChiaveTesto } from '../../../data/testi';
import { useLingua } from '../../../lib/lingua';
import Modal from './Modal';

// ⚠️ I NOMI DEGLI SFONDI ARRIVANO DA `GRADIENTI_CLASSIFICA`
// (data/circoli.ts) E LI' SONO IN ITALIANO: quel campo e'
// l'identificativo della sfumatura, non l'etichetta da mostrare, e
// tradurlo alla fonte vorrebbe dire cambiare un dato che sta anche
// dentro i documenti dei circoli. Qui si traduce solo la scritta sotto
// il quadratino di colore. Le stringhe italiane in questa tabella sono
// CHIAVI DI RICERCA, non testo a schermo: uno sfondo nuovo che non
// figuri qui mostra il proprio nome grezzo invece di sparire.
const NOME_SFONDO: Record<string, ChiaveTesto> = {
  'Verde Pino': 'adm.cla.sfondoVerdePino',
  'Terra Rossa': 'adm.cla.sfondoTerraRossa',
  'Blu Notte': 'adm.cla.sfondoBluNotte',
  Oro: 'adm.cla.sfondoOro',
  Grafite: 'adm.cla.sfondoGrafite',
};

export default function SezioneClassificaSociale({ circolo, soci, sfide }: { circolo: Circolo; soci: SocioCircolo[]; sfide: Sfida[] }) {
  const { t } = useLingua();
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
    if (!socioScelto) { setErrore(t('adm.cla.scegliSocio')); return; }
    const pos = parseInt(posizione, 10);
    if (!pos || pos < 1) { setErrore(t('adm.cla.posizioneNonValidaEstesa')); return; }
    const occupante = posizioneOccupataDa(pos);
    if (occupante) {
      setErrore(t('adm.cla.posizioneOccupata', { nome: `${occupante.nome} ${occupante.cognome}` }));
      return;
    }
    setSalvando(true);
    await impostaPosizioneClassificaSociale(socioScelto.uid, circolo.id, pos);
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
    if (!pos || pos < 1) { setModErrore(t('adm.cla.posizioneNonValida')); return; }
    const occupante = posizioneOccupataDa(pos, modificaSocio.uid);
    if (occupante) {
      setModErrore(t('adm.cla.posizioneOccupata', { nome: `${occupante.nome} ${occupante.cognome}` }));
      return;
    }
    setModSalvando(true);
    await impostaPosizioneClassificaSociale(modificaSocio.uid, circolo.id, pos);
    setModSalvando(false);
    setModificaSocio(null);
  };

  const rimuovi = async (uid: string) => {
    await rimuoviDaClassificaSociale(uid, circolo.id);
  };

  const [salvandoGradiente, setSalvandoGradiente] = useState(false);
  const gradienteAttuale = circolo.gradienteClassifica ?? GRADIENTI_CLASSIFICA[0];
  const scegliGradiente = async (g: { da: string; a: string }) => {
    setSalvandoGradiente(true);
    await aggiornaCircolo(circolo.id, { gradienteClassifica: { da: g.da, a: g.a } });
    setSalvandoGradiente(false);
  };

  // ⚠️ Il «Reset Sfide (solo test)» che stava qui è passato al Super
  // Admin, insieme a tutta la sezione Test Reset: cancellava tutte le
  // sfide del circolo, concluse comprese, e stava in mano al
  // presidente. Adesso è `resettaCircolo`, livello «Sfide», nella
  // scheda del circolo del pannello di rete.

  return (
    <div className="admin-card">
      <div className="admin-card-title">{t('adm.cla.titolo')}</div>
      <p className="admin-card-hint">{t('adm.cla.intro')}</p>

      <label className="admin-label">{t('adm.cla.sfondo')}</label>
      <div className="tema-grid">
        {GRADIENTI_CLASSIFICA.map((g) => {
          const selezionato = gradienteAttuale.da === g.da && gradienteAttuale.a === g.a;
          return (
            <button key={g.nome} type="button" className="tema-box" onClick={() => scegliGradiente(g)}>
              <span
                className={`tema-swatch${selezionato ? ' tema-swatch-sel' : ''}`}
                style={{ background: `linear-gradient(160deg, ${g.da}, ${g.a})` }}
              />
              <span className="tema-label">{NOME_SFONDO[g.nome] ? t(NOME_SFONDO[g.nome]) : g.nome}</span>
            </button>
          );
        })}
      </div>
      {salvandoGradiente && <p className="admin-card-hint" style={{ marginTop: '.3rem' }}>{t('com.salvataggio')}</p>}

      {inClassifica.length === 0 && !formAperto && (
        <p className="admin-empty-text">{t('adm.cla.nessunSocio')}</p>
      )}

      {inClassifica.map((soc) => (
        <div key={soc.uid} className="admin-list-row">
          <div
            style={{ flex: 1, cursor: 'pointer' }}
            className="admin-list-row-clickable"
            onClick={() => apriModifica(soc)}
          >
            <div className="admin-list-main">{soc.nome} {soc.cognome}</div>
            <div className="admin-list-sub">
              {t('adm.cla.posizioneNumero', { n: soc.posizioneClassificaSociale ?? '' })}
            </div>
          </div>
          <button className="admin-icon-btn danger" onClick={() => rimuovi(soc.uid)} aria-label={t('adm.cla.rimuovi')}>🗑</button>
        </div>
      ))}

      {formAperto ? (
        <>
          {socioScelto ? (
            <div className="admin-list-row" style={{ background: '#fff', border: '1.5px solid var(--bordo)', borderRadius: 10, padding: '.7rem 1rem' }}>
              <span style={{ flex: 1, fontWeight: 700 }}>{socioScelto.nome} {socioScelto.cognome}</span>
              <button type="button" className="admin-btn-small" onClick={() => setSocioScelto(null)}>{t('adm.cla.cambia')}</button>
            </div>
          ) : (
            <>
              <input
                className="admin-input" value={filtroSocio} onChange={(e) => setFiltroSocio(e.target.value)}
                placeholder={t('adm.cla.cercaSocio')}
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
          <label className="admin-label">{t('adm.cla.posizione')}</label>
          <input
            className="admin-input" value={posizione} onChange={(e) => setPosizione(e.target.value)}
            placeholder={t('adm.cla.esempioPosizione')} type="number" min={1}
          />
          {errore && <div className="admin-error-text">{errore}</div>}
          <div className="admin-row" style={{ marginTop: '.8rem' }}>
            <button className="admin-btn-full" style={{ background: '#fff', color: 'var(--grigio)', border: '2px solid var(--bordo)' }} onClick={resetForm}>
              {t('com.annulla')}
            </button>
            <button className="admin-btn-full" onClick={aggiungi} disabled={salvando}>
              {salvando ? t('com.salvataggio') : t('adm.cla.aggiungi')}
            </button>
          </div>
        </>
      ) : (
        <button className="admin-btn-full" onClick={() => setFormAperto(true)}>
          + {t('adm.cla.aggiungiSocio')}
        </button>
      )}

      <Modal visible={!!modificaSocio} onClose={() => setModificaSocio(null)}>
        <div className="admin-modal-title" style={{ textTransform: 'none' }}>
          {modificaSocio?.nome} {modificaSocio?.cognome}
        </div>
        <label className="admin-label">{t('adm.cla.posizione')}</label>
        <input
          className="admin-input" value={modPosizione} onChange={(e) => setModPosizione(e.target.value)}
          type="number" min={1}
        />
        {modErrore && <div className="admin-error-text">{modErrore}</div>}
        <div className="admin-modal-btn-row">
          <button className="admin-modal-btn-cancel" onClick={() => setModificaSocio(null)}>{t('com.annulla')}</button>
          <button className="admin-modal-btn-confirm" onClick={salvaModifica} disabled={modSalvando}>
            {modSalvando ? t('com.attendi') : t('com.salva')}
          </button>
        </div>
      </Modal>

      <div style={{ marginTop: '1.4rem', paddingTop: '1rem', borderTop: '1.5px solid #EFEBE0' }}>
        <div style={{ fontSize: '.68rem', fontWeight: 800, color: '#B3261E', textTransform: 'uppercase', letterSpacing: '.03em', marginBottom: '.4rem' }}>
          {t('adm.cla.soloTest')}
        </div>
      </div>

    </div>
  );
}
