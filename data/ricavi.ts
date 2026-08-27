// ============================================================
// RICAVI — la commissione sugli slot prenotati.
//
// È il modello di ricavi entrato in vigore il 27 agosto 2026: Racket
// Fever incassa una cifra fissa per ogni mezz'ora di campo prenotata
// attraverso l'app. Questo file contiene la matematica e le regole di
// che cosa si conta; le due schermate che lo mostrano — quella
// dell'Admin di circolo e quella del Super Admin — leggono soltanto
// i numeri che il server ha già scritto.
//
// ============================================================
// ⚠️ QUI CI SONO GLI EURO, E IN `data/fatturazione.ts` NO. NON È UNA
// CONTRADDIZIONE, ED È IMPORTANTE CAPIRE PERCHÉ.
//
// Il 21 agosto 2026 fasce e quote in euro sono state tolte da tutto il
// progetto, con una motivazione scritta in cima a `fatturazione.ts`
// che resta valida: **un listino scritto nel codice diventa un listino
// pubblicato**, cambia di trattativa in trattativa, e ogni versione
// dell'app in circolazione ne mostrerebbe una diversa.
//
// Questo è un caso diverso, e la differenza sta in una parola: lì il
// software avrebbe dovuto sapere quanto un circolo *paga*, cioè un
// prezzo negoziato. Qui il software sa quanti *slot* sono stati
// prenotati — un conteggio, non un prezzo — e la commissione per slot
// è una sola per tutta la rete, non una per circolo.
//
// ⚠️ E RESTA UNA SOLA. Il giorno che a un circolo si concedesse una
// commissione diversa, questa costante diventerebbe un listino e
// andrebbe tolta di qui esattamente come le fasce: il numero
// finirebbe sul contratto e il software mostrerebbe soltanto il
// conteggio. Chi si trovasse a scrivere `commissione` come campo di un
// circolo si fermi e rilegga questo riquadro.
//
// ⚠️ NON RIGUARDA L'UTENTE DELL'APP. Il socio non paga niente di
// questo, non lo vede e non deve vederlo: è un rapporto fra due
// aziende. Il conto compare solo nella dashboard dell'Admin — che è
// il circolo, cioè la controparte — e nel pannello del Super Admin.
// Portarlo dentro l'app del socio aprirebbe davanti a un revisore di
// App Store la domanda «che cos'è questo pagamento e perché non passa
// dallo store?», su un pagamento che l'utente non fa.
// ============================================================

// Quanto vale una mezz'ora prenotata, in centesimi.
//
// ⚠️ IN CENTESIMI E NON IN EURO, e non è pedanteria: 0,10 in virgola
// mobile non è 0,10, e diecimila slat moltiplicati per un numero che
// vale 0,1000000000000000055 danno un totale che non torna con la
// somma delle righe. Un revisore che ricontrolla una fattura trova
// scarti di centesimi e ha ragione lui. Si contano centesimi interi e
// si divide per cento una volta sola, alla fine, quando si scrive a
// schermo.
export const CENTESIMI_PER_SLOT = 10;

// ============================================================
// CHE COSA SI CONTA — e che cosa no.
//
// ⚠️ UNO SLOT È UN DOCUMENTO. Un'ora di campo sono DUE documenti da
// mezz'ora, e ciascuno vale la sua commissione. È la granularità con
// cui il progetto è costruito da sempre (`idSlot()` in
// `prenotazioniRepo`), quindi non c'è nessuna conversione da fare e
// nessuna interpretazione: si contano i documenti.
//
// ⚠️ GLI ORARI RISERVATI NON SONO PRENOTAZIONI, e quindi non c'è
// niente da escludere. Vivono in un'altra collezione
// (`circoli/{id}/blocchi`) e non generano nessun documento in
// `prenotazioni`: la griglia li disegna sopra. Chi cercasse in questo
// file il filtro «togli i riservati» non lo trova perché non serve —
// ma se un giorno i blocchi diventassero prenotazioni vere, quel
// filtro va aggiunto qui e in `functions/src/ricavi.ts` insieme.
//
// ⚠️ SI CONTANO ANCHE GLI SLOT A COSTO ZERO. Una lezione, o una
// prenotazione che il circolo regala a un socio, non fa incassare
// niente al circolo ma occupa un campo ed è passata dall'app: è
// servizio erogato, e vale la commissione come le altre. Legare la
// commissione al prezzo dello slot vorrebbe dire che un circolo che
// mette tutti i campi a zero non paga niente.
//
// ⚠️ I SEGNAPOSTO DI SFIDA NO. `sospesaSfida` marca mezz'ore tenute
// da parte durante una trattativa fra due sfidanti: prezzo zero,
// nessun giocatore, e oggi non se ne creano più. Nello storico ce ne
// sono, e non sono campo venduto.
// ============================================================
export function slotDaContare(p: {
  sospesaSfida?: boolean | null;
}): boolean {
  return p.sospesaSfida !== true;
}

