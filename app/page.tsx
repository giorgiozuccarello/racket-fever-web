'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { REGIONI_ITALIA, provinceDi } from '../data/tornei';
import { db } from '../lib/firebase';
import { EMAIL_CONTATTO } from '../data/consenso';

// ============================================================
// ⚠️ I LINK AGLI STORE NON CI SONO ANCORA, E SI ACCENDONO DA QUI.
//
// Il giorno della pubblicazione si scrivono i due indirizzi qui sotto
// e non si tocca nient'altro: i pulsanti diventano cliccabili da soli,
// perdono la dicitura «in arrivo» e smettono di essere `aria-disabled`.
// Finche' restano stringhe vuote i badge restano spenti — che e'
// l'unico modo onesto di mostrarli, perche' un pulsante «Scarica» che
// non porta da nessuna parte e' peggio di un pulsante che non c'e'.
//
// ⚠️ E I BADGE SONO SEGNAPOSTO DISEGNATI DA NOI. Apple e Google i
// propri li forniscono loro, e ne impongono forma, proporzioni e
// dicitura esatta («Scarica su App Store», «Disponibile su Google
// Play»): prima di pubblicare vanno scaricati dai rispettivi kit di
// marketing e messi al posto degli SVG qui sotto.
// ============================================================
const LINK_APP_STORE = '';
const LINK_GOOGLE_PLAY = '';

