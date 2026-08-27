// ============================================================
// CONTEGGIO DELLE MEZZ'ORE — quante ne sono state giocate e quanto
// hanno fruttato al circolo.
//
// Cinque numeri, e nient'altro: mezz'ore prenotate, annullate, il
// netto fra le due, quel netto espresso in ore, e il totale incassato.
//
// ============================================================
// ⚠️ QUI NON CI SONO COMMISSIONI, E NON CI DEVONO TORNARE.
//
// Una prima stesura di questo file calcolava anche quanto Racket Fever
// incassava dal circolo. È stata tolta il 27 agosto 2026: il conto che
// riguarda il rapporto fra le due aziende si fa altrove, e questa
// sezione dice al circolo una cosa sola — quanto campo ha venduto.
//
// Vale ancora la ragione scritta in cima a `data/fatturazione.ts`: un
// listino scritto nel codice diventa un listino pubblicato, e cambia
// di trattativa in trattativa. Qui gli euro ci sono, ma sono i SOLDI
// DEL CIRCOLO — il prezzo che il circolo stesso ha messo in griglia —
// non un prezzo che noi gli facciamo.
// ============================================================

// ============================================================
// ⚠️ SI CONTA PER ORA DI GIOCO, NON DI PRENOTAZIONE.
//
// È la decisione che regge tutto il resto, ed è di Giorgio: una
// mezz'ora entra nel conto quando è stata GIOCATA, non quando è stata
// venduta. Una prenotazione fatta oggi per il mese prossimo non conta
// ancora niente; il totale cresce da solo col passare delle ore, anche
// in un giorno in cui nessuno prenota.
//
// La conseguenza tecnica è che un contatore che sale al momento della
// prenotazione non basta: le mezz'ore **maturano** col tempo, e il
// conto di oggi non è quello di ieri anche se non è successo niente.
// Da qui i mucchietti per giorno e la soglia mobile — vedi il riquadro
// più sotto.
// ============================================================

// ============================================================
// ⚠️ IL PREZZO SI CONGELA, E NON SI RILEGGE MAI PIÙ.
//
// Il circolo può cambiare il listino quando vuole. Se il conto
// rileggesse il prezzo di oggi per una mezz'ora giocata a marzo, il
// totale di marzo cambierebbe da solo il giorno di un ritocco al
// listino — e nessuno dei due, né il circolo né noi, saprebbe più
// perché i conti non tornano.
//
// La buona notizia è che il prezzo è già congelato dove serve: ogni
// documento di prenotazione porta il proprio campo `prezzo`, scritto
// alla creazione, e le regole ne vietano la modifica. Le mezz'ore
// della stessa partita possono già costare diverso fra loro — la
// fascia serale — quindi il meccanismo esiste da sempre. Qui lo si
// copia nel mucchietto del giorno, e da lì non si tocca più.
//
// ⚠️ Non serve nessun lavoro periodico che «fotografi i prezzi». Il
// prezzo giusto è quello che c'era nell'istante della prenotazione, e
// in quell'istante è già stato scritto.
// ============================================================

// ⚠️ IN CENTESIMI INTERI. 0,10 in virgola mobile non è 0,10, e
// diecimila mezz'ore sommate in euro danno un totale che non torna con
// la somma delle righe. Si sommano centesimi e si divide per cento una
// volta sola, quando si scrive a schermo.

export const MINUTI_PER_SLOT = 30;

// ============================================================
// LA SOGLIA: l'inizio dell'ora in cui si sta guardando.
//
// ⚠️ PER DIFETTO, cioè l'ora in corso non si conta. Guardando alle
// 18:40 il conto arriva alle 18:00: la mezz'ora delle 17:30 finisce
// alle 18:00 ed è giocata, quella delle 18:00 è ancora in campo.
// Contare l'ora in corso vorrebbe dire un numero che si muove mentre
// lo si guarda, e che due persone affacciate allo stesso schermo
// leggono diverso.
// ============================================================
export function sogliaOraCorrente(adessoMs: number): { giornoIso: string; oraLimite: string } {
  const d = new Date(adessoMs);
  const gg = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  return { giornoIso: `${d.getFullYear()}-${mm}-${gg}`, oraLimite: `${hh}:00` };
}

