'use client';

import { useEffect, useState } from 'react';
import {
  creaCircoloConAdmin, ONBOARDING_ACCOUNT_ORFANO, ONBOARDING_CIRCOLO_SENZA_ADMIN,
} from '../../../data/onboarding';
import { REGIONI_ITALIA, provinceDi } from '../../../data/tornei';
import { ascoltaRichieste, RichiestaAttivazione } from '../../../data/richiesteAttivazione';
import SezioneCollassabile from '../../admin/dashboard/SezioneCollassabile';

interface Credenziali {
  nomeCircolo: string;
  passwordCircolo: string;
  emailAdmin: string;
  passwordAdmin: string;
}

export default function SezioneOnboarding() {
  const [nomeCircolo, setNomeCircolo] = useState('');
  const [citta, setCitta] = useState('');
  const [sigla, setSigla] = useState('');
  const [regione, setRegione] = useState('');
  const [provincia, setProvincia] = useState('');
  const [comune, setComune] = useState('');
  const [passwordCircolo, setPasswordCircolo] = useState('');
  const [nomeAdmin, setNomeAdmin] = useState('');
  const [cognomeAdmin, setCognomeAdmin] = useState('');
  const [emailAdmin, setEmailAdmin] = useState('');
  const [passwordAdmin, setPasswordAdmin] = useState('');
  const [errore, setErrore] = useState('');
  const [creando, setCreando] = useState(false);
  const [successo, setSuccesso] = useState<Credenziali | null>(null);

  // ============================================================
  // DA QUALE RICHIESTA NASCE QUESTO CIRCOLO.
  //
  // ⚠️ IL COLLEGAMENTO NON ESISTEVA, e senza di lui due cose non
  // funzionavano affatto. Il codice per scriverlo c'era — l'onboarding
  // accetta un `richiestaId` da sempre — ma nessuna schermata glielo
  // passava, quindi: nessuna richiesta e' mai passata da sola allo
  // stato «attivata» (restavano tutte «nuova» finche' qualcuno non
  // cliccava a mano), e l'eliminazione di un circolo non poteva
  // portarsi via la richiesta da cui era nato, perche' il filo per
  // trovarla non era mai stato annodato.
  // ============================================================
  const [richieste, setRichieste] = useState<RichiestaAttivazione[]>([]);
  const [richiestaId, setRichiestaId] = useState('');
  useEffect(() => ascoltaRichieste(setRichieste), []);
  const daContattare = richieste.filter((r) => r.stato === 'nuova');

  // Scegliendo la richiesta il modulo si riempie da solo con quello che
  // il circolo ha gia' scritto: e' anche il modo di non ribattere a
  // mano un'anagrafica che e' gia' arrivata giusta, visto che regione e
  // provincia le ha scelte da un menu.
  const prendiDallaRichiesta = (id: string) => {
    setRichiestaId(id);
    const r = richieste.find((x) => x.id === id);
    if (!r) return;
    setNomeCircolo(r.nomeCircolo ?? '');
    if (r.regione) setRegione(r.regione);
    if (r.provincia) setProvincia(r.provincia);
    if (r.citta) setCitta(r.citta);
    setRichiedenteNome(r.referente ?? '');
    setRichiedenteRuolo(r.ruolo ?? '');
    setRichiedenteEmail(r.email ?? '');
    setRichiedenteTelefono(r.telefono ?? '');
    if (r.referente || r.ruolo || r.email) setAnagraficaAperta(true);
  };

  // ---- Anagrafica di rete ----
  // Sta dietro un interruttore perche' non sempre si sa gia' tutto al
  // momento della creazione: chi chiede l'adesione spesso non e' chi
  // firma, e il contratto firmato arriva dopo. Si puo' completare in
  // qualsiasi momento dalla scheda del circolo.
  const [anagraficaAperta, setAnagraficaAperta] = useState(false);
  const [richiedenteNome, setRichiedenteNome] = useState('');
  const [richiedenteRuolo, setRichiedenteRuolo] = useState('');
  const [richiedenteEmail, setRichiedenteEmail] = useState('');
  const [richiedenteTelefono, setRichiedenteTelefono] = useState('');
  const [firmatarioNome, setFirmatarioNome] = useState('');
  const [firmatarioRuolo, setFirmatarioRuolo] = useState('');
  const [firmaIl, setFirmaIl] = useState('');
  const [noteInterne, setNoteInterne] = useState('');

  const reset = () => {
    setNomeCircolo(''); setCitta(''); setSigla(''); setRegione(''); setPasswordCircolo('');
    // ⚠️ Anche provincia e comune, che restavano indietro: creato un
    // circolo, il successivo partiva con la provincia del precedente
    // gia' selezionata — e l'anagrafica di rete decide dove arrivano i
    // banner venduti su una zona.
    setProvincia(''); setComune(''); setRichiestaId('');
    setNomeAdmin(''); setCognomeAdmin(''); setEmailAdmin(''); setPasswordAdmin('');
    setRichiedenteNome(''); setRichiedenteRuolo(''); setRichiedenteEmail(''); setRichiedenteTelefono('');
    setFirmatarioNome(''); setFirmatarioRuolo(''); setFirmaIl(''); setNoteInterne('');
    setAnagraficaAperta(false);
  };

  const crea = async () => {
    setErrore('');
    if (!nomeCircolo.trim() || !citta.trim() || !sigla.trim() || !passwordCircolo.trim()) {
      setErrore('Compila tutti i campi del circolo.');
      return;
    }
    // ⚠️ La regione e' obbligatoria alla nascita, e non era cosi': i
    // circoli creati prima ne sono senza, e nella bacheca Tornei —
    // l'unica cosa che attraversa i circoli — non compaiono a nessuno
    // finche' non gliela si scrive a mano.
    if (!provincia) {
      // Obbligatoria come la regione, e per lo stesso motivo: senza,
      // il circolo non riceve i banner venduti sulla sua provincia e i
      // suoi tornei non compaiono a chi filtra per provincia. E non
      // puo' aggiungersela da solo.
      setErrore('Scegli la provincia: senza, il circolo non risulta in nessuna zona.');
      return;
    }
    if (!regione) {
      setErrore('Scegli la regione: serve ai Tornei per far trovare il circolo.');
      return;
    }
    if (!nomeAdmin.trim() || !cognomeAdmin.trim() || !emailAdmin.trim() || !passwordAdmin) {
      setErrore("Compila tutti i campi dell'Admin Circolo.");
      return;
    }
    if (passwordAdmin.length < 6) {
      setErrore("La password dell'Admin deve avere almeno 6 caratteri.");
      return;
    }
    setCreando(true);
    try {
      await creaCircoloConAdmin({
        nomeCircolo, citta, sigla, regione, provincia, comune, passwordCircolo,
        nomeAdmin, cognomeAdmin, emailAdmin, passwordAdmin,
        richiedenteNome, richiedenteRuolo, richiedenteEmail, richiedenteTelefono,
        firmatarioNome, firmatarioRuolo, firmaIl, noteInterne,
        richiestaId,
      });
      setSuccesso({ nomeCircolo, passwordCircolo, emailAdmin, passwordAdmin });
      reset();
    } catch (err: any) {
      if (err.code === 'auth/email-already-in-use') {
        setErrore('Esiste già un account con questa email.');
      } else if (err.code === 'auth/weak-password') {
        setErrore('Password troppo debole.');
      } else if (err.message === ONBOARDING_ACCOUNT_ORFANO) {
        setErrore(
          "L'account dell'Admin è stato creato, ma il circolo no. Riprovando con la stessa "
          + "email otterrai «esiste già un account»: usa un'altra email, oppure fai cancellare "
          + "quell'account dalla console Firebase prima di riprovare."
        );
      } else if (err.message === ONBOARDING_CIRCOLO_SENZA_ADMIN) {
        setErrore(
          "Il circolo è stato creato ma l'Admin non è stato collegato: il circolo esiste e "
          + "nessuno può configurarlo. Aprilo dall'elenco qui sotto e sospendilo, poi segnala "
          + "il problema prima di ricreare."
        );
      } else {
        setErrore('Si è verificato un errore. Riprova.');
      }
    } finally {
      setCreando(false);
    }
  };

  if (successo) {
    return (
      <SezioneCollassabile
        id="saOnboarding"
        titolo="Nuovo circolo"
        descrizione="Crea il circolo e il suo primo account Admin, con i colori standard"
      >
        <div className="admin-card">
          <div className="admin-card-title">Circolo creato ✓</div>
          <p className="admin-card-hint">
            Comunica queste credenziali al presidente/segreteria di <b>{successo.nomeCircolo}</b>.
            I colori dell&apos;app sono impostati sullo standard: potrà personalizzarli quando vuole
            dalla propria Dashboard, sezione &quot;Personalizza App&quot;.
          </p>
          <div className="superadmin-credenziali">
            <div><span>Password circolo (per i soci)</span><code>{successo.passwordCircolo}</code></div>
            <div><span>Email Admin</span><code>{successo.emailAdmin}</code></div>
            <div><span>Password Admin</span><code>{successo.passwordAdmin}</code></div>
          </div>
          <button className="admin-btn-full" onClick={() => setSuccesso(null)}>+ Crea un altro circolo</button>
        </div>
      </SezioneCollassabile>
    );
  }

  return (
    <SezioneCollassabile
      id="saOnboarding"
      titolo="Nuovo circolo"
      descrizione="Crea il circolo e il suo primo account Admin, con i colori standard"
    >
      <div className="admin-card">
        {/* ⚠️ Il collegamento con la richiesta arrivata dal sito. Sceglierla
            qui fa tre cose: riempie il modulo con quello che il circolo ha
            già scritto, chiude da sola la richiesta quando il circolo
            nasce, e lascia il filo che permetterà — il giorno che quel
            circolo venisse eliminato — di portarsi via anche la richiesta.
            Senza, restavano tutte «nuova» per sempre. */}
        {daContattare.length > 0 && (
          <>
            <label className="admin-label" htmlFor="ob-richiesta">Nasce da una richiesta ricevuta</label>
            <select
              id="ob-richiesta" className="admin-input" value={richiestaId}
              onChange={(e) => prendiDallaRichiesta(e.target.value)}
            >
              <option value="">Nessuna — lo creo io da zero</option>
              {daContattare.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.nomeCircolo}{r.provincia ? ` · ${r.provincia}` : (r.citta ? ` · ${r.citta}` : '')}
                  {r.referente ? ` — ${r.referente}` : ''}
                </option>
              ))}
            </select>
          </>
        )}

        <label className="admin-label">Nome del circolo</label>
        <input className="admin-input" value={nomeCircolo} onChange={(e) => setNomeCircolo(e.target.value)} placeholder="ASD Tennis Esempio" />

        <div className="admin-row">
          <div style={{ flex: 2 }}>
            <label className="admin-label">Città</label>
            <input className="admin-input" value={citta} onChange={(e) => setCitta(e.target.value)} placeholder="Milazzo (ME)" />
          </div>
          <div style={{ flex: 1 }}>
            <label className="admin-label">Sigla</label>
            <input className="admin-input" value={sigla} onChange={(e) => setSigla(e.target.value)} placeholder="TM" maxLength={4} />
          </div>
        </div>

        <label className="admin-label">Regione</label>
        <select
          className="admin-select"
          value={regione}
          onChange={(e) => {
            const nuova = e.target.value;
            setRegione(nuova);
            // La provincia cade se non appartiene alla regione nuova.
            setProvincia((p) => (nuova && provinceDi(nuova).includes(p) ? p : ''));
          }}
        >
          <option value="">— scegli la regione —</option>
          {REGIONI_ITALIA.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>

        {/* ⚠️ Provincia e comune si chiedono QUI, che e' l'unico momento
            in cui costano zero: dopo, l'Admin non puo' piu' aggiungerle —
            la geografia e' di rete — e un circolo entrato senza provincia
            resta fuori da ogni vendita provinciale finche' non ci
            accorgiamo di riaprirne la scheda. */}
        <label className="admin-label">Provincia</label>
        <select className="admin-select" value={provincia} onChange={(e) => setProvincia(e.target.value)}>
          <option value="">— scegli la provincia —</option>
          {provinceDi(regione || null).map((pr) => <option key={pr} value={pr}>{pr}</option>)}
        </select>

        <label className="admin-label">Comune</label>
        <input className="admin-input" value={comune} onChange={(e) => setComune(e.target.value)} maxLength={80} />

        <label className="admin-label">Password d&apos;accesso soci</label>
        <input className="admin-input" value={passwordCircolo} onChange={(e) => setPasswordCircolo(e.target.value)} placeholder="es. esempio2026" />

        <div className="superadmin-subtitolo">Primo Admin Circolo</div>

        <div className="admin-row">
          <div>
            <label className="admin-label">Nome</label>
            <input className="admin-input" value={nomeAdmin} onChange={(e) => setNomeAdmin(e.target.value)} placeholder="Mario" />
          </div>
          <div>
            <label className="admin-label">Cognome</label>
            <input className="admin-input" value={cognomeAdmin} onChange={(e) => setCognomeAdmin(e.target.value)} placeholder="Rossi" />
          </div>
        </div>

        <label className="admin-label">Email</label>
        <input className="admin-input" type="email" value={emailAdmin} onChange={(e) => setEmailAdmin(e.target.value)} placeholder="presidente@circolo.it" />

        <label className="admin-label">Password</label>
        <input className="admin-input" type="password" value={passwordAdmin} onChange={(e) => setPasswordAdmin(e.target.value)} placeholder="Almeno 6 caratteri" />

        <div className="superadmin-subtitolo">Contratto di adesione</div>
        <p className="admin-card-hint">
          Chi ha chiesto di entrare in rete e chi ha firmato: spesso sono due persone diverse, e
          sapere quale delle due chiamare quando qualcosa non va è metà del lavoro di
          assistenza. Si può compilare anche dopo, dalla scheda del circolo.
        </p>
        <button
          className="admin-input" type="button" style={{ cursor: 'pointer', width: 'auto' }}
          onClick={() => setAnagraficaAperta(!anagraficaAperta)}
        >
          {anagraficaAperta ? 'Nascondi i dati del contratto' : '+ Aggiungi i dati del contratto'}
        </button>

        {anagraficaAperta && (
          <>
            <label className="admin-label">Chi ha chiesto l&apos;adesione</label>
            <div className="admin-row">
              <div>
                <input className="admin-input" value={richiedenteNome} onChange={(e) => setRichiedenteNome(e.target.value)} placeholder="Nome e cognome" />
              </div>
              <div>
                <input className="admin-input" value={richiedenteRuolo} onChange={(e) => setRichiedenteRuolo(e.target.value)} placeholder="Ruolo (es. Segretario)" />
              </div>
            </div>
            <div className="admin-row">
              <div>
                <input className="admin-input" type="email" value={richiedenteEmail} onChange={(e) => setRichiedenteEmail(e.target.value)} placeholder="Email" />
              </div>
              <div>
                <input className="admin-input" value={richiedenteTelefono} onChange={(e) => setRichiedenteTelefono(e.target.value)} placeholder="Telefono" />
              </div>
            </div>

            <label className="admin-label">Chi ha firmato il contratto</label>
            <div className="admin-row">
              <div>
                <input className="admin-input" value={firmatarioNome} onChange={(e) => setFirmatarioNome(e.target.value)} placeholder="Nome e cognome" />
              </div>
              <div>
                <input className="admin-input" value={firmatarioRuolo} onChange={(e) => setFirmatarioRuolo(e.target.value)} placeholder="Ruolo (es. Presidente)" />
              </div>
            </div>

            <label className="admin-label">Data della firma</label>
            <input className="admin-input" type="date" value={firmaIl} onChange={(e) => setFirmaIl(e.target.value)} />

            <label className="admin-label">Note interne</label>
            <textarea
              className="admin-input" rows={3} value={noteInterne} onChange={(e) => setNoteInterne(e.target.value)}
              style={{ resize: 'vertical', fontFamily: 'inherit' }}
              placeholder="Visibili solo al team Racket Fever"
            />
          </>
        )}

        {errore && <div className="admin-error-text">{errore}</div>}

        <button className="admin-btn-full" onClick={crea} disabled={creando}>
          {creando ? 'Creazione in corso…' : '+ Crea circolo'}
        </button>
      </div>
    </SezioneCollassabile>
  );
}
