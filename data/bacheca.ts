// ============================================================
// BACHECA — i fogli che il circolo appende, e che i soci leggono.
//
// Prende il posto della Chat del circolo, che era finta da sempre:
// dati di esempio e una risposta simulata dopo un secondo. Non e' una
// sostituzione alla pari, e' una scelta diversa.
//
// ⚠️ E' A SENSO UNICO, e non per pigrizia. Nessun commento, nessuna
// reazione, nessuna risposta: e' questo che la rende una bacheca
// invece di una chat, ed e' anche cio' che evita il problema che
// avrebbe affossato la chat — qualcuno deve moderarla, e nessun
// circolo ha voglia di farlo. Le due chat che restano, Sfide e
// Lezioni, sono conversazioni fra DUE persone: un'altra cosa.
//
// ⚠️ NON ESCE DAL CIRCOLO. E' la differenza con i Tornei, che sono un
// cartellone pubblico visibile a tutta la rete. Un avviso di chiusura,
// una quota da rinnovare, un annuncio del mercatino riguardano i soci
// di quel circolo e nessun altro — e le regole lo impongono a monte,
// non lo lasciano alla schermata.
//
// LA REGOLA DEI TRE POSTI, che vale la pena tenere a mente prima di
// aggiungere qualcosa da qualche parte:
//   Home    = le cose che riguardano ME (la mia prenotazione, il mio credito)
//   Bacheca = le cose che riguardano TUTTI quelli del mio circolo
//   Tornei  = il cartellone della rete
// Se la linea si sfoca, i tre posti diventano tre versioni sfocate
// della stessa cosa e il socio non sa piu' dove guardare.
// ============================================================

import { giornoDi, oggiIso, fraGiorni, soloGiorno } from './giorni';

// ---- Le categorie ----
//
// ⚠️ I COLORI SONO FISSI, non presi dal tema del circolo. E' la stessa
// scelta gia' fatta per la scheda del socio e per il pop-up della
// Classifica, ma qui il motivo e' piu' forte: il colore E'
// l'informazione, non decorazione. Preso dal tema, "Chiusure" sarebbe
// rossa in un circolo e blu in un altro, e lo stesso rosso vorrebbe
// dire due cose diverse — cioe' il colore smetterebbe di dire qualcosa.
//
// Tutti e otto sono scuri abbastanza da reggere il testo bianco sopra:
// servono per la spilletta che tiene appeso il foglio, per il nome
// della categoria stampato sul foglio, e per la pillola del filtro.
export interface Categoria {
  chiave: string;
  nome: string;
  // Nome dell'icona Ionicons, senza il suffisso "-outline": si usa la
  // versione piena, che dentro una pillola piccola si legge meglio del
  // contorno.
  icona: string;
  colore: string;
}

export const CATEGORIE_AVVISO: Categoria[] = [
  { chiave: 'comunicazioni', nome: 'Comunicazioni', icona: 'megaphone', colore: '#2F5D8C' },
  { chiave: 'chiusure', nome: 'Chiusure e orari', icona: 'time', colore: '#B3261E' },
  { chiave: 'quote', nome: 'Quote e pagamenti', icona: 'card', colore: '#1C5F06' },
  { chiave: 'scuola', nome: 'Scuola e Maestri', icona: 'school', colore: '#8A5A00' },
  { chiave: 'competizioni', nome: 'Competizioni del circolo', icona: 'trophy', colore: '#6A2E8F' },
  { chiave: 'eventi', nome: 'Eventi e vita sociale', icona: 'sparkles', colore: '#C2185B' },
  { chiave: 'lavori', nome: 'Lavori e manutenzione', icona: 'construct', colore: '#4A4A4A' },
  { chiave: 'mercatino', nome: 'Mercatino', icona: 'pricetag', colore: '#00695C' },
];

// ⚠️ Non si spacca mai. Una categoria sconosciuta — un avviso scritto
// prima di un cambio d'elenco, o un campo arrivato vuoto — ricade
// sulla prima invece di far uscire una mattonella senza colore e senza
// nome, che a schermo sembra un difetto e non un dato vecchio.
export function categoriaDi(chiave?: string | null): Categoria {
  return CATEGORIE_AVVISO.find((c) => c.chiave === chiave) ?? CATEGORIE_AVVISO[0];
}

