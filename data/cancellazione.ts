// ============================================================
// LIMITE DI CANCELLAZIONE E PROMEMORIA
// Un solo posto in cui si decide "entro quando si puo' disdire" e
// "quando parte un promemoria". Le due cose sono legate — l'ultimo
// promemoria e' l'ultima chiamata utile per cancellare, quindi
// dipende dal limite — e tenerle in due file avrebbe voluto dire
// ricalcolare la stessa data due volte, con la garanzia che prima o
// poi divergono.
//
// ⚠️ Qui NON si invia nulla. Le notifiche vere (che arrivano con
// l'app chiusa) hanno bisogno delle Cloud Functions e dei servizi di
// Google/Apple: quando ci saranno, chiameranno queste funzioni e non
// dovranno inventarsi ne' gli orari ne' i testi.
//
// ⚠️ Gli istanti dei promemoria NON si scrivono sulla prenotazione.
// Se li congelassimo, il giorno in cui l'Admin sposta il limite
// tutte le prenotazioni gia' in essere continuerebbero a dire
// l'orario vecchio. Si ricalcolano ogni volta: costano niente.
// ============================================================

// Massimo impostabile dall'Admin, in ore. Oltre le 24 il vincolo
// diventa piu' rigido di quanto abbia senso per un campo da tennis e
// lo slider perderebbe risoluzione proprio dove serve, nelle prime
// ore.
export const ORE_LIMITE_CANCELLAZIONE_MAX = 24;

const GIORNI = ['domenica', 'lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato'];
const MESI = [
  'gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno',
  'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre',
];

// Nomi scritti a mano e non toLocaleDateString('it-IT'): su Hermes i
// dati di localizzazione possono mancare del tutto e il risultato
// sarebbe in inglese, o peggio un errore a runtime.
export function dataEstesa(d: Date): string {
  return `${GIORNI[d.getDay()]} ${d.getDate()} ${MESI[d.getMonth()]}`;
}

