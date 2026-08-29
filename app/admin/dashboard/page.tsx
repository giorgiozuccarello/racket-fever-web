'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import { auth } from '../../../lib/firebase';
import { allineaProfiliCircolo } from '../../../data/tessere';
import { leggiResponsabile, ProfiloResponsabile } from '../../../data/responsabili';
import { leggiSessioneCollaboratore, sessioneScaduta } from '../../../data/collaboratori';
import { ascoltaSociCircolo, SocioCircolo } from '../../../data/users';
import { Circolo, Campo, Blocco, statoCircolo, attivazioneCircoloMs, limiteFidoDi } from '../../../data/circoli';
import { ascoltaCircolo, ascoltaCampi, ascoltaBlocchi } from '../../../data/circoliRepo';
import { ascoltaPrenotazioniCircolo, PrenotazioneAdmin } from '../../../data/prenotazioniRepo';
import { Sfida, ascoltaSfideCircolo, risolviTimerAccordo, risolviTimerPrenotazione } from '../../../data/sfide';
import InstallPrompt from '../InstallPrompt';
import SezionePanoramicaCircolo from './SezionePanoramicaCircolo';
// ⚠️ Le due sezioni non si montano piu' da qui: stanno dentro
// SezionePanoramicaCircolo, che le importa per conto suo. Erano rimaste
// anche qui, sciolte, per il solo Collaboratore.

import SezionePassword from './SezionePassword';
import SezioneCollaboratori from './SezioneCollaboratori';
import SezionePersonalizzaApp, { SezioneBannerMarketing } from './SezionePersonalizzaApp';
import SezioneCampi from './SezioneCampi';
import SezioneTornei from './SezioneTornei';
import SezioneBacheca from './SezioneBacheca';
import SezioneLimite from './SezioneLimite';
import SezioneLimiteCancellazione from './SezioneLimiteCancellazione';
import SezioneFido from './SezioneFido';
import SezioneBonifico from './SezioneBonifico';
import SezionePrezzi from './SezionePrezzi';
import SezioneBlocchi from './SezioneBlocchi';
import SezioneRichiesteTessera from './SezioneRichiesteTessera';
import SezioneSegnalazioni from './SezioneSegnalazioni';
import SezioneTessereDaSaldare from './SezioneTessereDaSaldare';
import SezioneRicavi from './SezioneRicavi';
// ⚠️ La data della testata si scrive con la stessa funzione dei
// riquadri del conteggio, e non con una copia: è la STESSA data —
// «attivo dal» in alto e il punto di partenza del totale più in
// basso — e due formati per una data sola fanno dubitare che sia la
// stessa.
import { giornoLeggibile } from './RiquadriConteggio';
import SchedaSocioModal from './SchedaSocioModal';
import SezioneMaestri from './SezioneMaestri';
import SezioneClassificaSociale from './SezioneClassificaSociale';
import SezioneSfideInCorso from './SezioneSfideInCorso';
import SezioneCollassabile from './SezioneCollassabile';
import SezioniOrdinate from './SezioniOrdinate';
import { confrontaTitoli } from '../../../data/ordineSezioni';
import SezionePersonalizzaDashboard from './SezionePersonalizzaDashboard';
import { TemaDashboard, TEMA_ADMIN_DI_PARTENZA, variabiliCss } from '../../../data/temaDashboard';
import { leggiTemaCircolo, leggiTemaLocale } from '../../../data/temaDashboardRepo';
import SezionePrenotazioni from './SezionePrenotazioni';
import SezioneNotePrenotazioni from './SezioneNotePrenotazioni';
import SezioneLezioniPrenotate from './SezioneLezioniPrenotate';
import { ascoltaMaestriCircolo, MaestroConUid } from '../../../data/maestriRepo';
import { LinguaProvider, useLingua } from '../../../lib/lingua';

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
    // ⚠️ ANCHE L'ATTESA HA IL SUO INVOLUCRO, e non e' quello di sotto
    // spostato: sono due rami dello stesso `if`, non si montano mai
    // insieme e non si annidano mai. Serve perche' `SplashCaricamento`
    // chiama `useLingua` per una parola sola — «Caricamento…» — e senza
    // un contenitore sopra di se' quella parola resterebbe in italiano
    // anche per un Admin che ha scelto il tedesco.
    return (
      <LinguaProvider ruolo="admin">
        <SplashCaricamento />
      </LinguaProvider>
    );
  }

  return (
    // ============================================================
    // ⚠️ L'INVOLUCRO DELLA LINGUA STA QUI, E PRIMA STAVA PIÙ IN BASSO.
    // Fino alla tornata 106 avvolgeva la sola Panoramica: era l'unica
    // sezione tradotta, e il selettore viveva dentro di lei. Da adesso
    // la dashboard è tradotta tutta, e un involucro che copre una
    // sezione sola vorrebbe dire un Admin tedesco che legge la
    // Panoramica in tedesco e le altre ventotto sezioni in italiano.
    //
    // ⚠️ E RESTA FUORI DAL RESTO DEL SITO. Non sale sul `layout.tsx`
    // della radice: quello trasformerebbe in componente client il
    // guscio di ogni pagina pubblica per una preferenza che riguarda
    // solo chi ha fatto l'accesso da Admin. Sale fin qui, e non un
    // livello più su.
    //
    // ⚠️ E `SchedaCircoloVista` aperta dal Super Admin resta in
    // italiano, che è come deve stare: quella pagina questo involucro
    // non ce l'ha, `useLingua` risponde con la lingua di serie, e il
    // team Racket Fever non si ritrova il pannello di rete in tedesco
    // perché l'Admin di un circolo ha scelto così.
    // ============================================================
    <LinguaProvider ruolo="admin">
      <ContenutoDashboard
        circolo={circolo}
        campi={campi}
        blocchi={blocchi}
        soci={soci}
        prenotazioni={prenotazioni}
        maestri={maestri}
        sfide={sfide}
        responsabile={responsabile}
        scadenzaSessione={scadenzaSessione}
        socioSelUid={socioSelUid}
        onSelezionaSocio={setSocioSelUid}
        onEsci={logout}
      />
    </LinguaProvider>
  );
}

