// ============================================================
// IL GESTIONALE DELLE SCUOLE — segnaposto, e dice la verita'.
//
// ⚠️ QUESTA PAGINA ESISTE PERCHE' IL RIMANDO DA `/rfcoach/Admin` DEVE
// ATTERRARE DA QUALCHE PARTE. Senza, chi segue l'indirizzo con le
// maiuscole — quello scritto nella richiesta del 16 settembre —
// prenderebbe un 404 che non saprebbe spiegarsi.
//
// ⚠️ E NON PROMETTE NIENTE CHE NON CI SIA. Qui arrivera' l'app Expo
// esportata sul web, con il guscio da scrivania: e' il punto 3 del piano
// in `claude/IMPIANTO_WEB_DAL_16_SETTEMBRE.md`. Finche' non c'e', questa
// pagina dice cosa fare ADESSO invece di mostrare un cantiere.
// ============================================================
export const metadata = { title: 'RF Coach — Gestionale' };

export default function AdminInArrivo() {
  return (
    <div className="contenuto">
      <div className="dentro">
        <h1 className="titolo">Il gestionale da computer sta arrivando</h1>
        <p className="sottotitolo">
          Sara’ la stessa app che hai sul telefono, riorganizzata per lo schermo grande.
        </p>
        <div className="foglio">
          <p>
            Per adesso il tuo spazio si gestisce dall’app <b>RF Coach</b> sul telefono:
            agenda, allievi, corsi, pacchetti e conto sono tutti li’, e i dati sono gli
            stessi che vedrai qui.
          </p>
        </div>
      </div>
    </div>
  );
}
