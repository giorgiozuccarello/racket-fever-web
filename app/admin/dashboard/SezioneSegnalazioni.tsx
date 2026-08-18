'use client';

// ============================================================
// SEGNALAZIONI — quello che i soci segnalano al circolo.
//
// ⚠️ ARRIVANO QUI E ANCHE A NOI, sempre tutte e due le cose. All'Admin
// perché conosce le persone, sta lì, e può agire subito — sospendere
// una tessera, escludere dalle sfide, parlarci. A Racket Fever perché
// gli store vogliono un processo di moderazione in capo al proprietario
// dell'app, e perché il circolo non può essere giudice in casa propria:
// se il segnalato è il figlio del presidente, la segnalazione deve
// poter arrivare anche altrove.
//
// ⚠️ E L'ADMIN NON PUÒ CANCELLARLE — solo prenderle in carico. Le
// regole gli negano la cancellazione apposta: una segnalazione che il
// circolo può far sparire non è una segnalazione.
// ============================================================

import { useEffect, useState } from 'react';
import { Circolo } from '../../../data/circoli';
import { Segnalazione, testoMotivo } from '../../../data/segnalazioni';
import { ascoltaSegnalazioniCircolo, segnaSegnalazione } from '../../../data/segnalazioniRepo';
import { auth } from '../../../lib/firebase';

function quando(ms?: number): string {
  if (!ms) return '';
  return new Date(ms).toLocaleString('it-IT', {
    day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit',
  });
}

export default function SezioneSegnalazioni({ circolo }: {
  circolo: Circolo;
}) {
  const [segnalazioni, setSegnalazioni] = useState<Segnalazione[]>([]);
  const [errore, setErrore] = useState('');

  useEffect(() => {
    if (!circolo?.id) return;
    return ascoltaSegnalazioniCircolo(circolo.id, setSegnalazioni);
  }, [circolo?.id]);

  const nuove = segnalazioni.filter((s) => s.stato === 'nuova');
  const viste = segnalazioni.filter((s) => s.stato !== 'nuova');

  const segna = async (s: Segnalazione, stato: 'vista' | 'chiusa') => {
    setErrore('');
    try {
      // ⚠️ Chi la prende in carico si legge dall'accesso in corso, non
      // si passa dall'esterno: il profilo del responsabile non porta
      // l'identificativo, e un collaboratore che lavora con la sessione
      // del circolo avrebbe scritto l'identificativo di un altro.
      await segnaSegnalazione(s.id, stato, auth.currentUser?.uid ?? '');
    } catch {
      setErrore('Non sono riuscito ad aggiornare la segnalazione. Riprova.');
    }
  };

  const riga = (s: Segnalazione, spenta: boolean) => (
    <div key={s.id} className="admin-list-row" style={spenta ? { opacity: 0.55 } : undefined}>
      {/* La copia della foto com'era al momento della segnalazione: se
          la persona la cambia un minuto dopo, chi giudica deve poter
          vedere di cosa si stava parlando. */}
      {s.copiaFotoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={s.copiaFotoUrl}
          alt=""
          style={{ width: 46, height: 46, borderRadius: 23, objectFit: 'cover', flexShrink: 0 }}
        />
      ) : (
        <div style={{
          width: 46, height: 46, borderRadius: 23, flexShrink: 0,
          background: 'rgba(14,59,46,.10)',
        }} />
      )}
      <div style={{ flex: 1 }}>
        <div className="admin-list-main">{s.segnalatoNome}</div>
        <div className="admin-list-sub"><strong>{testoMotivo(s.motivo)}</strong></div>
        <div className="admin-list-sub">
          Segnalato da {s.daNome || '—'} · {quando(s.creatoIlMs)}
        </div>
        {(s.copiaRacchetta || s.copiaClassifica) && (
          <div className="admin-list-sub">
            Nella scheda: {[s.copiaRacchetta, s.copiaClassifica].filter(Boolean).join(' · ')}
          </div>
        )}
      </div>
      {s.stato === 'nuova' ? (
        <>
          <button className="admin-btn-small" onClick={() => segna(s, 'vista')}>Presa in carico</button>
          <button className="admin-btn-small" onClick={() => segna(s, 'chiusa')}>Chiudi</button>
        </>
      ) : (
        <span className="admin-list-sub">{s.stato === 'vista' ? 'In carico' : 'Chiusa'}</span>
      )}
    </div>
  );

  return (
    <div>
      <p className="admin-card-hint">
        Un socio può segnalare la scheda di un altro socio dall&apos;app. Le segnalazioni arrivano
        qui e, nello stesso momento, a Racket Fever. Puoi prenderle in carico e chiuderle, ma non
        cancellarle: è la garanzia che chi segnala ha, e vale anche per noi.
      </p>
      <p className="admin-card-hint">
        Cosa puoi fare: parlare con la persona, sospendere la sua tessera dalla sezione Soci,
        oppure rimuoverla dal circolo. Per i casi seri scrivici — le segnalazioni le vediamo anche
        noi e possiamo intervenire sull&apos;account.
      </p>

      {!!errore && <div className="admin-error-text">{errore}</div>}

      {segnalazioni.length === 0 && <p className="admin-empty-text">Nessuna segnalazione.</p>}

      {nuove.map((s) => riga(s, false))}

      {viste.length > 0 && (
        <>
          <label className="admin-label" style={{ marginTop: '1rem' }}>Già guardate</label>
          {viste.map((s) => riga(s, true))}
        </>
      )}
    </div>
  );
}
