'use client';

import { useEffect, useRef, useState } from 'react';
import {
  Circolo, immaginiSponsor, MAX_IMMAGINI_SPONSOR, INTERVALLI_SPONSOR,
} from '../../../data/circoli';
import { aggiornaCircolo } from '../../../data/circoliRepo';
import { caricaLogoCircolo, caricaSponsorSfide, rimuoviImmagineSponsor, impostaIntervalloSponsor } from '../../../data/storage';

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

      <div className="superadmin-subtitolo" style={{ marginTop: '1.6rem' }}>Sponsor Sfide</div>
      <SezioneSponsorInterna circolo={circolo} />
    </div>
  );
}

// Le immagini dello sponsor, mostrate in cima alla Classifica Sfide e
// in Home sotto le tre caselle dell'app. Da 1 a MAX_IMMAGINI_SPONSOR,
// che si alternano con una dissolvenza.
//
// Nel browser non c'e' un selettore con ritaglio: come per il logo, il
// taglio lo fa il codice prendendo il rettangolo 3:1 piu' grande
// centrato nell'immagine scelta.
function SezioneSponsorInterna({ circolo }: { circolo: Circolo }) {
  // L'indice della riga che sta caricando. Durante un caricamento sono
  // bloccati tutti i pulsanti, "Togli" compreso: ogni operazione
  // rilegge la lista dal documento, la modifica e la riscrive.
  const [inCarico, setInCarico] = useState<number | null>(null);
  const [errore, setErrore] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  // Su quale riga sta agendo il selettore di file, che e' uno solo per
  // tutte le righe: l'input file nativo non si puo' duplicare senza
  // ritrovarsi cinque finestre di sistema aperte.
  const rigaScelta = useRef(0);

  const immagini = immaginiSponsor(circolo);
  // Al massimo UNA riga vuota, e sempre l'ultima. E' la regola che
  // tiene il numero di riga uguale alla posizione nella lista: con due
  // righe vuote e il caricamento fatto nella seconda, l'immagine
  // finirebbe comunque nel primo posto libero e comparirebbe sotto
  // l'etichetta di un'altra riga.
  const [rigaExtra, setRigaExtra] = useState(false);
  const righe = Math.min(MAX_IMMAGINI_SPONSOR, Math.max(1, immagini.length + (rigaExtra ? 1 : 0)));
  // La riga vuota si chiude da sola quando l'immagine e' arrivata: non
  // alla fine del caricamento, ma quando il dato aggiornato torna
  // indietro, o per un attimo la riga sparirebbe e ricomparirebbe.
  const immaginiPrec = useRef(immagini.length);
  useEffect(() => {
    if (immagini.length > immaginiPrec.current) setRigaExtra(false);
    immaginiPrec.current = immagini.length;
  }, [immagini.length]);

  const intervallo = circolo.sponsorSfideIntervallo ?? 0;

  const apriSelettore = (indice: number) => {
    rigaScelta.current = indice;
    inputRef.current?.click();
  };

  const gestisciFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const indice = rigaScelta.current;
    setErrore('');
    setInCarico(indice);
    try {
      await caricaSponsorSfide(circolo.id, file, indice);
    } catch {
      setErrore('Errore durante il caricamento. Riprova.');
    } finally {
      setInCarico(null);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const [rimuovendo, setRimuovendo] = useState(false);
  const occupato = inCarico !== null || rimuovendo;

  const rimuovi = async (indice: number) => {
    if (!confirm('Togliere questo sponsor? Sparisce dalla Home e dalla Classifica di tutti i soci.')) return;
    setErrore('');
    // Bloccato finche' non ha finito: ogni operazione rilegge la lista,
    // la modifica e la riscrive. Due che si accavallano riscrivono
    // ciascuna la versione che aveva letto prima, e una delle due
    // sparisce — nel caso peggiore lo sponsor tolto ricompare.
    setRimuovendo(true);
    try {
      await rimuoviImmagineSponsor(circolo.id, indice);
    } catch {
      setErrore('Non sono riuscito a togliere l’immagine. Riprova.');
    } finally {
      setRimuovendo(false);
    }
  };

  // Il cursore ha una posizione sua, locale, e il valore si salva solo
  // quando lo si lascia andare. In React 'onChange' su un range scatta
  // a ogni scatto del cursore: legandoci la scrittura, un trascinamento
  // da un capo all'altro manderebbe sei scritture su Firestore, e ogni
  // scrittura viene ribattuta a tutti i soci collegati facendo ripartire
  // la rotazione dello sponsor sui loro telefoni.
  const [posizione, setPosizione] = useState(Math.max(0, INTERVALLI_SPONSOR.indexOf(intervallo)));
  useEffect(() => {
    setPosizione(Math.max(0, INTERVALLI_SPONSOR.indexOf(intervallo)));
  }, [intervallo]);

  const salvaIntervallo = async (indice: number) => {
    const secondi = INTERVALLI_SPONSOR[indice] ?? 0;
    if (secondi === intervallo) return;
    setErrore('');
    try {
      await impostaIntervalloSponsor(circolo.id, secondi);
    } catch {
      setErrore('Non sono riuscito a salvare il tempo di cambio. Riprova.');
    }
  };

  return (
    <div>
      <p className="admin-card-hint">
        Compare in cima alla Classifica Sfide e in Home, sotto le tre caselle. Serve
        un&apos;immagine larga tre volte la sua altezza — l&apos;ideale e&apos; 1200x400
        pixel. Se le proporzioni sono diverse viene ritagliata dal centro. Puoi
        caricarne fino a {MAX_IMMAGINI_SPONSOR}: si alternano da sole.
      </p>

      {Array.from({ length: righe }, (_, indice) => {
        const url = immagini[indice];
        return (
          <div key={indice} className="sponsor-riga">
            <div className="sponsor-riga-testata">
              <span className="sponsor-riga-numero">Sponsor {indice + 1}</span>
              {url && (
                <button
                  type="button" className="sponsor-riga-togli"
                  onClick={() => rimuovi(indice)} disabled={occupato}
                >
                  Togli
                </button>
              )}
            </div>
            {url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={url} alt={`Sponsor ${indice + 1}`} className="sponsor-anteprima" />
            ) : (
              <div className="sponsor-anteprima sponsor-anteprima-vuota">Nessuno sponsor</div>
            )}
            <button
              className="admin-btn-full"
              style={{ marginTop: '.6rem' }}
              onClick={() => apriSelettore(indice)}
              disabled={occupato}
            >
              {inCarico === indice ? 'Caricamento…' : url ? 'Cambia immagine' : 'Carica immagine'}
            </button>
          </div>
        );
      })}

      {/* Il "+" compare solo se non c'e' gia' una riga vuota da
          riempire: e' l'altra meta' della regola "al massimo una riga
          vuota". Si guarda le righe davvero disegnate e non il flag,
          perche' un circolo senza nessuno sponsor la riga vuota ce l'ha
          gia' — e li' il "+" non deve comparire affatto. */}
      {righe === immagini.length && righe < MAX_IMMAGINI_SPONSOR && (
        <button type="button" className="sponsor-aggiungi" onClick={() => setRigaExtra(true)}>
          + Aggiungi immagine
        </button>
      )}

      {errore && <div className="admin-error-text">{errore}</div>}

      <input
        ref={inputRef} type="file" accept="image/*"
        onChange={gestisciFile} style={{ display: 'none' }}
      />

      <p className="admin-card-hint" style={{ marginTop: '1.4rem', marginBottom: '.4rem' }}>
        Ogni quanto cambia lo sponsor mostrato. Con una sola immagine non c&apos;e&apos;
        niente da alternare e il tempo non ha effetto.
      </p>
      <div className="sponsor-timer">
        <input
          type="range"
          min={0}
          max={INTERVALLI_SPONSOR.length - 1}
          step={1}
          value={posizione}
          disabled={immagini.length < 2}
          onChange={(e) => setPosizione(Number(e.target.value))}
          onPointerUp={() => salvaIntervallo(posizione)}
          onKeyUp={() => salvaIntervallo(posizione)}
        />
        <span className="sponsor-timer-valore">
          {INTERVALLI_SPONSOR[posizione] === 0 ? 'Fisso' : `${INTERVALLI_SPONSOR[posizione]} secondi`}
        </span>
      </div>
      {immagini.length > 1 && intervallo === 0 && (
        <div className="admin-error-text">
          Con piu&apos; immagini il tempo non puo&apos; restare su Fisso: si vedrebbe solo
          la prima. Spostalo per scegliere ogni quanto cambiano.
        </div>
      )}
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
