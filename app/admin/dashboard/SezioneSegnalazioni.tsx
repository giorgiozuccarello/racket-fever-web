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
import { Segnalazione, chiaveMotivo } from '../../../data/segnalazioni';
import { ascoltaSegnalazioniCircolo, segnaSegnalazione } from '../../../data/segnalazioniRepo';
import { auth } from '../../../lib/firebase';
import { useLingua } from '../../../lib/lingua';
import { ChiaveTesto } from '../../../data/testi';

function quando(ms?: number): string {
  if (!ms) return '';
  return new Date(ms).toLocaleString('it-IT', {
    day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit',
  });
}

export default function SezioneSegnalazioni({ circolo }: {
  circolo: Circolo;
}) {
  const { t } = useLingua();
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
      setErrore(t('adm.seg.erroreAggiorna'));
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
        {/* ⚠️ Su Firestore c'è il CODICE del motivo, non la frase: il
            socio lo sceglie nella sua lingua e l'Admin lo rilegge nella
            sua. `chiaveMotivo` restituisce la chiave del dizionario, e
            la frase nasce qui davanti. */}
        <div className="admin-list-sub"><strong>{t(chiaveMotivo(s.motivo) as ChiaveTesto)}</strong></div>
        <div className="admin-list-sub">
          {t('adm.seg.segnalatoDa', { chi: s.daNome || t('com.nessunDato'), quando: quando(s.creatoIlMs) })}
        </div>
        {(s.copiaRacchetta || s.copiaClassifica) && (
          <div className="admin-list-sub">
            {t('adm.seg.nellaScheda', {
              cosa: [s.copiaRacchetta, s.copiaClassifica].filter(Boolean).join(' · '),
            })}
          </div>
        )}
        {/* ⚠️ I MESSAGGI ALLEGATI, quando c'è di mezzo una chat. Non è un
            permesso di lettura che ci siamo dati: le conversazioni
            restano chiuse a tutti, e questo è solo ciò che la persona ha
            scelto di consegnare premendo «Segnala». Senza, la
            segnalazione di una frase sarebbe un'accusa senza prova. */}
        {!!s.copiaMessaggi && (
          <div className="admin-seg-messaggi">
            <div className="admin-seg-messaggi-titolo">{t('adm.seg.messaggiAllegati')}</div>
            <pre className="admin-seg-messaggi-corpo">{s.copiaMessaggi}</pre>
          </div>
        )}
      </div>
      {s.stato === 'nuova' ? (
        <>
          <button className="admin-btn-small" onClick={() => segna(s, 'vista')}>{t('adm.seg.prendiInCarico')}</button>
          <button className="admin-btn-small" onClick={() => segna(s, 'chiusa')}>{t('com.chiudi')}</button>
        </>
      ) : (
        <span className="admin-list-sub">{s.stato === 'vista' ? t('adm.seg.inCarico') : t('adm.seg.chiusa')}</span>
      )}
    </div>
  );

  return (
    <div>
      <p className="admin-card-hint">{t('adm.seg.hintArrivo')}</p>
      <p className="admin-card-hint">{t('adm.seg.hintCosaPuoiFare')}</p>

      {!!errore && <div className="admin-error-text">{errore}</div>}

      {segnalazioni.length === 0 && <p className="admin-empty-text">{t('adm.seg.nessuna')}</p>}

      {nuove.map((s) => riga(s, false))}

      {viste.length > 0 && (
        <>
          <label className="admin-label" style={{ marginTop: '1rem' }}>{t('adm.seg.giaGuardate')}</label>
          {viste.map((s) => riga(s, true))}
        </>
      )}
    </div>
  );
}
