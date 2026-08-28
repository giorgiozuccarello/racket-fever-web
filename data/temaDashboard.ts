// ============================================================
// TEMA DELLA DASHBOARD — i due colori del pannello web: la testata e
// il fondo della pagina.
//
// ⚠️ NIENTE A CHE VEDERE CON IL TEMA DEL CIRCOLO. Quello (`TEMI_APP` in
// `data/circoli.ts`) è il vestito che i soci vedono nell'app, e lo si
// sceglie fra sette combinazioni preparate. Questo riguarda solo la
// dashboard web di chi amministra, e i colori sono liberi.
//
// ⚠️ SI CONSERVA IN HSL, NON IN ESADECIMALE, e la scelta viene dai tre
// cursori: tinta, saturazione, luminosità. Sono già le tre grandezze
// dell'HSL, quindi conservandole così il cursore riapre esattamente
// dove era stato lasciato. Salvando `#232838` bisognerebbe rifare il
// giro all'indietro a ogni apertura, e il giro all'indietro non è
// esatto: due posizioni vicine dei cursori danno lo stesso esadecimale,
// e il cursore salterebbe da solo.
// ============================================================

export interface Tinta {
  /** Tinta, da 0 a 360 gradi sul cerchio dei colori. */
  h: number;
  /** Saturazione, da 0 (grigio) a 100 (colore pieno). */
  s: number;
  /** Luminosità, da 0 (nero) a 100 (bianco). */
  l: number;
}

export interface TemaDashboard {
  testata: Tinta;
  sfondo: Tinta;
}

// I colori storici: il verde pino `#0E3B2E` della testata e l'avorio
// `#FBFAF6` del fondo. Chi non tocca niente non deve accorgersi che
// questa sezione esiste.
//
// ⚠️ NON SONO ESATTI, E NON POSSONO ESSERLO. Con tinta, saturazione e
// luminosita' espresse in numeri interi — che e' quello che i cursori
// sanno produrre — nessuna combinazione dà esattamente quei due
// esadecimali: si cade sempre a un'unita' di distanza su un canale.
// Questi due sono i piu' vicini che esistano, verificati provando
// tutte le 3.6 milioni di combinazioni: `#0D3B2E` invece di `#0E3B2E`,
// `#FCFAF7` invece di `#FBFAF6`. È uno scarto che non si vede, ma va
// scritto: chi un giorno confrontasse i due valori con quelli di
// `BRAND` li troverebbe diversi e penserebbe a un errore.
export const TEMA_ADMIN_DI_PARTENZA: TemaDashboard = {
  testata: { h: 163, s: 64, l: 14 },
  sfondo: { h: 26, s: 48, l: 98 },
};

// ⚠️ Il pannello nostro nasce diverso da quello dei circoli, ed è
// voluto: nero pieno in testa e blu notte `#232838` sotto. Un colpo
// d'occhio basta a sapere in quale dei due si sta lavorando, che è
// esattamente la confusione da evitare quando si tocca la rete intera.
export const TEMA_SUPERADMIN_DI_PARTENZA: TemaDashboard = {
  testata: { h: 0, s: 0, l: 0 },
  sfondo: { h: 226, s: 23, l: 18 },
};

function fraZeroE(massimo: number, valore: number): number {
  if (!Number.isFinite(valore)) return 0;
  return Math.min(massimo, Math.max(0, Math.round(valore)));
}

/** Una tinta se i tre numeri ci sono davvero, altrimenti niente. */
function tintaSeValida(x: unknown): Tinta | null {
  if (!x || typeof x !== 'object') return null;
  const g = x as Partial<Tinta>;
  if (typeof g.h !== 'number' || typeof g.s !== 'number' || typeof g.l !== 'number') return null;
  return { h: fraZeroE(360, g.h), s: fraZeroE(100, g.s), l: fraZeroE(100, g.l) };
}

/**
 * ⚠️ QUALUNQUE COSA ARRIVI DAL DATABASE PASSA DI QUI, e torna `null`
 * invece di un mezzo tema. Un documento scritto male — o rimasto da una
 * versione precedente — non deve poter produrre `background:
 * hsl(NaN…)`, che il browser scarta lasciando la pagina trasparente:
 * testata invisibile e testo bianco su bianco, cioè un pannello
 * inutilizzabile e nessun modo di tornare indietro. Chi chiama, davanti
 * a `null`, resta sui colori di partenza.
 */
