'use client';

import { useEffect, useState, ReactNode } from 'react';

// Sezione collassabile: intestazione + descrizione, si apre al click.
// Chiusa di default.
//
// Il pulsante a spillo NON apre e NON chiude la sezione: è una preferenza
// indipendente dallo stato attuale. Serve solo a decidere come la sezione
// verrà trovata alla PROSSIMA apertura della Dashboard Admin:
//   spillo attivo  -> alla prossima apertura la sezione sarà già aperta
//   spillo spento  -> alla prossima apertura la sezione sarà chiusa
// La preferenza è salvata nel browser (localStorage).
export default function SezioneCollassabile({
  id, titolo, descrizione, children,
}: { id: string; titolo: string; descrizione: string; children: ReactNode }) {
  const [aperta, setAperta] = useState(false);
  const [fissata, setFissata] = useState(false);

  useEffect(() => {
    try {
      // 'aperta' è il valore usato anche dalle versioni precedenti: resta compatibile.
      const salvato = localStorage.getItem(`admin_sezione_${id}`);
      if (salvato === 'aperta') { setFissata(true); setAperta(true); }
      // 'chiusa' era il vecchio valore per "fissata chiusa": oggi
      // equivale a non avere preferenza, quindi si ripulisce.
      else if (salvato === 'chiusa') localStorage.removeItem(`admin_sezione_${id}`);
    } catch {
      // localStorage non disponibile: resta chiusa di default
    }
  }, [id]);

  // Cambia solo la preferenza per la prossima apertura della Dashboard.
  // Lo stato aperto/chiuso di adesso non viene toccato.
  const toggleFissa = () => {
    const nuovoValore = !fissata;
    setFissata(nuovoValore);
    try {
      if (nuovoValore) localStorage.setItem(`admin_sezione_${id}`, 'aperta');
      else localStorage.removeItem(`admin_sezione_${id}`);
    } catch {
      // se il salvataggio fallisce, la preferenza vale solo per questa sessione
    }
  };

  return (
    <div className="admin-collassa-wrapper">
      {/* L'intestazione non e' piu' un <button> unico: lo spillo e'
          un pulsante a se', e un pulsante dentro un altro pulsante non
          e' HTML valido — da tastiera lo spillo era irraggiungibile e
          lo screen reader leggeva tutto come un'unica etichetta. */}
      <div className={`admin-collassa-header${aperta ? ' aperta' : ''}`}>
        <button
          type="button"
          className="admin-collassa-tocca"
          onClick={() => setAperta((v) => !v)}
          aria-expanded={aperta}
        >
          <div className="admin-collassa-testo">
            <div className="admin-collassa-titolo">{titolo}</div>
            <div className="admin-collassa-descrizione">{descrizione}</div>
          </div>
        </button>
        <button
          type="button"
          className={`admin-collassa-pin${fissata ? ' attivo' : ''}`}
          onClick={toggleFissa}
          title={fissata
            ? 'Alla prossima apertura della Dashboard questa sezione sarà già aperta — clicca per togliere'
            : 'Clicca per trovarla già aperta alla prossima apertura della Dashboard'}
          aria-pressed={fissata}
          aria-label={fissata
            ? `${titolo}: alla prossima apertura della Dashboard sarà già aperta`
            : `${titolo}: alla prossima apertura della Dashboard sarà chiusa`}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z" />
          </svg>
        </button>
        {/* Freccia: stesso comando dell'intestazione, fuori dal giro di
            tabulazione per non annunciare due volte la stessa cosa. */}
        <button
          type="button"
          className="admin-collassa-chevron"
          onClick={() => setAperta((v) => !v)}
          tabIndex={-1}
          aria-hidden="true"
        >
          {aperta ? '▲' : '▼'}
        </button>
      </div>
      {aperta && <div className="admin-collassa-contenuto">{children}</div>}
    </div>
  );
}
