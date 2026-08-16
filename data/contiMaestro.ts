// ============================================================
// I NUMERI DELLA SCHEDA MAESTRO — si RICAVANO, non si compilano.
//
// Lezioni date, lezioni in programma, lezioni annullate: sono tutti
// conteggi che escono da dati gia' esistenti (le prenotazioni con un
// maestroId, e la traccia lasciata dal server quando una lezione viene
// disdetta). Non sono campi della scheda, e non devono diventarlo: un
// contatore scritto a mano si disallinea al primo annullamento fatto
// da un'altra schermata, e da quel momento in poi mente senza che
// nessuno lo sappia.
//
// ⚠️ SI CONTANO LE LEZIONI, NON LE MEZZ'ORE. Una lezione di un'ora
// occupa DUE documenti prenotazione, uno per ogni mezz'ora, legati
// dallo stesso cardId. Contando i documenti, ogni numero di questa
// scheda sarebbe il doppio del vero — e sarebbe un errore
// perfettamente credibile, quindi nessuno lo scoprirebbe.
// ============================================================

// Mezz'ora: quanto dura uno slot. Serve a sapere quando una lezione e'
// FINITA, che non e' quando comincia la sua ultima mezz'ora.
const DURATA_SLOT_MS = 30 * 60 * 1000;

export interface PrenotazioneDaContare {
  id: string;
  tipo?: string;
  maestroId?: string;
  cardId?: string | null;
  data: string;    // 'AAAA-MM-GG'
  orario: string;  // 'HH:MM'
}

export interface AnnullataDaContare {
  // ⚠️ L'identificativo del documento E' il cardId della lezione (lo
  // decide il server). Serve per riconoscere le cancellazioni PARZIALI:
  // vedi sotto.
  id: string;
  maestroId: string | null;
  oltreIlTermine: boolean;
  // Istante in cui la lezione sarebbe cominciata, e istante in cui e'
  // stata cancellata. Servono a distinguere una disdetta tardiva dalla
  // pulizia della griglia fatta il giorno dopo.
  inizioMs?: number | null;
  quandoMs?: number;
}

export interface ContiMaestro {
  inProgramma: number;
  fatte: number;
  annullate: number;
  // Annullate PRIMA che la lezione cominciasse, ma oltre il termine
  // per disdire. Sottoinsieme di "annullate".
  tardive: number;
}

// 'AAAA-MM-GGTHH:MM' — confrontabile come stringa, senza costruire
// nessuna data. Le prenotazioni portano gia' giorno e ora nell'ora
// italiana del circolo, e chi guarda questa scheda e' seduto in
// segreteria: qui non serve nessun calcolo di fuso.
function istante(data: string, orario: string): number {
  const [anno, mese, giorno] = data.split('-').map(Number);
  const [ora, minuti] = orario.split(':').map(Number);
  // Costruita nell'ora LOCALE del browser, come il "adesso" con cui
  // viene confrontata: due grandezze coerenti fra loro, ed e' tutto
  // quello che serve per dire se una lezione e' passata.
  return new Date(anno, (mese || 1) - 1, giorno || 1, ora || 0, minuti || 0).getTime();
}

export function contiDelMaestro(
  maestroId: string,
  prenotazioni: PrenotazioneDaContare[],
  annullate: AnnullataDaContare[],
  adesso: Date = new Date(),
): ContiMaestro {
  const ora = adesso.getTime();

  // Una card per lezione. Per ognuna si tiene l'istante dell'ULTIMA
  // mezz'ora, piu' la sua durata: una lezione e' "fatta" quando e'
  // finita, non quando comincia il suo ultimo pezzo. Senza i trenta
  // minuti, una lezione 17:00-18:00 passava fra le "date" alle 17:31,
  // con ventinove minuti ancora da giocare.
  const fineLezione = new Map<string, number>();
  const cardVive = new Set<string>();
  for (const p of prenotazioni) {
    if (p.tipo !== 'lezione') continue;
    if (p.maestroId !== maestroId) continue;
    if (!p.data || !p.orario) continue;
    const chiave = p.cardId || p.id;
    cardVive.add(chiave);
    const fine = istante(p.data, p.orario) + DURATA_SLOT_MS;
    const precedente = fineLezione.get(chiave);
    if (precedente === undefined || fine > precedente) fineLezione.set(chiave, fine);
  }

  let inProgramma = 0;
  let fatte = 0;
  fineLezione.forEach((fine) => {
    if (fine > ora) inProgramma += 1;
    else fatte += 1;
  });

  let annullateN = 0;
  let tardive = 0;
  for (const a of annullate) {
    if (a.maestroId !== maestroId) continue;
    // ⚠️ CANCELLAZIONE PARZIALE. Accorciando una lezione di un'ora —
    // cosa che tutte e tre le schermate di annullamento permettono —
    // il server lascia la traccia, ma della lezione resta in piedi
    // l'altra mezz'ora. Contandola qui, la stessa lezione risulterebbe
    // insieme "annullata" e "in programma": due conteggi per un unico
    // fatto. Finche' una sua mezz'ora e' viva, la lezione non e'
    // annullata — e' solo piu' corta.
    if (cardVive.has(a.id)) continue;
    annullateN += 1;
    // "Tardiva" solo se la lezione non era ancora cominciata. Senza
    // questa condizione, la pulizia della griglia fatta il giorno dopo
    // — che tecnicamente e' sempre "oltre il termine" — finiva nello
    // stesso numero, e sulla scheda sembrava un demerito del Maestro.
    const primaDellInizio = typeof a.inizioMs === 'number' && typeof a.quandoMs === 'number'
      ? a.quandoMs < a.inizioMs
      : false;
    if (a.oltreIlTermine && primaDellInizio) tardive += 1;
  }

  return { inProgramma, fatte, annullate: annullateN, tardive };
}
