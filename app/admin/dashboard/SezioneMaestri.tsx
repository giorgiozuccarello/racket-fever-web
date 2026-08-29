'use client';

import { useEffect, useState } from 'react';
import { MaestroConUid, creaMaestro, rimuoviMaestro, impostaAccessoAdmin } from '../../../data/maestriRepo';
import { contiDelMaestro, PrenotazioneDaContare } from '../../../data/contiMaestro';
import { ascoltaLezioniAnnullate, LezioneAnnullata } from '../../../data/lezioniAnnullate';
import { useLingua } from '../../../lib/lingua';
import SchedaMaestro from './SchedaMaestro';

export default function SezioneMaestri({ circoloId, maestri, prenotazioni }: {
  circoloId: string;
  maestri: MaestroConUid[];
  prenotazioni: PrenotazioneDaContare[];
}) {
  const { t } = useLingua();

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
  // ⚠️ `creato` dice se l'account è nato adesso o se ne abbiamo
  // collegato uno che c'era già: nel secondo caso non c'è nessuna
  // password da consegnare, perché è la sua.
  const [datiCreati, setDatiCreati] = useState<{ nome: string; email: string; password: string; creato: boolean } | null>(null);
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
      // ⚠️ Il nome e il cognome entrano come segnaposto e non incollati
      // davanti alla frase: in tedesco la persona non sta sempre in
      // testa, e una frase composta a pezzi qui obbligherebbe le altre
      // due lingue a seguire l'ordine italiano.
      const chi = `${m.nome} ${m.cognome}`;
      setErroreRimozione(
        e?.message === 'ACCESSO_ADMIN_NON_REVOCATO'
          ? t('adm.mae.rimozioneAccessoNonRevocato', { nome: chi })
          : t('adm.mae.rimozioneFallita', { nome: chi }),
      );
    }
  };

  const reset = () => { setNome(''); setCognome(''); setEmail(''); setPassword(''); setConsentiAdmin(false); setErrore(''); };

  const crea = async () => {
    setErrore('');
    if (!nome.trim() || !cognome.trim() || !email.trim() || !password) {
      setErrore(t('adm.mae.compilaTuttiICampi'));
      return;
    }
    if (password.length < 6) {
      setErrore(t('adm.mae.passwordTroppoCorta'));
      return;
    }
    setCreando(true);
    try {
      const esito = await creaMaestro(circoloId, nome, cognome, email, password, consentiAdmin);
      setDatiCreati({
        nome: `${nome.trim()} ${cognome.trim()}`, email: email.trim(), password, creato: esito.creato,
      });
      reset();
      setFormAperto(false);
    } catch (err: any) {
      // ⚠️ Il messaggio arriva dal server, ed è più preciso del nostro:
      // «esiste già un account» non è più un errore — quell'account
      // viene collegato — mentre «è già Maestro di un altro circolo» è
      // una cosa che va detta com'è.
      setErrore(err?.message || t('com.errore.generico'));
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
      //
      // ⚠️ Due frasi intere e non un verbo infilato in mezzo a una
      // sola: «togliere/concedere» in tedesco finisce in fondo alla
      // frase, e una sola frase con il buco a metà non si potrebbe
      // tradurre senza storpiarla.
      const chi = `${m.nome} ${m.cognome}`;
      setErroreRimozione(
        m.puoAccedereAdmin
          ? t('adm.mae.accessoNonTolto', { nome: chi })
          : t('adm.mae.accessoNonConcesso', { nome: chi }),
      );
    } finally {
      setAggiornandoUid(null);
    }
  };

  return (
    <div className="admin-card">
      <div className="admin-card-title">{t('adm.mae.titolo')}</div>
      <p className="admin-card-hint">{t('adm.mae.intro')}</p>

      {maestri.length === 0 && !formAperto && (
        <p className="admin-empty-text">{t('adm.mae.nessunMaestro')}</p>
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
              {schedaAperta === m.uid ? t('adm.mae.chiudiScheda') : t('adm.mae.scheda')}
            </button>
            <button className="admin-icon-btn danger" onClick={() => rimuovi(m)} aria-label={t('adm.mae.rimuovi')}>🗑</button>
          </div>
          <label className="admin-checkbox-row">
            <input
              type="checkbox" checked={!!m.puoAccedereAdmin}
              onChange={() => toggleAccessoAdmin(m)} disabled={aggiornandoUid === m.uid}
            />
            <span>{aggiornandoUid === m.uid ? t('adm.mae.aggiornamento') : t('adm.mae.puoAccedereAdmin')}</span>
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
          <p className="admin-card-hint">
            {t(datiCreati.creato ? 'adm.mae.creatoCredenziali' : 'adm.mae.collegatoTitolo')}
          </p>
          {!datiCreati.creato && (
            <p className="admin-card-hint">{t('adm.mae.collegatoSpiega')}</p>
          )}
          <div className="superadmin-credenziali">
            {/* ⚠️ Chiave diversa da quella del modulo: qui sotto c'è il
                nome E il cognome insieme, quindi «Nome» vale «nome e
                cognome» — in inglese e in tedesco sarebbe «First name»
                sopra un nome intero. */}
            <div><span>{t('adm.mae.credenzialiNome')}</span><code>{datiCreati.nome}</code></div>
            <div><span>{t('adm.mae.campoEmail')}</span><code>{datiCreati.email}</code></div>
            {/* ⚠️ La password si mostra SOLO se l'account l'abbiamo
                creato noi: su uno che esisteva già la password è sua e
                non la conosce nessuno, quindi scriverne una qualunque
                manderebbe a sbattere contro «credenziali non valide». */}
            {datiCreati.creato && (
              <div><span>{t('adm.mae.campoPassword')}</span><code>{datiCreati.password}</code></div>
            )}
          </div>
        </>
      )}

      {formAperto ? (
        <>
          {/* ⚠️ Anche i nomi di esempio sono tradotti: «Mario Rossi» è il
              nome finto con cui in Italia si spiega un modulo, e in
              inglese e in tedesco quel ruolo lo fanno altri due nomi.
              Non è il nome di una persona vera — quello sarebbe un dato
              e resterebbe com'è. */}
          <label className="admin-label">{t('adm.mae.campoNome')}</label>
          <input className="admin-input" value={nome} onChange={(e) => setNome(e.target.value)} placeholder={t('adm.mae.esempioNome')} />
          <label className="admin-label">{t('adm.mae.campoCognome')}</label>
          <input className="admin-input" value={cognome} onChange={(e) => setCognome(e.target.value)} placeholder={t('adm.mae.esempioCognome')} />
          <label className="admin-label">{t('adm.mae.campoEmail')}</label>
          <input className="admin-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t('adm.mae.esempioEmail')} />
          <label className="admin-label">{t('adm.mae.campoPassword')}</label>
          <input className="admin-input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={t('adm.mae.esempioPassword')} />
          {/* ⚠️ La nota sta QUI, sotto il campo, e non nel riepilogo dopo:
              e' prima di premere il tasto che l'Admin si chiede «e se ha
              gia' un account?». Detta dopo servirebbe solo a spiegare
              perche' la password che ha appena inventato non serve a
              niente. */}
          <div className="admin-card-hint">{t('adm.mae.passwordSoloSeNuovo')}</div>

          <label className="admin-checkbox-row" style={{ marginTop: '.8rem' }}>
            <input type="checkbox" checked={consentiAdmin} onChange={(e) => setConsentiAdmin(e.target.checked)} />
            <span>{t('adm.mae.consentiAccessoAdmin')}</span>
          </label>

          {errore && <div className="admin-error-text">{errore}</div>}

          <div className="admin-row" style={{ marginTop: '.8rem' }}>
            <button className="admin-btn-full" style={{ background: '#fff', color: 'var(--grigio)', border: '2px solid var(--bordo)' }} onClick={() => { setFormAperto(false); reset(); }}>
              {t('com.annulla')}
            </button>
            <button className="admin-btn-full" onClick={crea} disabled={creando}>
              {creando ? t('adm.mae.creazione') : t('adm.mae.creaMaestro')}
            </button>
          </div>
        </>
      ) : (
        <button className="admin-btn-full" onClick={() => { setDatiCreati(null); setFormAperto(true); }}>
          + {t('adm.mae.aggiungiMaestro')}
        </button>
      )}
    </div>
  );
}