export function temaSeValido(x: unknown): TemaDashboard | null {
  if (!x || typeof x !== 'object') return null;
  const g = x as Partial<TemaDashboard>;
  const testata = tintaSeValida(g.testata);
  const sfondo = tintaSeValida(g.sfondo);
  if (!testata || !sfondo) return null;
  return { testata, sfondo };
}

export function uguali(a: TemaDashboard, b: TemaDashboard): boolean {
  return a.testata.h === b.testata.h && a.testata.s === b.testata.s && a.testata.l === b.testata.l
    && a.sfondo.h === b.sfondo.h && a.sfondo.s === b.sfondo.s && a.sfondo.l === b.sfondo.l;
}

/** La scrittura che va nel foglio di stile. */
export function css(t: Tinta): string {
  return `hsl(${t.h}, ${t.s}%, ${t.l}%)`;
}

/**
 * Il codice esadecimale, solo per mostrarlo accanto ai cursori: serve a
 * chi il colore lo deve comunicare a qualcun altro, o ritrovare.
 */
export function esadecimale(t: Tinta): string {
  const s = t.s / 100;
  const l = t.l / 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((t.h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0; let g = 0; let b = 0;
  if (t.h < 60) { r = c; g = x; } else if (t.h < 120) { r = x; g = c; } else if (t.h < 180) { g = c; b = x; } else if (t.h < 240) { g = x; b = c; } else if (t.h < 300) { r = x; b = c; } else { r = c; b = x; }
  const due = (v: number) => Math.round((v + m) * 255).toString(16).padStart(2, '0').toUpperCase();
  return `#${due(r)}${due(g)}${due(b)}`;
}

/**
 * ⚠️ IL COLORE DEL TESTO NON SI SCEGLIE, SI CALCOLA. La testata ha
 * sempre avuto scritte avorio perché era verde scuro: lasciandole fisse
 * e dando i cursori in mano a qualcuno, il primo che porta la
 * luminosità in alto si ritrova avorio su giallo chiaro e non legge più
 * il proprio nome né il tasto «Esci». Sopra una certa luminosità il
 * testo diventa scuro, e il pannello resta leggibile in ogni posizione
 * dei cursori.
 *
 * La soglia è sulla luminosità percepita, non su quella dell'HSL: un
 * giallo pieno al 60% acceca, un blu pieno al 60% no.
 */
export function chiaroSopra(t: Tinta): boolean {
  const s = t.s / 100;
  const l = t.l / 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((t.h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0; let g = 0; let b = 0;
  if (t.h < 60) { r = c; g = x; } else if (t.h < 120) { r = x; g = c; } else if (t.h < 180) { g = c; b = x; } else if (t.h < 240) { g = x; b = c; } else if (t.h < 300) { r = x; b = c; } else { r = c; b = x; }
  const luce = 0.2126 * (r + m) + 0.7152 * (g + m) + 0.0722 * (b + m);
  return luce > 0.55;
}

/** Le variabili da appoggiare sul contenitore della dashboard. */
export function variabiliCss(tema: TemaDashboard): Record<string, string> {
  const testataChiara = chiaroSopra(tema.testata);
  return {
    '--dash-testata': css(tema.testata),
    '--dash-testata-testo': testataChiara ? '#141F1B' : '#F5F1E6',
    // Le due tinte smorzate che la testata usa per il sottotitolo e per
    // la cornice della foto: seguono il testo, non il fondo.
    '--dash-testata-tenue': testataChiara ? 'rgba(20,31,27,.72)' : 'rgba(245,241,230,.75)',
    '--dash-testata-velo': testataChiara ? 'rgba(20,31,27,.14)' : 'rgba(245,241,230,.35)',
    // L'oro che segnala «stai entrando come Collaboratore»: su una
    // testata chiara il giallo pallido sparisce, e quel cartellino è
    // l'unica cosa che distingue le due porte d'ingresso.
    '--dash-testata-accento': testataChiara ? '#8A5A00' : '#FFE1A8',
    '--dash-sfondo': css(tema.sfondo),
  };
}
