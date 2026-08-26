'use client';

import { useEffect, useState, ReactNode } from 'react';
import { useLingua } from '../../../lib/lingua';

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
  id, titolo, descrizione, children, apertaDiPartenza,
}: {
  // ⚠️ `titolo` e `descrizione` arrivano GIA' TRADOTTI da chi monta la
  // sezione (la dashboard li prende da `t('adm.gen.sez.<id>.…')`). Qui
  // si traducono solo le frasi che nascono dentro questo componente —
  // i due testi dello spillo — e il titolo si riusa come valore.
  id: string; titolo: string; descrizione: string; children: ReactNode;
  // ⚠️ Aperta al primo avvio, e serve a una sola sezione: la
  // Panoramica. Tutte nascono chiuse — sono venticinque — ma quella e'
  // la prima cosa da guardare, e chi aveva fissato «Soci» e «Debiti»
  // se le ritrova dentro: nascendo chiusa la Panoramica, quelle due
  // sembravano sparite e lo spillo sembrava rotto.
  apertaDiPartenza?: boolean;
}) {
  const { t } = useLingua();
  const [aperta, setAperta] = useState(!!apertaDiPartenza);
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
        {/* ⚠️ Niente spillo dove la sezione si apre comunque. Lo
            spillo dice una cosa sola — «come la trovi la prossima
            volta» — e sulla Panoramica quella risposta e' «aperta» in
            ogni caso: spento avrebbe annunciato «sarà chiusa», che e'
            falso, e acceso avrebbe promesso una preferenza che non sta
            salvando niente. Un comando che non cambia niente e mente
            sull'esito e' peggio di un comando assente. */}
        {!apertaDiPartenza && <button
          type="button"
          className={`admin-collassa-pin${fissata ? ' attivo' : ''}`}
          onClick={toggleFissa}
          title={fissata
            ? t('adm.col.spilloAttivoTitolo')
            : t('adm.col.spilloSpentoTitolo')}
          aria-pressed={fissata}
          aria-label={fissata
            ? t('adm.col.spilloAttivoEtichetta', { sezione: titolo })
            : t('adm.col.spilloSpentoEtichetta', { sezione: titolo })}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z" />
          </svg>
        </button>}
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
