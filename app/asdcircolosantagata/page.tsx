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
// ⚠️ L'ORDINE DI `giornata` E' LA STRUTTURA DELLA PAGINA. Le sezioni
// non sono un catalogo di servizi: sono i momenti della giornata del
// circolo, e le ore che le marcano NON sono una numerazione
// decorativa — sono l'orario in cui quella cosa succede davvero. Se
// cambia l'orario cambia il numero; se si aggiunge un momento, la
// sezione cresce da sola. Chi ordinasse l'elenco per comodita' invece
// che per orario romperebbe l'unica cosa che quella colonna dice.
//
// ⚠️ LE ETICHETTE «DA CONFERMARE» SONO VOLUTE. Indirizzo, telefono,
// email, tariffe, anno di costituzione e alcune date sono dati che
// abbiamo scritto noi per far vedere la pagina al Circolo: finche'
// non li conferma loro, restano segnati in giallo. Prima di mandare
// la pagina online per davvero non ne deve restare nemmeno una.
//
// ⚠️ LA PAGINA E' CHIARA DENTRO UN SITO NERO, e le regole che lo
// rendono possibile stanno nel blocco `.cir-*` in fondo a
// app/globals.css: leggerne le avvertenze prima di toccare i fondi
// delle sezioni.
// ============================================================

import type { Metadata } from 'next';
import Link from 'next/link';
import { SITO } from '../../data/consenso';

