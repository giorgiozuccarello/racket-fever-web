'use client';

// ============================================================
// ACCESSO DEL PRESIDENTE — il pronto soccorso, non una comodità.
//
// ⚠️ SERVE QUANDO IL «PASSWORD DIMENTICATA» NON PUÒ FUNZIONARE, e cioè
// quando la casella su cui arriverebbe il link non è raggiungibile:
// indirizzo sbagliato scritto in fase di attivazione, segretario che se
// n'è andato portandosi via la posta, dominio dismesso. In tutti gli
// altri casi il presidente si arrangia da solo dalla schermata di
// accesso, ed è meglio così.
//
// ⚠️ QUI NON SI LEGGE NESSUNA PASSWORD. Dalla Tornata 133 quella del
// presidente non la sa più nessuno tranne lui: non è scritta da nessuna
// parte e non c'è niente da mostrare. Si può solo SOSTITUIRLA, e la
// sostituzione riaccende l'obbligo di sceglierne una nuova al primo
// accesso — così la nostra conoscenza dura il tempo di una telefonata.
//
// ⚠️ LA SPIA «password ancora quella data da noi» È INFORMAZIONE VERA,
// non decorazione: dice se quel presidente è mai entrato davvero. Un
// circolo attivato tre settimane fa che ce l'ha ancora accesa è un
// circolo che non ha mai aperto la dashboard.
// ============================================================

import { useEffect, useState } from 'react';
import {
  AccessoResponsabile, leggiResponsabiliDelCircolo,
  reimpostaAccessoResponsabile, passwordProvvisoria,
} from '../../../data/accessoResponsabile';

export default function SezioneAccessoPresidente({ circoloId }: { circoloId: string }) {
  const [elenco, setElenco] = useState<AccessoResponsabile[]>([]);
  const [caricando, setCaricando] = useState(true);
  const [aperto, setAperto] = useState<string | null>(null);
  const [nuovaEmail, setNuovaEmail] = useState('');
  const [nuovaPassword, setNuovaPassword] = useState('');
  const [inCorso, setInCorso] = useState(false);
  const [errore, setErrore] = useState('');
  const [esito, setEsito] = useState('');

  const ricarica = async () => {
    setCaricando(true);
    try {
      setElenco(await leggiResponsabiliDelCircolo(circoloId));
    } catch {
      setErrore('Non sono riuscito a leggere gli Admin di questo circolo.');
    } finally {
      setCaricando(false);
    }
  };

  useEffect(() => { void ricarica(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [circoloId]);

  const apri = (uid: string) => {
    setAperto(uid);
    setNuovaEmail('');
    setNuovaPassword('');
    setErrore('');
    setEsito('');
  };

  const reimposta = async (uid: string) => {
    if (inCorso) return;
    setErrore('');
    setEsito('');
    if (!nuovaEmail.trim() && !nuovaPassword.trim()) {
      setErrore('Scrivi un indirizzo nuovo, una password provvisoria, oppure tutti e due.');
      return;
    }
    setInCorso(true);
    try {
      const fatto = await reimpostaAccessoResponsabile(uid, nuovaEmail.trim(), nuovaPassword.trim());
      // ⚠️ La password resta a schermo DOPO l'operazione, ed è voluto:
      // è il momento in cui la si detta al telefono. Sparisce chiudendo
      // il riquadro, e non viene scritta da nessuna parte.
      setEsito(
        `Fatto. Accesso con ${fatto.email}`
        + (fatto.passwordCambiata ? ` e password ${nuovaPassword.trim()}` : '')
        + '. Al primo accesso dovrà sceglierne una sua.',
      );
      setNuovaEmail('');
      await ricarica();
    } catch (e: unknown) {
      setErrore((e as { message?: string })?.message ?? 'Non sono riuscito a reimpostare l’accesso.');
    } finally {
      setInCorso(false);
    }
  };

  return (
    <>
      <div className="superadmin-subtitolo">Accesso del presidente</div>
      <p className="admin-card-hint">
        Serve solo quando il presidente non riesce più a entrare <strong>e</strong> non può
        ricevere il link di reimpostazione, perché la sua casella di posta non è più
        raggiungibile. In tutti gli altri casi deve usare «Password dimenticata?» dalla
        schermata di accesso. Qui la password non si legge: si sostituisce con una
        provvisoria, e al primo accesso lui è obbligato a sceglierne una sua.
      </p>

      {caricando && <p className="admin-card-hint">Caricamento…</p>}
      {!caricando && elenco.length === 0 && (
        <p className="admin-card-hint">Questo circolo non ha nessun Admin collegato.</p>
      )}

      {elenco.map((r) => (
        <div key={r.uid} className="sa-accesso-riga">
          <div className="sa-accesso-chi">
            <strong>{r.nome} {r.cognome}</strong>
            <span className="sa-accesso-email">{r.email || '—'}</span>
            {r.passwordDaCambiare && (
              <span className="sa-accesso-spia">password ancora quella data da noi</span>
            )}
          </div>
          {aperto === r.uid ? (
            <div className="sa-accesso-modulo">
              <label className="admin-label" htmlFor={`em-${r.uid}`}>Nuovo indirizzo (facoltativo)</label>
              <input
                id={`em-${r.uid}`} className="admin-input" type="email" autoComplete="off"
                value={nuovaEmail} onChange={(e) => setNuovaEmail(e.target.value)}
                placeholder={r.email}
              />

              <label className="admin-label" htmlFor={`pw-${r.uid}`}>Password provvisoria (facoltativa)</label>
              <div className="admin-row">
                <input
                  id={`pw-${r.uid}`} className="admin-input" type="text" autoComplete="off"
                  value={nuovaPassword} onChange={(e) => setNuovaPassword(e.target.value)}
                  placeholder="Almeno 8 caratteri"
                />
                {/* ⚠️ Facoltativo, come ha chiesto Giorgio: un pulsante
                    che si può usare o ignorare, non un automatismo che
                    sceglie al posto di chi sta compilando. */}
                <button className="admin-btn-small" type="button" onClick={() => setNuovaPassword(passwordProvvisoria())}>
                  Generane una
                </button>
              </div>
              <p className="admin-card-hint">
                La password si vede in chiaro perché va dettata al telefono: non viene salvata da
                nessuna parte e sparisce chiudendo questo riquadro.
              </p>

              {errore && <p className="admin-sic-errore">{errore}</p>}
              {esito && <p className="admin-sic-fatta">{esito}</p>}

              <div className="admin-row" style={{ marginTop: '.8rem' }}>
                <button className="admin-modal-btn-cancel" type="button" onClick={() => setAperto(null)} disabled={inCorso}>
                  Chiudi
                </button>
                <button className="admin-btn-small" type="button" onClick={() => reimposta(r.uid)} disabled={inCorso}>
                  {inCorso ? 'Attendere…' : 'Reimposta l’accesso'}
                </button>
              </div>
            </div>
          ) : (
            <button className="admin-btn-small" type="button" onClick={() => apri(r.uid)}>
              Reimposta
            </button>
          )}
        </div>
      ))}
    </>
  );
}
