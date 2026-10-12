import Link from 'next/link';
import { Testata } from './_pezzi/Guscio';

export const metadata = { title: 'RF Coach' };

// ============================================================
// LA PORTA DI `/rfcoach` — da qui si entra nei due pannelli, e dal 12
// ottobre 2026 un maestro che non c'e' ancora chiede di entrare.
//
// ⚠️ VESTITA COME IL GESTIONALE: la stessa testata con la banda e il marchio
// COACH, e i blocchi come capitoli col filo d'accento.
// ============================================================

export default function PorteRfCoach() {
  return (
    <>
      <Testata nome="RF Coach" />
      <div className="ingresso">
        <div className="scheda larga">
          <h1 className="titolo">RF Coach</h1>
          <p className="sottotitolo">Da qui si entra nei pannelli di gestione.</p>

          <div className="capitoli">
            <div className="capitolo largo">
              <h2>Scuole e maestri</h2>
              <p className="aiuto">
                Il gestionale del proprio spazio: agenda, allievi, corsi, pacchetti, conto.
              </p>
              {/* ⚠️ QUESTO È UN `<a>`, NON UN `<Link>`, e non è una svista.
                  Dietro `/rfcoach/admin` non c'è una pagina di questo sito:
                  c'è l'app Expo esportata, un'altra applicazione servita
                  come file statici. `<Link>` farebbe una navigazione
                  INTERNA a Next — nessun caricamento vero, nessun
                  `index.html` dell'app, schermo bianco. */}
              <div className="azioni">
                <a className="bottone acceso" href="/rfcoach/admin">Entra</a>
              </div>
            </div>

            <div className="capitolo largo">
              <h2>Sei un maestro e non hai ancora RF Coach?</h2>
              <p className="aiuto">Lascia i tuoi dati: ti contattiamo noi per attivare il tuo spazio.</p>
              <div className="azioni">
                <Link className="bottone leggero" href="/rfcoach/attiva">Richiedi l’attivazione</Link>
              </div>
            </div>

            <div className="capitolo largo">
              <h2>Super Admin</h2>
              <p className="aiuto">Riservato al team: clienti, contratti, richieste.</p>
              <div className="azioni">
                <Link className="bottone leggero" href="/rfcoach/superadmin">Entra</Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
