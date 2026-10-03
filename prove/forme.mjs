// ============================================================
// LE PROVE DELLA FORMA, LATO SITO — `npm run prova-forme`, 3 ottobre 2026.
//
// ⚠️ E' LA GEMELLA DI `rf-coach/prove/forme.mjs`, e nasce dalla stessa
// richiesta: Giorgio ha chiesto riquadri «quasi perfettamente
// rettangolari (arrotondamento angoli minimo)» e il fondo dei riquadri da
// avorio a grigio chiaro, «sia App che Web».
//
// ⚠️ MA NON LEGGE L'APP, e non e' pigrizia: una prova che apre la
// cartella accanto cade il giorno che qualcuno sposta una cartella, e su
// Cloud Build — dove di questo repository c'e' solo questo repository —
// non potrebbe girare per niente. Quando un numero e' condiviso fra app
// e sito, ognuna sorveglia il proprio lato e nomina l'altro per nome e
// cognome. Il nome e cognome dell'altro lato e':
//
//     rf-coach/theme/forme.ts        la costante MINIMO
//     rf-coach/data/temi.ts          superficie / superficieAlta
//     rf-coach/prove/forme.mjs       la prova che li tiene
//
// ⚠️ QUELLO CHE QUESTA PROVA FERMA DAVVERO non e' il numero di oggi: e'
// il ritorno dei numeri sparsi. Prima del 3 ottobre questo foglio aveva
// `--raggio` dichiarato in cima E tre raggi scritti a mano piu' sotto —
// 9 nei campi, 18 nella scheda d'ingresso, 999 su bottoni e pastiglie.
// Nessuno li aveva messi per dispetto: si scrive un pezzo nuovo, serve
// un angolo, si scrive il numero. Cosi' una richiesta di stile diventa
// una caccia a mano, foglio per foglio, e qualcosa resta indietro.
// ============================================================

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RADICE = fileURLToPath(new URL('..', import.meta.url));

let passate = 0;
const cadute = [];
const prova = (nome, esito) => { esito ? (passate += 1) : cadute.push(nome); };

const CSS = join(RADICE, 'app', 'rfcoach', 'rfcoach.css');
const css = readFileSync(CSS, 'utf8');

