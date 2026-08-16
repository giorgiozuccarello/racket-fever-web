'use client';

import { useEffect, useState } from 'react';
import { MaestroConUid, creaMaestro, rimuoviMaestro, impostaAccessoAdmin } from '../../../data/maestriRepo';
import { contiDelMaestro, PrenotazioneDaContare } from '../../../data/contiMaestro';
import { ascoltaLezioniAnnullate, LezioneAnnullata } from '../../../data/lezioniAnnullate';
import SchedaMaestro from './SchedaMaestro';

export default function SezioneMaestri({ circoloId, maestri, prenotazioni }: {
  circoloId: string;
  maestri: MaestroConUid[];
  prenotazioni: PrenotazioneDaContare[];
}) {
  // ⚠️ L'ascolto delle lezioni annullate sta QUI e non nella pagina.
  // Quei documenti servono soltanto ai conteggi dentro la scheda di un
  // Maestro, e questa sezione è collassata: tenendo l'ascolto più su si
  // scaricava, a ogni apertura della dashboard, l'intero storico delle
  // disdette del circolo per non mostrarlo a nessuno. La collezione non
  // ha scadenza: cresce e basta.
  //
  // ⚠️ E la query NON si può limitare per data o con un limit: i
  // conteggi sono storici, e un elenco tagliato darebbe un numero
  // sbagliato con l'aria di essere giusto.
  const [annullate, setAnnullate] = useState<LezioneAnnullata[]>([]);
  const [annullateArrivate, setAnnullateArrivate] = useState(false);
  useEffect(() => {
    setAnnullateArrivate(false);
    return ascoltaLezioniAnnullate(
      circoloId,
      (elenco) => { setAnnullate(elenco); setAnnullateArrivate(true); },
      () => { setAnnullate([]); setAnnullateArrivate(false); },
    );
  }, [circoloId]);

  const [formAperto, setFormAperto] = useState(false);
  // Una scheda aperta per volta: sono lunghe, e due aperte insieme
  // costringono a scorrere per capire quale si sta compilando.
  const [schedaAperta, setSchedaAperta] = useState<string | null>(null);
  const [nome, setNome] = useState('');
  const [cognome, setCognome] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [consentiAdmin, setConsentiAdmin] = useState(false);
  const [errore, setErrore] = useState('');
  const [creando, setCreando] = useState(false);
  const [datiCreati, setDatiCreati] = useState<{ nome: string; email: string; password: string } | null>(null);
  const [aggiornandoUid, setAggiornandoUid] = useState<string | null>(null);
  const [erroreRimozione, setErroreRimozione] = useState('');

  // ⚠️ rimuoviMaestro adesso puo' FALLIRE apposta: se non riesce a
  // togliere l'accesso Admin gemello o la scheda privata si ferma,
  // invece di lasciare in giro un permesso non piu' revocabile o un
  // numero di telefono irraggiungibile. Senza questo blocco l'errore
  // sarebbe finito solo nella console del browser, e all'Admin
  // sarebbe sembrato che non fosse successo niente.
  const rimuovi = async (m: MaestroConUid) => {
    setErroreRimozione('');
    try {
      await rimuoviMaestro(m);
    } catch (e: any) {
      setErroreRimozione(
        e?.message === 'ACCESSO_ADMIN_NON_REVOCATO'
          ? `${m.nome} ${m.cognome} non è stato rimosso: non è stato possibile togliergli l'accesso Admin. Riprova — se si cancellasse ora, quell'accesso resterebbe attivo e non sarebbe più revocabile.`
          : `${m.nome} ${m.cognome} non è stato rimosso. Riprova.`,
      );
    }
  };

  const reset = () => { setNome(''); setCognome(''); setEmail(''); setPassword(''); setConsentiAdmin(false); setErrore(''); };

  const crea = async () => {
    setErrore('');
    if (!nome.trim() || !cognome.trim() || !email.trim() || !password) {
      setErrore('Compila tutti i campi.');
      return;
    }
    if (password.length < 6) {
      setErrore('La password deve avere almeno 6 caratteri.');
      return;
    }
    setCreando(true);
    try {
      await creaMaestro(circoloId, nome, cognome, email, password, consentiAdmin);
      setDatiCreati({ nome: `${nome.trim()} ${cognome.trim()}`, email: email.trim(), password });
      reset();
      setFormAperto(false);
    } catch (err: any) {
      if (err.code === 'auth/email-already-in-use') setErrore('Esiste già un account con questa email.');
      else setErrore('Si è verificato un errore. Riprova.');
    } finally {
      setCreando(false);
    }
  };

  const toggleAccessoAdmin = async (m: MaestroConUid) => {
    setAggiornandoUid(m.uid);
    setErroreRimozione('');
    try {
      await impostaAccessoAdmin(m, !m.puoAccedereAdmin);
    } catch {
      // ⚠️ Una revoca fallita non puo' restare muta. La casella torna
      // da sola allo stato vero (lo decide l'ascolto su Firestore),
      // quindi senza un messaggio l'Admin vede la spunta rimettersi
      // dov'era e pensa a un tocco andato a vuoto — mentre l'accesso
      // Admin di quella persona e' ancora acceso.
      setErroreRimozione(
        `Non è stato possibile ${m.puoAccedereAdmin ? 'togliere' : 'concedere'} l'accesso Admin a ${m.nome} ${m.cognome}. Riprova.`,
      );
    } finally {
      setAggiornandoUid(null);
    }
  };

  return (
    <div className="admin-card">
      <div className="admin-card-title">Maestri</div>
      <p className="admin-card-hint">
        Ogni Maestro ha un proprio account, separato dal tuo: gestisce solo le proprie
        lezioni, non prezzi, soci o incassi — a meno che
        tu non gli conceda esplicitamente anche l&apos;accesso Admin.
      </p>

      {maestri.length === 0 && !formAperto && (
        <p className="admin-empty-text">Nessun Maestro ancora aggiunto.</p>
      )}

      {maestri.map((m) => (
        <div key={m.uid} className="maestro-block">
          <div className="admin-list-row">
            <div style={{ flex: 1 }}>
              <div className="admin-list-main">{m.nome} {m.cognome}</div>
              <div className="admin-list-sub">
                {m.email}
                {m.qualifica ? ` · ${m.qualifica}` : ''}
              </div>
            </div>
            <button
              className="admin-icon-btn"
              aria-expanded={schedaAperta === m.uid}
              onClick={() => setSchedaAperta(schedaAperta === m.uid ? null : m.uid)}
            >
              {schedaAperta === m.uid ? 'Chiudi scheda' : 'Scheda'}
            </button>
            <button className="admin-icon-btn danger" onClick={() => rimuovi(m)} aria-label="Rimuovi">🗑</button>
          </div>
          <label className="admin-checkbox-row">
            <input
              type="checkbox" checked={!!m.puoAccedereAdmin}
              onChange={() => toggleAccessoAdmin(m)} disabled={aggiornandoUid === m.uid}
            />
            <span>{aggiornandoUid === m.uid ? 'Aggiornamento…' : 'Può accedere anche come Admin Circolo'}</span>
          </label>
          {/* ⚠️ Montata solo da aperta, e con key sull'identificativo:
              la scheda tiene in memoria quello che si sta scrivendo, e
              riusando lo stesso componente per un altro Maestro i campi
              gia' compilati resterebbero a schermo — con il rischio di
              salvare il telefono di uno sulla scheda di un altro. */}
          {schedaAperta === m.uid && (
            <SchedaMaestro
              key={m.uid}
              maestro={m}
              conti={contiDelMaestro(m.uid, prenotazioni, annullate)}
              contiIncerti={!annullateArrivate}
            />
          )}
        </div>
      ))}

      {erroreRimozione && <div className="admin-error-text">{erroreRimozione}</div>}

      {datiCreati && (
        <>
          <p className="admin-card-hint">Maestro creato ✓ — comunica queste credenziali:</p>
          <div className="superadmin-credenziali">
            <div><span>Nome</span><code>{datiCreati.nome}</code></div>
            <div><span>Email</span><code>{datiCreati.email}</code></div>
            <div><span>Password</span><code>{datiCreati.password}</code></div>
          </div>
        </>
      )}

      {formAperto ? (
        <>
          <label className="admin-label">Nome</label>
          <input className="admin-input" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Mario" />
          <label className="admin-label">Cognome</label>
          <input className="admin-input" value={cognome} onChange={(e) => setCognome(e.target.value)} placeholder="Rossi" />
          <label className="admin-label">Email</label>
          <input className="admin-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="maestro@circolo.it" />
          <label className="admin-label">Password</label>
          <input className="admin-input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Almeno 6 caratteri" />

          <label className="admin-checkbox-row" style={{ marginTop: '.8rem' }}>
            <input type="checkbox" checked={consentiAdmin} onChange={(e) => setConsentiAdmin(e.target.checked)} />
            <span>Consenti anche l&apos;accesso come Admin Circolo</span>
          </label>

          {errore && <div className="admin-error-text">{errore}</div>}

          <div className="admin-row" style={{ marginTop: '.8rem' }}>
            <button className="admin-btn-full" style={{ background: '#fff', color: 'var(--grigio)', border: '2px solid var(--bordo)' }} onClick={() => { setFormAperto(false); reset(); }}>
              Annulla
            </button>
            <button className="admin-btn-full" onClick={crea} disabled={creando}>
              {creando ? 'Creazione…' : 'Crea Maestro'}
            </button>
          </div>
        </>
      ) : (
        <button className="admin-btn-full" onClick={() => { setDatiCreati(null); setFormAperto(true); }}>
          + Aggiungi Maestro
        </button>
      )}
    </div>
  );
}
