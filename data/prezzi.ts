// ============================================================
// CALCOLO PREZZO
// Il prezzo appartiene al campo: prezzo base, eventualmente
// sostituito da una tariffa speciale se giorno+orario corrispondono.
// Non restituisce mai null: se l'admin non ha ancora impostato un
// prezzo base, lo slot resta comunque prenotabile a €0,00 (nessuno
// stato "non impostato" bloccante nella griglia dei soci).
//
// ⚠️ QUESTO FILE E' IL GEMELLO IDENTICO nei due progetti: si modifica
// in tutti e due o in nessuno. Il prezzo di uno slot deve venire fuori
// uguale che lo chieda il telefono del socio o la griglia del sito,
// altrimenti l'Admin vede un numero e il socio ne paga un altro.
//
// ⚠️ LE TARIFFE SPECIALI SONO PIU' DI UNA, dal 28 agosto 2026, e la
// regola che le tiene in piedi e' una sola: NON SI SOVRAPPONGONO MAI.
// Se due fasce si accavallano sullo stesso giorno, quale delle due
// vale e' deciso dall'ordine in cui sono state salvate — cioe' dal
// caso. Invece di scegliere una priorita' (che nessuno vedrebbe a
// schermo e che andrebbe spiegata) si impedisce proprio che due fasce
// possano toccarsi: la tendina delle ore nasconde quelle gia' prese, e
// il salvataggio rifiuta comunque quello che passasse lo stesso.
//
// ⚠️ FINE ESCLUSA, INIZIO INCLUSO — ed era gia' cosi' prima che le
// tariffe diventassero tante. `08:00-10:00` copre lo slot delle 09:30
// e NON quello delle 10:00, quindi `08:00-10:00` e `10:00-12:00` sono
// due fasce che si toccano senza sovrapporsi. Tutto il controllo di
// sovrapposizione qui sotto si regge su questa convenzione: cambiarla
// vorrebbe dire rendere illegali coppie di tariffe che oggi convivono
// benissimo.
// ============================================================

import { Campo, TariffaSpeciale, ORARI, ORARI_ESTESI } from './circoli';

/**
 * Le tariffe di un campo, comunque siano scritte sul documento.
 *
 * ⚠️ NESSUNO LEGGE `campo.tariffaSpeciale` O `campo.tariffeSpeciali`
 * DIRETTAMENTE, e questo e' il motivo per cui la funzione esiste. I
 * campi configurati prima del 28 agosto 2026 hanno una tariffa sola nel
 * campo vecchio; quelli toccati dopo hanno l'elenco. Un solo punto che
 * conosce tutte e due le forme vale piu' di quindici punti che se le
 * ricordano — e il quindicesimo non se le ricorda.
 *
 * ⚠️ Alla tariffa vecchia si da' un id fisso invece di generarlo: la
 * lettura non deve avere effetti, e un id diverso a ogni chiamata
 * farebbe saltare l'evidenziazione della riga che si sta modificando.
 */
export function tariffeDelCampo(campo?: Campo | null): TariffaSpeciale[] {
  if (!campo) return [];
  const elenco = Array.isArray(campo.tariffeSpeciali) ? campo.tariffeSpeciali : null;
  if (elenco) return elenco.filter((t) => !!t && !!t.orarioInizio && !!t.orarioFine);
  const sola = campo.tariffaSpeciale;
  if (!sola || !sola.orarioInizio || !sola.orarioFine) return [];
  return [{ ...sola, id: sola.id || 'storica' }];
}

/** Vero se le due fasce orarie si intersecano. Fine esclusa. */
function fasceSiIncrociano(a: TariffaSpeciale, b: TariffaSpeciale): boolean {
  return a.orarioInizio < b.orarioFine && b.orarioInizio < a.orarioFine;
}

/**
 * Vero se le due tariffe condividono almeno un giorno.
 *
 * ⚠️ ELENCO VUOTO VUOL DIRE «TUTTI I GIORNI», ed e' la convenzione che
 * il modello aveva gia'. Quindi una tariffa senza giorni si scontra con
 * qualunque altra: e' il caso piu' facile da sbagliare, perche' a
 * schermo «nessun giorno selezionato» somiglia a «nessun giorno».
 */
function giorniSiIncrociano(a: TariffaSpeciale, b: TariffaSpeciale): boolean {
  const gA = a.giorni ?? [];
  const gB = b.giorni ?? [];
  if (gA.length === 0 || gB.length === 0) return true;
  return gA.some((g) => gB.includes(g));
}

/** Due tariffe sono in conflitto quando si incrociano nell'ora E nel giorno. */
export function siSovrappongono(a: TariffaSpeciale, b: TariffaSpeciale): boolean {
  return fasceSiIncrociano(a, b) && giorniSiIncrociano(a, b);
}

/**
 * La prima tariffa gia' presente che si scontra con quella proposta, o
 * niente se e' libera. Torna la tariffa e non un `boolean` perche' chi
 * chiama deve poter dire QUALE fascia da' fastidio: «si sovrappone» non
 * aiuta nessuno a rimediare.
 *
 * `escludiId` serve in modifica: una tariffa non si sovrappone a se'
 * stessa, e senza questo non si potrebbe riaprire una riga nemmeno per
 * cambiarle il prezzo.
 */
export function tariffaInConflitto(
  esistenti: TariffaSpeciale[], proposta: TariffaSpeciale, escludiId?: string,
): TariffaSpeciale | null {
  for (const t of esistenti) {
    if (escludiId && t.id === escludiId) continue;
    if (siSovrappongono(t, proposta)) return t;
  }
  return null;
}

