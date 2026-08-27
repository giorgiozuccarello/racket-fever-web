'use client';

// ============================================================
// MODELLI DI REVENUE — la porta d'ingresso al simulatore.
//
// ⚠️ QUESTA SEZIONE NON CALCOLA NIENTE, e non deve. È solo il pulsante
// che porta alla pagina `/superadmin/modelli-revenue`. Il simulatore
// occupa uno schermo intero — tre colonne di leve, una barra di
// confronto e due punti di indifferenza — e infilarlo dentro una
// sezione collassabile della dashboard vorrebbe dire schiacciarlo in
// mezza pagina proprio mentre lo si usa per ragionare.
//
// ⚠️ E STA DENTRO L'AREA SUPER ADMIN, non in `public/`. La tentazione
// era di lasciare il file HTML così com'è dentro `public/` e finire in
// due minuti: ma tutto ciò che sta in `public/` è raggiungibile da
// chiunque conosca l'indirizzo, senza password e senza lasciare
// traccia. E quella pagina contiene le nostre fasce di prezzo, la
// quota agevolata, la quota a regime e la percentuale di commissione —
// cioè esattamente i numeri che non vogliamo far leggere al circolo
// con cui stiamo trattando. La pagina protetta costa qualche riga in
// più e chiede lo stesso accesso della dashboard.
// ============================================================

import Link from 'next/link';
import SezioneCollassabile from '../../admin/dashboard/SezioneCollassabile';

export default function SezioneModelliRevenue() {
  return (
    <SezioneCollassabile
      id="modelliRevenue"
      titolo="Modelli di Revenue"
      descrizione="Il simulatore dei tre modelli — quota circolo, abbonamento socio, commissione sull’uso"
    >
      <div className="admin-card">
        <div className="admin-card-title">Simulatore Modelli di Revenue</div>
        <p className="admin-card-hint">
          Si sposta il profilo del circolo — soci, prezzo orario, ore prenotate in un anno — e le
          leve di ciascun modello, e i ricavi annui si ricalcolano subito. In fondo, le due
          domande che contano davvero: quanti soci paganti servono perché l’abbonamento valga
          quanto la quota, e quante ore l’anno servono perché ci arrivi la commissione.
        </p>
        <p className="admin-card-hint">
          {/* ⚠️ Detto qui e non solo dentro il simulatore. Chi apre la
              pagina per la prima volta la vede in mezzo a numeri che
              sembrano definitivi, ed è il momento sbagliato per
              scoprirlo. */}
          Sono valori di lavoro, non un listino: servono a confrontare le forme dei tre modelli,
          non a fare un preventivo.
        </p>
        <div style={{ marginTop: '1.1rem' }}>
          <Link className="btn" href="/superadmin/modelli-revenue">
            Vai a Modelli di Revenue
          </Link>
        </div>
      </div>
    </SezioneCollassabile>
  );
}
