// ============================================================
// LA RADICE DI `/rfcoach` — due porte, non un rimando.
//
// ⚠️ NON MANDA AUTOMATICAMENTE AL SUPER ADMIN, e non e' una svista: qui
// sotto vivono DUE cose per due persone diverse — il pannello del team e
// il gestionale delle scuole. Un rimando automatico avrebbe scelto per
// tutti, e chi cercava l'altro si sarebbe trovato davanti una porta che
// non e' la sua, senza capire perche'.
// ============================================================
import Link from 'next/link';

export const metadata = { title: 'RF Coach' };

export default function PorteRfCoach() {
  return (
    <div className="contenuto" style={{ paddingTop: 56 }}>
      <div className="dentro">
        <div className="marchio" style={{ marginBottom: 6, fontSize: 22 }}>
          <b>RACKET FEVER</b><span>COACH</span>
        </div>
        <p className="sottotitolo">Da qui si entra nei pannelli di gestione.</p>

        <div className="foglio">
          <h2>Scuole e maestri</h2>
          <p className="aiuto">
            Il gestionale del proprio spazio: agenda, allievi, corsi, pacchetti, conto.
          </p>
          {/* ⚠️ QUESTO È UN `<a>`, NON UN `<Link>`, e non è una svista.
              Dietro `/rfcoach/admin` non c'è una pagina di questo sito:
              c'è l'app Expo esportata, un'altra applicazione servita
              come file statici. `<Link>` farebbe una navigazione
              INTERNA a Next — nessun caricamento vero, nessun
              `index.html` dell'app, schermo bianco. Serve che il
              browser lasci davvero il sito ed entri nell'app. */}
          <div className="azioni">
            <a className="bottone acceso" href="/rfcoach/admin">Entra</a>
          </div>
        </div>

        <div className="foglio">
          <h2>Super Admin</h2>
          <p className="aiuto">Riservato al team: l’onboarding e la gestione degli spazi.</p>
          <div className="azioni">
            <Link className="bottone leggero" href="/rfcoach/superadmin">Entra</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