// ---- L'avviso ----
export interface Avviso {
  id: string;
  circoloId: string;
  categoria: string;
  // ⚠️ Il titolo e' l'unica cosa obbligatoria: e' quello che si legge
  // sul foglio appeso, insieme all'inizio del testo. Il foglio e'
  // pero' solo l'anteprima — il testo lungo ci sta troncato — mentre
  // il pop-up e' il foglio staccato e letto da vicino, con il
  // volantino intero e tutto il testo.
  titolo: string;
  testo?: string;
  // Il volantino. Facoltativo: un avviso puo' essere solo titolo e
  // testo, solo testo sotto il titolo, oppure il volantino e basta.
  volantinoUrl?: string | null;
  // Dove mandare chi legge: la pagina per pagare, il modulo da
  // scaricare, il sito del fornitore. Facoltativo.
  link?: string | null;
  // ⚠️ IL PIN DECIDE LA POSIZIONE, LA DATA DECIDE LA VITA.
  // Un avviso appuntato resta in cima ma scade lo stesso, e nella
  // dashboard la sua scadenza si vede bene e si allunga con un tocco.
  // Il PIN "per sempre" sembra comodo per mezz'ora: poi il regolamento
  // appeso a marzo e' ancora li' a dicembre, e a forza di stare li' ha
  // insegnato a tutti a non guardare piu' la bacheca.
  inEvidenza?: boolean;
  // 'YYYY-MM-DD', l'ultimo giorno in cui il socio lo vede.
  // ⚠️ Scritto sul documento e non ricavato a ogni lettura, perche' e'
  // il campo su cui Firestore filtra: senza, ogni socio si porterebbe
  // a casa l'intero archivio del circolo per vederne otto.
  visibileFinoA: string;
  creatoIlMs: number;
  autoreNome?: string;
}

// Trenta giorni: il tempo di una comunicazione normale. L'Admin la
// cambia quando serve, ma non deve pensarci per appendere un foglio.
export const GIORNI_AVVISO_PREDEFINITI = 30;

export function scadenzaPredefinita(adesso: Date = new Date()): string {
  return fraGiorni(oggiIso(adesso), GIORNI_AVVISO_PREDEFINITI);
}

// Ancora appeso? Il giorno della scadenza e' compreso: un avviso che
// scade oggi si vede oggi.
export function avvisoDaMostrare(a: { visibileFinoA?: string }, adesso: Date = new Date()): boolean {
  if (!a.visibileFinoA) return true;
  return soloGiorno(adesso).getTime() <= giornoDi(a.visibileFinoA).getTime();
}

export function avvisoScaduto(a: { visibileFinoA?: string }, adesso: Date = new Date()): boolean {
  return !avvisoDaMostrare(a, adesso);
}

// Quanti giorni mancano alla caduta. Serve alla dashboard, dove la
// scadenza va vista PRIMA di dimenticarsene.
export function giorniAllaScadenza(
  a: { visibileFinoA?: string }, adesso: Date = new Date(),
): number {
  if (!a.visibileFinoA) return 9999;
  const uno = 24 * 60 * 60 * 1000;
  return Math.round(
    (giornoDi(a.visibileFinoA).getTime() - soloGiorno(adesso).getTime()) / uno,
  );
}

// ---- Ordine ----
// Prima gli appuntati, poi i piu' recenti. ⚠️ A differenza dei Tornei,
// dove "in evidenza" e' una scelta del singolo socio e sta sul suo
// profilo, qui il PIN sta sull'AVVISO: lo decide l'Admin, e vale per
// tutti. Sono due cose con lo stesso nome e due padroni diversi.
export function ordinaAvvisi<T extends { inEvidenza?: boolean; creatoIlMs?: number }>(
  avvisi: T[],
): T[] {
  return [...avvisi].sort((a, b) => {
    const pa = a.inEvidenza ? 0 : 1;
    const pb = b.inEvidenza ? 0 : 1;
    if (pa !== pb) return pa - pb;
    return (b.creatoIlMs ?? 0) - (a.creatoIlMs ?? 0);
  });
}

export function filtraPerCategoria<T extends { categoria?: string }>(
  avvisi: T[], chiave: string | null,
): T[] {
  if (!chiave) return avvisi;
  return avvisi.filter((a) => categoriaDi(a.categoria).chiave === chiave);
}

// Solo le categorie che hanno davvero qualcosa appeso: una fila di
// otto pillole di cui sei non danno risultati e' una fila di sei
// vicoli ciechi.
export function categoriePresenti<T extends { categoria?: string }>(avvisi: T[]): Categoria[] {
  const usate = new Set(avvisi.map((a) => categoriaDi(a.categoria).chiave));
  return CATEGORIE_AVVISO.filter((c) => usate.has(c.chiave));
}

