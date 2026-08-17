'use client';

import { useEffect, useRef, useState } from 'react';
import {
  Circolo, immaginiSponsor, MAX_IMMAGINI_SPONSOR, INTERVALLI_SPONSOR,
  durateSponsor, sponsorFisso, DURATA_SPONSOR_MINIMA, linkSponsor,
} from '../../../data/circoli';
import { normalizzaLinkBanner, erroreLink, MAX_LUNGHEZZA_LINK } from '../../../data/linkBanner';
import { aggiornaCircolo } from '../../../data/circoliRepo';
import {
  caricaLogoCircolo, caricaSponsorSfide, rimuoviImmagineSponsor, impostaDurataSponsor,
  spostaImmagineSponsor, impostaLinkSponsor,
} from '../../../data/storage';

export default function SezionePersonalizzaApp({ circolo }: { circolo: Circolo }) {
  return (
    <div className="admin-card">
      <div className="admin-card-title">Personalizza App</div>
      <p className="admin-card-hint">
        Il colore dell&apos;app ora si sceglie tra 8 Temi coordinati — il selettore per
        l&apos;Admin arriva a breve; nel frattempo tutti i circoli usano il Tema Bianco
        di default. Qui resta il logo; i banner degli sponsor hanno una sezione loro,
        qui sotto.
      </p>

      <div className="superadmin-subtitolo" style={{ marginTop: '.5rem' }}>Logo dell&apos;App</div>
      <SezioneLogoInterna circolo={circolo} />
    </div>
  );
}