export function oraBreve(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

// Istante di inizio di uno slot. 'data' e' 'YYYY-MM-DD', 'orario' e'
// 'HH:MM'. La Date si costruisce in ora LOCALE (mai new Date('...Z'))
// perche' il confronto e' con l'orologio di chi sta guardando l'app.
export function istanteSlot(data: string, orario: string): Date {
  const [h, m] = orario.split(':').map(Number);
  const d = new Date(`${data}T00:00:00`);
  d.setHours(h, m, 0, 0);
  return d;
}

// Quante ore prima si puo' ancora disdire, ripulite: qualunque cosa
// ci sia sul circolo (campo assente, null, numero storto) diventa un
// intero fra 0 e il massimo.
export function oreLimiteDi(circolo?: { oreLimiteCancellazione?: number | null } | null): number {
  // Number() e non typeof === 'number': un valore scritto a mano dalla
  // console Firestore, o arrivato da un import, puo' essere la stringa
  // "12". Scartandolo il limite del circolo sparirebbe in silenzio, ed
  // e' l'unico modo in cui questo conto puo' sbagliare a favore di chi
  // cancella.
  const v = Number(circolo?.oreLimiteCancellazione);
  if (!isFinite(v) || v <= 0) return 0;
  return Math.min(Math.max(1, Math.round(v)), ORE_LIMITE_CANCELLAZIONE_MAX);
}

// Entro quando si puo' ancora cancellare.
// null = nessun limite (slider a zero): si disdice fino all'inizio.
// Su una prenotazione di piu' mezz'ore vale sempre la PRIMA: e'
// l'inizio del gioco che conta, non la fine.
export function limiteCancellazione(
  data: string,
  orario: string,
  oreLimite: number,
): Date | null {
  if (oreLimite <= 0) return null;
  return new Date(istanteSlot(data, orario).getTime() - oreLimite * 3600_000);
}

// Il socio puo' ancora disdire? Senza limite basta che l'ora di gioco
// non sia gia' passata — cancellare una partita finita non ha senso.
export function sePuoCancellare(
  data: string,
  orario: string,
  oreLimite: number,
  adesso: Date = new Date(),
): boolean {
  const limite = limiteCancellazione(data, orario, oreLimite);
  if (!limite) return adesso.getTime() < istanteSlot(data, orario).getTime();
  return adesso.getTime() < limite.getTime();
}

// La riga che chiude ogni notifica e che compare nel pop-up di
// dettaglio: sempre la stessa frase, scritta in un posto solo.
export function testoLimiteCancellazione(
  data: string,
  orario: string,
  oreLimite: number,
  adesso: Date = new Date(),
): string {
  const inizio = istanteSlot(data, orario);
  const limite = limiteCancellazione(data, orario, oreLimite);
  // Senza limite si cancella fino all'inizio, ma NON oltre: a partita
  // cominciata sePuoCancellare dice gia' di no, e questa frase deve
  // dire la stessa cosa. Con il testo fisso, chi apriva una partita
  // gia' iniziata si vedeva "puoi cancellare fino all'orario di
  // gioco" scritto in rosso come motivo del blocco.
  if (!limite) {
    if (adesso.getTime() >= inizio.getTime()) {
      return `La partita è già cominciata (${dataEstesa(inizio)} alle ${oraBreve(inizio)}): non si può più annullare.`;
    }
    return 'Puoi cancellare questa prenotazione fino all’orario di gioco.';
  }
  if (adesso.getTime() >= limite.getTime()) {
    return `Il termine per cancellare questa prenotazione è scaduto (era ${dataEstesa(limite)} alle ${oraBreve(limite)}).`;
  }
  return `Se vuoi cancellare questa prenotazione puoi farlo entro le ${oraBreve(limite)} di ${dataEstesa(limite)}.`;
}

// ---- Promemoria ----
// Tre avvisi, come stabilito: i primi due servono a ricordare la
// partita e si contano dall'inizio del gioco; il terzo e' l'ultima
// chiamata per disdire e si conta dal limite di cancellazione.
export type ChiavePromemoria = 'due-giorni' | 'un-giorno' | 'ultima-chiamata';

export interface Promemoria {
  chiave: ChiavePromemoria;
  quando: Date;
  titolo: string;
  corpo: string;
}

export interface DatiPromemoria {
  data: string;        // 'YYYY-MM-DD' della prima mezz'ora
  orario: string;      // 'HH:MM' della prima mezz'ora
  campoNome: string;
  tipo?: 'campo' | 'lezione';
  maestroNome?: string;
  maestroCognome?: string;
}

// I tre promemoria di una prenotazione, gia' ordinati e gia' ripuliti
// da quelli inutili: se prenoti stamattina per stasera, l'avviso "due
// giorni prima" cadrebbe nel passato e semplicemente non esiste.
export function promemoriaPrenotazione(
  p: DatiPromemoria,
  oreLimite: number,
  adesso: Date = new Date(),
): Promemoria[] {
  const inizio = istanteSlot(p.data, p.orario);
  const limite = limiteCancellazione(p.data, p.orario, oreLimite);
  const dove = p.tipo === 'lezione' && p.maestroNome
    ? `${p.campoNome} con il Maestro ${p.maestroNome} ${p.maestroCognome ?? ''}`.trim()
    : p.campoNome;
  const quandoTesto = `${dataEstesa(inizio)} alle ${oraBreve(inizio)}`;

  // La riga sulla cancellazione si calcola sull'istante in cui
  // l'avviso ARRIVA, non su quello in cui viene composto: altrimenti
  // il promemoria del giorno prima direbbe "puoi disdire entro le
  // 18:00" a un socio che lo legge alle 18:00 di quel giorno.
  const componi = (chiave: ChiavePromemoria, quando: Date, titolo: string): Promemoria => ({
    chiave,
    quando,
    titolo,
    corpo: `${dove} — ${quandoTesto}.\n${testoLimiteCancellazione(p.data, p.orario, oreLimite, quando)}`,
  });

  // Senza limite di cancellazione questa non e' piu' "l'ultima
  // chiamata per disdire": diventa l'avviso di un'ora prima della
  // partita, che e' comunque quello che un socio si aspetta.
  const ultimaChiamata = new Date((limite ?? inizio).getTime() - 3600_000);

  return [
    componi('due-giorni', new Date(inizio.getTime() - 48 * 3600_000), 'Fra due giorni giochi'),
    componi('un-giorno', new Date(inizio.getTime() - 24 * 3600_000), 'Domani giochi'),
    componi('ultima-chiamata', ultimaChiamata, limite ? 'Ultima ora per cancellare' : 'Fra un\u2019ora giochi'),
  ]
    // Chi prenota per stasera non ha un "due giorni prima": quell'istante
    // e' nel passato e l'avviso semplicemente non esiste.
    .filter((x) => x.quando.getTime() > adesso.getTime())
    // Con il limite a 23 o 24 ore i due avvisi "ricordati che giochi"
    // finirebbero appaiati all'ultima chiamata o addirittura dopo, e
    // direbbero di disdire entro un orario gia' passato. In quel caso
    // resta solo l'ultima chiamata.
    .filter((x) => x.chiave === 'ultima-chiamata' || x.quando.getTime() < ultimaChiamata.getTime())
    .sort((a, b) => a.quando.getTime() - b.quando.getTime());
}