// ---- Il nuovo, senza scrivere niente a nessuno ----
//
// ⚠️ QUI STA LA SCELTA CHE CONTA. La strada istintiva era creare una
// notifica per ogni socio a ogni foglio appeso: su un circolo da
// trecento soci sono trecento scritture per pubblicazione, e la Home
// di tutti si allaga. Invece non si scrive NIENTE quando si pubblica:
// si segna sul profilo di chi guarda l'istante in cui ha aperto la
// Bacheca, e il "nuovo" e' semplicemente cio' che e' arrivato dopo.
// Una scrittura per visita invece di trecento per pubblicazione, e il
// pallino si spegne da solo.
//
// Due segni e non uno, perche' sono due gesti diversi: aprire la
// Bacheca vuol dire "ho letto", chiudere la card in Home vuol dire
// "ho visto l'avviso", che non e' la stessa cosa. Chi spegne la card
// senza entrare deve continuare a trovare il pallino sulla scheda.
//
// Sono mappe per circolo e non un numero solo: un socio puo' essere
// tesserato in piu' circoli, e un unico segno avrebbe fatto sparire i
// nuovi avvisi di uno perche' aveva letto quelli dell'altro.
export type SegniLettura = Record<string, number> | undefined | null;

export function segnoDi(segni: SegniLettura, circoloId: string): number {
  return (segni ?? {})[circoloId] ?? 0;
}

export function avvisiNuovi<T extends { creatoIlMs?: number }>(
  avvisi: T[], daQuandoMs: number,
): T[] {
  return avvisi.filter((a) => (a.creatoIlMs ?? 0) > daQuandoMs);
}

// Quanti ne mostra il pallino sulla scheda.
export function quantiNonLetti<T extends { creatoIlMs?: number }>(
  avvisi: T[], lettaAlMs: number,
): number {
  return avvisiNuovi(avvisi, lettaAlMs).length;
}

// Quanti ne annuncia la card in Home. Sparisce sia leggendo la Bacheca
// sia spegnendo la card: vince il gesto piu' recente dei due.
export function quantiPerLaHome<T extends { creatoIlMs?: number }>(
  avvisi: T[], lettaAlMs: number, spentaAlMs: number,
): number {
  return avvisiNuovi(avvisi, Math.max(lettaAlMs, spentaAlMs)).length;
}

// ⚠️ Una card sola con il conteggio, non una per avviso. Tre card
// identiche in Home spingerebbero prenotazioni e lezioni sotto la
// piega — e' lo stesso motivo per cui i messaggi della stessa
// conversazione si raggruppano invece di comparire uno per riga.
export function testoCardHome(quanti: number): string {
  if (quanti <= 0) return '';
  if (quanti === 1) return 'C’è un nuovo avviso in bacheca';
  return `Ci sono ${quanti} nuovi avvisi in bacheca`;
}

// L'istante da segnare come "letto": quello dell'avviso piu' recente
// che ho davanti, non l'ora dell'orologio.
// ⚠️ Con Date.now() un avviso pubblicato mentre la pagina era aperta —
// e quindi mai comparso a schermo — risultava letto: l'orologio corre
// anche quando nessuno guarda. Con l'istante dell'avviso piu' recente
// FRA QUELLI MOSTRATI, quello che arriva dopo resta nuovo.
export function istanteDaSegnare<T extends { creatoIlMs?: number }>(avvisi: T[]): number {
  return avvisi.reduce((massimo, a) => Math.max(massimo, a.creatoIlMs ?? 0), 0);
}

// ---- Controlli prima di pubblicare ----
// Le tre forme ammesse: titolo e testo, titolo e volantino, o tutti e
// tre insieme. Un avviso con il solo titolo e niente altro non e' un
// avviso: e' una riga che non dice niente e non si puo' approfondire.
export function cosaMancaPerPubblicare(a: {
  titolo?: string; testo?: string; volantinoUrl?: string | null; visibileFinoA?: string;
}): string | null {
  if (!(a.titolo ?? '').trim()) return 'Manca il titolo dell’avviso.';
  if (!(a.testo ?? '').trim() && !a.volantinoUrl) {
    return 'Serve almeno il testo dell’avviso o un volantino da allegare.';
  }
  if (!a.visibileFinoA) return 'Manca la data fino a cui l’avviso resta in bacheca.';
  return null;
}