// ============================================================
// IL PERIODO.
//
// ⚠️ ANCORATO ALL'ANNIVERSARIO DEL CIRCOLO, non al primo gennaio. È
// la stessa scelta già fatta per il conteggio degli utenti, e la
// ragione sta scritta lì: con l'anno solare tutti i rinnovi della rete
// arriverebbero nella stessa settimana di dicembre. Qui in più c'è che
// un circolo attivato a marzo troverebbe il suo primo «trimestre»
// lungo tre settimane.
//
// ⚠️ LA CADENZA NON È DECISA. Trimestre, semestre o anno è una
// questione di contratto e cambierà: per questo è un parametro e non
// un numero scritto dentro. Le tre cadenze si calcolano tutte allo
// stesso modo — l'anno del circolo diviso in N parti uguali — così
// cambiando cadenza i confini restano allineati all'anniversario e non
// nasce un periodo tronco.
// ============================================================
export type Cadenza = 'trimestre' | 'semestre' | 'anno';

export const PARTI_PER_ANNO: Record<Cadenza, number> = {
  trimestre: 4,
  semestre: 2,
  anno: 1,
};

const ANNO_MS = 365 * 24 * 60 * 60 * 1000;

export interface PeriodoRicavi {
  inizioMs: number;
  fineMs: number;
  // Progressivo dall'attivazione del circolo: «3» del trimestre vuol
  // dire il terzo trimestre da quando il circolo è partito.
  numero: number;
  cadenza: Cadenza;
  // Falso quando la data di attivazione non c'è e il periodo è stato
  // ricavato all'indietro da oggi. Va detto a schermo: un periodo non
  // ancorato non è sbagliato, ma non è nemmeno l'anniversario di
  // niente, e chi legge la fattura deve saperlo.
  ancorato: boolean;
}

// ⚠️ LA CHIAVE DEL PERIODO È UNA STRINGA, ed è quella con cui il
// server nomina il documento dei conteggi. Deve essere stabile:
// ricalcolandola fra sei mesi per lo stesso periodo deve venire
// identica, o i conteggi finirebbero in due documenti diversi. Per
// questo è fatta di cadenza e progressivo — due numeri che non
// cambiano — e non della data di inizio, che dipende dall'orologio.
export function chiavePeriodo(p: { cadenza: Cadenza; numero: number }): string {
  return `${p.cadenza}-${String(p.numero).padStart(4, '0')}`;
}

export function periodoRicavi(
  attivatoIlMs: number | null | undefined,
  adessoMs: number,
  cadenza: Cadenza,
): PeriodoRicavi {
  const durata = ANNO_MS / PARTI_PER_ANNO[cadenza];
  // Senza data di attivazione non si può ancorare niente: si prende il
  // periodo che finisce adesso. È il ripiego onesto — dice «questi
  // ultimi tre mesi» invece di inventare un anniversario — ed è a
  // questo che serve `ancorato`.
  if (!attivatoIlMs || attivatoIlMs <= 0 || attivatoIlMs > adessoMs) {
    return {
      inizioMs: adessoMs - durata,
      fineMs: adessoMs,
      numero: 1,
      cadenza,
      ancorato: false,
    };
  }
  const trascorsi = Math.floor((adessoMs - attivatoIlMs) / durata);
  const inizioMs = attivatoIlMs + trascorsi * durata;
  return {
    inizioMs,
    fineMs: inizioMs + durata,
    numero: trascorsi + 1,
    cadenza,
    ancorato: true,
  };
}

