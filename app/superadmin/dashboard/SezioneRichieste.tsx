'use client';

// ============================================================
// RICHIESTE DI ATTIVAZIONE — i circoli che chiedono di entrare.
//
// ⚠️ IL CESTINO NON E' UN COMODO: e' l'unico modo di togliere una
// richiesta. Il modulo e' pubblico, quindi chi la manda non ha un
// account e non puo' ritirarla, e finche' non c'era il pulsante una
// sola ondata di spazzatura restava in cima all'elenco per sempre —
// sopra le richieste vere, che sono quelle per cui la sezione esiste.
// ============================================================

import { useEffect, useState } from 'react';
import {
  ascoltaRichieste, aggiornaStatoRichiesta, eliminaRichiesta, RichiestaAttivazione,
} from '../../../data/richiesteAttivazione';

// La zona in una riga sola: le richieste nuove hanno regione e
// provincia scelte da un menu, quelle vecchie una citta' scritta a
// mano. Si mostra quello che c'e'.
function zonaDi(r: RichiestaAttivazione): string {
  if (r.provincia || r.regione) return [r.provincia, r.regione].filter(Boolean).join(' · ');
  return r.citta ?? '';
}

function ChiScrive({ r }: { r: RichiestaAttivazione }) {
  const pezzi = [r.referente, r.ruolo].filter(Boolean).join(' · ');
  return (
    <div className="admin-list-sub">
      {pezzi ? `${pezzi} — ` : ''}{r.email}{r.telefono ? ` · ${r.telefono}` : ''}
    </div>
  );
}

export default function SezioneRichieste() {
  const [richieste, setRichieste] = useState<RichiestaAttivazione[]>([]);
  const [daRimuovere, setDaRimuovere] = useState<RichiestaAttivazione | null>(null);
  const [errore, setErrore] = useState('');

  useEffect(() => ascoltaRichieste(setRichieste), []);

  const nuove = richieste.filter((r) => r.stato === 'nuova');
  const gestite = richieste.filter((r) => r.stato !== 'nuova');

  const cestino = (r: RichiestaAttivazione) => (
    <button
      className="admin-icon-btn danger"
      onClick={() => { setErrore(''); setDaRimuovere(r); }}
      aria-label={`Elimina la richiesta di ${r.nomeCircolo}`}
      title="Elimina la richiesta"
    >
      🗑
    </button>
  );

  return (
    <div className="admin-card">
      <div className="admin-card-title">Richieste di attivazione {nuove.length > 0 ? `(${nuove.length} nuove)` : ''}</div>
      <p className="admin-card-hint">
        Arrivano dal form pubblico del sito istituzionale. Il modulo non ha più campi liberi da
        riempire: chi scrive sceglie zona e ruolo e chiede di essere contattato, quindi quello che
        leggi qui è tutto quello che si poteva scrivere.
      </p>

      {richieste.length === 0 && <p className="admin-empty-text">Nessuna richiesta ricevuta finora.</p>}

      {!!errore && <div className="admin-error-text">{errore}</div>}

      {nuove.map((r) => (
        <div key={r.id} className="admin-list-row">
          <div style={{ flex: 1 }}>
            <div className="admin-list-main">
              {r.nomeCircolo}{zonaDi(r) ? ` · ${zonaDi(r)}` : ''}
            </div>
            <ChiScrive r={r} />
            {/* Le richieste vecchie avevano un testo libero: si continua
                a mostrarlo, o quello che è già arrivato sparirebbe. */}
            {r.messaggio && (
              <div className="admin-list-sub" style={{ marginTop: 4, fontStyle: 'italic' }}>&quot;{r.messaggio}&quot;</div>
            )}
          </div>
          <button
            className="admin-btn-small"
            onClick={() => aggiornaStatoRichiesta(r.id, 'contattata')
              .catch(() => setErrore('Non sono riuscito a segnare la richiesta come contattata.'))}
          >
            Segna contattata
          </button>
          {cestino(r)}
        </div>
      ))}

      {gestite.length > 0 && (
        <>
          <label className="admin-label" style={{ marginTop: '1rem' }}>Già gestite</label>
          {gestite.map((r) => (
            <div key={r.id} className="admin-list-row" style={{ opacity: 0.5 }}>
              <div style={{ flex: 1 }}>
                <div className="admin-list-main">
                  {r.nomeCircolo}{zonaDi(r) ? ` · ${zonaDi(r)}` : ''}
                </div>
                <ChiScrive r={r} />
                {/* Anche qui, non solo fra le nuove: bastava un click su
                    «Segna contattata» e il testo di una richiesta
                    vecchia non era più leggibile da nessuna schermata. */}
                {r.messaggio && (
                  <div className="admin-list-sub" style={{ marginTop: 4, fontStyle: 'italic' }}>&quot;{r.messaggio}&quot;</div>
                )}
              </div>
              {cestino(r)}
            </div>
          ))}
        </>
      )}

      {/* ⚠️ Con una conferma, e con il nome scritto dentro. L'elenco è
          ordinato per data e le righe si somigliano tutte: un cestino
          che cancella al primo click, prima o poi, cancella la
          richiesta vera arrivata un minuto prima. */}
      {daRimuovere && (
        <div className="admin-modal-backdrop" onClick={() => setDaRimuovere(null)}>
          <div className="admin-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="admin-card-title">Eliminare la richiesta di {daRimuovere.nomeCircolo}?</div>
            <p className="admin-card-hint">
              Sparisce da questo elenco e non si recupera. Se è un circolo vero, prima segnala
              come contattata: le richieste gestite restano qui sotto.
            </p>
            <div className="admin-row" style={{ gap: '.6rem', marginTop: '.8rem' }}>
              <button className="admin-input" style={{ cursor: 'pointer' }} onClick={() => setDaRimuovere(null)}>
                Indietro
              </button>
              <button
                className="admin-btn-full"
                style={{ background: '#B3261E' }}
                onClick={async () => {
                  const r = daRimuovere;
                  setDaRimuovere(null);
                  try {
                    await eliminaRichiesta(r.id);
                  } catch {
                    setErrore('Non sono riuscito a eliminare la richiesta. Riprova.');
                  }
                }}
              >
                Elimina
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
