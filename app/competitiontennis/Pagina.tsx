// ============================================================
// SPAZIO WEB DI COMPETITION TENNIS GMBH — il componente.
//
// ⚠️ UN COMPONENTE SOLO PER TRE LINGUE. Le tre rotte
// (/competitiontennis, /it, /en) non sono tre pagine: sono tre righe
// che chiamano questo file con una lingua diversa. Se una sezione
// esiste in tedesco e non in inglese, è perché qualcuno ha scritto del
// JSX dentro una condizione — e non si fa: il testo sta in contenuti.ts
// e qui non ce n'è nemmeno una parola.
//
// ⚠️ NIENTE JAVASCRIPT DI PAGINA. È un componente server: il selettore
// di lingua sono tre `Link`, non un interruttore. Costa tre indirizzi
// indicizzabili invece di uno e non manda un byte di script al
// telefono di chi guarda.
//
// ⚠️ I FONDI SCURI VANNO SCRITTI `.ct-pagina section.ct-scura`. Il
// `body` del sito è nero per regola di ELEMENTO: una classe sola non
// la batte, ed è già costata una sezione bianca su bianco nello spazio
// web del Circolo. Le avvertenze complete stanno nel blocco `.ct-*` in
// fondo a app/globals.css.
// ============================================================

import Link from 'next/link';
import {
  T, ROTTE, LINGUE, CORDE, LEZIONI, CAMPO, PRIVATA, MARCHE, PARTNER, FOTO,
  FOTO_LUOGHI, VALUTA, ANNO,
  TEL, TEL_URL, WA, IG, IG_NOME, AZIENDA, MARCHIO, MAESTRO, SITO_CLIENTE,
  type Lingua,
} from './contenuti';

const ANCORE = ['chi', 'lezioni', 'incordatura', 'dove', 'contatti'];

