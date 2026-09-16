// ============================================================
// LE PROVE DEL DOMINIO — nate dal 16 settembre 2026, il giorno in cui
// il sito e' passato da `racketfever.it` a `www.racketfever.com`.
//
// ⚠️ ESISTONO PER UN GUASTO CHE NON AVREBBE DATO NESSUN ERRORE.
// `EMAIL_CONTATTO` era derivato da `SITO`: cambiando il dominio, senza
// una riga di codice rotta e senza un avviso, l'indirizzo di contatto
// stampato su informativa, termini, cancellazione account e home
// sarebbe diventato `info@www.racketfever.com` — una casella che non
// esiste, su una zona DNS senza record MX. Le mail degli utenti
// sarebbero sparite in silenzio, dalle quattro pagine dove un contatto
// sbagliato costa di piu'.
//
// Un difetto che non alza la voce si ferma solo con qualcuno che gli
// chiede conto a ogni consegna. E' questo file.
//
// ============================================================
// ⚠️ SI VALUTANO I VALORI VERI, NON SI RICOSTRUISCONO.
//
// La prima stesura di questo file, il 16 settembre, era CIECA proprio
// sul punto per cui era stata scritta: leggeva `DOMINIO_POSTA` e poi si
// calcolava da sola `info@${DOMINIO_POSTA}`, invece di valutare
// l'espressione scritta in `consenso.ts`. Cambiando quella riga in
// `info@mail.${DOMINIO_POSTA}` le prove restavano verdi. Una rete che
// confronta il codice con la propria idea del codice non e' una rete.
//
// Adesso le dichiarazioni si estraggono dal file e si ESEGUONO in
// catena, cosi' il valore che finisce nelle prove e' lo stesso che
// finisce sulla pagina.
//
// ⚠️ E I COMMENTI SI TOLGONO PRIMA DI GUARDARE. Il 16 settembre una
// prova dell'app e' passata verde perche' cercava una stringa che il
// file nominava nel PROPRIO commento. Qui i commenti spariscono,
// altrimenti ogni ⚠️ scritto qui sopra diventerebbe una prova che si
// autoassolve.
//
// Si lancia con `npm run prove`. Non ha dipendenze.
// ============================================================

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

let passate = 0;
const cadute = [];

function prova(nome, esito) {
  if (esito) passate += 1;
  else cadute.push(nome);
}

