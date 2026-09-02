// ============================================================
// SPAZIO WEB DEL CIRCOLO — ASD Circolo Tennis Sant'Agata.
// Indirizzo: /asdcircolosantagata
//
// ⚠️ TUTTO IL CONTENUTO STA NELL'OGGETTO `CIRCOLO` QUI SOTTO, e non
// sparso nel JSX. Non e' un vezzo: lo spazio web e' parte dell'offerta
// che facciamo ai circoli, quindi questa pagina e' il primo esemplare
// di una serie. Con i dati raccolti in un punto solo, il secondo
// circolo si fa copiando il file e cambiando l'oggetto; il giorno che
// diventa automatica, quell'oggetto lo si legge da Firestore e il JSX
// non si tocca. Se un testo finisce dentro il JSX, quel giorno si
// riscrive tutto.
//
// ⚠️ LE ETICHETTE «DA CONFERMARE» SONO VOLUTE. Indirizzo esatto,
// telefono, email, tariffe e alcune date sono dati che abbiamo scritto
// noi per far vedere la pagina al Circolo: finche' non li conferma
// loro, restano segnati in giallo. Prima di mandare la pagina online
// per davvero non ne deve restare nemmeno una.
//
// ⚠️ LA PAGINA E' BIANCA DENTRO UN SITO NERO. Il fondo, i tre
// selettori di elemento (`nav`, `section`, `footer`) e i colori sono
// scavalcati nel blocco `.cir-*` in fondo a app/globals.css. Niente
// font nuovi: Archivo e Spline Sans Mono li carica gia' il layout.
// ============================================================

import type { Metadata } from 'next';
import { Fragment } from 'react';
import Link from 'next/link';
import { SITO } from '../../data/consenso';

// ⚠️ Gli stessi due indirizzi della home, e per lo stesso motivo:
// finche' sono stringhe vuote i due distintivi restano spenti e
// dichiarati `aria-disabled`. Il giorno della pubblicazione si
// scrivono qui e in app/page.tsx — sono due file, non uno.
const LINK_APP_STORE = '';
const LINK_GOOGLE_PLAY = '';

const BASE = '/asdcircolosantagata';

const CIRCOLO = {
  nome: 'ASD Circolo Tennis Sant’Agata',
  comune: 'Sant’Agata di Militello',
  provincia: 'ME',
  logo: `${BASE}/logo-circolo.png`,
  affiliazioni: `${BASE}/affiliazioni.png`,

  apertura:
    'Associazione sportiva dilettantistica affiliata alla Federazione Italiana '
    + 'Tennis e Padel. Due campi in cemento con illuminazione, scuola tennis, '
    + 'corsi per ragazzi e campus estivi. L’accesso ai campi è consentito ai '
    + 'soci e, su prenotazione, anche ai non soci.',

  prospetto: [
    { voce: 'Campi', valore: '2, in cemento' },
    { voce: 'Illuminazione', valore: 'Su entrambi' },
    { voce: 'Affiliazione', valore: 'FITP — CONI' },
    { voce: 'Prenotazioni', valore: 'App Racket Fever' },
  ],

  campi: [
    {
      nome: 'Campo 1',
      foto: `${BASE}/campo.jpg`,
      dati: [
        ['Superficie', 'Cemento'],
        ['Misure', '23,77 × 10,97 m'],
        ['Illuminazione', 'Sì'],
        ['Uso', 'Singolare e doppio'],
      ],
    },
    {
      nome: 'Campo 2',
      foto: `${BASE}/campo.jpg`,
      dati: [
        ['Superficie', 'Cemento'],
        ['Misure', '23,77 × 10,97 m'],
        ['Illuminazione', 'Sì'],
        ['Uso', 'Singolare, doppio e corsi'],
      ],
    },
  ],

  servizi: [
    {
      titolo: 'Spogliatoi',
      testo: 'Spogliatoi con docce, disponibili negli orari di apertura del circolo.',
    },
    {
      titolo: 'Parcheggio',
      testo: 'Parcheggio interno gratuito.',
    },
  ],

  sponsor: {
    principale: { nome: 'Ristorante Pizzeria La Risacca', file: `${BASE}/sponsor-larisacca.png` },
    altri: [
      { nome: 'Amadore Costruzioni s.r.l.', file: `${BASE}/sponsor-amadore.png` },
      { nome: 'Unieuro Mediastore di Petrisi', file: `${BASE}/sponsor-unieuro.png` },
    ],
  },

  orari: [
    ['Lunedì – Venerdì', '8:00 – 24:00'],
    ['Sabato', '8:00 – 24:00'],
    ['Domenica', '8:00 – 20:00'],
  ],
};