// ⚠️ I BANNER HANNO UNA SEZIONE LORO, e prima stavano in fondo a
// «Personalizza App» sotto il logo. Non e' un riordino estetico: quello
// e' il posto dove il circolo VENDE, ci torna ogni volta che cambia uno
// sponsor, e deve trovarlo per nome invece di ricordarsi che sta sotto
// il logo.
export function SezioneBannerMarketing({ circolo }: { circolo: Circolo }) {
  return (
    <div className="admin-card">
      <div className="admin-card-title">Banner Marketing</div>
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

  const durate = durateSponsor(circolo);
  // Gli indirizzi dei siti, uno per banner e nello stesso ordine.
  const linkDeiBanner = linkSponsor(circolo);
  // L'indice del banner che si e' preso la scena, se c'e'.
  const iFisso = sponsorFisso(circolo);

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
    } catch (e: any) {
      // Il messaggio vero, quando c'e': «questa GIF pesa 6,2 MB» dice
      // cosa fare, «errore durante il caricamento» no.
      setErrore(e?.message ?? 'Errore durante il caricamento. Riprova.');
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
  // Una posizione per riga, ora che ogni banner ha il suo tempo.
  const [posizioni, setPosizioni] = useState<number[]>([]);
  const chiaveDurate = durate.join('|');
  useEffect(() => {
    // ⚠️ Non trovato = FONDO SCALA, non zero. Lo zero e' «Fisso», cioe'
    // il contrario di una durata lunga: una durata vecchia fuori scala
    // faceva comparire «Fisso — solo questo» su un banner che invece
    // girava, e l'avviso in cima — che legge il dato vero — non
    // compariva. Il pannello si contraddiceva da solo.
    setPosizioni(durate.map((d) => {
      const posizione = INTERVALLI_SPONSOR.indexOf(d);
      return posizione >= 0 ? posizione : INTERVALLI_SPONSOR.length - 1;
    }));
    // La dipendenza e' la stringa e non l'array: un array nuovo a ogni
    // disegno rimetterebbe i cursori a posto in continuazione, anche
    // mentre l'Admin ne sta trascinando uno.
  }, [chiaveDurate]);

  const salvaDurata = async (indice: number, posizione: number) => {
    const secondi = INTERVALLI_SPONSOR[posizione] ?? 0;
    if (secondi === durate[indice]) return;
    setErrore('');
    try {
      await impostaDurataSponsor(circolo.id, indice, secondi);
    } catch {
      setErrore('Non sono riuscito a salvare il tempo di questo sponsor. Riprova.');
    }
  };

  const sposta = async (indice: number, verso: -1 | 1) => {
    setErrore('');
    setRimuovendo(true);
    try {
      await spostaImmagineSponsor(circolo.id, indice, verso);
    } catch {
      setErrore('Non sono riuscito a spostare lo sponsor. Riprova.');
    } finally {
      setRimuovendo(false);
    }
  };

  return (
    <div>
      <p className="admin-card-hint">
        Compare in cima alla Classifica Sfide e in Home, sotto le tre caselle. Serve
        un&apos;immagine larga tre volte la sua altezza — l&apos;ideale e&apos; 1200x400
        pixel. Se le proporzioni sono diverse viene ritagliata dal centro. Puoi
        caricarne fino a {MAX_IMMAGINI_SPONSOR}: si alternano da sole, ognuna per il
        tempo che le dai qui sotto. Le frecce spostano lo sponsor nell&apos;ordine di
        rotazione — il Main Sponsor va in cima.
      </p>
      <p className="admin-card-hint">
        Vanno bene JPEG, PNG, WebP e GIF, anche animate. Una GIF non viene ritagliata:
        entra così com&apos;è e il riquadro le taglia i bordi, quindi tieni logo e
        scritte al centro. Massimo 2 MB.
      </p>

      {iFisso >= 0 && (
        <div className="sponsor-nota-fisso">
          Lo Sponsor {iFisso + 1} è a Fisso: fra i tuoi resta l&apos;unico visibile e gli
          altri non compaiono. Riportalo ad almeno {DURATA_SPONSOR_MINIMA} secondi per rimettere
          in gioco tutti.
        </div>
      )}

      {Array.from({ length: righe }, (_, indice) => {
        const url = immagini[indice];
        const durata = durate[indice] ?? 0;
        // Con uno sponsor a Fisso gli altri sono fuori gioco: i loro
        // comandi si spengono, cosi' si vede che non e' un guasto.
        const spento = iFisso >= 0 && iFisso !== indice;
        return (
          <div key={indice} className="sponsor-riga" style={spento ? { opacity: 0.55 } : undefined}>
            <div className="sponsor-riga-testata">
              <span className="sponsor-riga-numero">Sponsor {indice + 1}</span>
              <span style={{ display: 'flex', gap: '.35rem', alignItems: 'center' }}>
                {url && immagini.length > 1 && (
                  <>
                    <button
                      type="button" className="sponsor-riga-ordine"
                      onClick={() => sposta(indice, -1)}
                      disabled={occupato || indice === 0}
                      aria-label="Sposta questo sponsor più in alto"
                    >
                      ↑
                    </button>
                    <button
                      type="button" className="sponsor-riga-ordine"
                      onClick={() => sposta(indice, 1)}
                      disabled={occupato || indice >= immagini.length - 1}
                      aria-label="Sposta questo sponsor più in basso"
                    >
                      ↓
                    </button>
                  </>
                )}
                {url && (
                  <button
                    type="button" className="sponsor-riga-togli"
                    onClick={() => rimuovi(indice)} disabled={occupato}
                  >
                    Togli
                  </button>
                )}
              </span>
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

            {url && (
              <div className="sponsor-timer" style={{ marginTop: '.6rem' }}>
                <input
                  type="range"
                  min={0}
                  max={INTERVALLI_SPONSOR.length - 1}
                  step={1}
                  value={posizioni[indice] ?? 0}
                  disabled={occupato || spento}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    setPosizioni((prec) => prec.map((p, i) => (i === indice ? v : p)));
                  }}
                  onPointerUp={() => salvaDurata(indice, posizioni[indice] ?? 0)}
                  onKeyUp={() => salvaDurata(indice, posizioni[indice] ?? 0)}
                  aria-label={`Durata dello sponsor ${indice + 1}, in secondi`}
                />
                <span className="sponsor-timer-valore">
                  {(INTERVALLI_SPONSOR[posizioni[indice] ?? 0] ?? 0) === 0
                    ? 'Fisso — solo questo'
                    : `${INTERVALLI_SPONSOR[posizioni[indice] ?? 0]} secondi`}
                  {spento ? ' · non visibile' : ''}
                </span>
              </div>
            )}

            {url && (
              <CasellaLinkSponsor
                circoloId={circolo.id}
                indice={indice}
                valore={linkDeiBanner[indice] ?? ''}
                immagine={url}
                bloccato={occupato}
              />
            )}
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
        ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif"
        onChange={gestisciFile} style={{ display: 'none' }}
      />

    </div>
  );
}

// ============================================================
// LA CASELLA DEL SITO DELLO SPONSOR.
//
// ⚠️ HA UNA COPIA SUA DEL TESTO, e non scrive a ogni lettera. Legata
// direttamente a Firestore, ogni carattere battuto sarebbe stato una
// scrittura ribattuta a tutti i soci collegati — e la fascia sarebbe
// ripartita da capo sui loro telefoni mentre l'Admin scrive
// l'indirizzo. Si salva quando si esce dal campo, esattamente come il
// cursore della durata si salva quando lo si lascia andare.
//
// ⚠️ E SI RIALLINEA quando il valore vero cambia: dopo il salvataggio
// torna l'indirizzo NORMALIZZATO — scritto «www.sponsor.it», nel campo
// compare «https://www.sponsor.it» — ed e' giusto che l'Admin veda
// quello che e' stato scritto davvero.
// ============================================================
function CasellaLinkSponsor({ circoloId, indice, valore, immagine, bloccato }: {
  circoloId: string; indice: number; valore: string; immagine: string; bloccato: boolean;
}) {
  const [testo, setTesto] = useState(valore);
  const [salvando, setSalvando] = useState(false);
  const [errore, setErrore] = useState('');
  useEffect(() => { setTesto(valore); setErrore(''); }, [valore]);

  const salva = async () => {
    const buono = normalizzaLinkBanner(testo);
    const problema = erroreLink(testo);
    if (problema) {
      setErrore(problema);
      return;
    }
    setErrore('');
    if (buono === valore) return;
    setSalvando(true);
    try {
      await impostaLinkSponsor(circoloId, indice, testo, immagine);
    } catch (e: any) {
      setErrore(e?.message ?? 'Non sono riuscito a salvare l’indirizzo. Riprova.');
      setTesto(valore);
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div style={{ marginTop: '.6rem' }}>
      <input
        className="admin-input"
        type="url"
        value={testo}
        maxLength={MAX_LUNGHEZZA_LINK}
        disabled={bloccato || salvando}
        onChange={(e) => setTesto(e.target.value)}
        onBlur={salva}
        onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
        placeholder="Sito dello sponsor (facoltativo)"
        aria-label={`Indirizzo del sito dello sponsor ${indice + 1}`}
      />
      {errore
        ? <div className="admin-error-text">{errore}</div>
        : (
          <p className="admin-card-hint" style={{ marginTop: '.25rem' }}>
            {salvando
              ? 'Salvo…'
              : valore
                ? 'Il socio che tocca il banner viene avvisato e poi esce sul browser.'
                : 'Vuoto: il banner resta un cartellone e non si può toccare.'}
          </p>
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