export default function Home() {
  const rootRef = useRef<HTMLDivElement>(null);

  // Reveal-on-scroll, stessa logica del prototipo originale
  useEffect(() => {
    const nodes = rootRef.current?.querySelectorAll('.reveal') ?? [];
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('in');
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12 }
    );
    nodes.forEach((n) => io.observe(n));
    return () => io.disconnect();
  }, []);

  return (
    <div ref={rootRef}>
      <nav>
        {/* ⚠️ Il logo esteso è bianco su trasparente: la testata deve
            restare nera, o sparisce. La scritta «Racket Fever» che
            stava qui accanto è stata tolta perché il logo la contiene
            già — ripeterla faceva leggere il nome due volte. */}
        <a href="#top" aria-label="Racket Fever — home">
          <img className="logo-esteso" src="/logo-rf-esteso-bianco.png" alt="Racket Fever" width={1200} height={400} />
        </a>
        <div className="nav-links">
          <a href="#circoli">Per i Circoli</a>
          <a href="#giocatori">Per i Giocatori</a>
          <a href="#coach">RF Coach</a>
          <a href="#scarica">Scarica l&apos;app</a>
          <a href="#prezzi">Quanto costa</a>
          <Link className="btn btn-outline nav-login-btn" href="/admin">Accedi</Link>
          <a className="btn" href="#richiesta">Porta l&apos;app nel tuo circolo</a>
        </div>
      </nav>

      <header className="hero" id="top">
        <div className="hero-grid">
          <div>
            <div className="mono">Prenotazioni · Lezioni · Sfide · Tornei</div>
            <h1 className="display">
              Il tuo circolo,<br />nella tua <em>tasca</em>.
            </h1>
            <p className="lead">
              Racket Fever è l&apos;app dei circoli tennis italiani, ed è <strong>gratuita per chi
              gioca</strong>. Ogni socio la vede con i colori e il logo del proprio circolo: prenota
              il campo, prende lezione dal Maestro, lancia una sfida, segue i tornei.
            </p>
            <div className="hero-cta">
              <a className="btn" href="#scarica">Scarica l&apos;app</a>
              <a className="btn btn-outline" href="#circoli">Sei un presidente?</a>
            </div>
          </div>
          <div className="phone" aria-hidden="true">
            <div className="phone-screen">
              <div className="phone-header">
                <span>ASD Circolo Tennis Sant&apos;Agata</span>
                <span>Campo 2</span>
              </div>
              <div className="slot-grid">
                <div className="slot busy">09:00</div>
                <div className="slot">10:00</div>
                <div className="slot">11:00</div>
                <div className="slot">12:00</div>
                <div className="slot mine">17:00</div>
                <div className="slot busy">18:00</div>
                <div className="slot busy">19:00</div>
                <div className="slot">20:00</div>
                <div className="slot">21:00</div>
              </div>
              <div className="phone-note">La tua prenotazione: oggi alle 17:00 — Campo 2</div>
            </div>
          </div>
        </div>
      </header>

      <div className="strip">
        <div><b>Gratis</b><small>Per chi gioca</small></div>
        <div><b>In tempo reale</b><small>Disponibilità dei campi</small></div>
        <div><b>Su misura</b><small>Colori e logo del circolo</small></div>
      </div>

      <section id="circoli">
        <div className="wrap">
          <img className="filigrana" src="/logo-rf-pallina.png" alt="" aria-hidden="true" />
          <div className="eyebrow mono reveal">Per i Circoli</div>
          <h2 className="display reveal">Non un fornitore. Un <em>sodalizio</em>.</h2>
          <p className="sub reveal">
            Per i tuoi soci l&apos;app è gratuita: nessun abbonamento, niente da comprare dal
            telefono. Il nostro team vi affianca nella personalizzazione — logo, colori, campi,
            tariffe e Maestri vengono configurati insieme, fin dal primo giorno.
          </p>

          <div className="sodalizio reveal">
            <div className="noi">
              <h3>Racket Fever mette</h3>
              <ul>
                <li>L&apos;app con logo e colori del circolo, fra otto temi grafici</li>
                <li>Pannello di gestione: campi, soci, ospiti, tessere, limiti e disdette</li>
                <li>Area Maestro con agenda, lezioni e tariffe</li>
                <li>Fino a dieci spazi per i vostri sponsor dentro l&apos;app</li>
                <li>Onboarding assistito e supporto diretto dal nostro team</li>
                <li>Aggiornamenti continui, senza che dobbiate fare niente</li>
              </ul>
            </div>
            <div className="voi">
              <h3>Il circolo mette</h3>
              <ul>
                <li>La presentazione dell&apos;app ai propri soci</li>
                <li>Campi, orari e anagrafiche tenuti aggiornati</li>
                <li>I feedback di chi la usa tutti i giorni</li>
                <li>La testimonianza che fa crescere la rete dei circoli</li>
                <li>La segnalazione tempestiva di problemi ed esigenze</li>
              </ul>
            </div>
          </div>

          <div className="gratis reveal">
            <strong>L&apos;app è gratuita per i tuoi soci — la formula per il circolo la scegliamo insieme</strong>
            <a className="btn" href="#richiesta">Richiedi l&apos;attivazione</a>
          </div>
        </div>
      </section>

      <section className="giocatori" id="giocatori">
        <div className="wrap">
          <div className="eyebrow mono reveal">Per i Giocatori</div>
          <h2 className="display reveal">Tutto il circolo, in un&apos;app.</h2>
          <p className="sub reveal">
            Scarichi l&apos;app — è gratuita — scegli il tuo circolo dalla lista, inserisci la
            password che ti dà la segreteria: da quel momento l&apos;app è la vostra, con i colori,
            il logo e i campi del tuo club.
          </p>

          <div className="feat reveal">
            <article>
              <div className="mono">Campi</div>
              <h3>Prenoti in tempo reale</h3>
              <p>Griglia del giorno con la disponibilità aggiornata al secondo. Scegli campo e orario, aggiungi chi gioca con te — soci o ospiti — e hai finito.</p>
            </article>
            <article>
              <div className="mono">Maestro</div>
              <h3>Lezioni, senza telefonate</h3>
              <p>Chiedi una lezione al Maestro dall&apos;app. Se quell&apos;ora non gli va bene te ne propone altre, e la chat resta lì fino a lezione fatta.</p>
            </article>
            <article>
              <div className="mono">Sfide</div>
              <h3>Sfide e classifica sociale</h3>
              <p>Sfida un socio, giocate, e il risultato muove la classifica del circolo. Con le tue statistiche: ore giocate, partite, andamento.</p>
            </article>
            <article>
              <div className="mono">Tornei</div>
              <h3>Tornei del circolo e della rete</h3>
              <p>Quelli di casa e quelli degli altri circoli, filtrati per regione, provincia e periodo. Un tocco e sei sulla pagina di iscrizione.</p>
            </article>
            <article>
              <div className="mono">Bacheca</div>
              <h3>La bacheca del circolo</h3>
              <p>Avvisi, chiusure dei campi, quote, volantini dei tornei. Quello che prima stava appeso in segreteria, in tasca.</p>
            </article>
            <article>
              <div className="mono">Community</div>
              <h3>Chat del circolo</h3>
              <p>Chat di gruppo e messaggi diretti: trovi un avversario per stasera in un minuto.</p>
            </article>
            <article>
              <div className="mono">Portafoglio</div>
              <h3>Il tuo credito, sempre in chiaro</h3>
              <p>Quanto hai, quanto hai speso e per cosa. Il credito lo carica la segreteria del circolo: nell&apos;app non si compra niente.</p>
            </article>
            <article>
              <div className="mono">Promemoria</div>
              <h3>Ti ricorda quando giochi</h3>
              <p>Due giorni prima, il giorno prima, e l&apos;ultima ora utile per disdire senza penalità. Arrivano da soli, anche se non apri l&apos;app.</p>
            </article>
            <article>
              <div className="mono">Identità</div>
              <h3>L&apos;app del tuo club</h3>
              <p>Logo, colori e informazioni del tuo circolo, fra otto temi grafici: un&apos;app che sembra fatta apposta per voi. Perché lo è.</p>
            </article>
          </div>
        </div>
      </section>

      {/* ============================================================
          RF COACH — l'app del Maestro, accanto a quella del circolo.
          ⚠️ È presentata come IN ARRIVO e non come disponibile: è un
          prodotto a sé, con la sua app sugli store, e finché non è
          pubblicata annunciarla al presente sarebbe una promessa che
          la pagina non può mantenere.
          ============================================================ */}
      <section className="coach" id="coach">
        <div className="wrap">
          <div className="coach-grid">
            <div className="coach-visual reveal">
              <img src="/logo-rf-pallina.png" alt="" aria-hidden="true" />
              <span className="coach-tag">RF Coach</span>
            </div>
            <div>
              <div className="eyebrow mono reveal">Per i Maestri</div>
              <h2 className="display reveal">
                RF <em>Coach</em><span className="pill">In arrivo</span>
              </h2>
              <p className="sub reveal" style={{ marginBottom: '1.2rem' }}>
                Il gestionale del Maestro di tennis: un&apos;app a sé, che sta accanto a Racket
                Fever e parla la stessa lingua. Per chi insegna in un circolo, e per chi lavora
                con più circoli e ha bisogno di un&apos;agenda che sia sua.
              </p>
              <ul className="coach-lista reveal">
                <li>La tua agenda delle lezioni, giorno per giorno</li>
                <li>Gli allievi, con scheda e storico</li>
                <li>Richieste di lezione con proposta di altri orari</li>
                <li>Chat diretta con l&apos;allievo</li>
                <li>Conti, crediti e insoluti sempre in chiaro</li>
                <li>Avvisi e promemoria che partono da soli</li>
              </ul>
              <a className="btn" href="#richiesta">Voglio saperne di più</a>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================
          SCARICA L'APP — i badge sono spenti finché non ci sono i link.
          Vedi le costanti in cima al file.
          ============================================================ */}
      <section className="scarica" id="scarica">
        <div className="wrap">
          <div className="scarica-piastra reveal">
            <img className="scarica-logo" src="/logo-rf-esteso-bianco.png" alt="Racket Fever" />
          </div>
          <div className="eyebrow mono reveal">Scarica l&apos;app</div>
          <h2 className="display reveal">Gratis, su iPhone e Android.</h2>
          <p className="sub reveal">
            Nessun abbonamento e nessun acquisto dentro l&apos;app. Ti servirà solo la password
            del tuo circolo, quella che ti dà la segreteria.
          </p>
          <div className="store-riga reveal">
            <BadgeStore
              href={LINK_APP_STORE}
              su="Scarica su"
              nome="App Store"
              icona={<IconaApple />}
            />
            <BadgeStore
              href={LINK_GOOGLE_PLAY}
              su="Disponibile su"
              nome="Google Play"
              icona={<IconaPlay />}
            />
          </div>
          <p className="scarica-nota">
            {LINK_APP_STORE || LINK_GOOGLE_PLAY
              ? 'Il tuo circolo non c’è ancora? Parlagliene.'
              : 'Pubblicazione in corso — i link agli store arrivano a giorni.'}
          </p>
        </div>
      </section>

      <section id="prezzi">
        <div className="wrap">
          <div className="eyebrow mono reveal">Quanto costa</div>
          <h2 className="display reveal">Per chi gioca, <em>niente</em>.</h2>
          <p className="sub reveal">
            L&apos;app si scarica e si usa gratis. Non c&apos;è un abbonamento, non c&apos;è niente
            da comprare dentro l&apos;app: il socio pensa a giocare.
          </p>

          <div className="prezzi-grid reveal">
            <div className="card-prezzo evidenza">
              <div className="mono">Socio / Giocatore</div>
              <div className="prezzo display">Gratis</div>
              <ul>
                <li>Prenotazione dei campi senza limiti</li>
                <li>Lezioni con il Maestro del circolo</li>
                <li>Sfide, classifica sociale e statistiche</li>
                <li>Tornei del circolo e di tutta la rete</li>
                <li>Bacheca, chat e promemoria automatici</li>
                <li>Nessun abbonamento, nessun acquisto nell&apos;app</li>
              </ul>
              <a className="btn" href="#scarica">Scarica l&apos;app</a>
            </div>
            {/* ⚠️ QUI NON COMPARE NESSUNA CIFRA, ed è una regola del
                progetto e non una dimenticanza: un listino scritto nel
                software è un listino pubblicato, cambia di trattativa
                in trattativa, e il circolo lo leggerebbe prima di
                parlarci. Le due formule invece si dicono: sono il
                modello, non il prezzo. */}
            <div className="card-prezzo">
              <div className="mono" style={{ color: 'var(--giallo)' }}>Circolo</div>
              <div className="prezzo display">Due formule</div>
              <ul>
                <li>Quota annuale, senza commissioni sulle prenotazioni</li>
                <li>Oppure app senza quota, con una commissione sull&apos;uso</li>
                <li>App con il logo e i colori del circolo</li>
                <li>Gestione di campi, soci, ospiti, Maestri e tornei</li>
                <li>Spazi per i vostri sponsor dentro l&apos;app</li>
                <li>Onboarding assistito e supporto diretto</li>
              </ul>
              <a className="btn" href="#richiesta">Attiva il tuo circolo</a>
            </div>
          </div>
        </div>
      </section>

      <section className="chisiamo" id="chisiamo">
        <div className="wrap">
          <div className="eyebrow mono reveal">Chi Siamo</div>
          <h2 className="display reveal">Nati dentro un <em>circolo</em>.</h2>
          <p className="reveal">
            Racket Fever nasce dall&apos;esperienza diretta nei circoli: fogli appesi in bacheca,
            telefonate per prenotare, tornei organizzati su gruppi di messaggistica. Sapevamo che si
            poteva fare meglio.
          </p>
          <p className="reveal">
            Il primo circolo pilota è l&apos;ASD Circolo Tennis Sant&apos;Agata. Da lì costruiamo,
            un circolo alla volta, la rete dei club tennis italiani — con la cura artigianale di chi
            il circolo lo vive davvero. Ogni cosa che trovi nell&apos;app è nata da una richiesta di
            un presidente, di un Maestro o di un socio: nessuna è stata inventata a tavolino.
          </p>
        </div>
      </section>

      <RichiestaForm />

      <footer>
        <div className="foot-grid">
          <div>
            <img className="foot-logo" src="/logo-rf-esteso-bianco.png" alt="Racket Fever" />
            <p style={{ fontSize: '.88rem', color: 'var(--fumo)', maxWidth: '26rem' }}>
              La piattaforma italiana per i circoli tennis. Gratuita per chi gioca, con l&apos;app
              vestita dei colori del proprio circolo e la gestione completa per chi lo manda avanti.
            </p>
          </div>
          <div>
            <h4>Piattaforma</h4>
            <ul>
              <li><a href="#circoli">Per i Circoli</a></li>
              <li><a href="#giocatori">Per i Giocatori</a></li>
              <li><a href="#coach">RF Coach</a></li>
              <li><a href="#scarica">Scarica l&apos;app</a></li>
              <li><a href="#prezzi">Quanto costa</a></li>
            </ul>
          </div>
          <div>
            <h4>Contatti</h4>
            <ul>
              <li><a href={`mailto:${EMAIL_CONTATTO}`}>{EMAIL_CONTATTO}</a></li>
              <li><a href="/cancellazione-account">Cancellazione account</a></li>
              {/* ⚠️ Erano due segnaposto morti, e Play Console rifiuta
                  l'invio senza un indirizzo di informativa funzionante:
                  era una delle cinque cose che impedivano di pubblicare. */}
              <li><a href="/privacy">Privacy</a></li>
              <li><a href="/termini">Termini di servizio</a></li>
            </ul>
          </div>
        </div>
        <div className="foot-bottom">
          <span>© 2026 Racket Fever — Tutti i diritti riservati</span>
          <span>Fatto da chi il circolo lo vive 🎾</span>
        </div>
      </footer>
    </div>
  );
}

