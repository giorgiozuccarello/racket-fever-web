'use client';

import { useEffect, useState } from 'react';
import { Campo, ORARI_ESTESI } from '../../../data/circoli';
import { aggiornaCampo } from '../../../data/circoliRepo';
import { ChiaveTesto } from '../../../data/testi';
import { useLingua } from '../../../lib/lingua';
import Modal from './Modal';

// I giorni con l'indice che usa JavaScript: 0 = domenica. Sono le
// chiavi comuni in forma CORTA, perche' qui i giorni stanno dentro
// pastiglie larghe tre lettere e dentro una riga di riepilogo: prima si
// scriveva il nome intero e poi lo si tagliava con `slice(0, 3)`, che in
// tedesco dava «Mit» invece di «Mi».
const GIORNI_SETTIMANA: ChiaveTesto[] = [
  'com.g.dom', 'com.g.lun', 'com.g.mar', 'com.g.mer', 'com.g.gio', 'com.g.ven', 'com.g.sab',
];
const PREZZI_DISPONIBILI = Array.from({ length: 33 }, (_, i) => Math.round(i * 0.5 * 100) / 100);

export default function SezionePrezzi({ circoloId, campi }: { circoloId: string; campi: Campo[] }) {
  const { t } = useLingua();
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
      // ⚠️ QUESTA E' UNA PROPOSTA, NON UN TESTO DI SISTEMA: l'etichetta
      // finisce in Firestore ed e' un dato scritto dall'Admin, che puo'
      // cambiarla prima di salvare. Si suggerisce nella sua lingua
      // perche' un Admin tedesco riscriverebbe comunque a mano un
      // «Con illuminazione» che non capisce.
      setEtichetta(t('adm.pri.etichettaEsempio'));
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
    if (!orarioInizio || !orarioFine) { setErrore(t('adm.pri.scegliOrari')); return; }
    if (prezzoSpeciale === '') { setErrore(t('adm.pri.scegliPrezzo')); return; }
    if (!etichetta.trim()) { setErrore(t('adm.pri.scegliEtichetta')); return; }

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
      <div className="admin-card-title">{t('adm.pri.titolo')}</div>
      <p className="admin-card-hint">{t('adm.pri.intro')}</p>

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
          <label className="admin-label">{t('adm.pri.prezzoBase', { campo: campo.nome })}</label>
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
          {salvandoBase && <div className="admin-saving">{t('com.salvataggio')}</div>}

          <label className="admin-label">{t('adm.pri.tariffaSpeciale')}</label>
          {esistente ? (
            <div className="admin-list-row">
              <div style={{ flex: 1 }}>
                <div className="admin-list-main">{esistente.etichetta} · € {esistente.prezzo.toFixed(2)}</div>
                <div className="admin-list-sub">
                  {esistente.orarioInizio}–{esistente.orarioFine}
                  {esistente.giorni && esistente.giorni.length > 0
                    ? `  ·  ${esistente.giorni.map((g) => t(GIORNI_SETTIMANA[g])).join(', ')}`
                    : `  ·  ${t('adm.pri.tuttiIGiorni')}`}
                </div>
              </div>
              <button className="admin-icon-btn" onClick={apriForm} aria-label={t('adm.pri.modifica')}>✎</button>
              <button className="admin-icon-btn danger" onClick={rimuoviTariffaSpeciale} aria-label={t('adm.pri.rimuovi')}>🗑</button>
            </div>
          ) : (
            <button className="admin-btn-full" onClick={apriForm}>+ {t('adm.pri.aggiungiTariffa')}</button>
          )}
        </>
      )}

      <Modal visible={modificaAperta} onClose={() => setModificaAperta(false)}>
        <div className="admin-modal-title">{t('adm.pri.tariffaSpeciale')}{campo ? ` — ${campo.nome}` : ''}</div>

        <label className="admin-label">{t('adm.pri.dalle')}</label>
        <select className="admin-select" value={orarioInizio} onChange={(e) => setOrarioInizio(e.target.value)}>
          <option value="">--</option>
          {ORARI_ESTESI.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>

        <label className="admin-label">{t('adm.pri.alle')}</label>
        <select className="admin-select" value={orarioFine} onChange={(e) => setOrarioFine(e.target.value)}>
          <option value="">--</option>
          {ORARI_ESTESI.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>

        <label className="admin-label">{t('adm.pri.prezzo')}</label>
        <select className="admin-select" value={prezzoSpeciale} onChange={(e) => setPrezzoSpeciale(e.target.value)}>
          <option value="">--</option>
          {PREZZI_DISPONIBILI.map((p) => <option key={p} value={p}>€ {p.toFixed(2)}</option>)}
        </select>

        <label className="admin-label">{t('adm.pri.etichetta')}</label>
        <input
          className="admin-input" value={etichetta} onChange={(e) => setEtichetta(e.target.value)}
          placeholder={t('adm.pri.etichettaEsempio')}
        />

        <label className="admin-label">{t('adm.pri.giorni')}</label>
        <div className="admin-chip-row">
          {GIORNI_SETTIMANA.map((chiave, i) => (
            <button key={i} className={`admin-chip ${giorniSel.includes(i) ? 'selected' : ''}`} onClick={() => toggleGiorno(i)}>
              {t(chiave)}
            </button>
          ))}
        </div>

        {errore && <div className="admin-error-text">{errore}</div>}

        <div className="admin-modal-btn-row">
          <button className="admin-modal-btn-cancel" onClick={() => setModificaAperta(false)}>{t('com.annulla')}</button>
          <button className="admin-modal-btn-confirm" onClick={salvaTariffa}>{t('com.salva')}</button>
        </div>
      </Modal>
    </div>
  );
}
