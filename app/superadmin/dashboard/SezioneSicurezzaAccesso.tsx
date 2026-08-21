'use client';

// ============================================================
// SICUREZZA DELL'ACCESSO — la sezione con cui il titolare cambia da
// solo la propria password e sposta la propria email.
//
// ⚠️ PERCHÉ ESISTE, in una riga: senza, l'unico modo di cambiare la
// password del Super Admin era il pulsante «Reimposta password» della
// console Firebase, che manda un'email — e quell'account era stato
// creato su un indirizzo inesistente. La password non si poteva
// cambiare, e quella in uso era finita in chiaro in due file di script.
//
// ⚠️ NON È UNA SEZIONE «DI SERVIZIO», è la prima dell'elenco. Sta in
// cima alla dashboard perché una cosa che si fa una volta l'anno, se è
// sepolta sotto sei sezioni, non si trova il giorno che serve — e
// quel giorno serve in fretta.
//
// ⚠️ Ma nasce CHIUSA come tutte le altre, ed è voluto: aperta di
// default terrebbe tre campi password vuoti in cima allo schermo a
// ogni accesso, davanti a chiunque passi accanto al monitor, per una
// cosa che si fa una volta l'anno. Chi la vuole aperta usa lo spillo.
// ============================================================

import { useState, useEffect, FormEvent } from 'react';
import { User } from 'firebase/auth';
import SezioneCollassabile from '../../admin/dashboard/SezioneCollassabile';
// ⚠️ Il dominio da `data/consenso.ts` e non ricopiato a mano: è l'unico
// posto dove vive. Qui è un suggerimento, non un vincolo — si può
// mettere qualunque indirizzo — ma indicare il dominio ufficiale spinge
// verso un indirizzo aziendale invece che verso una casella personale,
// che per l'account del titolare è la scelta giusta.
import { SITO_NUDO } from '../../../data/consenso';
import {
  MIN_PASSWORD, problemaPassword,
  cambiaPasswordProprio, avviaCambioEmailProprio,
} from '../../../data/sicurezzaAccesso';