// L'attesa: una parola sola, ma passa dal traduttore come tutto il
// resto. Componente a se' per lo stesso motivo di `ContenutoDashboard`
// — vedi il commento qui sotto.
function SplashCaricamento() {
  const { t } = useLingua();
  return (
    <div className="admin-splash">
      <div className="logo-mark" aria-hidden="true" />
      <p className="mono" style={{ marginTop: '1rem', opacity: 0.8 }}>{t('com.caricamento')}</p>
    </div>
  );
}

// ============================================================
// ⚠️ PERCHE' LA DASHBOARD E' UN COMPONENTE A PARTE E NON IL CORPO DI
// `AdminDashboard`. NON RIPORTARLA DENTRO.
//
// `AdminDashboard` e' il componente che MONTA `LinguaProvider`.
// `useLingua()` chiamato li' dentro non leggerebbe il contenitore che
// sta montando in quel momento — leggerebbe quello che c'e' PIU' SU,
// cioe' nessuno: il valore di serie del contesto. Risultato: la
// dashboard resterebbe in italiano per sempre e il cambio di lingua
// dal selettore non arriverebbe mai qui, mentre le sezioni figlie
// cambierebbero. Un guasto che si vede solo provando a cambiare
// lingua, ed e' il modo piu' rapido di far sembrare rotto il selettore.
//
// Quindi tutto quello che ha bisogno di `t` sta QUI, sotto il
// contenitore. E sta al primo livello del file, non annidato dentro
// `AdminDashboard`: un componente definito dentro un altro componente
// viene ricreato a ogni disegno, e React lo tratta come un tipo nuovo —
// smonterebbe e rimonterebbe tutte e ventotto le sezioni a ogni
// battito di stato, perdendo quali erano aperte.
// ============================================================
type PropsContenuto = {
  circolo: Circolo;
  campi: Campo[];
  blocchi: Blocco[];
  soci: SocioCircolo[];
  prenotazioni: PrenotazioneAdmin[];
  maestri: MaestroConUid[];
  sfide: Sfida[];
  responsabile: ProfiloResponsabile;
  // Nulla per l'Admin vero: vedi `AdminDashboard`.
  scadenzaSessione: number | null;
  socioSelUid: string | null;
  onSelezionaSocio: (uid: string | null) => void;
  onEsci: () => void;
};

