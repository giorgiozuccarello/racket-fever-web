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

// Chiavi del dizionario, nello stesso ordine di `Date.getDay()`.
const CHIAVI_GIORNO = ['com.G.dom', 'com.G.lun', 'com.G.mar', 'com.G.mer', 'com.G.gio', 'com.G.ven', 'com.G.sab'];

// ⚠️ IL TRADUTTORE E' FACOLTATIVO, E DEVE RESTARE FACOLTATIVO. Questa
// data finisce in due posti diversi: nel pop-up che il socio LEGGE
// adesso (e allora vuole la sua lingua) e dentro il corpo dei
// promemoria, che si compone qui sotto e resta scritto — li' l'italiano
// e' la scelta giusta, per la stessa ragione della `dataLabel`.
// Chiamata senza `t` risponde in italiano, esattamente come prima.
//
// ⚠️ IN TEDESCO IL GIORNO DEL MESE VUOLE IL PUNTO — «Montag, 3. Sep.»
// — perche' e' un ordinale.
//
// Nomi scritti a mano e non toLocaleDateString('it-IT'): su Hermes i
// dati di localizzazione possono mancare del tutto e il risultato
// sarebbe in inglese, o peggio un errore a runtime.
export function dataEstesa(
  d: Date,
  t?: (chiave: string) => string,
  lingua?: string,
): string {
  if (!t) return `${GIORNI[d.getDay()]} ${d.getDate()} ${MESI[d.getMonth()]}`;
  const giorno = t(CHIAVI_GIORNO[d.getDay()]);
  const mese = t(`com.M.${d.getMonth() + 1}`);
  // In italiano la frase che la ospita e' minuscola in mezzo al periodo
  // («era lunedì 3 settembre»); tedesco e inglese vogliono la maiuscola.
  const giornoScritto = lingua === 'it' || !lingua ? giorno.toLowerCase() : giorno;
  return lingua === 'de'
    ? `${giornoScritto}, ${d.getDate()}. ${mese}`
    : `${giornoScritto} ${d.getDate()} ${mese}`;
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

// Il limite delle LEZIONI non e' quello del circolo: e' del Maestro
// che la tiene. L'Admin regola i campi, che sono suoi; una lezione la
// da' il Maestro, ed e' lui a dover dire entro quando gli si puo' dare
// buca — deve poter riempire quell'ora con un altro allievo.
//
// ⚠️ Campo assente = EREDITA dal circolo, e non "nessun limite". Il
// giorno dell'aggiornamento nessun maestro ha ancora toccato il
// cursore: partendo da zero, tutte le lezioni gia' prenotate sarebbero
// diventate di colpo disdicibili fino all'ultimo minuto, senza che
// nessuno avesse deciso niente. Finche' il Maestro non sceglie, vale
// quello che il circolo aveva gia' stabilito.
//
// ⚠️ Per questo il controllo e' su null/undefined e NON su Number():
// `Number(null)` fa 0, e un campo mai scritto sarebbe stato letto come
// "il Maestro ha scelto nessun limite" — cioe' l'esatto contrario di
// ereditare. Uno zero VERO, messo dal Maestro, resta zero.
export function oreLimiteLezioniDi(
  maestro?: { oreLimiteCancellazioneLezioni?: number | null } | null,
  circolo?: { oreLimiteCancellazione?: number | null } | null,
): number {
  const suo = maestro?.oreLimiteCancellazioneLezioni;
  if (suo === undefined || suo === null) return oreLimiteDi(circolo);
  const v = Number(suo);
  if (!isFinite(v) || v <= 0) return 0;
  return Math.min(Math.max(1, Math.round(v)), ORE_LIMITE_CANCELLAZIONE_MAX);
}

// Il Maestro ha gia' scelto, o sta ancora ereditando dal circolo?
// Serve solo alla sua schermata Impostazioni, per dirglielo.
export function limiteLezioniEreditato(
  maestro?: { oreLimiteCancellazioneLezioni?: number | null } | null,
): boolean {
  const suo = maestro?.oreLimiteCancellazioneLezioni;
  return suo === undefined || suo === null;
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
  // Una lezione non e' "una prenotazione": chi la disdice sta dando
  // buca a una persona, e la frase deve dire quello che il socio ha
  // davanti. Il termine, poi, non lo decide nemmeno lo stesso: quello
  // dei campi e' del circolo, quello delle lezioni del Maestro.
  eLezione = false,
  // ⚠️ FACOLTATIVO, come in `dataEstesa` qui sopra e per lo stesso
  // motivo: questa riga il socio la LEGGE nel pop-up della Griglia e
  // nella card in Home — li' va nella sua lingua — ma la stessa
  // funzione compone anche la coda dei promemoria, che si SCRIVE e
  // resta in italiano. Senza `t` risponde in italiano come prima.
  // ⚠️ Le chiavi sono le `srv.canc.*` gia' usate dalle Cloud Functions
  // (`functions/src/promemoria.ts`): stessa frase, un dizionario solo.
  t?: (chiave: string, valori?: Record<string, string | number>) => string,
  lingua?: string,
): string {
  const inizio = istanteSlot(data, orario);
  const limite = limiteCancellazione(data, orario, oreLimite);
  const cosa = t
    ? t(eLezione ? 'srv.canc.laLezione' : 'srv.canc.laPrenotazione')
    : (eLezione ? 'questa lezione' : 'questa prenotazione');
  // Senza limite si cancella fino all'inizio, ma NON oltre: a partita
  // cominciata sePuoCancellare dice gia' di no, e questa frase deve
  // dire la stessa cosa. Con il testo fisso, chi apriva una partita
  // gia' iniziata si vedeva "puoi cancellare fino all'orario di
  // gioco" scritto in rosso come motivo del blocco.
  if (!limite) {
    if (adesso.getTime() >= inizio.getTime()) {
      if (t) {
        return t(eLezione ? 'pre.can.lezioneIniziata' : 'pre.can.partitaIniziata', {
          data: dataEstesa(inizio, t, lingua), ora: oraBreve(inizio),
        });
      }
      return eLezione
        ? `La lezione è già cominciata (${dataEstesa(inizio)} alle ${oraBreve(inizio)}): non si può più annullare.`
        : `La partita è già cominciata (${dataEstesa(inizio)} alle ${oraBreve(inizio)}): non si può più annullare.`;
    }
    if (t) return t('srv.canc.finoInizio', { cosa });
    return eLezione
      ? 'Puoi cancellare questa lezione fino all’orario di inizio.'
      : 'Puoi cancellare questa prenotazione fino all’orario di gioco.';
  }
  if (adesso.getTime() >= limite.getTime()) {
    if (t) {
      return t('srv.canc.scaduto', {
        cosa, data: dataEstesa(limite, t, lingua), ora: oraBreve(limite),
      });
    }
    return `Il termine per cancellare ${cosa} è scaduto (era ${dataEstesa(limite)} alle ${oraBreve(limite)}).`;
  }
  if (t) {
    return t('srv.canc.entro', {
      cosa, ora: oraBreve(limite), data: dataEstesa(limite, t, lingua),
    });
  }
  return `Se vuoi cancellare ${cosa} puoi farlo entro le ${oraBreve(limite)} di ${dataEstesa(limite)}.`;
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
  // ⚠️ Il Maestro legge un altro testo: il corpo del socio dice «con il
  // Maestro Mario Rossi», che per lui e' il proprio nome. Si compone
  // qui insieme all'altro perche' i due devono restare allineati.
  corpoMaestro?: string;
}

export interface DatiPromemoria {
  data: string;        // 'YYYY-MM-DD' della prima mezz'ora
  orario: string;      // 'HH:MM' della prima mezz'ora
  campoNome: string;
  tipo?: 'campo' | 'lezione';
  maestroNome?: string;
  maestroCognome?: string;
  // Chi fa la lezione: il nome che va nell'avviso DEL MAESTRO.
  allievoNome?: string;
  allievoCognome?: string;
}

// I tre promemoria di una prenotazione, gia' ordinati e gia' ripuliti
// da quelli inutili: se prenoti stamattina per stasera, l'avviso "due
// giorni prima" cadrebbe nel passato e semplicemente non esiste.
// ⚠️ `oreLimite` lo passa chi chiama, e per una LEZIONE dev'essere
// quello del Maestro (oreLimiteLezioniDi), non quello del circolo:
// altrimenti l'ultima chiamata a disdire arriverebbe a un'ora che non
// e' il vero termine. Oggi questa funzione non ha ancora chiamanti —
// li avra' con le Cloud Functions — ma il vincolo nasce qui.
export function promemoriaPrenotazione(
  p: DatiPromemoria,
  oreLimite: number,
  adesso: Date = new Date(),
): Promemoria[] {
  const inizio = istanteSlot(p.data, p.orario);
  const limite = limiteCancellazione(p.data, p.orario, oreLimite);
  const eLezione = p.tipo === 'lezione';
  const dove = eLezione && p.maestroNome
    ? `${p.campoNome} con il Maestro ${p.maestroNome} ${p.maestroCognome ?? ''}`.trim()
    : p.campoNome;
  // Lo stesso campo visto dall'altra parte della rete.
  const allievo = `${p.allievoNome ?? ''} ${p.allievoCognome ?? ''}`.trim();
  const doveMaestro = allievo ? `${p.campoNome} con ${allievo}` : p.campoNome;
  const quandoTesto = `${dataEstesa(inizio)} alle ${oraBreve(inizio)}`;
  // ⚠️ Una lezione non e' una partita: «Domani giochi» arrivava anche a
  // chi la lezione la tiene.
  const verbo = eLezione ? 'hai lezione' : 'giochi';

  // La riga sulla cancellazione si calcola sull'istante in cui
  // l'avviso ARRIVA, non su quello in cui viene composto: altrimenti
  // il promemoria del giorno prima direbbe "puoi disdire entro le
  // 18:00" a un socio che lo legge alle 18:00 di quel giorno.
  const componi = (chiave: ChiavePromemoria, quando: Date, titolo: string): Promemoria => {
    const coda = testoLimiteCancellazione(p.data, p.orario, oreLimite, quando, eLezione);
    return {
      chiave,
      quando,
      titolo,
      corpo: `${dove} — ${quandoTesto}.\n${coda}`,
      ...(eLezione ? { corpoMaestro: `${doveMaestro} — ${quandoTesto}.\n${coda}` } : {}),
    };
  };

  // Senza limite di cancellazione questa non e' piu' "l'ultima
  // chiamata per disdire": diventa l'avviso di un'ora prima della
  // partita, che e' comunque quello che un socio si aspetta.
  const ultimaChiamata = new Date((limite ?? inizio).getTime() - 3600_000);

  return [
    componi('due-giorni', new Date(inizio.getTime() - 48 * 3600_000), `Fra due giorni ${verbo}`),
    componi('un-giorno', new Date(inizio.getTime() - 24 * 3600_000), `Domani ${verbo}`),
    componi('ultima-chiamata', ultimaChiamata, limite ? 'Ultima ora per cancellare' : `Fra un\u2019ora ${verbo}`),
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