export default function Pagina({ lingua }: { lingua: Lingua }) {
  const t = T[lingua];

  // ⚠️ `lang` QUI E NON PIÙ IN ALTO. `<html lang="it">` sta in
  // app/layout.tsx ed è di tutto il sito: senza questa riga la pagina
  // tedesca e quella inglese venivano servite come italiano — una
  // sintesi vocale leggeva «Auf die Plätze» con la fonetica italiana e
  // l'`hreflang` diceva il contrario del documento. `lang` su un
  // discendente vale per tutto il suo sottoalbero.
  return (
    <div className="ct-pagina" lang={t.htmlLang}>

      <nav className="ct-nav">
        <a className="ct-marchio" href="#top">
          {MARCHIO}
          <span>{MAESTRO}</span>
        </a>

        <div className="ct-nav-voci">
          {t.nav.map((voce, i) => (
            <a href={`#${ANCORE[i]}`} key={ANCORE[i]}>{voce}</a>
          ))}
        </div>

        <div className="ct-lingue">
          {LINGUE.map((l) => (
            l === lingua
              ? <span className="ct-lingua-attiva" key={l} aria-current="page">{l}</span>
              : (
                <Link
                  href={ROTTE[l]}
                  key={l}
                  hrefLang={T[l].htmlLang}
                  aria-label={T[l].etichetta}
                >
                  {l}
                </Link>
              )
          ))}
        </div>

        <a className="ct-btn" href={TEL_URL}>{t.ctaTel}</a>
      </nav>

      {/* ---------------- Apertura ---------------- */}
      <header className="ct-apertura" id="top">
        <div className="ct-dentro ct-apertura-griglia">
          <div>
            <p className="ct-occhiello">{t.heroOcchiello}</p>
            <h1 className="ct-display">
              {t.heroTitolo.map((riga, i) => (
                <span key={riga}>{riga}{i < t.heroTitolo.length - 1 ? <br /> : null}</span>
              ))}
            </h1>
            <p className="ct-guida">{t.heroTesto}</p>
            <div className="ct-azioni">
              <a className="ct-btn" href={TEL_URL}>{t.ctaTel} {TEL}</a>
              <a className="ct-btn ct-btn-vuoto" href={WA} rel="noopener noreferrer" target="_blank">
                {t.ctaWa}
              </a>
            </div>
            <p className="ct-sotto">{t.heroNota}</p>
          </div>

          <div className="ct-apertura-foto">
            <img
              src={FOTO.ritratto.file}
              alt={MAESTRO}
              width={FOTO.ritratto.larghezza}
              height={FOTO.ritratto.altezza}
            />
          </div>
        </div>

        <div className="ct-dentro">
          <dl className="ct-dati">
            {t.dati.map(([grande, piccolo]) => (
              <div key={grande}>
                <dt>{grande}</dt>
                <dd>{piccolo}</dd>
              </div>
            ))}
          </dl>
        </div>
      </header>

      {/* ---------------- Chi sono ---------------- */}
      <section id="chi">
        <div className="ct-dentro ct-due">
          <div>
            <p className="ct-occhiello">{t.chiOcchiello}</p>
            <h2 className="ct-display">
              {t.chiTitolo.map((riga, i) => (
                <span key={riga}>{riga}{i < t.chiTitolo.length - 1 ? <br /> : null}</span>
              ))}
            </h2>
          </div>
          <div>
            {t.chiTesto.map((p) => <p className="ct-testo" key={p.slice(0, 24)}>{p}</p>)}
            <p className="ct-firma">
              {t.chiFirma}
              <small>{MAESTRO}</small>
            </p>
          </div>
        </div>
      </section>

      {/* ---------------- Lezioni e prezzi ---------------- */}
      <section className="ct-tenue" id="lezioni">
        <div className="ct-dentro">
          <p className="ct-occhiello">{t.lezOcchiello}</p>
          <h2 className="ct-display">
            {t.lezTitolo.map((riga, i) => (
              <span key={riga}>{riga}{i < t.lezTitolo.length - 1 ? <br /> : null}</span>
            ))}
          </h2>
          <p className="ct-guida">{t.lezTesto}</p>

          <div className="ct-carte">
            {t.lezCarte.map((c) => (
              <article className="ct-carta" key={c.titolo}>
                <h3>{c.titolo}</h3>
                <p>{c.testo}</p>
                <p className="ct-prezzo">
                  <span>{c.voce}</span>
                  <strong>{c.prezzo}</strong>
                </p>
              </article>
            ))}
          </div>

          <table className="ct-tabella">
            <caption className="ct-invisibile">{t.tabTitolo}</caption>
            <thead>
              <tr>
                <th scope="col">{t.tabGruppo}</th>
                <th scope="col">{t.tabDurata}</th>
                <th scope="col" className="ct-n">{t.tabSocio}, {t.tabPersona}</th>
                <th scope="col" className="ct-n ct-campo">{t.tabCampo}</th>
              </tr>
            </thead>
            <tbody>
              {LEZIONI.map(([gruppo, durata, prezzo]) => (
                <tr key={`${gruppo}-${durata}`}>
                  <th scope="row">{gruppo}</th>
                  <td>{durata}</td>
                  <td className="ct-n">{VALUTA} {prezzo}</td>
                  <td className="ct-n ct-campo">{VALUTA} {CAMPO}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* ⚠️ La privata sta fuori dalla tabella: è l'unica riga con
              due prezzi, e dentro costringeva la quarta colonna a dire
              una volta il campo e una volta il non socio. */}
          <div className="ct-privata">
            <div>
              <strong>{t.tabPrivata}</strong>
              <span>{PRIVATA.durata}</span>
            </div>
            <div>
              <small>{t.tabSocio}</small>
              <strong>{VALUTA} {PRIVATA.socio}</strong>
            </div>
            <div>
              <small>{t.tabNonSocio}</small>
              <strong>{VALUTA} {PRIVATA.nonSocio}</strong>
            </div>
          </div>

          <ul className="ct-note">
            {t.lezNote.map((n) => <li key={n.slice(0, 20)}>{n}</li>)}
          </ul>
        </div>
      </section>

      {/* ---------------- Incordatura ---------------- */}
      <section className="ct-scura" id="incordatura">
        <div className="ct-dentro ct-due ct-due-fondo">
          <div>
            <p className="ct-occhiello">{t.incOcchiello}</p>
            <h2 className="ct-display">
              {t.incTitolo.map((riga, i) => (
                <span key={riga}>{riga}{i < t.incTitolo.length - 1 ? <br /> : null}</span>
              ))}
            </h2>
            <p className="ct-guida">{t.incTesto}</p>
            <div className="ct-azioni">
              <a className="ct-btn" href={TEL_URL}>{t.incCta}</a>
            </div>
          </div>
          <div className="ct-officina">
            <img
              src={FOTO.basilea.file}
              alt={t.incAlt}
              width={FOTO.basilea.larghezza}
              height={FOTO.basilea.altezza}
            />
          </div>
        </div>

        <div className="ct-dentro">
          <ul className="ct-corde">
            {CORDE.map(([nome, prezzo]) => (
              <li key={nome}>
                <span>{nome}</span>
                <strong>{VALUTA} {prezzo}</strong>
              </li>
            ))}
          </ul>
          <p className="ct-occhiello ct-occhiello-marche">{t.incMarche}</p>
          <p className="ct-marche">
            {MARCHE.map((m) => <span key={m}>{m}</span>)}
          </p>
          <p className="ct-nota-chiara">{t.incColori}</p>
        </div>
      </section>

      {/* ---------------- Dove ---------------- */}
      <section id="dove">
        <div className="ct-dentro">
          <p className="ct-occhiello">{t.dovOcchiello}</p>
          <h2 className="ct-display">
            {t.dovTitolo.map((riga, i) => (
              <span key={riga}>{riga}{i < t.dovTitolo.length - 1 ? <br /> : null}</span>
            ))}
          </h2>

          <div className="ct-luoghi">
            {t.luoghi.map((l) => {
              const chiave = FOTO_LUOGHI[l.nome];
              const f = chiave ? FOTO[chiave] : null;
              return (
                <article className="ct-luogo" key={l.nome}>
                  {f
                    ? <img src={f.file} alt="" width={f.larghezza} height={f.altezza} />
                    : <div className="ct-luogo-senzafoto" aria-hidden="true" />}
                  <div>
                    <h3>{l.nome}</h3>
                    {l.club ? <p className="ct-luogo-club">{l.club}</p> : null}
                    <p className="ct-luogo-nota">{l.nota}</p>
                  </div>
                </article>
              );
            })}
          </div>
          <p className="ct-guida">{t.dovNota}</p>
        </div>
      </section>

      {/* ---------------- Novità, voce del cliente, partner ---------------- */}
      <section className="ct-tenue">
        <div className="ct-dentro ct-due ct-due-mezzo">
          <div>
            <h2 className="ct-occhiello">{t.newsOcchiello}</h2>
            <div className="ct-news">
              {t.news.map((n) => (
                <article key={n.titolo}>
                  <h3>{n.titolo}</h3>
                  <p>{n.testo}</p>
                </article>
              ))}
            </div>
          </div>
          <figure className="ct-voce">
            <blockquote>{t.testimonianza}</blockquote>
            <figcaption>{t.testimonianzaChi}</figcaption>
          </figure>
        </div>

        <div className="ct-dentro ct-partner-blocco">
          <p className="ct-occhiello">{t.partOcchiello}</p>
          <h2 className="ct-display ct-display-piccolo">{t.partTitolo}</h2>
          <div className="ct-partner">
            {PARTNER.map((p) => (
              <div key={p.nome}>
                <img src={p.file} alt={p.nome} width={p.larghezza} height={p.altezza} />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------- Contatti ---------------- */}
      <section className="ct-scura" id="contatti">
        <div className="ct-dentro ct-due ct-due-mezzo">
          <div>
            <p className="ct-occhiello">{t.contOcchiello}</p>
            <h2 className="ct-display">
              {t.contTitolo.map((riga, i) => (
                <span key={riga}>{riga}{i < t.contTitolo.length - 1 ? <br /> : null}</span>
              ))}
            </h2>
            <p className="ct-guida">{t.contTesto}</p>

            <p className="ct-occhiello ct-occhiello-faq">{t.faqOcchiello}</p>
            <dl className="ct-faq">
              {t.faq.map(([domanda, risposta]) => (
                <div key={domanda.slice(0, 24)}>
                  <dt>{domanda}</dt>
                  <dd>{risposta}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="ct-recapiti">
            <a href={TEL_URL}>
              <small>{t.contTel}</small>
              <strong>{TEL}</strong>
            </a>
            <a href={WA} rel="noopener noreferrer" target="_blank">
              <small>{t.contWa}</small>
              <strong>{TEL}</strong>
            </a>
            <a href={IG} rel="noopener noreferrer" target="_blank">
              <small>{t.contIg}</small>
              <strong>{IG_NOME}</strong>
            </a>
          </div>
        </div>
      </section>

      <footer>
        <div className="ct-dentro ct-piede">
          <p>
            &copy; {ANNO} {AZIENDA}
            {' · '}
            <a href={SITO_CLIENTE} rel="noopener noreferrer" target="_blank">{t.piedeSito}</a>
          </p>
          <p>{t.piedeRf} <Link href="/">Racket Fever</Link></p>
        </div>
      </footer>

    </div>
  );
}