// ⚠️ Gli stessi due indirizzi della home, e per lo stesso motivo:
// finche' sono stringhe vuote i due distintivi restano spenti e
// dichiarati `aria-disabled`, perche' un pulsante «Scarica» che non
// porta da nessuna parte e' peggio di un pulsante che non c'e'. Il
// giorno della pubblicazione si scrivono qui E in app/page.tsx: sono
// due file, non uno.
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
    'Due campi in cemento con illuminazione, scuola tennis, corsi per ragazzi '
    + 'e campus estivi. Il circolo è aperto ai soci e, su prenotazione, anche '
    + 'a chi socio non è.',

  fascia: [
    { voce: 'Campi', valore: '2, in cemento' },
    { voce: 'Illuminazione', valore: 'Fino alle 24:00' },
    { voce: 'Affiliazione', valore: 'FITP — CONI' },
    { voce: 'Prenotazioni', valore: 'App Racket Fever' },
  ],

  // ⚠️ L'ordine di questo elenco È la struttura della pagina: si
  // aggiunge un momento e la sezione cresce da sola.
  giornata: [
    {
      ora: '08:00',
      titolo: 'Le lezioni',
      foto: `${BASE}/lezioni.jpg`,
      alt: 'Lezione individuale con il maestro',
      testi: [
        'Le lezioni si svolgono su prenotazione, dal mattino alla sera, in forma '
        + 'individuale, a coppie o in piccoli gruppi. La richiesta si inoltra '
        + 'dall’applicazione: si propone un orario, il maestro lo conferma oppure '
        + 'ne propone un altro.',
        'Sono rivolte anche a chi inizia da adulto. Per le prime lezioni il '
        + 'circolo mette a disposizione le racchette.',
      ],
      scheda: [
        ['Individuale', '60 minuti, un allievo'],
        ['A coppie', '60 minuti, due allievi'],
        ['Gruppo', 'Fino a 4 allievi, su richiesta'],
      ],
    },
    {
      ora: '16:30',
      titolo: 'I ragazzi',
      foto: `${BASE}/corsi-ragazzi.jpg`,
      alt: 'Corso per ragazzi sul campo',
      testi: [
        'Da ottobre a maggio i corsi occupano i pomeriggi infrasettimanali, con '
        + 'gruppi divisi per età e livello. L’avviamento utilizza palline '
        + 'depressurizzate e campo ridotto.',
        'A giugno e luglio gli stessi campi diventano campus estivi, dal lunedì '
        + 'al venerdì in fascia mattutina: si può partecipare anche per singole '
        + 'settimane, senza esperienza pregressa.',
      ],
      scheda: [
        ['Corsi', 'Ottobre – Maggio, pomeriggio'],
        ['Campus', 'Giugno – Luglio, 8:30 – 13:00'],
        ['Età', 'Da 5 a 14 anni'],
        ['Gruppi', 'Massimo 6 allievi per campo'],
      ],
      daConfermare: true,
    },
    {
      ora: '21:00',
      titolo: 'Il gioco sotto le luci',
      foto: null,
      alt: '',
      testi: [
        'Entrambi i campi sono illuminati e restano prenotabili fino a '
        + 'mezzanotte. È la fascia dei doppi serali, ed è quella che si esaurisce '
        + 'per prima: la griglia dell’applicazione mostra in tempo reale le '
        + 'mezz’ore ancora libere.',
      ],
      scheda: [
        ['Ultimo ingresso', '23:30'],
        ['Prenotazione', 'A mezz’ore'],
      ],
    },
    {
      ora: '23:00',
      titolo: 'Lo spazio bar',
      foto: `${BASE}/bar.jpg`,
      alt: 'Lo spazio bar del circolo',
      testi: [
        'Il servizio bar ha i tavoli all’aperto affacciati sui campi ed è aperto '
        + 'negli orari del circolo. È il punto in cui finiscono le partite, ed è '
        + 'anche la ragione per cui molti soci restano dopo aver giocato.',
      ],
      scheda: [
        ['Spogliatoi', 'Con docce, negli orari del circolo'],
        ['Parcheggio', 'Interno, gratuito'],
      ],
    },
  ],

  campi: [
    { nome: 'Campo 1', superficie: 'Cemento', misure: '23,77 × 10,97 m', luce: 'Sì', uso: 'Singolare e doppio' },
    { nome: 'Campo 2', superficie: 'Cemento', misure: '23,77 × 10,97 m', luce: 'Sì', uso: 'Singolare, doppio e corsi' },
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

function DaConfermare() {
  return <span className="cir-daconfermare">da confermare</span>;
}

export default function PaginaCircoloSantAgata() {
  return (
    <div className="cir-pagina">

      <nav className="cir-nav">
        <a href="#top" aria-label={`${CIRCOLO.nome} — inizio pagina`}>
          <img src={CIRCOLO.logo} alt={CIRCOLO.nome} width={465} height={154} />
        </a>
        <div className="cir-nav-voci">
          <a href="#giornata">La giornata</a>
          <a href="#campi">I campi</a>
          <a href="#incordatura">Incordatura</a>
          <a href="#sponsor">Sponsor</a>
          <a href="#contatti">Contatti</a>
        </div>
        <a className="cir-btn" href="#prenotazioni">Prenota</a>
      </nav>

      {/* ---------------- Apertura ----------------
          Due metà e non una fascia unica: la foto del campo è larga
          595 px, e stirata a tutto schermo si vedrebbe sfocata. */}
      <header className="cir-apertura" id="top">
        <div className="cir-dentro cir-apertura-griglia">
          <div>
            <p className="cir-mono">{CIRCOLO.comune} ({CIRCOLO.provincia}) &middot; dal 1986<DaConfermare /></p>
            <h1 className="cir-display">Circolo Tennis<br />Sant&rsquo;Agata</h1>
            <p>{CIRCOLO.apertura}</p>
            <div className="cir-apertura-azioni">
              <a className="cir-btn" href="#prenotazioni">Prenota un campo</a>
              <a className="cir-btn cir-btn-chiaro" href="#contatti">Contatti e orari</a>
            </div>
          </div>
          <div className="cir-apertura-foto">
            <img src={`${BASE}/campo.jpg`} alt="Uno dei due campi in cemento" width={595} height={321} />
          </div>
        </div>
      </header>

      <div className="cir-fascia">
        <dl className="cir-dentro cir-fascia-griglia">
          {CIRCOLO.fascia.map((r) => (
            <div key={r.voce}>
              <dt className="cir-mono">{r.voce}</dt>
              <dd>{r.valore}</dd>
            </div>
          ))}
        </dl>
      </div>

      {/* ---------------- La giornata ---------------- */}
      <section id="giornata">
        <div className="cir-dentro">
          <div className="cir-testata-sezione">
            <p className="cir-mono">Una giornata al circolo</p>
            <h2 className="cir-display cir-titolo-sezione">Dalle otto a mezzanotte</h2>
          </div>

          <div className="cir-giornata">
            {CIRCOLO.giornata.map((m) => (
              <article className={m.foto ? 'cir-momento' : 'cir-momento cir-momento-senzafoto'} key={m.ora}>
                <p className="cir-momento-ora">{m.ora}</p>
                <div>
                  <h3 className="cir-display">{m.titolo}</h3>
                  {m.testi.map((t) => <p className="cir-testo" key={t.slice(0, 24)}>{t}</p>)}
                  <dl className="cir-scheda">
                    {m.scheda.map(([k, v]) => (
                      <div key={k} style={{ display: 'contents' }}>
                        <dt>{k}</dt>
                        <dd>{v}{m.daConfermare ? <DaConfermare /> : null}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
                {m.foto && (
                  <img src={m.foto} alt={m.alt} width={660} height={440} />
                )}
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------- I campi: scheda tecnica ---------------- */}
      <section className="cir-campi" id="campi">
        <div className="cir-dentro">
          <div className="cir-testata-sezione">
            <p className="cir-mono">Scheda tecnica</p>
            <h2 className="cir-display cir-titolo-sezione">I due campi</h2>
          </div>
          <div className="cir-campi-griglia">
            <img src={`${BASE}/campo.jpg`} alt="Campo in cemento" width={595} height={321} />
            <div>
              <table className="cir-tabella">
                <thead>
                  <tr>
                    <th scope="col">Campo</th>
                    <th scope="col">Superficie</th>
                    <th scope="col">Misure</th>
                    <th scope="col">Luce</th>
                  </tr>
                </thead>
                <tbody>
                  {CIRCOLO.campi.map((c) => (
                    <tr key={c.nome}>
                      <th scope="row">{c.nome}</th>
                      <td>{c.superficie}</td>
                      <td>{c.misure}</td>
                      <td>{c.luce}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="cir-nota-campi">
                I due campi sono identici e intercambiabili: il Campo 2 ospita
                anche i corsi, quindi nei pomeriggi da ottobre a maggio è meno
                disponibile. Prenotazione a mezz&rsquo;ore dall&rsquo;applicazione.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------- Incordatura ---------------- */}
      <section id="incordatura">
        <div className="cir-dentro">
          <div className="cir-testata-sezione">
            <p className="cir-mono">Servizio interno</p>
            <h2 className="cir-display cir-titolo-sezione">Incordatura</h2>
          </div>
          <div className="cir-officina">
            <img src={`${BASE}/incordatura.jpg`} alt="Macchina incordatrice del circolo" width={591} height={442} />
            <div>
              <p className="cir-testo">
                L&rsquo;incordatura si esegue in sede, con macchina elettronica e corde
                disponibili al circolo. Si lascia la racchetta e si ritira
                incordata, indicando la tensione desiderata.
              </p>
              <div style={{ marginTop: '1.1rem' }}>
                <span className="cir-chip">Tensione 20 – 26 kg</span>
                <span className="cir-chip">Corde in sede</span>
                <span className="cir-chip">Riconsegna in giornata</span>
              </div>
              <p className="cir-testo" style={{ fontSize: '.85rem', marginTop: '.9rem' }}>
                Tempi e tariffe si concordano al circolo.<DaConfermare />
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------- Prenotazioni ---------------- */}
      <section className="cir-rf" id="prenotazioni">
        <div className="cir-dentro">
          <img className="cir-rf-logo" src="/logo-rf-esteso-bianco.png" alt="Racket Fever" width={1200} height={400} />
          <div className="cir-rf-griglia">
            <div>
              <div className="cir-testata-sezione">
                <p className="cir-mono">Prenotazioni</p>
                <h2 className="cir-display cir-titolo-sezione">I campi si prenotano dall&rsquo;app</h2>
              </div>
              <p className="cir-testo">
                Il circolo utilizza Racket Fever per la gestione delle prenotazioni.
                L&rsquo;applicazione è gratuita e mostra la disponibilità dei due campi
                mezz&rsquo;ora per mezz&rsquo;ora. Si possono indicare i compagni di gioco: il
                costo viene ripartito e la prenotazione è visibile anche a loro.
              </p>
              <div className="cir-store">
                {LINK_APP_STORE ? (
                  <a className="cir-distintivo" href={LINK_APP_STORE}><small>Scarica su</small><strong>App Store</strong></a>
                ) : (
                  <span className="cir-distintivo" aria-disabled="true"><small>Scarica su</small><strong>App Store</strong></span>
                )}
                {LINK_GOOGLE_PLAY ? (
                  <a className="cir-distintivo" href={LINK_GOOGLE_PLAY}><small>Disponibile su</small><strong>Google Play</strong></a>
                ) : (
                  <span className="cir-distintivo" aria-disabled="true"><small>Disponibile su</small><strong>Google Play</strong></span>
                )}
              </div>
              {(!LINK_APP_STORE || !LINK_GOOGLE_PLAY) && (
                <p className="cir-nota">I collegamenti agli store si attivano alla pubblicazione dell&rsquo;applicazione.</p>
              )}
            </div>
            <ol className="cir-passi">
              <li><span>1</span><span>Si scarica l&rsquo;app e si seleziona {CIRCOLO.nome} dall&rsquo;elenco dei circoli.</span></li>
              <li><span>2</span><span>Si accede con la password fornita dal circolo.</span></li>
              <li><span>3</span><span>Si consulta la griglia dei campi e si prenota la fascia desiderata.</span></li>
              <li><span>4</span><span>Si aggiungono i compagni di gioco: il costo viene ripartito fra i partecipanti.</span></li>
            </ol>
          </div>
        </div>
      </section>

      {/* ---------------- Sponsor ---------------- */}
      <section id="sponsor" style={{ background: 'var(--cir-carta-2)' }}>
        <div className="cir-dentro">
          <div className="cir-testata-sezione">
            <p className="cir-mono">Chi sostiene il circolo</p>
            <h2 className="cir-display cir-titolo-sezione">Sponsor</h2>
          </div>
          <div className="cir-sponsor-uno">
            <img
              src={CIRCOLO.sponsor.principale.file}
              alt={`Main sponsor: ${CIRCOLO.sponsor.principale.nome}`}
              width={1200}
              height={400}
            />
          </div>
          <div className="cir-sponsor-due">
            {CIRCOLO.sponsor.altri.map((s) => (
              <div key={s.nome}>
                <img src={s.file} alt={`Sponsor: ${s.nome}`} width={1200} height={400} />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------- Contatti ---------------- */}
      <section id="contatti">
        <div className="cir-dentro">
          <div className="cir-testata-sezione">
            <p className="cir-mono">Dove e quando</p>
            <h2 className="cir-display cir-titolo-sezione">Sede e orari</h2>
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
              <p style={{ marginTop: '.45rem' }}><DaConfermare /></p>
            </div>
          </div>
        </div>
      </section>

      <footer>
        <div className="cir-dentro cir-piede">
          <img
            src={CIRCOLO.affiliazioni}
            alt="Affiliazioni: CONI e Federazione Italiana Tennis e Padel"
            width={465}
            height={118}
          />
          <p>&copy; {new Date().getFullYear()} {CIRCOLO.nome}</p>
          <p>Spazio web e piattaforma di prenotazione: <Link href="/">Racket Fever</Link></p>
        </div>
      </footer>

    </div>
  );
}
