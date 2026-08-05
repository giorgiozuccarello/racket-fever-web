'use client';

import { useRef, useState } from 'react';
import { Circolo } from '../../../data/circoli';
import { aggiornaCircolo } from '../../../data/circoliRepo';
import { caricaLogoCircolo } from '../../../data/storage';

export default function SezionePersonalizzaApp({ circolo }: { circolo: Circolo }) {
  return (
    <div className="admin-card">
      <div className="admin-card-title">Personalizza App</div>
      <p className="admin-card-hint">
        Il colore dell&apos;app ora si sceglie tra 8 Temi coordinati — il selettore per
        l&apos;Admin arriva a breve; nel frattempo tutti i circoli usano il Tema Bianco
        di default. Qui sotto resta solo il logo.
      </p>

      <div className="superadmin-subtitolo" style={{ marginTop: '.5rem' }}>Logo dell&apos;App</div>
      <SezioneLogoInterna circolo={circolo} />
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
              // Anteprima del logo mancante: il vecchio campo "tema" non
              // esiste piu' (sostituito dagli 8 TEMI_APP), si usa il
              // colore istituzionale.
              background: '#0E3B2E', display: 'flex',
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