export default function SezioneSicurezzaAccesso({ utente }: { utente: User }) {
  // ⚠️ Due moduli, due stati separati e non uno condiviso. Con un solo
  // «errore» e un solo «fatto», il messaggio verde del cambio password
  // restava a schermo mentre si sbagliava l'indirizzo qui sotto, e si
  // leggeva come se fosse andato bene anche il secondo.
  //
  // ⚠️ E ogni tasto premuto azzera ANCHE il verde, non solo il rosso.
  // Separare i due moduli non bastava: dentro lo stesso modulo, chi
  // ricominciava a digitare per un secondo tentativo si trovava ancora
  // davanti «Password cambiata» dal tentativo di prima, e non c'è modo
  // di distinguerlo da una conferma appena arrivata.
  const [pwAttuale, setPwAttuale] = useState('');
  const [pwNuova, setPwNuova] = useState('');
  const [pwConferma, setPwConferma] = useState('');
  const [pwErrore, setPwErrore] = useState('');
  const [pwFatto, setPwFatto] = useState('');
  const [pwCorso, setPwCorso] = useState(false);

  const [emPassword, setEmPassword] = useState('');
  const [emNuova, setEmNuova] = useState('');
  const [emErrore, setEmErrore] = useState('');
  const [emFatto, setEmFatto] = useState('');
  const [emCorso, setEmCorso] = useState(false);
  // ⚠️ Ricopiati in stato locale perché `utente` è una fotografia presa
  // al momento dell'accesso e non si aggiorna più da sola. Chi apre il
  // link di conferma dal telefono e poi torna su questa scheda vedeva
  // ancora l'indirizzo vecchio e «mai verificato»: proprio la schermata
  // che deve dire la verità su quel dato era l'ultima a saperla.
  const [emailMostrata, setEmailMostrata] = useState(utente.email ?? '');
  const [verificata, setVerificata] = useState(utente.emailVerified);

  useEffect(() => {
    // ⚠️ `reload()` va a chiedere al server, non guarda la cache. È una
    // chiamata sola all'apertura della sezione — che nasce chiusa,
    // quindi succede solo quando qualcuno la apre davvero.
    let vivo = true;
    utente.reload()
      .then(() => {
        if (!vivo) return;
        setEmailMostrata(utente.email ?? '');
        setVerificata(utente.emailVerified);
      })
      .catch(() => {
        // Rilettura fallita: restano i valori dell'accesso. Sono
        // vecchi al massimo di una sessione, e dirlo con un allarme
        // sarebbe peggio del dato leggermente stantio.
      });
    return () => { vivo = false; };
  }, [utente]);

  const cambiaPassword = async (e: FormEvent) => {
    e.preventDefault();
    setPwErrore(''); setPwFatto('');
    if (!pwAttuale) { setPwErrore('Scrivi la password attuale.'); return; }
    const problema = problemaPassword(pwNuova, pwAttuale, pwConferma);
    if (problema) { setPwErrore(problema); return; }
    setPwCorso(true);
    try {
      await cambiaPasswordProprio(pwAttuale, pwNuova);
      // ⚠️ I campi si svuotano SUBITO dopo. Una password nuova lasciata
      // in un campo di testo su uno schermo aperto è la stessa password
      // scritta su un foglietto accanto alla tastiera.
      setPwAttuale(''); setPwNuova(''); setPwConferma('');
      // ⚠️ «Vale da adesso» sarebbe una mezza verità. Il cambio
      // invalida i token di rinnovo, ma una sessione già aperta altrove
      // continua a lavorare con il proprio token fino alla scadenza —
      // fino a un'ora. Chi cambia la password perché teme che qualcuno
      // sia entrato deve saperlo, altrimenti chiude il portatile
      // convinto di aver sbattuto fuori qualcuno che invece è ancora
      // dentro.
      setPwFatto(
        'Password cambiata: dal prossimo accesso serve quella nuova. '
        + 'Attenzione: una sessione già aperta su un altro dispositivo può restare attiva ancora per circa un’ora.',
      );
    } catch (err: unknown) {
      setPwErrore(err instanceof Error ? err.message : 'Il cambio password non è riuscito.');
    } finally {
      setPwCorso(false);
    }
  };

  const cambiaEmail = async (e: FormEvent) => {
    e.preventDefault();
    setEmErrore(''); setEmFatto('');
    if (!emPassword) { setEmErrore('Scrivi la password attuale.'); return; }
    if (!emNuova.trim()) { setEmErrore('Scrivi il nuovo indirizzo.'); return; }
    setEmCorso(true);
    try {
      const destinatario = emNuova.trim();
      await avviaCambioEmailProprio(emPassword, destinatario);
      setEmPassword(''); setEmNuova('');
      // ⚠️ «Ho chiesto l'invio» e non «è stato inviato», e la
      // differenza non è pedanteria. Con la protezione
      // anti-enumerazione attiva — ed è il valore predefinito dei
      // progetti Firebase recenti — se il nuovo indirizzo appartiene
      // già a un altro account la chiamata RIESCE senza mandare
      // niente: nessun errore, nessun codice, nessun sintomo. Qui non
      // sappiamo se è partita un'email, sappiamo solo che Firebase non
      // si è lamentato. Affermare l'invio lascerebbe il titolare ad
      // aspettare un messaggio che non esiste, convinto che la
      // procedura sia partita.
      setEmFatto(
        `Ho chiesto a Firebase di mandare il link di conferma a ${destinatario}. Aprilo da quella `
        + 'casella: finché non lo apri non cambia niente e continui a entrare come adesso; dopo '
        + 'averlo aperto dovrai usare il nuovo indirizzo. Se entro qualche minuto non arriva, '
        + 'controlla lo spam, verifica di aver scritto bene l’indirizzo, e tieni presente che se '
        + 'quell’indirizzo appartiene già a un altro account Firebase l’invio non parte — e Firebase '
        + 'non lo segnala.',
      );
    } catch (err: unknown) {
      setEmErrore(err instanceof Error ? err.message : 'Il cambio indirizzo non è riuscito.');
    } finally {
      setEmCorso(false);
    }
  };

  return (
    <SezioneCollassabile
      id="sicurezza-accesso"
      titolo="Sicurezza dell’accesso"
      descrizione="La tua password e l’indirizzo con cui entri"
    >
      <div className="admin-card">
        <div className="admin-card-title">L’account con cui sei entrato</div>
        <p className="admin-card-hint">
          Indirizzo attuale: <strong>{emailMostrata}</strong>
          {verificata ? ' · verificato' : ' · mai verificato'}.
        </p>
        {/* ⚠️ Questo avviso non è decorativo: è il motivo per cui la
            sezione esiste. Un account su una casella che non riceve
            posta non può essere recuperato in nessun modo — né da qui,
            né dalla console, né da Firebase — perché ogni strada di
            recupero passa da un'email. Finché è così, la password
            attuale è l'unica chiave esistente. */}
        {!verificata && (
          <p className="admin-error-text">
            Questo indirizzo non è mai stato verificato. Se dietro non c’è una casella che leggi
            davvero, oggi non hai nessuna strada di recupero: perdendo la password perderesti
            l’accesso alla rete. Spostalo su un indirizzo che ricevi, qui sotto.
          </p>
        )}
      </div>

      <div className="admin-card">
        <div className="admin-card-title">Cambia la password</div>
        <p className="admin-card-hint">
          Serve la password attuale: è quello che impedisce che un computer lasciato aperto
          diventi un cambio di credenziali. Almeno {MIN_PASSWORD} caratteri, con lettere e cifre.
        </p>
        <form onSubmit={cambiaPassword}>
          {/* ⚠️ `autoComplete` esplicito su tutti e tre. Senza, il
              gestore di password del browser riempie i campi nuovi con
              quella vecchia e propone di salvare la vecchia al posto
              della nuova. */}
          <label className="admin-label" htmlFor="pw-attuale">Password attuale</label>
          <input
            id="pw-attuale" className="admin-input" type="password" autoComplete="current-password"
            value={pwAttuale} onChange={(ev) => { setPwAttuale(ev.target.value); setPwErrore(''); setPwFatto(''); }}
          />
          <label className="admin-label" htmlFor="pw-nuova">Nuova password</label>
          <input
            id="pw-nuova" className="admin-input" type="password" autoComplete="new-password"
            value={pwNuova} onChange={(ev) => { setPwNuova(ev.target.value); setPwErrore(''); setPwFatto(''); }}
          />
          <label className="admin-label" htmlFor="pw-conferma">Ripeti la nuova password</label>
          <input
            id="pw-conferma" className="admin-input" type="password" autoComplete="new-password"
            value={pwConferma} onChange={(ev) => { setPwConferma(ev.target.value); setPwErrore(''); setPwFatto(''); }}
          />
          {!!pwErrore && <div className="admin-error-text">{pwErrore}</div>}
          {!!pwFatto && <div className="admin-ok-text">{pwFatto}</div>}
          <button className="admin-btn-full" type="submit" disabled={pwCorso}>
            {pwCorso ? 'Cambio in corso…' : 'Cambia la password'}
          </button>
        </form>
      </div>

      <div className="admin-card">
        <div className="admin-card-title">Sposta l’indirizzo</div>
        {/* ⚠️ Va detto che il link arriva al NUOVO indirizzo, perché è
            proprio la domanda che si fa chi ha una casella vecchia
            morta: «e se non mi arriva?». Non passa dal vecchio: il
            vecchio non viene mai interpellato. */}
        <p className="admin-card-hint">
          Il link di conferma arriva al <strong>nuovo</strong> indirizzo, mai al vecchio: si esce
          così da una casella che non riceve più. Finché non apri quel link non cambia niente e
          continui a entrare come adesso. Usa un indirizzo che leggi davvero — va bene anche un
          semplice inoltro verso la tua posta di sempre.
        </p>
        <form onSubmit={cambiaEmail}>
          {/* ⚠️ «Password attuale» PRIMA, come nel modulo qui sopra.
              Era in fondo, e sulla stessa schermata lo stesso campo
              compariva una volta in cima e una volta in coda: su
              un'operazione che si fa una volta l'anno, quell'incoerenza
              invita a scrivere la password nella casella sbagliata —
              cioè, qui, in un campo di testo in chiaro. */}
          <label className="admin-label" htmlFor="em-password">Password attuale</label>
          <input
            id="em-password" className="admin-input" type="password" autoComplete="current-password"
            value={emPassword} onChange={(ev) => { setEmPassword(ev.target.value); setEmErrore(''); setEmFatto(''); }}
          />
          <label className="admin-label" htmlFor="em-nuova">Nuovo indirizzo</label>
          <input
            id="em-nuova" className="admin-input" type="email" autoComplete="email"
            value={emNuova} onChange={(ev) => { setEmNuova(ev.target.value); setEmErrore(''); setEmFatto(''); }}
            placeholder={`nome@${SITO_NUDO}`}
          />
          {!!emErrore && <div className="admin-error-text">{emErrore}</div>}
          {!!emFatto && <div className="admin-ok-text">{emFatto}</div>}
          <button className="admin-btn-full" type="submit" disabled={emCorso}>
            {emCorso ? 'Invio in corso…' : 'Manda il link di conferma'}
          </button>
        </form>
      </div>
    </SezioneCollassabile>
  );
}