// ============================================================
// I NUMERI DI UN PERIODO.
//
// ⚠️ TRE CONTATORI E NON UNO, e questa è la decisione che rende il
// conto difendibile davanti a un circolo che lo contesta.
//
// La regola commerciale è che uno slot prenotato vale la commissione e
// uno slot annullato la toglie — cioè si fattura il NETTO. Verrebbe
// naturale tenere un contatore solo e farlo salire e scendere. Non si
// fa, per un motivo che si vede solo dopo: un numero che oscilla non è
// verificabile. Se il circolo chiede «perché 4.812?», con un contatore
// solo la risposta è «perché adesso dice così». Con tre — prenotati,
// annullati, netto — la risposta è una sottrazione che chiunque può
// rifare, e i due addendi sono contatori che salgono soltanto, cioè
// non possono tornare indietro senza che si veda.
//
// ⚠️ ED È ANCHE L'UNICO MODO PER RIFARE LA STESSA FATTURA DUE VOLTE.
// Una fattura emessa il 31 marzo deve essere ricalcolabile identica il
// 15 aprile. Con contatori che salgono e basta lo è; con un netto
// vivo, no.
// ============================================================
export interface ConteggioPeriodo {
  // Quante mezz'ore sono state prenotate nel periodo.
  slotPrenotati: number;
  // Quante di quelle prenotate sono poi state annullate. ⚠️ Si conta
  // l'annullamento nel periodo in cui è AVVENUTO, non in quello in cui
  // era stata fatta la prenotazione: un annullamento che scavalca la
  // chiusura di un periodo non può riaprire una fattura già emessa.
  slotAnnullati: number;
  // Quando il server ha toccato questi numeri l'ultima volta.
  aggiornatoIlMs: number;
}

export const CONTEGGIO_VUOTO: ConteggioPeriodo = {
  slotPrenotati: 0,
  slotAnnullati: 0,
  aggiornatoIlMs: 0,
};

export function slotNetti(c: ConteggioPeriodo): number {
  // ⚠️ Il netto non scende sotto zero. Può succedere davvero, e non è
  // un errore dei dati: gli annullamenti di gennaio riguardano
  // prenotazioni fatte a dicembre, quindi in un periodo si può
  // annullare più di quanto si sia prenotato. Fatturare un numero
  // negativo vorrebbe dire emettere una nota di credito automatica,
  // che non è una decisione del software.
  return Math.max(0, c.slotPrenotati - c.slotAnnullati);
}

export function centesimiDovuti(c: ConteggioPeriodo): number {
  return slotNetti(c) * CENTESIMI_PER_SLOT;
}

// ============================================================
// COME SI SCRIVONO A SCHERMO.
//
// ⚠️ LA DIVISIONE PER CENTO SI FA QUI E IN NESSUN ALTRO POSTO. Ogni
// schermata che si dividesse i centesimi per conto suo aprirebbe la
// porta a due totali che non tornano fra loro.
// ============================================================
// ⚠️ CON IL PUNTO DELLE MIGLIAIA, e non e' un vezzo tipografico: il
// resto della dashboard scrive «48.120,00 €» (vedi `euro()` in
// `data/fatturazione.ts`), e due formati diversi per due cifre in
// euro nella stessa pagina sono esattamente il dettaglio che fa
// dubitare del numero. Chi legge una fattura nota prima le
// incongruenze di forma di quelle di sostanza.
export function euroDaCentesimi(centesimi: number): string {
  const segno = centesimi < 0 ? '−' : '';
  const assoluti = Math.abs(Math.round(centesimi));
  const interi = Math.floor(assoluti / 100);
  const resto = assoluti % 100;
  return `${segno}${conMigliaia(interi)},${String(resto).padStart(2, '0')}`;
}

// ⚠️ A MANO E NON CON `toLocaleString`: Hermes, il motore JavaScript
// dell'app, non porta con se' le localizzazioni — `toLocaleString`
// li' non fa niente e restituisce il numero nudo. E' la stessa
// ragione per cui le date si compongono a mano in tutto il progetto.
export function conMigliaia(n: number): string {
  const cifre = String(Math.abs(Math.trunc(n)));
  let fuori = '';
  for (let i = 0; i < cifre.length; i += 1) {
    if (i > 0 && (cifre.length - i) % 3 === 0) fuori += '.';
    fuori += cifre[i];
  }
  return (n < 0 ? '−' : '') + fuori;
}