// Vera se questa mezz'ora è già stata giocata rispetto alla soglia.
//
// ⚠️ Il confronto fra orari è fra STRINGHE, e funziona perché sono
// tutte `HH:MM` a due cifre: '09:30' < '18:00' come testo e come ora.
// È lo stesso confronto che la griglia fa da sempre.
export function slotGiocato(
  giornoIso: string,
  orario: string,
  soglia: { giornoIso: string; oraLimite: string },
): boolean {
  if (giornoIso < soglia.giornoIso) return true;
  if (giornoIso > soglia.giornoIso) return false;
  return orario < soglia.oraLimite;
}

// ============================================================
// I MUCCHIETTI PER GIORNO.
//
// ⚠️ UN DOCUMENTO PER GIORNO DI GIOCO, con dentro le ore. È la forma
// che permette di rispondere a «quanto fino alle 18:00 di oggi» senza
// rileggere migliaia di prenotazioni: i giorni finiti si sommano
// interi una volta sola e non si toccano più, e del giorno in corso si
// prendono solo le ore prima della soglia.
//
// ⚠️ E LE ORE STANNO DENTRO, non in un documento per ora. Un documento
// per ogni mezz'ora sarebbe stato quarantotto documenti al giorno per
// campo: leggerne uno solo e guardarci dentro costa una lettura invece
// di trentuno.
// ============================================================
export interface OraDelGiorno {
  prenotate: number;
  annullate: number;
  // La somma dei prezzi delle mezz'ore NON annullate di quest'ora.
  centesimi: number;
}

export interface GiornoConteggio {
  // Chiave `HH:MM` — l'orario di inizio della mezz'ora.
  perOra: Record<string, OraDelGiorno>;
}

export const ORA_VUOTA: OraDelGiorno = { prenotate: 0, annullate: 0, centesimi: 0 };

// ============================================================
// IL TOTALE.
//
// ⚠️ TRE NUMERI E NON UNO, ed è quello che rende il conto
// verificabile. «Prenotate meno annullate» è una sottrazione che il
// circolo può rifare a mano; un netto e basta è un numero da prendere
// per buono. È anche il modo in cui Giorgio ha chiesto i box.
// ============================================================
export interface TotaleConteggio {
  prenotate: number;
  annullate: number;
  centesimi: number;
}

export const TOTALE_VUOTO: TotaleConteggio = { prenotate: 0, annullate: 0, centesimi: 0 };

export function sommaOra(t: TotaleConteggio, o: OraDelGiorno): TotaleConteggio {
  return {
    prenotate: t.prenotate + o.prenotate,
    annullate: t.annullate + o.annullate,
    centesimi: t.centesimi + o.centesimi,
  };
}

export function sommaGiorno(
  t: TotaleConteggio,
  g: GiornoConteggio,
  fermatiPrimaDi?: string,
): TotaleConteggio {
  let fuori = t;
  for (const [ora, dati] of Object.entries(g.perOra ?? {})) {
    if (fermatiPrimaDi !== undefined && !(ora < fermatiPrimaDi)) continue;
    fuori = sommaOra(fuori, dati);
  }
  return fuori;
}

// ⚠️ Il netto non scende sotto zero. Non dovrebbe mai servire — una
// mezz'ora annullata è sempre stata prima prenotata — ma un numero
// negativo in un riquadro che dice «il dato reale» sarebbe la cosa
// peggiore da mostrare se un giorno i dati si sporcassero.
export function mezzOreNette(t: TotaleConteggio): number {
  return Math.max(0, t.prenotate - t.annullate);
}

// Le stesse mezz'ore dette in ore. Mezze incluse: 7 mezz'ore sono 3,5
// ore, e arrotondare a 4 vorrebbe dire un riquadro che non torna con
// quello accanto.
export function oreNette(t: TotaleConteggio): number {
  return (mezzOreNette(t) * MINUTI_PER_SLOT) / 60;
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