// ============================================================
// I BADGE DEGLI STORE.
//
// ⚠️ SPENTI FINCHE' NON C'E' L'INDIRIZZO. Senza `href` il badge non e'
// un link ma uno `span`: non e' raggiungibile con il tabulatore, e chi
// naviga con lo schermo letto sente «in arrivo» invece di sentirsi
// annunciare un collegamento che non porta da nessuna parte.
// ============================================================
function BadgeStore({ href, su, nome, icona }: {
  href: string; su: string; nome: string; icona: React.ReactNode;
}) {
  if (!href) {
    return (
      <span className="store-badge" aria-disabled="true">
        {icona}
        <span className="store-testo">
          <span className="store-su">In arrivo su</span>
          <span className="store-nome">{nome}</span>
        </span>
      </span>
    );
  }
  return (
    <a className="store-badge" href={href} target="_blank" rel="noopener noreferrer">
      {icona}
      <span className="store-testo">
        <span className="store-su">{su}</span>
        <span className="store-nome">{nome}</span>
      </span>
    </a>
  );
}

// ⚠️ Segni disegnati da noi, non i marchi ufficiali: vedi la nota in
// cima al file. Servono a far riconoscere la riga a colpo d'occhio
// finche' non arrivano i badge veri.
function IconaApple() {
  return (
    <svg width="24" height="28" viewBox="0 0 24 28" fill="none" aria-hidden="true">
      <path
        d="M12 7.6c-1.3-.9-2.7-1-3.4-1C6 6.6 4 8.7 4 12.4c0 2.4.8 5 2.1 6.9 1 1.4 1.9 2.3 3 2.3.9 0 1.4-.5 2.6-.5s1.6.5 2.6.5c1.1 0 2-1 3-2.4.7-1 1.1-1.9 1.4-2.6-2.6-1-3.1-4.5-.7-6.2-.9-1.1-2.2-1.7-3.5-1.8-.9 0-1.9.5-2.5 1z"
        fill="currentColor"
      />
      <path
        d="M14.6 2.4c.1 1-.3 2-.9 2.7-.6.8-1.6 1.4-2.6 1.3-.1-1 .4-2 1-2.7.6-.8 1.7-1.3 2.5-1.3z"
        fill="currentColor"
      />
    </svg>
  );
}

