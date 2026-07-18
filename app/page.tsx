'use client';

import { useEffect, useRef, useState } from 'react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';

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
        <a className="logo" href="#top" aria-label="Racket Fever — home">
          <div className="logo-mark" aria-hidden="true" />
          <span>Racket Fever</span>
        </a>
        <div className="nav-links">
          <a href="#circoli">Per i Circoli</a>
          <a href="#giocatori">Per i Giocatori</a>
          <a href="#prezzi">Prezzi</a>
          <a href="#chisiamo">Chi Siamo</a>
          <a className="btn" href="#richiesta">Porta l&apos;app nel tuo circolo</a>
        </div>
      </nav>

      <header className="hero" id="top">
        <div className="hero-grid">
          <div>
            <div className="mono">Terra rossa · Prenotazioni · Tornei · Community</div>
            <h1 className="display">
              Il tuo circolo,<br />nella tua <em>tasca</em>.
            </h1>
            <p className="lead">
              Racket Fever è l&apos;app dei circoli tennis italiani: ogni socio vede l&apos;app con i
              colori e il logo del proprio circolo. Prenota il campo, iscriviti ai tornei, resta in
              contatto con la community.
            </p>
            <div className="hero-cta">
              <a className="btn" href="#giocatori">Scarica l&apos;app</a>
              <a className="btn btn-outline" href="#circoli">Sei un presidente?</a>
            </div>
          </div>
          <div className="phone" aria-hidden="true">
            <div className="phone-screen">
              <div className="phone-header">
                <span>ASD Tennis Milazzo</span>
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
              <div className="phone-note">La tua prenotazione: oggi alle 17:00 — Campo 2, terra rossa</div>
            </div>
          </div>
        </div>
      </header>

      <div className="strip">
        <div><b>€4,99 / anno</b><small>Per il socio</small></div>
        <div><b>Gratis</b><small>Per il circolo</small></div>
        <div><b>Real-time</b><small>Disponibilità campi</small></div>
      </div>

      <section id="circoli">
        <div className="wrap">
          <div className="eyebrow mono reveal">Per i Circoli</div>
          <h2 className="display reveal">Non un fornitore. Un sodalizio.</h2>
          <p className="sub reveal">
            La piattaforma è gratuita per il circolo. In cambio, il circolo presenta l&apos;app ai
            propri soci. Il nostro team vi affianca nella personalizzazione: logo, colori, campi e
            servizi vengono configurati insieme, fin dal primo giorno.
          </p>

          <div className="sodalizio reveal">
            <div className="noi">
              <h3>Racket Fever offre</h3>
              <ul>
                <li>App personalizzata con logo e colori del circolo</li>
                <li>Assistenza dedicata nel setup e nella customizzazione</li>
                <li>Aggiornamenti continui e nuove funzionalità</li>
                <li>Dashboard admin completa e facile da usare</li>
                <li>Supporto tecnico diretto dal nostro team</li>
              </ul>
            </div>
            <div className="voi">
              <h3>Il circolo contribuisce</h3>
              <ul>
                <li>Promozione attiva dell&apos;app ai propri soci</li>
                <li>Raccolta dei feedback degli utenti</li>
                <li>Testimonianza per far crescere la rete dei circoli</li>
                <li>Fiducia nel brand verso i soci</li>
                <li>Segnalazione tempestiva di problemi ed esigenze</li>
              </ul>
            </div>
          </div>

          <div className="gratis reveal">
            <strong>Zero costi per il circolo. Per sempre.</strong>
            <a className="btn" style={{ background: 'var(--pino)' }} href="#richiesta">
              Richiedi l&apos;attivazione
            </a>
          </div>
        </div>
      </section>

      <section className="giocatori" id="giocatori">
        <div className="wrap">
          <div className="eyebrow mono reveal">Per i Giocatori</div>
          <h2 className="display reveal">Tutto il circolo, in un&apos;app.</h2>
          <p className="sub reveal">
            Scarichi l&apos;app, scegli il tuo circolo dalla lista, inserisci la password che ti dà
            il circolo — e da quel momento l&apos;app è la vostra: colori, logo e campi del tuo club.
          </p>

          <div className="feat reveal">
            <article>
              <div className="mono">Campi</div>
              <h3>Prenotazione real-time</h3>
              <p>Griglia settimanale con disponibilità aggiornata al secondo. Scegli campo, giorno e orario in tre tocchi.</p>
            </article>
            <article>
              <div className="mono">Competizione</div>
              <h3>Tornei &amp; classifiche</h3>
              <p>Iscriviti ai tornei interni, segui il tabellone e scala la classifica del tuo circolo.</p>
            </article>
            <article>
              <div className="mono">Community</div>
              <h3>Chat del circolo</h3>
              <p>Chat di gruppo e messaggi diretti: trova un avversario per stasera in un minuto.</p>
            </article>
            <article>
              <div className="mono">Progressi</div>
              <h3>Statistiche personali</h3>
              <p>Ore giocate, storico prenotazioni e livello di gioco, sempre a portata di mano.</p>
            </article>
            <article>
              <div className="mono">Avvisi</div>
              <h3>Notifiche push</h3>
              <p>Conferme di prenotazione, convocazioni ai tornei e comunicazioni del circolo.</p>
            </article>
            <article>
              <div className="mono">Identità</div>
              <h3>L&apos;app del tuo club</h3>
              <p>Logo, colori e informazioni del tuo circolo: un&apos;app che sembra fatta apposta per voi. Perché lo è.</p>
            </article>
          </div>
        </div>
      </section>

      <section id="prezzi">
        <div className="wrap">
          <div className="eyebrow mono reveal">Prezzi</div>
          <h2 className="display reveal">Meno di un tubo di palline.</h2>
          <p className="sub reveal">Un unico prezzo, trasparente, per un anno intero di gioco organizzato.</p>

          <div className="prezzi-grid reveal">
            <div className="card-prezzo evidenza">
              <div className="mono" style={{ color: 'var(--terra-chiara)' }}>Socio / Giocatore</div>
              <div className="prezzo display">€4,99 <small>/ anno</small></div>
              <ul>
                <li>Prenotazione campi illimitata</li>
                <li>Tornei, classifiche e statistiche</li>
                <li>Chat community del circolo</li>
                <li>Notifiche push</li>
                <li>Rinnovo automatico, disdici quando vuoi</li>
              </ul>
              <a className="btn" href="#giocatori">Scarica e attiva</a>
            </div>
            <div className="card-prezzo">
              <div className="mono" style={{ color: 'var(--terra)' }}>Circolo</div>
              <div className="prezzo display">Gratis</div>
              <ul>
                <li>App brandizzata per i tuoi soci</li>
                <li>Pannello admin: campi, soci, tornei, avvisi</li>
                <li>Onboarding assistito dal nostro team</li>
                <li>Supporto tecnico dedicato</li>
                <li>Nessun vincolo, nessun canone</li>
              </ul>
              <a className="btn" href="#richiesta">Attiva il tuo circolo</a>
            </div>
          </div>
        </div>
      </section>

      <section className="chisiamo" id="chisiamo">
        <div className="wrap">
          <div className="eyebrow mono reveal" style={{ color: 'var(--riga)' }}>Chi Siamo</div>
          <h2 className="display reveal">Nati sulla terra rossa siciliana.</h2>
          <p className="reveal">
            Racket Fever nasce dall&apos;esperienza diretta nei circoli: fogli appesi in bacheca,
            telefonate per prenotare, tornei organizzati su gruppi di messaggistica. Sapevamo che si
            poteva fare meglio.
          </p>
          <p className="reveal">
            Il primo circolo pilota è l&apos;ASD Tennis Milazzo, in Sicilia. Da lì costruiamo, un
            circolo alla volta, la rete dei club tennis italiani — con la cura artigianale di chi il
            circolo lo vive davvero.
          </p>
        </div>
      </section>

      <RichiestaForm />

      <footer>
        <div className="foot-grid">
          <div>
            <div className="logo" style={{ marginBottom: '1rem' }}>
              <div className="logo-mark" aria-hidden="true" />
              <span style={{ fontVariationSettings: "'wdth' 118,'wght' 850", textTransform: 'uppercase' }}>
                Racket Fever
              </span>
            </div>
            <p style={{ fontSize: '.88rem', opacity: 0.7, maxWidth: '26rem' }}>
              La piattaforma italiana per i circoli tennis. App brandizzata per i soci, gestione
              completa per il circolo.
            </p>
          </div>
          <div>
            <h4>Piattaforma</h4>
            <ul>
              <li><a href="#circoli">Per i Circoli</a></li>
              <li><a href="#giocatori">Per i Giocatori</a></li>
              <li><a href="#prezzi">Prezzi</a></li>
              <li><a href="#">Blog / News</a></li>
            </ul>
          </div>
          <div>
            <h4>Contatti</h4>
            <ul>
              <li><a href="mailto:info@racketfever.com">info@racketfever.com</a></li>
              <li><a href="#">Press kit</a></li>
              <li><a href="#">Privacy</a></li>
              <li><a href="#">Termini di servizio</a></li>
            </ul>
          </div>
        </div>
        <div className="foot-bottom">
          <span>© 2026 Racket Fever — Tutti i diritti riservati</span>
          <span>Fatto in Sicilia 🎾</span>
        </div>
      </footer>
    </div>
  );
}

