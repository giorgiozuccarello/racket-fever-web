'use client';

import { useRef, useState } from 'react';
import { Circolo, TEMI_SFONDO_APP } from '../../../data/circoli';
import { aggiornaCircolo } from '../../../data/circoliRepo';
import { caricaLogoCircolo } from '../../../data/storage';

export default function SezionePersonalizzaApp({ circolo }: { circolo: Circolo }) {
  return (
    <div className="admin-card">
      <div className="admin-card-title">Personalizza App</div>
      <p className="admin-card-hint">Colori e logo mostrati ai tuoi soci nell&apos;app e sul sito.</p>

      <div className="superadmin-subtitolo">Tema App</div>
      <SezioneTema circolo={circolo} />

      <div className="superadmin-subtitolo" style={{ marginTop: '1.4rem' }}>Sfondo App</div>
      <SezioneSfondoApp circolo={circolo} />

      <div className="superadmin-subtitolo" style={{ marginTop: '1.4rem' }}>Logo dell&apos;App</div>
      <SezioneLogoInterna circolo={circolo} />
    </div>
  );
}

function SezioneSfondoApp({ circolo }: { circolo: Circolo }) {
  const [salvando, setSalvando] = useState(false);
  const temaAttuale = circolo.sfondoApp ?? 'bianco';

  const scegli = async (chiave: string) => {
    setSalvando(true);
    await aggiornaCircolo(circolo.id, { sfondoApp: chiave });
    setSalvando(false);
  };

  const chiaviChiare = ['bianco', 'latte', 'avorio'];
  const chiaviScure = ['nero', 'bluScuro', 'violaScuro'];

  return (
    <div>
      <p className="admin-card-hint">
        Lo sfondo generale dell&apos;app (dietro le card, che restano sempre bianche e leggibili).
        I temi chiari mantengono i titoli in nero, quelli scuri li mostrano in bianco.
      </p>

      <label className="admin-label" style={{ marginTop: '.6rem' }}>Temi chiari</label>
      <div className="tema-grid">
        {chiaviChiare.map((chiave) => {
          const t = TEMI_SFONDO_APP[chiave];
          const selezionato = temaAttuale === chiave;
          return (
            <button key={chiave} type="button" className="tema-box" onClick={() => scegli(chiave)}>
              <span
                className={`tema-swatch${selezionato ? ' tema-swatch-sel' : ''}`}
                style={{ background: `linear-gradient(160deg, ${t.da}, ${t.a})`, border: '1.5px solid #C9C2B0' }}
              />
              <span className="tema-label">{t.nome}</span>
            </button>
          );
        })}
      </div>

      <label className="admin-label" style={{ marginTop: '.8rem' }}>Temi scuri</label>
      <div className="tema-grid">
        {chiaviScure.map((chiave) => {
          const t = TEMI_SFONDO_APP[chiave];
          const selezionato = temaAttuale === chiave;
          return (
            <button key={chiave} type="button" className="tema-box" onClick={() => scegli(chiave)}>
              <span
                className={`tema-swatch${selezionato ? ' tema-swatch-sel' : ''}`}
                style={{ background: `linear-gradient(160deg, ${t.da}, ${t.a})` }}
              />
              <span className="tema-label">{t.nome}</span>
            </button>
          );
        })}
      </div>
      {salvando && <p className="admin-card-hint" style={{ marginTop: '.3rem' }}>Salvataggio…</p>}
    </div>
  );
}

// 10 temi predefiniti, bicolore — stessi ovunque, nessun colore libero.
// I nomi richiamano i colpi del tennis, in coerenza col resto del brand.
// (placeholder di partenza: la lista definitiva arriverà dal cliente)
const TEMI: { nome: string; primario: string; accento: string }[] = [
  { nome: 'Dritto', primario: '#0E3B2E', accento: '#B0451F' },
  { nome: 'Rovescio', primario: '#16324F', accento: '#E0724B' },
  { nome: 'Smash', primario: '#5C1A2E', accento: '#C9932E' },
  { nome: 'Dropshot', primario: '#0B4F4A', accento: '#E8895F' },
  { nome: 'Slice', primario: '#33312E', accento: '#8B9A4B' },
  { nome: 'Volée', primario: '#3B2A4A', accento: '#4FAE96' },
  { nome: 'Ace', primario: '#151515', accento: '#4A7FB5' },
  { nome: 'Topspin', primario: '#1F4E3D', accento: '#C79A3E' },
  { nome: 'Passante', primario: '#123B4F', accento: '#D98F72' },
  { nome: 'Lob', primario: '#2C3E66', accento: '#C9A227' },
];

function SezioneTema({ circolo }: { circolo: Circolo }) {
  const [salvando, setSalvando] = useState(false);
  const [ok, setOk] = useState(false);

  const scegli = async (tema: { primario: string; accento: string }) => {
    setSalvando(true);
    await aggiornaCircolo(circolo.id, { tema: { primario: tema.primario, accento: tema.accento } });
    setSalvando(false);
    setOk(true);
    setTimeout(() => setOk(false), 1800);
  };

  const eAttuale = (t: { primario: string; accento: string }) =>
    t.primario.toLowerCase() === circolo.tema.primario.toLowerCase()
    && t.accento.toLowerCase() === circolo.tema.accento.toLowerCase();

  return (
    <div>
      <p className="admin-card-hint">
        Un solo clic cambia entrambi i colori insieme, sempre in coppie pensate per
        restare leggibili — stesso identico risultato su ogni dispositivo.
      </p>
      <div className="tema-grid">
        {TEMI.map((t) => {
          const selezionato = eAttuale(t);
          return (
            <button
              key={t.nome} type="button" className="tema-box"
              onClick={() => scegli(t)}
            >
              <span
                className={`tema-swatch${selezionato ? ' tema-swatch-sel' : ''}`}
                style={{ background: `linear-gradient(135deg, ${t.primario} 50%, ${t.accento} 50%)` }}
              >
                {selezionato && <span className="tema-check">✓</span>}
              </span>
              <span className="tema-label">{t.nome}</span>
            </button>
          );
        })}
      </div>
      <span style={{ fontSize: '.75rem', color: 'var(--grigio)' }}>
        {salvando ? 'Salvataggio…' : ok ? 'Salvato ✓' : ''}
      </span>
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