function IconaPlay() {
  return (
    <svg width="24" height="28" viewBox="0 0 24 28" fill="none" aria-hidden="true">
      <path d="M4 3.4v21.2c0 .6.6 1 1.1.7l1.6-1L15 14 6.7 4.7l-1.6-1C4.6 2.4 4 2.8 4 3.4z" fill="#00A0FF" />
      <path d="M19.6 11.2 16 9.1 12.6 14 16 18.9l3.6-2.1c1.1-.6 1.1-2 0-2.6z" fill="#FFCE00" />
      <path d="M6.7 4.7 16 9.1 12.6 14z" fill="#00C853" />
      <path d="M6.7 23.3 12.6 14 16 18.9z" fill="#FF3A44" />
    </svg>
  );
}

// ============================================================
// LA RICHIESTA DI ATTIVAZIONE — senza campi liberi da riempire.
//
// ⚠️ IL TESTO LIBERO E' STATO TOLTO, e non per semplificare il modulo:
// e' che un campo libero su una pagina pubblica, senza accesso, e' uno
// spazio pubblicitario gratuito — e infatti sono arrivate le prime
// richieste di spam. Un filtro sarebbe stato una rincorsa; togliendo
// il campo, uno spam non ha piu' dove mettere il suo messaggio e il
// suo link, quindi non conviene piu' mandarlo. E' lo stesso
// ragionamento fatto per le chat fra soci.
//
// Restano liberi solo i tre dati che sono nomi propri e non si possono
// mettere in un elenco: il nome del circolo, il nome del referente e
// l'email. Su quelli le regole impongono una lunghezza e rifiutano
// qualunque cosa contenga un indirizzo web — un nome di circolo con
// dentro un link non e' un nome di circolo.
//
// Regione e provincia sono menu: l'elenco completo ce l'abbiamo gia'
// dal lavoro sui tornei e sui banner di rete, e cosi' l'anagrafica
// arriva gia' pulita invece di essere verificata a mano dopo.
// ============================================================
const RUOLI_RICHIESTA = ['Presidente', 'Direttore', 'Segreteria', 'Maestro', 'Altro'];