function RichiestaForm() {
  const [nome, setNome] = useState('');
  const [citta, setCitta] = useState('');
  const [email, setEmail] = useState('');
  const [messaggio, setMessaggio] = useState('');
  const [inviando, setInviando] = useState(false);
  const [inviato, setInviato] = useState(false);
  const [errore, setErrore] = useState('');

  const invia = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim() || !citta.trim() || !email.trim()) {
      setErrore('Compila almeno nome del circolo, città ed email.');
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
        citta: citta.trim(),
        email: email.trim(),
        messaggio: messaggio.trim(),
        stato: 'nuova',
        creataIl: serverTimestamp(),
      });
      setInviato(true);
    } catch {
      setErrore('Si è verificato un errore. Riprova o scrivici a info@racketfever.com.');
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
            <input id="nome" type="text" placeholder="ASD Tennis Milazzo" value={nome} onChange={(e) => setNome(e.target.value)} required />
            <label htmlFor="citta">Città</label>
            <input id="citta" type="text" placeholder="Milazzo (ME)" value={citta} onChange={(e) => setCitta(e.target.value)} required />
            <label htmlFor="email">Email del responsabile</label>
            <input id="email" type="email" placeholder="presidente@circolo.it" value={email} onChange={(e) => setEmail(e.target.value)} required />
            <label htmlFor="msg">Raccontaci il vostro circolo</label>
            <textarea
              id="msg" rows={4}
              placeholder="Quanti campi avete? Quanti soci? Come gestite oggi le prenotazioni?"
              value={messaggio} onChange={(e) => setMessaggio(e.target.value)}
            />
            {errore && <p style={{ color: '#B3261E', fontSize: '.85rem', marginTop: '.8rem' }}>{errore}</p>}
            <button className="btn" type="submit" disabled={inviando}>
              {inviando ? 'Invio in corso…' : 'Invia la richiesta'}
            </button>
          </form>
        ) : (
          <div className="form-ok reveal in">
            <strong className="display" style={{ fontSize: '1.3rem' }}>Richiesta inviata.</strong>
            <p style={{ marginTop: '.6rem', color: 'var(--grigio)' }}>
              Ti contatteremo entro 48 ore per iniziare l&apos;onboarding del tuo circolo.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