export const metadata: Metadata = {
  title: `${CIRCOLO.nome} — Sant’Agata di Militello`,
  description:
    'Due campi in cemento, scuola tennis, corsi per ragazzi e campus estivi. '
    + 'Prenotazione dei campi dall’app Racket Fever.',
  alternates: { canonical: `${SITO}/asdcircolosantagata` },
  openGraph: {
    type: 'website',
    locale: 'it_IT',
    title: CIRCOLO.nome,
    description:
      'Circolo tennis a Sant’Agata di Militello (ME). Due campi in cemento, '
      + 'scuola tennis, corsi per ragazzi e campus estivi.',
  },
};

/** Segno per un dato che il Circolo non ha ancora confermato. */
function DaConfermare() {
  return <span className="cir-daconfermare">da confermare</span>;
}

export default function PaginaCircoloSantAgata() {
  return (
    <div className="cir-pagina">

      {/* ---------------- Testata ---------------- */}
      <nav className="cir-nav">
        <a className="cir-nav-marchio" href="#top" aria-label={`${CIRCOLO.nome} — inizio pagina`}>
          <img src={CIRCOLO.logo} alt={CIRCOLO.nome} width={465} height={154} />
        </a>
        <div className="cir-nav-voci">
          <a href="#circolo">Il circolo</a>
          <a href="#campi">Campi</a>
          <a href="#scuola">Scuola tennis</a>
          <a href="#servizi">Servizi</a>
          <a href="#sponsor">Sponsor</a>
          <a href="#contatti">Contatti</a>
        </div>
        <a className="cir-btn" href="#prenotazioni">Prenota un campo</a>
      </nav>

      {/* ---------------- Apertura ---------------- */}
      <header className="cir-apertura" id="top">
        <div className="cir-dentro">
          <p className="cir-occhiello">
            {CIRCOLO.comune} ({CIRCOLO.provincia}) &middot; Associazione sportiva dilettantistica
          </p>
          <h1 className="cir-titolo" style={{ marginTop: '.8rem' }}>{CIRCOLO.nome}</h1>
          <p className="cir-testo">{CIRCOLO.apertura}</p>
          <div className="cir-azioni">
            <a className="cir-btn" href="#prenotazioni">Prenota un campo</a>
            <a className="cir-btn cir-btn-vuoto" href="#contatti">Contatti e orari</a>
          </div>

          <dl className="cir-prospetto">
            {CIRCOLO.prospetto.map((r) => (
              <div key={r.voce}>
                <dt>{r.voce}</dt>
                <dd>{r.valore}</dd>
              </div>
            ))}
          </dl>
        </div>
      </header>

      {/* ---------------- Il circolo ---------------- */}
      <section id="circolo">
        <div className="cir-dentro">
          <hr className="cir-filetto" />
          <div className="cir-intestazione" style={{ marginTop: '1.6rem' }}>
            <p className="cir-occhiello">Il circolo</p>
            <h2 className="cir-sezione-titolo">Struttura e attivit&agrave;</h2>
          </div>
          <div className="cir-coppia-larga">
            <div>
              <p className="cir-testo">
                Il Circolo Tennis Sant&rsquo;Agata &egrave; un&rsquo;associazione sportiva
                dilettantistica con sede a {CIRCOLO.comune}, in provincia di Messina.
                Dispone di due campi in cemento con illuminazione, spogliatoi con
                docce, spazio bar e servizio di incordatura.
              </p>
              <p className="cir-testo">
                L&rsquo;attivit&agrave; comprende il gioco libero su prenotazione, le lezioni
                individuali e collettive, i corsi per ragazzi durante l&rsquo;anno
                sportivo e i campus estivi nei mesi di giugno e luglio. Il circolo
                organizza inoltre un torneo sociale nel periodo estivo.<DaConfermare />
              </p>
            </div>
            <dl className="cir-dati" style={{ marginTop: 0 }}>
              <dt>Costituzione</dt><dd>1986<DaConfermare /></dd>
              <dt>Soci</dt><dd>circa 180<DaConfermare /></dd>
              <dt>Affiliazione</dt><dd>FITP, CONI</dd>
              <dt>Accesso</dt><dd>Soci e non soci</dd>
              <dt>Superficie campi</dt><dd>Cemento</dd>
            </dl>
          </div>
        </div>
      </section>

      {/* ---------------- I campi ---------------- */}
      <section id="campi" style={{ background: 'var(--cir-carta-2)', borderTop: '1px solid var(--cir-linea)', borderBottom: '1px solid var(--cir-linea)' }}>
        <div className="cir-dentro">
          <div className="cir-intestazione">
            <p className="cir-occhiello">I campi</p>
            <h2 className="cir-sezione-titolo">Due campi in cemento, misure regolamentari</h2>
          </div>
          <div className="cir-coppia">
            {CIRCOLO.campi.map((c) => (
              <figure className="cir-figura" key={c.nome}>
                <img src={c.foto} alt={`${c.nome} — campo in cemento`} width={595} height={321} />
                <figcaption>
                  <p className="cir-nome-campo">{c.nome}</p>
                  <dl className="cir-dati">
                    {c.dati.map(([k, v]) => (
                      <Fragment key={k}>
                        <dt>{k}</dt><dd>{v}</dd>
                      </Fragment>
                    ))}
                  </dl>
                </figcaption>
              </figure>
            ))}
          </div>
          <p className="cir-testo" style={{ marginTop: '2rem' }}>
            I campi si prenotano a mezz&rsquo;ore tramite l&rsquo;applicazione Racket Fever,
            che mostra in tempo reale le fasce ancora libere.
          </p>
        </div>
      </section>

      {/* ---------------- Scuola tennis: lezioni ---------------- */}
      <section id="scuola">
        <div className="cir-dentro">
          <div className="cir-intestazione">
            <p className="cir-occhiello">Scuola tennis</p>
            <h2 className="cir-sezione-titolo">Lezioni individuali e collettive</h2>
          </div>
          <div className="cir-coppia">
            <div>
              <p className="cir-testo">
                Le lezioni si svolgono su prenotazione, in forma individuale, a
                coppie o in piccoli gruppi, dal mattino alla sera. La richiesta si
                inoltra dall&rsquo;applicazione: si propone un orario, il maestro lo
                conferma oppure ne propone un altro.
              </p>
              <p className="cir-testo">
                Le lezioni sono rivolte anche a chi inizia da adulto. Il circolo
                mette a disposizione le racchette per le prime lezioni.
              </p>
              <dl className="cir-dati" style={{ marginTop: '1.4rem' }}>
                <dt>Individuale</dt><dd>60 minuti, un allievo</dd>
                <dt>A coppie</dt><dd>60 minuti, due allievi</dd>
                <dt>Gruppo</dt><dd>Fino a 4 allievi, su richiesta</dd>
                <dt>Tariffe</dt><dd>Presso il circolo<DaConfermare /></dd>
              </dl>
            </div>
            <figure className="cir-figura">
              <img src={`${BASE}/lezioni.jpg`} alt="Lezione individuale con il maestro" width={661} height={438} />
            </figure>
          </div>
        </div>
      </section>

      {/* ---------------- Corsi ragazzi e campus ---------------- */}
      <section id="ragazzi" style={{ background: 'var(--cir-carta-2)', borderTop: '1px solid var(--cir-linea)', borderBottom: '1px solid var(--cir-linea)' }}>
        <div className="cir-dentro">
          <div className="cir-intestazione">
            <p className="cir-occhiello">Corsi ragazzi e campus estivi</p>
            <h2 className="cir-sezione-titolo">Attivit&agrave; giovanile</h2>
          </div>
          <div className="cir-coppia">
            <figure className="cir-figura">
              <img src={`${BASE}/corsi-ragazzi.jpg`} alt="Corso per ragazzi sul campo" width={666} height={443} />
            </figure>
            <div>
              <p className="cir-testo">
                I corsi per ragazzi si svolgono da ottobre a maggio, nei pomeriggi
                infrasettimanali, con gruppi divisi per et&agrave; e livello.
                L&rsquo;avviamento utilizza palline depressurizzate e campo ridotto.
              </p>
              <p className="cir-testo">
                Nei mesi di giugno e luglio il circolo organizza i campus estivi,
                dal luned&igrave; al venerd&igrave; in fascia mattutina. La partecipazione
                &egrave; ammessa anche per singole settimane e non richiede esperienza
                pregressa.
              </p>
              <dl className="cir-dati" style={{ marginTop: '1.4rem' }}>
                <dt>Corsi</dt><dd>Ottobre &ndash; Maggio, pomeriggio<DaConfermare /></dd>
                <dt>Campus</dt><dd>Giugno &ndash; Luglio, 8:30 &ndash; 13:00<DaConfermare /></dd>
                <dt>Et&agrave;</dt><dd>Da 5 a 14 anni<DaConfermare /></dd>
                <dt>Gruppi</dt><dd>Massimo 6 allievi per campo<DaConfermare /></dd>
              </dl>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------- Servizi ---------------- */}
      <section id="servizi">
        <div className="cir-dentro">
          <div className="cir-intestazione">
            <p className="cir-occhiello">Servizi</p>
            <h2 className="cir-sezione-titolo">Spazio bar e incordatura</h2>
          </div>
          <div className="cir-coppia">
            <figure className="cir-figura cir-figura-pari">
              <img src={`${BASE}/bar.jpg`} alt="Lo spazio bar del circolo" width={667} height={442} />
              <figcaption>
                <p className="cir-nome-campo">Spazio bar</p>
                <p className="cir-testo" style={{ fontSize: '.94rem', marginTop: '.4rem' }}>
                  Servizio bar con tavoli all&rsquo;aperto affacciati sui campi, aperto
                  negli orari del circolo.
                </p>
              </figcaption>
            </figure>
            <figure className="cir-figura cir-figura-pari">
              <img src={`${BASE}/incordatura.jpg`} alt="Macchina incordatrice del circolo" width={591} height={442} />
              <figcaption>
                <p className="cir-nome-campo">Servizio incordatura</p>
                <p className="cir-testo" style={{ fontSize: '.94rem', marginTop: '.4rem' }}>
                  Incordatura eseguita presso il circolo, con corde disponibili in
                  sede. Tensione a richiesta, indicativamente fra 20 e 26 kg.<DaConfermare />
                </p>
              </figcaption>
            </figure>
          </div>

          <ul className="cir-elenco">
            {CIRCOLO.servizi.map((s) => (
              <li key={s.titolo}>
                <h3>{s.titolo}</h3>
                <p>{s.testo}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ============================================================
          PRENOTAZIONI — l'unico blocco nero della pagina, ed e' nero
          perche' e' il nostro: qui parla Racket Fever, non il Circolo.
          Il resto della pagina resta bianco, come chiesto.
          ============================================================ */}
      <section className="cir-rf" id="prenotazioni">
        <div className="cir-dentro">
          <img className="cir-rf-logo" src="/logo-rf-esteso-bianco.png" alt="Racket Fever" width={1200} height={400} />
          <div className="cir-coppia-larga">
            <div>
              <p className="cir-occhiello">Prenotazioni</p>
              <h2 className="cir-sezione-titolo">I campi si prenotano dall&rsquo;app</h2>
              <p className="cir-testo" style={{ marginTop: '1rem' }}>
                Il circolo utilizza Racket Fever per la gestione delle prenotazioni.
                L&rsquo;applicazione &egrave; gratuita e mostra la disponibilit&agrave; dei due campi
                mezz&rsquo;ora per mezz&rsquo;ora. Si possono indicare i compagni di gioco: il
                costo viene ripartito e la prenotazione &egrave; visibile anche a loro.
              </p>
              <div className="cir-store">
                {LINK_APP_STORE ? (
                  <a className="cir-distintivo" href={LINK_APP_STORE}>
                    <small>Scarica su</small><strong>App Store</strong>
                  </a>
                ) : (
                  <span className="cir-distintivo" aria-disabled="true">
                    <small>Scarica su</small><strong>App Store</strong>
                  </span>
                )}
                {LINK_GOOGLE_PLAY ? (
                  <a className="cir-distintivo" href={LINK_GOOGLE_PLAY}>
                    <small>Disponibile su</small><strong>Google Play</strong>
                  </a>
                ) : (
                  <span className="cir-distintivo" aria-disabled="true">
                    <small>Disponibile su</small><strong>Google Play</strong>
                  </span>
                )}
              </div>
              {(!LINK_APP_STORE || !LINK_GOOGLE_PLAY) && (
                <p className="cir-nota">
                  I collegamenti agli store si attivano alla pubblicazione dell&rsquo;applicazione.
                </p>
              )}
            </div>
            <ol className="cir-passi">
              <li>
                <span className="cir-n">1</span>
                <span>Si scarica l&rsquo;app e si seleziona {CIRCOLO.nome} dall&rsquo;elenco dei circoli.</span>
              </li>
              <li>
                <span className="cir-n">2</span>
                <span>Si accede con la password fornita dal circolo.</span>
              </li>
              <li>
                <span className="cir-n">3</span>
                <span>Si consulta la griglia dei campi e si prenota la fascia desiderata.</span>
              </li>
              <li>
                <span className="cir-n">4</span>
                <span>Si aggiungono i compagni di gioco: il costo viene ripartito fra i partecipanti.</span>
              </li>
            </ol>
          </div>
        </div>
      </section>

      {/* ---------------- Sponsor ---------------- */}
      <section id="sponsor">
        <div className="cir-dentro">
          <div className="cir-intestazione">
            <p className="cir-occhiello">Sponsor</p>
            <h2 className="cir-sezione-titolo">Chi sostiene il circolo</h2>
          </div>
          <div className="cir-sponsor-principale">
            <img
              src={CIRCOLO.sponsor.principale.file}
              alt={`Main sponsor: ${CIRCOLO.sponsor.principale.nome}`}
              width={1200}
              height={400}
            />
          </div>
          <div className="cir-sponsor-riga">
            {CIRCOLO.sponsor.altri.map((s) => (
              <div key={s.nome}>
                <img src={s.file} alt={`Sponsor: ${s.nome}`} width={1200} height={400} />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------- Contatti ---------------- */}
      <section id="contatti" style={{ background: 'var(--cir-carta-2)', borderTop: '1px solid var(--cir-linea)' }}>
        <div className="cir-dentro">
          <div className="cir-intestazione">
            <p className="cir-occhiello">Contatti</p>
            <h2 className="cir-sezione-titolo">Sede e orari</h2>
          </div>
          <div className="cir-contatti">
            <div>
              <h3>Sede</h3>
              <p>
                {CIRCOLO.nome}<br />
                {CIRCOLO.comune} ({CIRCOLO.provincia})<br />
                <span className="cir-daconfermare">indirizzo da confermare</span>
              </p>
            </div>
            <div>
              <h3>Recapiti</h3>
              <p>
                <span className="cir-daconfermare">telefono da confermare</span><br />
                <span className="cir-daconfermare">email da confermare</span>
              </p>
            </div>
            <div>
              <h3>Orari</h3>
              <ul className="cir-orari">
                {CIRCOLO.orari.map(([giorno, ore]) => (
                  <li key={giorno}><span>{giorno}</span><span>{ore}</span></li>
                ))}
              </ul>
              <p style={{ marginTop: '.5rem' }}><DaConfermare /></p>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------- Piede ---------------- */}
      <footer>
        <div className="cir-dentro cir-piede-dentro">
          <img
            className="cir-affiliazioni"
            src={CIRCOLO.affiliazioni}
            alt="Affiliazioni: CONI e Federazione Italiana Tennis e Padel"
            width={465}
            height={118}
          />
          <p>&copy; {new Date().getFullYear()} {CIRCOLO.nome}</p>
          <p>
            Spazio web e piattaforma di prenotazione:{' '}
            <Link href="/">Racket Fever</Link>
          </p>
        </div>
      </footer>

    </div>
  );
}