function RichiestaForm() {
  const [nome, setNome] = useState('');
  const [referente, setReferente] = useState('');
  const [ruolo, setRuolo] = useState(RUOLI_RICHIESTA[0]);
  const [regione, setRegione] = useState('');
  const [provincia, setProvincia] = useState('');
  const [email, setEmail] = useState('');
  const [telefono, setTelefono] = useState('');
  const [contattami, setContattami] = useState(false);
  // ⚠️ IL CAMPO CHE NON SI VEDE. Sta fuori schermo e non ha etichetta,
  // quindi una persona non lo trova nemmeno volendo; i programmi che
  // compilano moduli in automatico invece riempiono tutto quello che
  // trovano. Se arriva pieno, la richiesta non parte — e non si dice
  // niente a chi l'ha mandata, perche' dirglielo sarebbe insegnargli
  // come aggirarlo.
  const [esca, setEsca] = useState('');
  const [inviando, setInviando] = useState(false);
  const [inviato, setInviato] = useState(false);
  const [errore, setErrore] = useState('');

  // ⚠️ `provinceDi` e non l'elenco a mano: quando una regione non ha
  // province quella funzione ricade su tutte e centosette, «perche' un
  // elenco vuoto sembrerebbe un guasto». Con la ricaduta opposta — un
  // menu vuoto su un campo obbligatorio — il modulo sarebbe diventato
  // impossibile da inviare, senza nessun messaggio che lo spiegasse.
  const province = regione ? provinceDi(regione) : [];

  const invia = async (e: React.FormEvent) => {
    e.preventDefault();
    if (esca.trim()) { setInviato(true); return; }
    if (!nome.trim() || !referente.trim() || !email.trim() || !regione || !provincia) {
      setErrore('Compila il nome del circolo, il referente, l’email e la zona.');
      return;
    }
    if (!contattami) {
      setErrore('Spunta «Voglio essere contattato» per inviare la richiesta.');
      return;
    }
    setErrore('');
    setInviando(true);
    try {
      // Richiesta pubblica: chiunque visiti il sito può inviarla, non
      // serve essere autenticati (vedi firestore.rules — collezione
      // "richieste_attivazione", scrittura pubblica, lettura solo Super Admin).
      await addDoc(collection(db, 'richieste_attivazione'), {
        nomeCircolo: nome.trim(),
        referente: referente.trim(),
        ruolo,
        regione,
        provincia,
        email: email.trim(),
        telefono: telefono.trim(),
        contattami: true,
        stato: 'nuova',
        creataIl: serverTimestamp(),
      });
      setInviato(true);
    } catch {
      setErrore(`Si è verificato un errore. Riprova o scrivici a ${EMAIL_CONTATTO}.`);
    } finally {
      setInviando(false);
    }
  };

  return (
    <section id="richiesta">
      <div className="wrap">
        <div style={{ textAlign: 'center' }}>
          <div className="eyebrow mono reveal">Attivazione circolo</div>
          <h2 className="display reveal" style={{ marginInline: 'auto' }}>
            Porta Racket Fever nel tuo circolo
          </h2>
          <p className="sub reveal" style={{ marginInline: 'auto' }}>
            Compila la richiesta: ti contattiamo entro 48 ore per l&apos;onboarding assistito.
          </p>
        </div>

        {!inviato ? (
          <form className="form-box reveal" onSubmit={invia}>
            <label htmlFor="nome">Nome del circolo</label>
            <input id="nome" type="text" placeholder="ASD Circolo Tennis Sant'Agata" value={nome} onChange={(e) => setNome(e.target.value)} maxLength={120} required />

            <label htmlFor="referente">Chi sei</label>
            <input id="referente" type="text" placeholder="Nome e cognome" value={referente} onChange={(e) => setReferente(e.target.value)} maxLength={80} required />

            <label htmlFor="ruolo">Il tuo ruolo nel circolo</label>
            <select id="ruolo" value={ruolo} onChange={(e) => setRuolo(e.target.value)}>
              {RUOLI_RICHIESTA.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>

            <label htmlFor="regione">Regione</label>
            <select
              id="regione" value={regione} required
              onChange={(e) => { setRegione(e.target.value); setProvincia(''); }}
            >
              <option value="">Scegli la regione…</option>
              {REGIONI_ITALIA.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>

            <label htmlFor="provincia">Provincia</label>
            <select
              id="provincia" value={provincia} required disabled={!regione}
              onChange={(e) => setProvincia(e.target.value)}
            >
              <option value="">{regione ? 'Scegli la provincia…' : 'Scegli prima la regione'}</option>
              {province.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>

            <label htmlFor="email">Email</label>
            <input id="email" type="email" placeholder="presidente@circolo.it" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={200} required />

            <label htmlFor="tel">Telefono (facoltativo, ma è la via più rapida)</label>
            <input
              id="tel" type="tel" inputMode="tel" placeholder="333 1234567"
              value={telefono} maxLength={25}
              onChange={(e) => setTelefono(e.target.value.replace(/[^0-9+\s]/g, ''))}
            />

            {/* L'esca per i programmi automatici: fuori schermo, senza
                etichetta e senza tabulazione. Una persona non la trova. */}
            <input
              type="text" value={esca} onChange={(e) => setEsca(e.target.value)}
              tabIndex={-1} autoComplete="off" aria-hidden="true"
              style={{ position: 'absolute', left: '-9999px', width: 1, height: 1, opacity: 0 }}
            />

            <label className="form-consenso">
              <input
                type="checkbox" checked={contattami}
                onChange={(e) => setContattami(e.target.checked)}
              />
              <span>Voglio essere contattato da Racket Fever per l’attivazione del circolo.</span>
            </label>

            {/* ============================================================
                ⚠️ IL LINK ALL'INFORMATIVA VA QUI, ACCANTO AL PULSANTE, e
                non solo in fondo alla pagina. Chi compila questo modulo
                sta consegnando nome, circolo e recapito a degli
                sconosciuti: l'informativa gli va offerta nel momento in
                cui decide, non dieci schermate più in basso fra i link di
                servizio. È anche la posizione che il Garante indica, ed è
                l'unica che una persona vede davvero.
                ============================================================ */}
            <p className="form-nota">
              I dati che lasci qui servono solo a richiamarti: nient’altro, e a nessun altro.
              Come li trattiamo è scritto nell’<a href="/privacy">informativa privacy</a>.
            </p>

            {errore && <p style={{ color: '#FF6B6B', fontSize: '.85rem', marginTop: '.8rem' }}>{errore}</p>}
            <button className="btn" type="submit" disabled={inviando}>
              {inviando ? 'Invio in corso…' : 'Invia la richiesta'}
            </button>
          </form>
        ) : (
          <div className="form-ok reveal in">
            <strong className="display" style={{ fontSize: '1.3rem' }}>Richiesta inviata.</strong>
            <p style={{ marginTop: '.6rem', color: 'var(--fumo)' }}>
              Ti contatteremo entro 48 ore per iniziare l&apos;onboarding del tuo circolo.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
