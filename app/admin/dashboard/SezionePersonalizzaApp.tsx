'use client';

import { useRef, useState } from 'react';
import { Circolo } from '../../../data/circoli';
import { aggiornaCircolo } from '../../../data/circoliRepo';
import { caricaLogoCircolo } from '../../../data/storage';

export default function SezionePersonalizzaApp({ circolo }: { circolo: Circolo }) {
  return (
    <div className="admin-card">
      <div className="admin-card-title">Personalizza App</div>
      <p className="admin-card-hint">Colori e logo mostrati ai tuoi soci nell&apos;app e sul sito.</p>

      <div className="superadmin-subtitolo">Tema App</div>
      <SezioneTema circolo={circolo} />

      <div className="superadmin-subtitolo" style={{ marginTop: '1.4rem' }}>Logo dell&apos;App</div>
      <SezioneLogoInterna circolo={circolo} />
    </div>
  );
}

function SezioneTema({ circolo }: { circolo: Circolo }) {
  const [primario, setPrimario] = useState(circolo.tema.primario);
  const [secondario, setSecondario] = useState(circolo.tema.accento);
  const [salvando, setSalvando] = useState(false);
  const [ok, setOk] = useState(false);

  const salva = async (nuovoPrimario: string, nuovoSecondario: string) => {
    setSalvando(true);
    await aggiornaCircolo(circolo.id, { tema: { primario: nuovoPrimario, accento: nuovoSecondario } });
    setSalvando(false);
    setOk(true);
    setTimeout(() => setOk(false), 1800);
  };

  return (
    <div className="admin-row">
      <div>
        <label className="admin-label">Colore primario</label>
        <input
          type="color" className="superadmin-color" value={primario}
          onChange={(e) => { setPrimario(e.target.value); salva(e.target.value, secondario); }}
        />
      </div>
      <div>
        <label className="admin-label">Colore secondario</label>
        <input
          type="color" className="superadmin-color" value={secondario}
          onChange={(e) => { setSecondario(e.target.value); salva(primario, e.target.value); }}
        />
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: 2 }}>
        <span style={{ fontSize: '.8rem', color: 'var(--grigio)' }}>
          {salvando ? 'Salvataggio…' : ok ? 'Salvato ✓' : ''}
        </span>
      </div>
    </div>
  );
}

function SezioneLogoInterna({ circolo }: { circolo: Circolo }) {
  const [caricando, setCaricando] = useState(false);
  const [errore, setErrore] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const gestisciFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setErrore('');
    setCaricando(true);
    try {
      await caricaLogoCircolo(circolo.id, file);
    } catch {
      setErrore('Errore durante il caricamento. Riprova.');
    } finally {
      setCaricando(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <div>
      <p className="admin-card-hint">
        Carica un&apos;immagine: viene ritagliata quadrata (dal centro) e
        ridimensionata automaticamente, poi mostrata al posto della sigla.
      </p>

      <div style={{ display: 'flex', justifyContent: 'center', margin: '.8rem 0' }}>
        {circolo.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={circolo.logoUrl} alt="Logo circolo" className="superadmin-logo-preview" />
        ) : (
          <div
            className="superadmin-logo-preview"
            style={{
              background: circolo.tema.primario, display: 'flex',
              alignItems: 'center', justifyContent: 'center',
              color: '#fff', fontWeight: 900, fontSize: '1.3rem',
            }}
          >
            {circolo.sigla}
          </div>
        )}
      </div>

      {errore && <div className="admin-error-text">{errore}</div>}

      <input
        ref={inputRef} type="file" accept="image/*"
        onChange={gestisciFile} style={{ display: 'none' }}
      />
      <button className="admin-btn-full" onClick={() => inputRef.current?.click()} disabled={caricando}>
        {caricando ? 'Caricamento…' : circolo.logoUrl ? 'Cambia logo' : 'Carica logo'}
      </button>
    </div>
  );
}
