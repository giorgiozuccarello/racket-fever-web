'use client';

import { useEffect, useState, ReactNode } from 'react';

// Sezione collassabile: intestazione + descrizione, si apre al click.
// Chiusa di default. Il pulsante a spillo salva la preferenza nel
// browser (localStorage) — se attivo, la sezione ricorda lo stato
// aperto/chiuso anche alla prossima visita.
export default function SezioneCollassabile({
  id, titolo, descrizione, children,
}: { id: string; titolo: string; descrizione: string; children: ReactNode }) {
  const [aperta, setAperta] = useState(false);
  const [fissata, setFissata] = useState(false);

  useEffect(() => {
    try {
      const salvato = localStorage.getItem(`admin_sezione_${id}`);
      if (salvato === 'aperta') { setAperta(true); setFissata(true); }
      else if (salvato === 'chiusa') { setAperta(false); setFissata(true); }
    } catch {
      // localStorage non disponibile: resta chiusa di default
    }
  }, [id]);

  const toggleFissa = () => {
    const nuovoValore = aperta ? 'chiusa' : 'aperta';
    setFissata(true);
    setAperta(!aperta);
    try {
      localStorage.setItem(`admin_sezione_${id}`, nuovoValore);
    } catch {
      // se il salvataggio fallisce, il toggle resta comunque valido per questa sessione
    }
  };

  return (
    <div className="admin-collassa-wrapper">
      <button type="button" className="admin-collassa-header" onClick={() => setAperta((v) => !v)}>
        <div className="admin-collassa-testo">
          <div className="admin-collassa-titolo">{titolo}</div>
          <div className="admin-collassa-descrizione">{descrizione}</div>
        </div>
        <span
          className={`admin-collassa-pin${fissata ? ' fissata' : ''}`}
          onClick={(e) => { e.stopPropagation(); toggleFissa(); }}
          title={fissata ? (aperta ? 'Sempre aperta — clicca per fissare chiusa' : 'Sempre chiusa — clicca per fissare aperta') : 'Fissa questo stato per la prossima volta'}
          role="button"
        >
          📌
        </span>
        <span className="admin-collassa-chevron">{aperta ? '▲' : '▼'}</span>
      </button>
      {aperta && <div className="admin-collassa-contenuto">{children}</div>}
    </div>
  );
}
