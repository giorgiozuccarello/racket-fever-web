'use client';

// ============================================================
// SEGNALAZIONI DI RETE — quelle di tutti i circoli.
//
// ⚠️ ESISTE PERCHÉ GLI STORE PRETENDONO UN PROCESSO IN CAPO A NOI, non
// al circolo. Apple lo chiede a chiare lettere per le app con contenuti
// degli utenti: un modo di segnalare e una risposta in tempi rapidi da
// parte di chi pubblica l'app. Se l'unica destinazione fosse l'Admin
// del circolo, quella richiesta non sarebbe soddisfatta — e nel caso
// che conta davvero, cioè quando il problema è dentro al circolo, non
// ci sarebbe nessuno a cui rivolgersi.
//
// ⚠️ E LE CANCELLIAMO SOLO NOI. L'Admin del circolo può prenderle in
// carico e chiuderle, non farle sparire.
// ============================================================

import { useEffect, useState } from 'react';
import { Segnalazione, chiaveMotivo } from '../../../data/segnalazioni';
import { ChiaveTesto, traduci } from '../../../data/testi';

// ⚠️ ITALIANO FISSO, E NON È UNA DIMENTICANZA. Il pannello del Super
// Admin non ha selettore della lingua e non lo avrà: lo guarda il team
// Racket Fever, che scrive e parla italiano. Il motivo di una
// segnalazione però su Firestore è salvato come CODICE — l'ha scelto un
// socio che poteva avere l'app in tedesco — quindi qui va riletto dal
// dizionario, chiedendogli l'italiano e basta.
const motivoInItaliano = (codice: string | null | undefined) => traduci('it', chiaveMotivo(codice) as ChiaveTesto);
import { ascoltaTutteLeSegnalazioni, segnaSegnalazione } from '../../../data/segnalazioniRepo';
import { ascoltaCircoli } from '../../../data/circoliRepo';
import { Circolo } from '../../../data/circoli';
import { auth } from '../../../lib/firebase';

function quando(ms?: number): string {
  if (!ms) return '';
  return new Date(ms).toLocaleString('it-IT', {
    day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit',
  });
}

export default function SezioneSegnalazioni() {
  const [segnalazioni, setSegnalazioni] = useState<Segnalazione[]>([]);
  const [circoli, setCircoli] = useState<Circolo[]>([]);
  const [errore, setErrore] = useState('');
  const [soloNuove, setSoloNuove] = useState(true);

  useEffect(() => ascoltaTutteLeSegnalazioni(setSegnalazioni), []);
  useEffect(() => ascoltaCircoli(setCircoli), []);

  const nomeCircolo = (id: string) => circoli.find((c) => c.id === id)?.nome ?? id;

  const nuove = segnalazioni.filter((s) => s.stato === 'nuova');
  const mostrate = soloNuove ? nuove : segnalazioni;

  const segna = async (s: Segnalazione, stato: 'vista' | 'chiusa') => {
    setErrore('');
    try {
      await segnaSegnalazione(s.id, stato, auth.currentUser?.uid ?? '');
    } catch {
      setErrore('Non sono riuscito ad aggiornare la segnalazione.');
    }
  };

  return (
    <div className="admin-card">
      <div className="admin-card-title">
        Segnalazioni {nuove.length > 0 ? `(${nuove.length} da guardare)` : ''}
      </div>
      <p className="admin-card-hint">
        Arrivano dall&apos;app: un socio segnala la scheda di un altro socio. Le vede anche
        l&apos;Admin del circolo, che può prenderle in carico — ma non cancellarle. Qui c&apos;è
        la rete intera, perché quando il problema riguarda il circolo stesso non c&apos;è nessun
        altro a cui possa arrivare.
      </p>

      <button
        type="button"
        className="admin-input"
        style={{ width: 'auto', cursor: 'pointer', marginBottom: '.6rem' }}
        onClick={() => setSoloNuove((v) => !v)}
      >
        {soloNuove ? 'Mostra anche quelle già guardate' : 'Mostra solo le nuove'}
      </button>

      {!!errore && <div className="admin-error-text">{errore}</div>}
      {mostrate.length === 0 && <p className="admin-empty-text">Niente da guardare.</p>}

      {mostrate.map((s) => (
        <div
          key={s.id}
          className="admin-list-row"
          style={s.stato === 'nuova' ? undefined : { opacity: 0.55 }}
        >
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
            <div className="admin-list-main">
              {s.segnalatoNome} · <span style={{ fontWeight: 400 }}>{nomeCircolo(s.circoloId)}</span>
            </div>
            <div className="admin-list-sub"><strong>{motivoInItaliano(s.motivo)}</strong></div>
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
      ))}
    </div>
  );
}