// ⚠️ I COMMENTI VANNO VIA PRIMA DI CERCARE. Questo foglio e' meta'
// commento, e i commenti di oggi NOMINANO i valori vecchi — «erano
// `#f4f4f2` e `#e4e4e0`», «era 12», «999 su bottoni e pastiglie». Una
// prova che cercasse nel testo grezzo troverebbe quelle parole e
// resterebbe verde su un foglio sbagliato, oppure cadrebbe su un foglio
// giusto. E' la prima delle cinque forme della prova cieca: cercare una
// stringa che compare in un commento.
const senzaCommenti = css.replace(/\/\*[\s\S]*?\*\//g, '');

// ------------------------------------------------------------
// 1. IL RAGGIO — un numero solo, e piccolo.
// ------------------------------------------------------------
const trovato = /--raggio:\s*(\d+)px;/.exec(senzaCommenti);
prova('il raggio del pannello si legge nel css', !!trovato);

if (trovato) {
  const raggio = Number(trovato[1]);
  // ⚠️ IL TETTO E' SEI, lo stesso numero della prova dell'app. «Minimo»
  // non e' un'impressione: sopra i sei punti l'occhio smette di leggere
  // un rettangolo. Il tetto sta qui perche' il giorno che qualcuno
  // rialza il numero per comodita' — «su questa pagina stava meglio» —
  // la prova lo dica prima della consegna, non Giorgio dopo.
  prova(`il raggio resta minimo (trovato ${raggio}px, il gemello nell app e MINIMO in rf-coach/theme/forme.ts)`,
    raggio > 0 && raggio <= 6);
}

// ------------------------------------------------------------
// 2. E NESSUN ANGOLO SE LO SCRIVE DA SE'.
//
// ⚠️ LO ZERO RESTA AMMESSO: lo spigolo dichiarato e' una scelta, non una
// dimenticanza. Tutto il resto deve passare da `var(--raggio)`.
// ------------------------------------------------------------
const scrittiAMano = [];
for (const m of senzaCommenti.matchAll(/border-radius:\s*(\d+)(px)?/g)) {
  if (Number(m[1]) === 0) continue;
  scrittiAMano.push(m[0]);
}
prova(
  `nessun angolo scritto a mano nel foglio (${scrittiAMano.length} trovati${scrittiAMano.length ? `: ${scrittiAMano.join(', ')}` : ''})`,
  scrittiAMano.length === 0,
);

// ⚠️ E LA VARIABILE DEVE ESSERE USATA, o la prova sopra sarebbe
// soddisfatta anche da un foglio che ha smesso di arrotondare qualunque
// cosa: zero numeri scritti a mano e zero angoli. E' la terza forma
// della prova cieca — essere verdi per il motivo sbagliato.
const usi = (senzaCommenti.match(/var\(--raggio\)/g) ?? []).length;
prova(`la variabile del raggio e usata davvero (${usi} volte)`, usi >= 6);

// ------------------------------------------------------------
// 3. NEMMENO LE PAGINE SE LO SCRIVONO IN LINEA.
//
// ⚠️ QUESTE PAGINE OGGI NON HANNO NESSUNO STILE IN LINEA — verificato
// file per file il 3 ottobre — e la prova esiste per il giorno in cui
// qualcuno ne scrivera' uno. Un `style={{ borderRadius: 8 }}` dentro un
// `page.tsx` e' invisibile a chi guarda il foglio di stile, e sfugge
// anche a chi cerca `border-radius` con il trattino.
// ------------------------------------------------------------
function tuttiITsx(cartella) {
  const fuori = [];
  for (const voce of readdirSync(cartella)) {
    const dentro = join(cartella, voce);
    if (statSync(dentro).isDirectory()) fuori.push(...tuttiITsx(dentro));
    else if (/\.tsx?$/.test(voce)) fuori.push(dentro);
  }
  return fuori;
}

const PAGINE = tuttiITsx(join(RADICE, 'app', 'rfcoach'));
prova(`le pagine del pannello si trovano (${PAGINE.length})`, PAGINE.length >= 8);

const inLinea = [];
for (const p of PAGINE) {
  const testo = readFileSync(p, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '');
  for (const m of testo.matchAll(/borderRadius:\s*(\d+)/g)) {
    if (Number(m[1]) === 0) continue;
    inLinea.push(`${p.slice(RADICE.length)}: ${m[0]}`);
  }
}
prova(
  `nessun angolo in linea nelle pagine (${inLinea.length} trovati${inLinea.length ? `: ${inLinea.slice(0, 4).join(' | ')}` : ''})`,
  inLinea.length === 0,
);

// ------------------------------------------------------------
// 4. E I DUE GRIGI NON TORNANO AVORIO.
//
// ⚠️ «AVORIO» IN NUMERI E' IL ROSSO SOPRA IL BLU. Non si pretende il
// grigio esatto (R = G = B): i valori scelti il 3 ottobre sono appena
// FREDDI, nello stesso verso dei grigi dell'app. Si pretende che non
// tornino caldi, che e' la cosa che Giorgio ha chiesto di togliere.
//
// ⚠️ `--sfondo` HA UN VALORE PRECISO E NON SOLO UN VERSO: e' `#f2f2f4`,
// lo stesso numero di `superficie` in `rf-coach/data/temi.ts`. Ma qui si
// sorveglia solo il verso: pretendere il valore esatto da questo lato
// vorrebbe dire scrivere il numero dell'altro repository in due posti, e
// un numero scritto due volte e' la cosa che queste prove combattono. Il
// legame vero e' il commento nel foglio, che nomina l'altro file.
// ------------------------------------------------------------
function caldo(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return r > b;
}

for (const nome of ['sfondo', 'riga']) {
  const m = new RegExp(`--${nome}:\\s*(#[0-9a-fA-F]{6});`).exec(senzaCommenti);
  prova(`il colore --${nome} si legge nel css`, !!m);
  if (m) {
    prova(
      `e --${nome} non e piu caldo che freddo (${m[1]}: il rosso non deve stare sopra il blu)`,
      !caldo(m[1]),
    );
  }
}

// ⚠️ E IL FOGLIO DEI RIQUADRI RESTA BIANCO. Su questo pannello il
// riquadro e' bianco e il grigio sta SOTTO, al contrario dell'app dove il
// riquadro e' grigio sul fondo chiaro: schiarire il fondo e imbiancare
// anche il riquadro vorrebbe dire bianco su bianco, cioe' il difetto
// pagato il 6 settembre dall'altro lato.
prova('il foglio dei riquadri resta bianco', /--foglio:\s*#ffffff;/.test(senzaCommenti));

// ⚠️ E IL BORDO C'E'. Con riquadri bianchi su fondo grigio chiarissimo,
// la linea e' il secondo segnale che li stacca: `.foglio` deve avere il
// suo bordo, non il solo sfondo.
prova('e il riquadro ha il suo bordo', /\.rfcoach \.foglio \{[^}]*border: 1px solid var\(--riga\)/.test(senzaCommenti));

// ------------------------------------------------------------
console.log(`\nPROVE FORME — ${passate} passate, ${cadute.length} cadute`);
if (cadute.length) {
  for (const c of cadute) console.log(`  ✗ ${c}`);
  process.exit(1);
}
console.log('  ✓ tutto in ordine\n');
