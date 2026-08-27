// ============================================================
// CONTEGGIO DELLE MEZZ'ORE — due conti diversi, e vanno tenuti
// distinti perché rispondono a due domande diverse.
//
// ⚠️ «PRENOTATO ADESSO» — quante mezz'ore risultano prenotate nel
// momento in cui si guarda, comprese quelle di domani e del mese
// prossimo. Sale quando qualcuno prenota, scende quando qualcuno
// disdice. È la fotografia del presente, e serve a tenere sotto
// controllo il circolo mentre gira.
//
// ⚠️ «MATURATO» — quante mezz'ore sono state effettivamente giocate,
// con il taglio a MEZZANOTTE DI IERI: entrano solo i giorni chiusi per
// intero. È il numero su cui si fattura, ed è l'unico che non cambia
// più una volta scritto.
//
// ⚠️ NON SONO LO STESSO NUMERO IN DUE MOMENTI DIVERSI. Una prenotazione
// per il mese prossimo è dentro il primo e fuori dal secondo, e ci
// resterà fuori fino al giorno dopo la partita. Confonderli vorrebbe
// dire fatturare campo che non è ancora stato giocato.
//
// ============================================================
// ⚠️ QUI NON C'È NESSUNA COMMISSIONE, E NON CE NE DEVONO ARRIVARE.
//
// Questo file è il gemello condiviso: sta nell'app, sta nel sito, e
// viene copiato dentro le Cloud Functions. Quello che finisce qui
// finisce nel pacchetto che va sugli store.
//
// Quanto Racket Fever incassa dal circolo vive in un file che esiste
// SOLO nel progetto del sito, sotto il pannello di rete. Non è una
// precauzione di facciata: così quella cifra non è dentro l'app
// nemmeno da spenta, e un revisore che aprisse la dashboard di un
// circolo non trova niente da chiedere su un pagamento che l'utente
// dell'app non fa.
// ============================================================

export const MINUTI_PER_SLOT = 30;

// ============================================================
// I TRE NUMERI, ed è la stessa forma per il live e per il maturato.
//
// ⚠️ TRE E NON UNO. «Prenotate meno annullate» è una sottrazione che
// chiunque può rifare a mano; un netto e basta è un numero da prendere
// per buono. Vale per il circolo che guarda il proprio conto e vale
// per noi quando quel conto diventa una fattura.
// ============================================================
export interface Conteggio {
  prenotate: number;
  annullate: number;
  // Il valore delle mezz'ore ancora in piedi, in centesimi.
  //
  // ⚠️ IN CENTESIMI INTERI. 0,10 in virgola mobile non è 0,10, e
  // diecimila mezz'ore sommate in euro danno un totale che non torna
  // con la somma delle righe. Si sommano centesimi e si divide per
  // cento una volta sola, quando si scrive a schermo.
  //
  // ⚠️ E IL PREZZO È QUELLO DEL MOMENTO DELLA PRENOTAZIONE. Il circolo
  // può cambiare il listino quando vuole: se il conto rileggesse il
  // prezzo di oggi per una mezz'ora giocata a marzo, il totale di
  // marzo cambierebbe da solo il giorno di un ritocco. Ogni documento
  // di prenotazione porta già il proprio `prezzo`, scritto alla
  // creazione, e le regole ne vietano la modifica: qui lo si copia e
  // non lo si rilegge mai più.
  centesimi: number;
}

export const CONTEGGIO_VUOTO: Conteggio = { prenotate: 0, annullate: 0, centesimi: 0 };

export function somma(a: Conteggio, b: Conteggio): Conteggio {
  return {
    prenotate: a.prenotate + b.prenotate,
    annullate: a.annullate + b.annullate,
    centesimi: a.centesimi + b.centesimi,
  };
}

// ⚠️ Il netto non scende sotto zero. Non dovrebbe servire — una
// mezz'ora annullata è sempre stata prima prenotata — ma un numero
// negativo in un riquadro che dice «il dato reale» sarebbe la cosa
// peggiore da mostrare se un giorno i dati si sporcassero.
export function mezzOreNette(c: Conteggio): number {
  return Math.max(0, c.prenotate - c.annullate);
}

// Le stesse mezz'ore dette in ore. Mezze comprese: sette mezz'ore sono
// tre ore e mezza, e arrotondare a quattro vorrebbe dire un riquadro
// che non torna con quello accanto.
export function oreNette(c: Conteggio): number {
  return (mezzOreNette(c) * MINUTI_PER_SLOT) / 60;
}

// ============================================================
// IL TAGLIO DEL MATURATO: la mezzanotte appena passata.
//
// ⚠️ SOLO GIORNI CHIUSI PER INTERO. Una prima stesura tagliava
// all'inizio dell'ora in corso: era più preciso e sbagliato lo stesso,
// perché produceva un numero che si muoveva mentre lo si guardava e
// che due persone affacciate allo stesso schermo leggevano diverso.
// Con il taglio a ieri, il maturato di oggi è lo stesso a qualunque
// ora lo si apra — ed è quello che serve a un numero su cui si
// fattura.
//
// ⚠️ E SEMPLIFICA TUTTO IL RESTO: non servono più le ore dentro la
// giornata. Un mucchietto per giorno, un totale, e niente da
// ricalcolare a metà.
// ============================================================
const GIORNO_MS = 24 * 60 * 60 * 1000;

export function isoDelGiorno(ms: number): string {
  const d = new Date(ms);
  const gg = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${gg}`;
}

// L'ultimo giorno che conta nel maturato: ieri.
export function ultimoGiornoMaturato(adessoMs: number): string {
  return isoDelGiorno(adessoMs - GIORNO_MS);
}

export function giornoDopo(giornoIso: string): string {
  return isoDelGiorno(new Date(`${giornoIso}T12:00:00`).getTime() + GIORNO_MS);
}

// ============================================================
// COME SI SCRIVONO A SCHERMO.
//
// ⚠️ La divisione per cento si fa qui e in nessun altro posto: ogni
// schermata che se la facesse da sé aprirebbe la porta a due totali
// che non tornano fra loro.
// ============================================================
export function euroDaCentesimi(centesimi: number): string {
  const segno = centesimi < 0 ? '−' : '';
  const assoluti = Math.abs(Math.round(centesimi));
  const interi = Math.floor(assoluti / 100);
  const resto = assoluti % 100;
  return `${segno}${conMigliaia(interi)},${String(resto).padStart(2, '0')}`;
}

// ⚠️ A MANO E NON CON `toLocaleString`: Hermes, il motore JavaScript
// dell'app, non porta con sé le localizzazioni — lì `toLocaleString`
// non fa niente e restituisce il numero nudo. È la stessa ragione per
// cui in tutto il progetto le date si compongono a mano.
export function conMigliaia(n: number): string {
  const cifre = String(Math.abs(Math.trunc(n)));
  let fuori = '';
  for (let i = 0; i < cifre.length; i += 1) {
    if (i > 0 && (cifre.length - i) % 3 === 0) fuori += '.';
    fuori += cifre[i];
  }
  return (n < 0 ? '−' : '') + fuori;
}

// Le ore con la mezza, scritte come le direbbe una persona: «3,5» e
// non «3.5», «12» e non «12,0».
export function oreScritte(ore: number): string {
  const intere = Math.trunc(ore);
  const mezza = Math.abs(ore - intere) >= 0.25;
  return mezza ? `${conMigliaia(intere)},5` : conMigliaia(intere);
}