// ------------------------------------------------------------
// LE ORE DA MOSTRARE NELLE DUE TENDINE
//
// ⚠️ E' LA DIFESA CHE SI VEDE, e viene prima di quella che rifiuta. Un
// modulo che accetta la scelta e poi dice «no, quelle ore sono gia'
// prese» fa perdere tempo e non insegna niente; una tendina in cui
// quelle ore non ci sono racconta da sola come e' fatto il calendario
// del campo. Il controllo al salvataggio resta comunque, perche' i
// giorni si possono cambiare DOPO aver scelto le ore.
// ------------------------------------------------------------

/** Gli slot mezz'ora coperti da una fascia, estremo finale escluso. */
function slotCoperti(inizio: string, fine: string): string[] {
  return ORARI.filter((o) => o >= inizio && o < fine);
}

/**
 * Le ore che una nuova tariffa NON puo' usare come inizio, perche' gia'
 * dentro un'altra fascia negli stessi giorni.
 *
 * ⚠️ SENZA GIORNI SCELTI NON SI PUO' RISPONDERE, e la funzione torna
 * l'elenco piu' prudente: quello di chi vale tutti i giorni. E' il
 * motivo per cui nel modulo i giorni si scelgono PRIMA delle ore.
 */
export function oreOccupate(
  esistenti: TariffaSpeciale[], giorniScelti: number[], escludiId?: string,
): string[] {
  const finta: TariffaSpeciale = {
    id: '', orarioInizio: '00:00', orarioFine: '00:00',
    prezzo: 0, etichetta: '', giorni: giorniScelti ?? [],
  };
  const prese = new Set<string>();
  for (const t of esistenti) {
    if (escludiId && t.id === escludiId) continue;
    if (!giorniSiIncrociano(t, finta)) continue;
    for (const o of slotCoperti(t.orarioInizio, t.orarioFine)) prese.add(o);
  }
  return Array.from(prese);
}

/** Le ore selezionabili come INIZIO: tutte quelle non gia' prese. */
export function iniziDisponibili(
  esistenti: TariffaSpeciale[], giorniScelti: number[], escludiId?: string,
): string[] {
  const prese = new Set(oreOccupate(esistenti, giorniScelti, escludiId));
  return ORARI.filter((o) => !prese.has(o));
}

/**
 * Le ore selezionabili come FINE, dato un inizio.
 *
 * ⚠️ NON BASTA «QUELLE LIBERE»: la fine delimita un intervallo, quindi
 * bisogna fermarsi al PRIMO slot occupato che si incontra andando in
 * avanti. Con l'inizio alle 16:00 e una tariffa gia' presente dalle
 * 18:00, le fini valide sono 16:30, 17:00, 17:30 e 18:00 — quest'ultima
 * inclusa proprio perche' la fine e' esclusa e quindi le due fasce si
 * toccano senza scavalcarsi. Le 18:30 no: coprirebbe le 18:00, che e'
 * di un'altra.
 *
 * ⚠️ Le fini escono da `ORARI_ESTESI` e non da `ORARI`: l'ultimo slot
 * prenotabile e' 23:00-23:30, e senza il 23:30 non lo si potrebbe
 * coprire.
 */
export function finiDisponibili(
  inizio: string, esistenti: TariffaSpeciale[], giorniScelti: number[], escludiId?: string,
): string[] {
  if (!inizio) return [];
  const prese = new Set(oreOccupate(esistenti, giorniScelti, escludiId));
  const fuori: string[] = [];
  for (const candidata of ORARI_ESTESI) {
    if (candidata <= inizio) continue;
    // Lo slot che si aggiungerebbe portando la fine fin qui e' quello
    // che comincia alla candidata precedente: se e' occupato, oltre non
    // si va — e non si va nemmeno piu' avanti.
    const slotDaCoprire = slotCoperti(inizio, candidata);
    if (slotDaCoprire.some((o) => prese.has(o))) break;
    fuori.push(candidata);
  }
  return fuori;
}

/**
 * Un identificativo per una tariffa nuova.
 *
 * ⚠️ Niente `uuid` e niente dipendenze: serve solo che due tariffe dello
 * stesso campo non collidano, e il tempo piu' una manciata di caratteri
 * casuali basta e avanza. Non e' un id che qualcuno leggera' mai.
 */
export function nuovoIdTariffa(): string {
  return `t${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

// ------------------------------------------------------------
// IL MOTORE DEL PREZZO — le due funzioni che tutto il resto chiama.
// Le firme non sono cambiate passando da una tariffa a molte, ed e' il
// motivo per cui nessuno dei quindici punti che le usano ha dovuto
// essere toccato.
// ------------------------------------------------------------

export function trovaTariffaApplicabile(
  campo: Campo, giorno: Date, orario: string,
): TariffaSpeciale | null {
  const tariffe = tariffeDelCampo(campo);
  for (const t of tariffe) {
    const oraInRange = orario >= t.orarioInizio && orario < t.orarioFine;
    if (!oraInRange) continue;
    const giornoOk = !t.giorni || t.giorni.length === 0 || t.giorni.includes(giorno.getDay());
    if (giornoOk) return t;
  }
  return null;
}

export function calcolaPrezzo(campo: Campo, giorno: Date, orario: string): number {
  const t = trovaTariffaApplicabile(campo, giorno, orario);
  if (t) return t.prezzo;
  return campo.prezzoOraDefault ?? 0;
}
