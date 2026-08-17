'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import { auth } from '../../../lib/firebase';
import { allineaProfiliCircolo } from '../../../data/tessere';
import { leggiResponsabile, ProfiloResponsabile } from '../../../data/responsabili';
import { leggiSessioneCollaboratore, sessioneScaduta } from '../../../data/collaboratori';
import { ascoltaSociCircolo, SocioCircolo } from '../../../data/users';
import { Circolo, Campo, Blocco } from '../../../data/circoli';
import { ascoltaCircolo, ascoltaCampi, ascoltaBlocchi } from '../../../data/circoliRepo';
import { ascoltaPrenotazioniCircolo, PrenotazioneAdmin } from '../../../data/prenotazioniRepo';
import { Sfida, ascoltaSfideCircolo, risolviTimerAccordo, risolviTimerPrenotazione } from '../../../data/sfide';
import InstallPrompt from '../InstallPrompt';
import SezionePassword from './SezionePassword';
import SezioneCollaboratori from './SezioneCollaboratori';
import SezionePersonalizzaApp, { SezioneBannerMarketing } from './SezionePersonalizzaApp';
import SezioneCampi from './SezioneCampi';
import SezioneTornei from './SezioneTornei';
import SezioneBacheca from './SezioneBacheca';
import SezioneLimite from './SezioneLimite';
import SezioneLimiteCancellazione from './SezioneLimiteCancellazione';
import SezionePrezzi from './SezionePrezzi';
import SezioneBlocchi from './SezioneBlocchi';
import SezioneSoci from './SezioneSoci';
import SezioneRichiesteTessera from './SezioneRichiesteTessera';
import SezioneTessereDaSaldare from './SezioneTessereDaSaldare';
import SezioneTestReset from './SezioneTestReset';
import SezioneDebitiSoci from './SezioneDebitiSoci';
import SchedaSocioModal from './SchedaSocioModal';
import SezioneMaestri from './SezioneMaestri';
import SezioneClassificaSociale from './SezioneClassificaSociale';
import SezioneSfideInCorso from './SezioneSfideInCorso';
import SezioneCollassabile from './SezioneCollassabile';
import SezionePrenotazioni from './SezionePrenotazioni';
import SezioneNotePrenotazioni from './SezioneNotePrenotazioni';
import SezioneLezioniPrenotate from './SezioneLezioniPrenotate';
import { ascoltaMaestriCircolo, MaestroConUid } from '../../../data/maestriRepo';

