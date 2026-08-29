'use client';

// ============================================================
// CAMBIO PASSWORD DELL'ADMIN DI CIRCOLO.
//
// ⚠️ ESISTE PERCHE' LA PRIMA PASSWORD NON E' SUA. Un circolo nasce con
// le credenziali che gli diamo noi in fase di attivazione: sono scritte
// nel riepilogo dell'onboarding, viaggiano su WhatsApp o su un foglio,
// e finche' restano quelle la password del presidente la conoscono
// almeno due persone.
//
// ⚠️ GEMELLA DELLA SEZIONE DEL SUPER ADMIN, ma non la stessa: li' i
// testi sono in italiano fisso, perche' quel pannello lo guarda solo il
// team. Questa la guarda un presidente che puo' avere l'applicazione in
// inglese o in tedesco, quindi passa dalle traduzioni.
//
// ⚠️ LE REGOLE — quanto lunga, quali caratteri, come si legge ogni
// errore di Firebase — stanno in data/sicurezzaAccesso.ts, gemello
// dell'app. Qui si disegna soltanto: due copie delle stesse regole
// finirebbero, fra un anno, a chiedere due cose diverse.
// ============================================================

import { useState } from 'react';
import { useLingua } from '../../../lib/lingua';
import { auth } from '../../../lib/firebase';
import {
  MIN_PASSWORD, problemaPasswordCodice, cambiaPasswordConEsito,
  chiaveProblemaPassword, chiaveErroreCambioPassword,
} from '../../../data/sicurezzaAccesso';

export default function SezioneSicurezzaAccesso({
  senzaTitolo = false, onCambiata,
}: {
  // Nella schermata del primo accesso il titolo c'e' gia' sopra.
  senzaTitolo?: boolean;
  onCambiata?: () => void;
}) {
  const { t } = useLingua();
  const [attuale, setAttuale] = useState('');
  const [nuova, setNuova] = useState('');
  const [conferma, setConferma] = useState('');
  const [errore, setErrore] = useState('');
  const [fatta, setFatta] = useState(false);
  const [inCorso, setInCorso] = useState(false);

  const cambia = async () => {
    if (inCorso) return;
    setErrore('');
    setFatta(false);

    // ⚠️ Prima i controlli che non costano niente: mandare a Firebase
    // una password che sappiamo gia' troppo corta consuma uno dei
    // tentativi ravvicinati che lui conta, e si finisce bloccati per un
    // errore di battitura.
    const problema = problemaPasswordCodice(nuova, attuale, conferma);
    if (problema) {
      setErrore(t(chiaveProblemaPassword(problema), { n: MIN_PASSWORD }));
      return;
    }

    setInCorso(true);
    const codice = await cambiaPasswordConEsito(attuale, nuova);
    setInCorso(false);

    if (codice) {
      setErrore(t(chiaveErroreCambioPassword(codice), { codice }));
      return;
    }

    // ⚠️ I campi si svuotano subito: restare a schermo con la password
    // nuova scritta in due caselle, su un computer di segreteria, e'
    // esattamente cio' che questa sezione serve a evitare.
    setAttuale(''); setNuova(''); setConferma('');
    setFatta(true);
    onCambiata?.();
  };

  return (
    <div className="admin-card">
      {!senzaTitolo && (
        <>
          <div className="admin-card-title">{t('adm.gen.sez.sicurezza.titolo')}</div>
          <p className="admin-card-hint">{t('adm.sic.intro')}</p>
        </>
      )}
      <p className="admin-card-hint" style={{ fontStyle: 'italic' }}>
        {t('adm.sic.regola', { n: MIN_PASSWORD })}
      </p>

      {/* ⚠️ L'indirizzo in un campo nascosto: senza, i gestori di
          password del browser non sanno a QUALE account appartiene la
          password nuova, e la salvano sotto un'altra voce o non la
          salvano affatto. */}
      <input
        type="text" name="username" autoComplete="username" readOnly hidden
        value={auth.currentUser?.email ?? ''}
      />

      <label className="admin-label" htmlFor="sic-attuale">{t('adm.sic.passwordAttuale')}</label>
      <input
        id="sic-attuale" className="admin-input" type="password" autoComplete="current-password"
        value={attuale} onChange={(e) => setAttuale(e.target.value)}
      />

      <label className="admin-label" htmlFor="sic-nuova">{t('adm.sic.nuovaPassword')}</label>
      <input
        id="sic-nuova" className="admin-input" type="password" autoComplete="new-password"
        value={nuova} onChange={(e) => setNuova(e.target.value)}
      />

      <label className="admin-label" htmlFor="sic-conferma">{t('adm.sic.conferma')}</label>
      <input
        id="sic-conferma" className="admin-input" type="password" autoComplete="new-password"
        value={conferma} onChange={(e) => setConferma(e.target.value)}
      />

      {errore && <p className="admin-sic-errore">{errore}</p>}
      {fatta && <p className="admin-sic-fatta">{t('adm.sic.fatta')}</p>}

      <button className="admin-btn-small" onClick={cambia} disabled={inCorso} style={{ marginTop: '1rem' }}>
        {inCorso ? t('adm.sic.inCorso') : t('adm.sic.cambia')}
      </button>
    </div>
  );
}