// ============================================================
// I NUMERI INCROCIATI.
//
// ⚠️ SERVONO A RISPONDERE A UNA DOMANDA SOLA: «quanto mi costa?». Un
// circolo che legge «devi 481,20 €» non ha modo di sapere se è tanto o
// poco. Lo stesso numero accanto a quello che il circolo ha incassato
// dai campi in quello stesso periodo si legge da solo, e il rapporto
// fra i due è la sola cifra che conta davvero nella trattativa.
//
// ⚠️ «QUELLO CHE IL CIRCOLO INCASSA» È IL VALORE DEI CAMPI VENDUTI,
// non il denaro entrato in cassa. Sono due cose diverse e il registro
// movimenti le tiene separate: le RICARICHE sono denaro vero che entra
// (contanti in segreteria, bonifico), gli ADDEBITI sono consumo di
// credito già versato. Ai fini del confronto conta il secondo, perché
// è quello generato dalle stesse prenotazioni su cui si calcola la
// commissione. Confrontare la commissione con le ricariche darebbe un
// rapporto che dipende da quando i soci passano in segreteria.
// ============================================================
export interface IncrocioRicavi {
  // Il valore dei campi venduti nel periodo, in centesimi.
  centesimiCircolo: number;
  // La commissione dovuta, in centesimi.
  centesimiRacketFever: number;
  // Quanti soci distinti hanno prenotato almeno una volta.
  sociCheHannoPrenotato: number;
  // Quante mezz'ore erano disponibili in tutto nel periodo: campi per
  // slot al giorno per giorni. Serve al riempimento.
  slotDisponibili: number;
}

// Quanta parte di quello che incassa il circolo se ne va in
// commissione, in percentuale. È il numero che risponde alla domanda
// vera, ed è quello che va detto per primo.
//
// ⚠️ Torna `null` e non zero quando il circolo non ha incassato
// niente: zero vorrebbe dire «non ti costa niente», mentre la verità è
// «non si può dire». Un circolo che ha regalato tutti i campi ha
// comunque una commissione da pagare, e mostrargli «0%» sarebbe una
// bugia comoda.
export function incidenzaPercento(i: IncrocioRicavi): number | null {
  if (i.centesimiCircolo <= 0) return null;
  return (i.centesimiRacketFever / i.centesimiCircolo) * 100;
}

// Quanto costa la piattaforma per ogni socio che l'ha davvero usata
// per prenotare. È il numero da mettere accanto ai 4,99 € l'anno che
// il socio paga: dice in una riga se il conto sta in piedi.
export function centesimiPerSocioAttivo(i: IncrocioRicavi): number | null {
  if (i.sociCheHannoPrenotato <= 0) return null;
  return i.centesimiRacketFever / i.sociCheHannoPrenotato;
}

// Quanta parte dei campi disponibili è stata venduta. Dice al circolo
// quanto margine ha ancora, e a noi quanto può crescere quel circolo
// senza aprire un campo nuovo.
export function riempimentoPercento(slotNetti: number, slotDisponibili: number): number | null {
  if (slotDisponibili <= 0) return null;
  return Math.min(100, (slotNetti / slotDisponibili) * 100);
}

// Il prezzo medio di una mezz'ora, in centesimi. Serve a noi più che
// al circolo: dice se una commissione fissa uguale per tutti è equa.
// Un circolo che vende la mezz'ora a 3 € e uno che la vende a 12
// pagano gli stessi 10 centesimi, e questo numero è quello che lo
// rende visibile prima che se ne accorga qualcun altro.
export function centesimiMediPerSlot(i: IncrocioRicavi, slotNetti: number): number | null {
  if (slotNetti <= 0) return null;
  return i.centesimiCircolo / slotNetti;
}

// ============================================================
// LA PROIEZIONE A FINE PERIODO.
//
// ⚠️ È UNA STIMA E VA DETTO CHE LO È. Serve a sapere in anticipo che
// fattura aspettarsi, non a emetterla: si ricava dal ritmo tenuto
// finora e presuppone che il resto del periodo somigli alla parte già
// passata, cosa che d'estate non è vera per nessun circolo di tennis.
//
// ⚠️ Torna `null` nei primi giorni del periodo. Con tre giorni di
// dati, moltiplicare per trenta produce un numero che sembra preciso
// e non lo è: meglio non scrivere niente che scrivere una cifra a
// caso con due decimali.
// ============================================================
// ⚠️ Esportata perche' la schermata la scrive nella frase che spiega
// perche' la proiezione non c'e' ancora. Con il numero scritto due
// volte, il giorno che cambia qui la frase resta a dirne un altro.
export const GIORNI_MINIMI_PER_PROIETTARE = 7;
const GIORNO_MS = 24 * 60 * 60 * 1000;

export function proiezioneSlot(
  slotFinora: number,
  periodo: PeriodoRicavi,
  adessoMs: number,
): number | null {
  const trascorsiMs = Math.min(adessoMs, periodo.fineMs) - periodo.inizioMs;
  if (trascorsiMs < GIORNI_MINIMI_PER_PROIETTARE * GIORNO_MS) return null;
  const durataMs = periodo.fineMs - periodo.inizioMs;
  if (trascorsiMs <= 0 || durataMs <= 0) return null;
  return Math.round(slotFinora * (durataMs / trascorsiMs));
}