function senzaCommenti(testo) {
  return testo
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

// ⚠️ `fileURLToPath` E NON `.pathname`. Su Windows — cioe' sul computer
// dove si lavora davvero — `pathname` vale `/C:/Users/acer/...`, con una
// barra di troppo davanti alla lettera del disco, e ogni `readFileSync`
// muore con ENOENT. Una rete che esplode al primo lancio viene provata
// una volta e poi mai piu'.
const RADICE = fileURLToPath(new URL('..', import.meta.url));
const CONSENSO = join(RADICE, 'data/consenso.ts');
const codiceConsenso = senzaCommenti(readFileSync(CONSENSO, 'utf8'));

// ------------------------------------------------------------
// L'ESTRATTORE. Prende le dichiarazioni che ci interessano NELL'ORDINE
// IN CUI STANNO NEL FILE e le esegue in catena, cosi' `SITO_NUDO` vede
// davvero il `SITO` che sta sopra di lui.
// ------------------------------------------------------------
const NOMI = [
  'VERSIONE_DOCUMENTI', 'SITO', 'SITO_NUDO', 'DOMINIO_POSTA', 'EMAIL_CONTATTO',
  'INDIRIZZO_PRIVACY', 'INDIRIZZO_TERMINI', 'INDIRIZZO_CANCELLAZIONE',
];

const dichiarazioni = [];   // [nome, espressione] in ordine di file
const espressione = {};     // nome -> testo dell'espressione

for (const m of codiceConsenso.matchAll(
  /export const ([A-Z_][A-Z0-9_]*)\s*(?::[^=]+)?=\s*([^;]+);/g,
)) {
  const [, nome, espr] = m;
  if (!NOMI.includes(nome)) continue;
  dichiarazioni.push([nome, espr.trim()]);
  espressione[nome] = espr.trim();
}

let valore = {};
let erroreEsecuzione = null;
try {
  const corpo = dichiarazioni.map(([n, e]) => `const ${n} = ${e};`).join('\n')
    + `\nreturn { ${dichiarazioni.map(([n]) => n).join(', ')} };`;
  // eslint-disable-next-line no-new-func
  valore = new Function(corpo)();
} catch (e) {
  erroreEsecuzione = e;
}

prova('le costanti di consenso.ts si leggono ed eseguono', erroreEsecuzione === null);
for (const n of NOMI) {
  prova(`${n} e dichiarato in consenso.ts`, Object.prototype.hasOwnProperty.call(valore, n));
}

// ------------------------------------------------------------
// 1. IL SITO
// ------------------------------------------------------------
prova('SITO e https', (valore.SITO || '').startsWith('https://'));
prova('SITO non finisce con /', !(valore.SITO || '/').endsWith('/'));
prova('SITO e https://www.racketfever.com', valore.SITO === 'https://www.racketfever.com');

// ------------------------------------------------------------
// 2. IL NOME NUDO — si guarda il VALORE, non la forma della regex
// ------------------------------------------------------------
prova('SITO_NUDO non contiene lo schema', !(valore.SITO_NUDO || '://').includes('://'));
prova('SITO_NUDO non comincia con www.', !(valore.SITO_NUDO || 'www.').startsWith('www.'));
prova('SITO_NUDO e racketfever.com', valore.SITO_NUDO === 'racketfever.com');
prova('SITO_NUDO deriva da SITO', /SITO\b/.test(espressione.SITO_NUDO || ''));

// ------------------------------------------------------------
// 3. ⚠️ LA POSTA — il cuore di questo file
// ------------------------------------------------------------
prova('DOMINIO_POSTA e racketfever.it', valore.DOMINIO_POSTA === 'racketfever.it');
prova(
  'DOMINIO_POSTA e scritto a mano, non derivato da SITO',
  !/SITO/.test(espressione.DOMINIO_POSTA || 'SITO'),
);
prova(
  'EMAIL_CONTATTO non deriva ne da SITO ne da SITO_NUDO',
  !/SITO/.test(espressione.EMAIL_CONTATTO || 'SITO'),
);
prova(
  'EMAIL_CONTATTO deriva dal dominio della posta',
  /DOMINIO_POSTA/.test(espressione.EMAIL_CONTATTO || ''),
);
// ⚠️ E QUI SI GUARDA IL VALORE VERO, quello che finisce stampato sulle
// quattro pagine. Le tre prove qui sopra dicono da dove viene; questa
// dice che cosa e'. Servono tutte e quattro: `info@mail.${DOMINIO_POSTA}`
// passerebbe le prime tre.
prova('l indirizzo di contatto non contiene www.', !(valore.EMAIL_CONTATTO || 'www.').includes('www.'));
prova(
  'l indirizzo di contatto e esattamente info@racketfever.it',
  valore.EMAIL_CONTATTO === 'info@racketfever.it',
);
prova(
  'l indirizzo di contatto sta sul dominio della posta, non su quello del sito',
  (valore.EMAIL_CONTATTO || '').endsWith(`@${valore.DOMINIO_POSTA}`),
);

// ------------------------------------------------------------
// 4. GLI INDIRIZZI DEI DOCUMENTI — devono seguire il sito
// ------------------------------------------------------------
for (const [nome, coda] of [
  ['INDIRIZZO_PRIVACY', '/privacy'],
  ['INDIRIZZO_TERMINI', '/termini'],
  ['INDIRIZZO_CANCELLAZIONE', '/cancellazione-account'],
]) {
  prova(`${nome} parte dal sito`, (valore[nome] || '').startsWith(valore.SITO || '\u0000'));
  prova(`${nome} finisce con ${coda}`, (valore[nome] || '').endsWith(coda));
  // ⚠️ E la pagina deve esistere davvero: un documento legale che
  // rimanda a un 404 e' peggio di un documento assente.
  prova(
    `la pagina ${coda} esiste sul disco`,
    existsSync(join(RADICE, 'app', coda.slice(1), 'page.tsx')),
  );
}

// ------------------------------------------------------------
// 5. LA VERSIONE DEI DOCUMENTI
// ------------------------------------------------------------
prova(
  'VERSIONE_DOCUMENTI e una data AAAA-MM-GG',
  /^\d{4}-\d{2}-\d{2}$/.test(valore.VERSIONE_DOCUMENTI || ''),
);
// ⚠️ E le tre pagine legali devono RENDERLA, non scrivere una data a
// mano: due date che si contraddicono dentro lo stesso documento sono
// esattamente cio' che quel campo esiste per non dover spiegare.
for (const pagina of ['privacy', 'termini', 'cancellazione-account']) {
  const f = join(RADICE, 'app', pagina, 'page.tsx');
  const t = existsSync(f) ? senzaCommenti(readFileSync(f, 'utf8')) : '';
  prova(`${pagina} rende VERSIONE_DOCUMENTI`, /VERSIONE_DOCUMENTI/.test(t));
  prova(`${pagina} non ha una data scritta a mano`, !/['"`]20\d\d-\d\d-\d\d['"`]/.test(t));
}

// ------------------------------------------------------------
// 6. ⚠️ NESSUN DOMINIO SCRITTO A MANO ALTROVE.
//
// Il dominio sta in un posto solo. Qui si controlla che sia vero nel
// CODICE e nei file di configurazione — non nei commenti, dove la
// storia di come ci siamo arrivati deve poter restare scritta.
//
// ⚠️ E NON SOLO NEI `.ts`. La prima stesura guardava solo `.ts`/`.tsx` e
// saltava `public/`: cioe' era cieca proprio dove il prossimo trasloco
// si romperebbe davvero — un `redirects()` messo in `next.config.js` da
// chi «aiuta», o un `Sitemap:` in `robots.txt` rimasto sul dominio
// vecchio.
// ------------------------------------------------------------
const SALTA_CARTELLE = new Set(['node_modules', '.next', '.git', 'prove', '.expo']);
const SALTA_FILE = new Set(['package-lock.json', 'tsconfig.tsbuildinfo']);
const GUARDATI = /\.(ts|tsx|js|jsx|mjs|cjs|json|css|txt|xml|webmanifest|html)$/;
const CON_COMMENTI = /\.(ts|tsx|js|jsx|mjs|cjs|css)$/;
const sospetti = [];

function percorri(cartella) {
  for (const voce of readdirSync(cartella)) {
    if (SALTA_CARTELLE.has(voce) || SALTA_FILE.has(voce)) continue;
    const pieno = join(cartella, voce);
    if (statSync(pieno).isDirectory()) { percorri(pieno); continue; }
    if (!GUARDATI.test(voce)) continue;
    if (pieno === CONSENSO) continue;
    const grezzo = readFileSync(pieno, 'utf8');
    const testo = CON_COMMENTI.test(voce) ? senzaCommenti(grezzo) : grezzo;
    if (/racketfever\.(it|com)/i.test(testo)) sospetti.push(relative(RADICE, pieno).split(sep).join('/'));
  }
}
percorri(RADICE);

prova(
  `nessun dominio scritto a mano fuori da consenso.ts (trovati: ${sospetti.join(', ') || 'nessuno'})`,
  sospetti.length === 0,
);

// ------------------------------------------------------------
// 7. ⚠️ IL 301 NON STA NEL CODICE.
//
// I tre nomi vecchi li reindirizza Firebase App Hosting, al bordo. Una
// seconda copia dentro `middleware.ts` o dentro `next.config.js`
// sarebbe una seconda verita' sullo stesso fatto, e il giorno che
// divergono vince quella che non si vede.
// ------------------------------------------------------------
const middleware = senzaCommenti(readFileSync(join(RADICE, 'middleware.ts'), 'utf8'));
prova('il middleware non nomina nessun dominio', !/racketfever/i.test(middleware));
// ⚠️ Il matcher puo' essere una stringa o un array: tutte e due le
// forme sono legittime, e una prova che ne accetta una sola e' un falso
// allarme che aspetta. Si controlla che sia STRETTO, non come e'
// scritto.
prova(
  'il matcher del middleware resta stretto su /rfcoach',
  /matcher\s*:\s*(\[[^\]]*\]|['"`][^'"`]*['"`])/.test(middleware)
    && !/matcher\s*:\s*(\[[^\]]*\]|['"`][^'"`]*['"`])/.exec(middleware)[0].replace(/\/rfcoach\/[^'"`,\]]*/g, '').match(/['"`]\//),
);

for (const conf of ['next.config.js', 'next.config.mjs']) {
  const f = join(RADICE, conf);
  if (!existsSync(f)) continue;
  const t = senzaCommenti(readFileSync(f, 'utf8'));
  prova(`${conf} non contiene redirects()`, !/\bredirects\s*\(/.test(t));
}

// ------------------------------------------------------------
console.log(`\nPROVE DOMINIO — ${passate} passate, ${cadute.length} cadute`);
if (cadute.length) {
  for (const c of cadute) console.log(`  ✗ ${c}`);
  process.exit(1);
}
console.log('  ✓ tutto in ordine\n');