export default function AdminDashboard() {
  const router = useRouter();
  const [responsabile, setResponsabile] = useState<ProfiloResponsabile | null>(null);
  // Quando finisce la sessione Collaboratore. Nullo per l'Admin vero,
  // che non ha scadenza: il suo accesso e' un account, non un permesso
  // a tempo.
  const [scadenzaSessione, setScadenzaSessione] = useState<number | null>(null);
  const [circolo, setCircolo] = useState<Circolo | null>(null);
  const [campi, setCampi] = useState<Campo[]>([]);
  const [blocchi, setBlocchi] = useState<Blocco[]>([]);
  const [soci, setSoci] = useState<SocioCircolo[]>([]);
  const [prenotazioni, setPrenotazioni] = useState<PrenotazioneAdmin[]>([]);
  const [maestri, setMaestri] = useState<MaestroConUid[]>([]);
  const [sfide, setSfide] = useState<Sfida[]>([]);
  const [socioSelUid, setSocioSelUid] = useState<string | null>(null);
  const [caricando, setCaricando] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user: User | null) => {
      if (!user) {
        router.replace('/admin/login');
        return;
      }
      const r = await leggiResponsabile(user.uid);
      if (r) {
        setResponsabile(r);
        setCaricando(false);
        // Rimette in riga i profili approvati prima che l'app scrivesse
        // il circolo sul profilo: senza, quelle persone non possono
        // essere scelte come compagno di gioco.
        allineaProfiliCircolo(r.circoloId)
          .then((n) => { if (n > 0) console.log(`Profili allineati: ${n}`); })
          .catch(() => {});
        return;
      }
      // ⚠️ Una sessione scaduta NON e' una sessione. Senza questo
      // controllo la Dashboard si sarebbe aperta lo stesso — il
      // documento c'e' ancora — e poi ogni singola operazione sarebbe
      // stata respinta dalle regole, una per una, senza spiegazione.
      // Meglio dire subito "rientra con la password".
      const sessione = await leggiSessioneCollaboratore(user.uid);
      if (sessione && !sessioneScaduta(sessione)) {
        setResponsabile({ nome: 'Collaboratore', cognome: '', email: '', circoloId: sessione.circoloId });
        setScadenzaSessione(sessione.scadeIlMs ?? null);
        setCaricando(false);
        return;
      }
      await signOut(auth);
      router.replace('/admin/login');
    });
    return unsub;
  }, [router]);

  useEffect(() => {
    if (!responsabile) return;
    const u1 = ascoltaCircolo(responsabile.circoloId, setCircolo);
    const u2 = ascoltaCampi(responsabile.circoloId, setCampi);
    const u3 = ascoltaBlocchi(responsabile.circoloId, setBlocchi);
    const u4 = ascoltaSociCircolo(responsabile.circoloId, setSoci);
    const u5 = ascoltaPrenotazioniCircolo(responsabile.circoloId, setPrenotazioni);
    const u6 = ascoltaMaestriCircolo(responsabile.circoloId, setMaestri);
    const u7 = ascoltaSfideCircolo(responsabile.circoloId, setSfide);
    return () => { u1(); u2(); u3(); u4(); u5(); u6(); u7(); };
  }, [responsabile]);

  // Stesso controllo passivo del mobile: se l'Admin ha la dashboard
  // aperta e nota un timer scaduto (accordo o prenotazione), lo
  // risolve lui — non c'è un sistema di automazioni lato server.
  const sfideScaduteTentate = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (soci.length === 0) return;
    sfide
      .filter((sf) =>
        (sf.fase === 'accordo' && Date.now() >= sf.accordoScadenza) ||
        (sf.fase === 'prenotazione' && sf.prenotazioneScadenza && Date.now() >= sf.prenotazioneScadenza)
      )
      .filter((sf) => !sfideScaduteTentate.current.has(sf.id))
      .forEach((sf) => {
        sfideScaduteTentate.current.add(sf.id);
        if (sf.fase === 'accordo') risolviTimerAccordo(sf, soci, circolo);
        else risolviTimerPrenotazione(sf, soci, circolo);
      });
  }, [sfide, soci, circolo]);

  // ⚠️ LA SCADENZA VA CONTROLLATA ANCHE MENTRE SI LAVORA.
  // Il controllo all'apertura non basta: una Dashboard su un PC di
  // segreteria resta aperta tutto il giorno, e alla dodicesima ora
  // tutti gli ascolti cominciavano a fallire in silenzio — dati
  // congelati a schermo e ogni operazione respinta con un "Riprova"
  // che non poteva riuscire. Peggio: una sequenza non transazionale
  // interrotta a meta' lasciava le cose a meta'. Un giro al minuto
  // costa niente e permette di dire la cosa giusta.
  useEffect(() => {
    if (scadenzaSessione == null) return;
    const controllo = setInterval(async () => {
      if (Date.now() < scadenzaSessione) return;
      clearInterval(controllo);
      await signOut(auth);
      router.replace('/admin/login?scaduta=1');
    }, 60000);
    return () => clearInterval(controllo);
  }, [scadenzaSessione, router]);

  const logout = async () => {
    await signOut(auth);
    router.replace('/admin/login');
  };

  if (caricando || !responsabile || !circolo) {
    return (
      <div className="admin-splash">
        <div className="logo-mark" aria-hidden="true" />
        <p className="mono" style={{ marginTop: '1rem', opacity: 0.8 }}>Caricamento…</p>
      </div>
    );
  }

  return (
    <div className="admin-shell">
      <InstallPrompt />

      <header className="admin-header">
        <div className="admin-header-brand">
          {circolo.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={circolo.logoUrl} alt="" className="admin-header-logo" />
          ) : (
            <div className="admin-header-logo admin-header-logo-fallback">{circolo.sigla}</div>
          )}
          <div>
            <div className="mono" style={{ opacity: 0.75 }}>ADMIN CIRCOLO</div>
            <h1 className="display" style={{ fontSize: '1.7rem', marginTop: '.2rem' }}>{circolo.nome}</h1>
          </div>
        </div>
        {/* Lato destro: il marchio Racket Fever e il tasto di uscita.
            Il marchio sta PRIMA del tasto, non all'estremita', perche'
            "Esci" e' sempre stato l'ultimo elemento in alto a destra:
            spostarlo per far posto al logo avrebbe cambiato un gesto
            che l'admin fa a memoria. */}
        <div className="admin-header-fine">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-rf-completo.png" alt="Racket Fever" width={453} height={96} className="admin-header-marchio" />
          <button className="btn btn-outline admin-logout-btn" onClick={logout}>Esci</button>
        </div>
      </header>

      <main className="admin-main">
        <SezioneCollassabile id="test-reset" titolo="Test Reset" descrizione="Strumenti per ripartire puliti fra due sessioni di prova">
          <SezioneTestReset circolo={circolo} sfide={sfide} />
        </SezioneCollassabile>
        <SezioneCollassabile id="personalizza" titolo="Personalizza App" descrizione="Colori e logo dell'app mostrati ai soci">
          <SezionePersonalizzaApp circolo={circolo} />
        </SezioneCollassabile>
        <SezioneCollassabile
          id="banner"
          titolo="Banner Marketing"
          descrizione="Gli sponsor che girano in Home e in Classifica"
        >
          <SezioneBannerMarketing circolo={circolo} />
        </SezioneCollassabile>
        <SezioneCollassabile id="password" titolo="Password Circolo" descrizione="Password che i soci usano per accedere">
          <SezionePassword circolo={circolo} />
        </SezioneCollassabile>
        <SezioneCollassabile id="collaboratori" titolo="Collaboratori" descrizione="Accesso rapido per lo staff, senza account personale">
          <SezioneCollaboratori circoloId={circolo.id} />
        </SezioneCollassabile>
        <SezioneCollassabile id="campi" titolo="Campi" descrizione="Nome e disciplina dei campi">
          <SezioneCampi circoloId={circolo.id} campi={campi} />
        </SezioneCollassabile>
        {/* La Bacheca sta PRIMA dei Tornei, e nell'ordine c'e' un
            senso: la bacheca e' quotidiana — una chiusura, una quota,
            un avviso — mentre un torneo si pubblica ogni tanto. Quello
            che si usa tutti i giorni sta sopra. */}
        <SezioneCollassabile id="bacheca" titolo="Bacheca" descrizione="Avvisi, volantini e comunicazioni per i tuoi soci">
          <SezioneBacheca circolo={circolo} autoreNome={circolo.nome} />
        </SezioneCollassabile>
        <SezioneCollassabile id="tornei" titolo="Tornei" descrizione="Pubblica un torneo sulla bacheca della rete">
          <SezioneTornei circolo={circolo} />
        </SezioneCollassabile>
        <SezioneCollassabile id="limite" titolo="Limite Prenotazioni" descrizione="Limite di prenotazioni settimanali per socio">
          <SezioneLimite circolo={circolo} />
        </SezioneCollassabile>
        <SezioneCollassabile id="limite-cancellazione" titolo="Limite Cancellazione Prenotazioni Campi" descrizione="Entro quante ore prima un socio può disdire un campo">
          <SezioneLimiteCancellazione circolo={circolo} />
        </SezioneCollassabile>
        <SezioneCollassabile id="prezzi" titolo="Prezzi" descrizione="Tariffe orarie e fasce speciali">
          <SezionePrezzi circoloId={circolo.id} campi={campi} />
        </SezioneCollassabile>
        <SezioneCollassabile id="blocchi" titolo="Orari Riservati" descrizione="Manutenzione, tornei, corsi — orari non prenotabili">
          <SezioneBlocchi circoloId={circolo.id} campi={campi} blocchi={blocchi} />
        </SezioneCollassabile>
        <SezioneCollassabile id="richieste" titolo="Richieste in sospeso" descrizione="Chi ha chiesto di entrare nel circolo">
          <SezioneRichiesteTessera circolo={circolo} approvatore={responsabile.email} />
        </SezioneCollassabile>
        {/* Il registro non e' una sezione collassabile ma una pagina a
            se': un estratto conto ha bisogno di spazio per i filtri,
            per la tabella e per la stampa. */}
        <button className="admin-riga-registro" onClick={() => router.push('/admin/movimenti')}>
          <div style={{ flex: 1, textAlign: 'left' }}>
            <div className="admin-riga-registro-titolo">Registro Movimenti</div>
            <div className="admin-riga-registro-sub">
              Ricariche, addebiti e rimborsi — prova in caso di contestazione, con stampa
            </div>
          </div>
          <span aria-hidden>›</span>
        </button>

        <SezioneCollassabile id="saldare" titolo="Tessere da saldare" descrizione="Ex soci con credito da restituire o debito da recuperare">
          <SezioneTessereDaSaldare circolo={circolo} />
        </SezioneCollassabile>
        <SezioneCollassabile id="soci" titolo="Soci/Tesserati e Ospiti" descrizione="Anagrafica e credito di Soci/Tesserati e Ospiti">
          <SezioneSoci soci={soci} onSelezionaSocio={setSocioSelUid} />
        </SezioneCollassabile>
        <SezioneCollassabile id="debiti" titolo="Debiti dei Soci/Tesserati e Ospiti" descrizione="Soci/Tesserati e Ospiti con credito negativo o Fido da saldare">
          <SezioneDebitiSoci soci={soci} onSelezionaSocio={setSocioSelUid} />
        </SezioneCollassabile>
        <SezioneCollassabile id="maestri" titolo="Maestri" descrizione="Anagrafica, account e accesso dei maestri del circolo">
          <SezioneMaestri circoloId={circolo.id} maestri={maestri} prenotazioni={prenotazioni} />
        </SezioneCollassabile>
        <SezioneCollassabile id="classifica" titolo="Classifica Sociale" descrizione="Ranking dei soci e gestione posizioni">
          <SezioneClassificaSociale circolo={circolo} soci={soci} sfide={sfide} />
        </SezioneCollassabile>
        <SezioneCollassabile id="sfide" titolo="Sfide in Corso" descrizione="Sfide sociali dal lancio alla conclusione">
          <SezioneSfideInCorso sfide={sfide} soci={soci} circolo={circolo} />
        </SezioneCollassabile>
        <SchedaSocioModal
          circoloId={circolo.id}
          socio={socioSelUid ? soci.find((x) => x.uid === socioSelUid) ?? null : null}
          prenotazioni={prenotazioni}
          onClose={() => setSocioSelUid(null)}
        />
        <SezioneCollassabile id="prenotazioni" titolo="Prenotazione Campi" descrizione="Griglia campi — clicca uno slot per i dettagli">
          <SezionePrenotazioni campi={campi} blocchi={blocchi} prenotazioni={prenotazioni} sfide={sfide} circolo={circolo} soci={soci} nomeEsecutore={`${responsabile.nome} ${responsabile.cognome}`} />
        </SezioneCollassabile>
        <SezioneCollassabile id="note" titolo="Note alle Prenotazioni" descrizione="Prenotazioni con note lasciate dai soci">
          <SezioneNotePrenotazioni prenotazioni={prenotazioni} />
        </SezioneCollassabile>
        <SezioneCollassabile id="lezioni" titolo="Lezioni Prenotate" descrizione="Calendario riepilogativo delle lezioni con i maestri">
          <SezioneLezioniPrenotate
            prenotazioni={prenotazioni}
            circoloId={circolo.id}
            nomeEsecutore={`${responsabile.nome} ${responsabile.cognome}`}
          />
        </SezioneCollassabile>
      </main>
    </div>
  );
}