function ContenutoDashboard({
  circolo, campi, blocchi, soci, prenotazioni, maestri, sfide,
  responsabile, scadenzaSessione, socioSelUid, onSelezionaSocio, onEsci,
}: PropsContenuto) {
  const { t } = useLingua();
  const router = useRouter();

  // ⚠️ I COLORI DEL PANNELLO ARRIVANO IN DUE TEMPI, e l'ordine conta.
  // Prima quelli conservati in questo browser — che ci sono subito, senza
  // aspettare la rete — poi quelli del circolo, che sono la verità e
  // valgono per tutti. Al contrario, chi ha scelto un fondo scuro
  // vedrebbe mezzo secondo di pagina chiara a ogni apertura: un lampo
  // bianco che sembra un difetto.
  const [tema, setTema] = useState<TemaDashboard>(TEMA_ADMIN_DI_PARTENZA);

  useEffect(() => {
    const locale = leggiTemaLocale(`circolo.${circolo.id}`);
    if (locale) setTema(locale);
    let vivo = true;
    leggiTemaCircolo(circolo.id).then((salvato) => {
      // ⚠️ `vivo`: la lettura può tornare dopo che si è già usciti dalla
      // dashboard, e scrivere in uno stato che non esiste più è un
      // avviso in console a ogni uscita.
      if (vivo && salvato) setTema(salvato);
    });
    return () => { vivo = false; };
  }, [circolo.id]);

  return (
    <div className="admin-shell" style={variabiliCss(tema) as React.CSSProperties}>
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
            <div className="mono" style={{ opacity: 0.75 }}>{t('adm.gen.ruoloIntestazione')}</div>
            <h1 className="display" style={{ fontSize: '1.7rem', marginTop: '.2rem' }}>{circolo.nome}</h1>
            {/* ⚠️ DA QUANDO IL CIRCOLO È IN RETE, accanto al nome. È la
                data da cui parte il conteggio delle mezz'ore più in
                basso: senza, quel totale è un numero che non si può
                giudicare — grande o piccolo rispetto a che cosa?
                Sta sotto il nome e sopra la riga del Collaboratore, che
                resta l'ultima cosa della testata perché è la più
                urgente da leggere quando c'è. */}
            {attivazioneCircoloMs(circolo) !== null && (
              <div className="mono" style={{ opacity: 0.75, fontSize: '.72rem', marginTop: '.3rem' }}>
                {t('adm.ric2.attivoDal', { data: giornoLeggibile(attivazioneCircoloMs(circolo)) })}
              </div>
            )}
            {/* ⚠️ CHI SEI, scritto. Le due porte d'ingresso — l'account
                del responsabile e la password condivisa dello staff —
                aprivano una dashboard identica, e da dentro non c'era
                un solo segno che dicesse con quale delle due si era
                entrati. Quando una sezione si comporta diversamente nei
                due casi, quel silenzio si legge come un guasto. */}
            {scadenzaSessione != null && (
              <div className="admin-header-collab">
                {/* ⚠️ L'ora resta scritta all'italiana (24 ore, `it-IT`)
                    anche in inglese e in tedesco: e' l'orologio del
                    circolo, e tutta la dashboard — griglia campi
                    compresa — mostra le ore cosi'. Due formati nella
                    stessa schermata si leggono come un errore. */}
                {t('adm.gen.accessoCollaboratore', {
                  ora: new Date(scadenzaSessione)
                    .toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }),
                })}
              </div>
            )}
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
          <button className="btn btn-outline admin-logout-btn" onClick={onEsci}>{t('adm.gen.esci')}</button>
        </div>
      </header>

      {/* ============================================================
          ⚠️ LA PANORAMICA STA FUORI DA `main.admin-main`, e non e' un
          capriccio: quel contenitore e' una griglia a DUE COLONNE
          (`column-count: 2`), quindi qualunque cosa ci si metta dentro
          nasce larga meta' schermo. La panoramica ha una tabella a
          sette colonne e tre righe di numeri: in mezza pagina
          scorrerebbe in orizzontale, che e' il modo piu' rapido di
          rendere illeggibile una schermata fatta per essere letta a
          colpo d'occhio.

          Sta in un contenitore suo con lo stesso ingombro esterno di
          `main` — stessa larghezza massima, stesso padding — cosi' si
          allinea al resto della pagina ma prende tutta la riga.
          ============================================================ */}
      {/* ⚠️ A TUTTI, Collaboratore compreso, e il giro precedente aveva
          deciso il contrario. Il ragionamento era: le regole gli negano
          la fotografia, quindi vedrebbe persone e denaro ma non
          attività. Sbagliato due volte. Il Collaboratore legge già
          tutte le tessere del circolo — senza non potrebbe fare una
          ricarica — quindi la fotografia non gli dice niente di nuovo,
          gli dice le stesse cose sommate. E una sezione che sparisce
          senza una parola non si distingue da una sezione che non è
          arrivata. Adesso la fotografia la legge anche lui; al solo
          responsabile resta il tasto che la rifà. */}
      <div className="admin-larga">
        <SezioneCollassabile
          id="panoramica"
          titolo={t('adm.gen.sez.panoramica.titolo')}
          descrizione={t('adm.gen.sez.panoramica.descrizione')}
          apertaDiPartenza
        >
          <SezionePanoramicaCircolo
            circoloId={circolo.id}
            statoCircolo={statoCircolo(circolo)}
            attivatoIlMs={attivazioneCircoloMs(circolo)}
            soci={soci}
            onSelezionaSocio={onSelezionaSocio}
            puoAggiornare={scadenzaSessione == null}
          />
        </SezioneCollassabile>
      </div>

      <main className="admin-main">
        {/* ============================================================
            ⚠️ LE SEZIONI SONO IN ORDINE ALFABETICO, e l'ordine lo decide
            `SezioniOrdinate` quando la pagina si disegna — non l'ordine
            in cui sono scritte qui sotto.

            Il motivo e' che i titoli sono tradotti: riordinare le righe
            avrebbe dato l'ordine giusto in italiano e un ordine casuale
            in inglese e in tedesco. «Prezzi delle ore» sta fra P e Q in
            italiano, ma e' «Hourly prices» sotto la H e «Stundenpreise»
            sotto la S.

            ⚠️ LA PANORAMICA NON E' QUI DENTRO: sta sopra, nel suo
            contenitore a tutta riga, e per questo resta in cima
            qualunque sia la lingua. Non e' una sezione fra le altre —
            e' il quadro d'insieme da cui si parte.

            ⚠️ Aggiungendo una sezione non c'e' nessun ordine da
            rispettare: la si scrive dove capita e finisce al suo posto
            da sola.
            ============================================================ */}
        <SezioniOrdinate confronta={confrontaTitoli}>
        {/* ⚠️ LA SEZIONE «TEST RESET» NON C'È PIÙ, ed è passata al Super
            Admin. Azzerava crediti, prenotazioni, movimenti, avvisi,
            sfide e lezioni di un intero circolo, e stava in cima alla
            Dashboard di ogni presidente. Adesso è una funzione del
            server (`resettaCircolo`), la chiama solo il team Racket
            Fever dalla scheda del circolo, e prima del reset totale
            propone di archiviare il registro. */}
        <SezioneCollassabile id="personalizza" titolo={t('adm.gen.sez.personalizza.titolo')} descrizione={t('adm.gen.sez.personalizza.descrizione')}>
          <SezionePersonalizzaApp circolo={circolo} />
        </SezioneCollassabile>
        <SezioneCollassabile
          id="banner"
          titolo={t('adm.gen.sez.banner.titolo')}
          descrizione={t('adm.gen.sez.banner.descrizione')}
        >
          <SezioneBannerMarketing circolo={circolo} />
        </SezioneCollassabile>
        {/* Subito dopo le due personalizzazioni dell'app: chi cerca
            «dove si cambiano i colori» le apre tutte e tre nello stesso
            momento, e tenerle lontane vorrebbe dire farle cercare. */}
        {/* ⚠️ `titolo` e `id` non li usa il componente: li legge
            `SezioniOrdinate` per sapere dove metterlo e con quale
            chiave. Senza, questa sezione sarebbe l'unica a non avere un
            posto nell'ordine e finirebbe in fondo. */}
        <SezionePersonalizzaDashboard
          id="temaDashboard"
          titolo={t('adm.gen.sez.temaDash.titolo')}
          circoloId={circolo.id}
          tema={tema}
          setTema={setTema}
          puoSalvare={scadenzaSessione == null}
        />
        {/* ⚠️ LE DUE SERRATURE NON SI MOSTRANO A CHI È ENTRATO CON UNA
            CHIAVE A SCADENZA. Erano montate per tutti, e il Collaboratore
            si trovava davanti il proprio campo password già compilato:
            poteva cambiarselo e rientrare per sempre, oppure cambiare
            quello dei soci e chiudere fuori il circolo. Le regole adesso
            lo negano (firestore.rules: /privato e il campo `password` del
            circolo), e queste due righe fanno in modo che non veda un
            comando destinato a essere respinto. */}
        {scadenzaSessione == null && (
          <>
            <SezioneCollassabile id="password" titolo={t('adm.gen.sez.password.titolo')} descrizione={t('adm.gen.sez.password.descrizione')}>
              <SezionePassword circolo={circolo} />
            </SezioneCollassabile>
            <SezioneCollassabile id="collaboratori" titolo={t('adm.gen.sez.collaboratori.titolo')} descrizione={t('adm.gen.sez.collaboratori.descrizione')}>
              <SezioneCollaboratori circoloId={circolo.id} />
            </SezioneCollassabile>
          </>
        )}
        <SezioneCollassabile id="campi" titolo={t('adm.gen.sez.campi.titolo')} descrizione={t('adm.gen.sez.campi.descrizione')}>
          <SezioneCampi circoloId={circolo.id} campi={campi} />
        </SezioneCollassabile>
        {/* La Bacheca sta PRIMA dei Tornei, e nell'ordine c'e' un
            senso: la bacheca e' quotidiana — una chiusura, una quota,
            un avviso — mentre un torneo si pubblica ogni tanto. Quello
            che si usa tutti i giorni sta sopra. */}
        <SezioneCollassabile id="bacheca" titolo={t('adm.gen.sez.bacheca.titolo')} descrizione={t('adm.gen.sez.bacheca.descrizione')}>
          {/* ⚠️ Il Collaboratore vede la bacheca ma non il comando che fa
              squillare i telefoni: `avvisaBacheca` pretende il
              responsabile. Stessa regola dell'app. */}
          <SezioneBacheca circolo={circolo} autoreNome={circolo.nome} puoNotificare={scadenzaSessione == null} />
        </SezioneCollassabile>
        <SezioneCollassabile id="tornei" titolo={t('adm.gen.sez.tornei.titolo')} descrizione={t('adm.gen.sez.tornei.descrizione')}>
          <SezioneTornei circolo={circolo} />
        </SezioneCollassabile>
        <SezioneCollassabile id="limite" titolo={t('adm.gen.sez.limite.titolo')} descrizione={t('adm.gen.sez.limite.descrizione')}>
          <SezioneLimite circolo={circolo} />
        </SezioneCollassabile>
        <SezioneCollassabile id="fido" titolo={t('adm.gen.sez.fido.titolo')} descrizione={t('adm.gen.sez.fido.descrizione')}>
          <SezioneFido circolo={circolo} />
        </SezioneCollassabile>
        <SezioneCollassabile id="bonifico" titolo={t('adm.gen.sez.bonifico.titolo')} descrizione={t('adm.gen.sez.bonifico.descrizione')}>
          <SezioneBonifico circolo={circolo} />
        </SezioneCollassabile>
        <SezioneCollassabile id="limite-cancellazione" titolo={t('adm.gen.sez.limite-cancellazione.titolo')} descrizione={t('adm.gen.sez.limite-cancellazione.descrizione')}>
          <SezioneLimiteCancellazione circolo={circolo} />
        </SezioneCollassabile>
        <SezioneCollassabile id="prezzi" titolo={t('adm.gen.sez.prezzi.titolo')} descrizione={t('adm.gen.sez.prezzi.descrizione')}>
          <SezionePrezzi circoloId={circolo.id} campi={campi} />
        </SezioneCollassabile>
        <SezioneCollassabile id="blocchi" titolo={t('adm.gen.sez.blocchi.titolo')} descrizione={t('adm.gen.sez.blocchi.descrizione')}>
          <SezioneBlocchi circoloId={circolo.id} campi={campi} blocchi={blocchi} />
        </SezioneCollassabile>
        <SezioneCollassabile id="richieste" titolo={t('adm.gen.sez.richieste.titolo')} descrizione={t('adm.gen.sez.richieste.descrizione')}>
          <SezioneRichiesteTessera circolo={circolo} approvatore={responsabile.email} />
        </SezioneCollassabile>
        {/* Accanto alle richieste, non in fondo: sono le due cose che
            un segretario guarda quando apre la dashboard per vedere
            «cosa è arrivato». */}
        <SezioneCollassabile
          id="segnalazioni"
          titolo={t('adm.gen.sez.segnalazioni.titolo')}
          descrizione={t('adm.gen.sez.segnalazioni.descrizione')}
        >
          <SezioneSegnalazioni circolo={circolo} />
        </SezioneCollassabile>
        {/* Il registro non e' una sezione collassabile ma una pagina a
            se': un estratto conto ha bisogno di spazio per i filtri,
            per la tabella e per la stampa. */}
        <button className="admin-riga-registro" onClick={() => router.push('/admin/movimenti')}>
          <div style={{ flex: 1, textAlign: 'left' }}>
            <div className="admin-riga-registro-titolo">{t('adm.gen.registroTitolo')}</div>
            <div className="admin-riga-registro-sub">
              {t('adm.gen.registroDescrizione')}
            </div>
          </div>
          <span aria-hidden>›</span>
        </button>

        {/* Subito sotto il registro, e non in fondo: il registro dice
            che cosa è entrato nelle tasche del circolo, questa dice
            che cosa ne esce verso Racket Fever. Sono le due facce
            dello stesso conto e si leggono di seguito. */}
        <SezioneCollassabile
          id="ricavi"
          titolo={t('adm.ric2.sez.titolo')}
          descrizione={t('adm.ric2.sez.descrizione')}
        >
          {/* ⚠️ `campi` non serve più: se ne andava nel riempimento dei
              campi, che era uno dei numeri incrociati buttati via
              insieme alle commissioni. */}
          <SezioneRicavi circolo={circolo} />
        </SezioneCollassabile>

        <SezioneCollassabile id="saldare" titolo={t('adm.gen.sez.saldare.titolo')} descrizione={t('adm.gen.sez.saldare.descrizione')}>
          <SezioneTessereDaSaldare circolo={circolo} />
        </SezioneCollassabile>
        {/* «Soci» e «Debiti dei Soci» stanno DENTRO la Panoramica, in
            cima alla pagina, per tutti. Non esistono più sciolte per
            nessuno: erano rimaste qui per il solo Collaboratore, e due
            strade per la stessa schermata prima o poi divergono. */}
        <SezioneCollassabile id="maestri" titolo={t('adm.gen.sez.maestri.titolo')} descrizione={t('adm.gen.sez.maestri.descrizione')}>
          <SezioneMaestri circoloId={circolo.id} maestri={maestri} prenotazioni={prenotazioni} />
        </SezioneCollassabile>
        <SezioneCollassabile id="classifica" titolo={t('adm.gen.sez.classifica.titolo')} descrizione={t('adm.gen.sez.classifica.descrizione')}>
          <SezioneClassificaSociale circolo={circolo} soci={soci} sfide={sfide} />
        </SezioneCollassabile>
        <SezioneCollassabile id="sfide" titolo={t('adm.gen.sez.sfide.titolo')} descrizione={t('adm.gen.sez.sfide.descrizione')}>
          <SezioneSfideInCorso sfide={sfide} soci={soci} circolo={circolo} puoCambiareSfide={scadenzaSessione == null} />
        </SezioneCollassabile>
        <SchedaSocioModal
          circoloId={circolo.id}
          limiteFido={limiteFidoDi(circolo)}
          socio={socioSelUid ? soci.find((x) => x.uid === socioSelUid) ?? null : null}
          prenotazioni={prenotazioni}
          onClose={() => onSelezionaSocio(null)}
        />
        <SezioneCollassabile id="prenotazioni" titolo={t('adm.gen.sez.prenotazioni.titolo')} descrizione={t('adm.gen.sez.prenotazioni.descrizione')}>
          <SezionePrenotazioni campi={campi} blocchi={blocchi} prenotazioni={prenotazioni} sfide={sfide} circolo={circolo} soci={soci} nomeEsecutore={`${responsabile.nome} ${responsabile.cognome}`} />
        </SezioneCollassabile>
        <SezioneCollassabile id="note" titolo={t('adm.gen.sez.note.titolo')} descrizione={t('adm.gen.sez.note.descrizione')}>
          <SezioneNotePrenotazioni prenotazioni={prenotazioni} />
        </SezioneCollassabile>
        <SezioneCollassabile id="lezioni" titolo={t('adm.gen.sez.lezioni.titolo')} descrizione={t('adm.gen.sez.lezioni.descrizione')}>
          <SezioneLezioniPrenotate
            prenotazioni={prenotazioni}
            circoloId={circolo.id}
            nomeEsecutore={`${responsabile.nome} ${responsabile.cognome}`}
          />
        </SezioneCollassabile>
        </SezioniOrdinate>
      </main>
    </div>
  );
}
