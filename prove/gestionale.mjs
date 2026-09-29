// ============================================================
// LE PROVE DEL GESTIONALE SOTTO `/rfcoach/admin` — 16 settembre 2026.
//
// ⚠️ ESISTONO PER UN GUASTO CHE HO VISTO SUCCEDERE, non per uno che ho
// immaginato. Provando l'export in un browser vero, prima di scrivere
// una riga:
//
//   • con il middleware di allora, che minuscolava TUTTO l'indirizzo,
//     sette caratteri dell'app — `Outfit_700Bold.….ttf` e compagni —
//     venivano rimandati a un nome minuscolo che non esiste;
//   • il ripiego SPA rispondeva `index.html` al posto del font;
//   • `useFonts` non si risolveva mai e l'app non disegnava niente.
//
// Schermo BIANCO. Zero errori in console, zero risposte 4xx, niente nei
// log. Un guasto che non alza la voce si ferma solo con qualcuno che
// gli chiede conto a ogni consegna: e' questo file.
//
// Si lancia con `npm run prove`. Ha bisogno di Node con
// `--experimental-strip-types`, perche' esegue la funzione VERA di
// `lib/indirizzi.ts` invece di riscriverne una copia: una prova che
// confronta il codice con la propria idea del codice non e' una prova.
// ============================================================

import { readdirSync, statSync, existsSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { minuscolato, daReindirizzare, CONFINE_APP } from '../lib/indirizzi.ts';

let passate = 0;
const cadute = [];
const prova = (nome, esito) => { esito ? (passate += 1) : cadute.push(nome); };

const RADICE = fileURLToPath(new URL('..', import.meta.url));
const CARTELLA = join(RADICE, 'public', 'rfcoach', 'admin');

// ------------------------------------------------------------
// 1. IL CONFINE, e i tre posti in cui e' scritto
// ------------------------------------------------------------
prova('il confine e /rfcoach/admin', CONFINE_APP === '/rfcoach/admin');

const config = readFileSync(join(RADICE, 'next.config.js'), 'utf8');
prova(
  'next.config.js ha il ripiego sulla radice del gestionale',
  config.includes(`source: '${CONFINE_APP}'`)
    && config.includes(`destination: '${CONFINE_APP}/index.html'`),
);
prova(
  'next.config.js ha il ripiego sui percorsi profondi',
  config.includes(`source: '${CONFINE_APP}/:percorso*'`),
);
// ⚠️ `afterFiles` e non `beforeFiles`: con `beforeFiles` ogni asset
// riceverebbe `index.html` al posto del proprio contenuto, ed e' di
// nuovo lo schermo bianco — per una strada diversa.
prova('il ripiego sta in afterFiles', /afterFiles\s*:/.test(config));
prova('il ripiego NON sta in beforeFiles', !/beforeFiles\s*:/.test(config));

// ------------------------------------------------------------
// 1-bis. ⚠️ LA CACHE — il guasto del 16 settembre sera.
//
// Il nome del pacchetto dell'app contiene un hash e CAMBIA A OGNI
// ESPORTAZIONE. L'`index.html` e' l'unico file che quel nome lo nomina.
// Un browser che si tiene un `index.html` vecchio chiede un pacchetto
// che non esiste piu', il ripiego gli risponde con dell'HTML al posto
// del JavaScript, e la pagina resta BIANCA — senza nemmeno cambiare
// indirizzo, perche' il router dell'app non parte proprio. Successo
// davvero, su Edge, e si sarebbe ripetuto a ogni maestro a ogni
// riesportazione.
//
// ⚠️ E LA META' DIFFICILE E' L'ALTRA: gli asset con l'hash nel nome
// sono immutabili per costruzione e devono restare in cache a lungo.
// Sono 8 MB. Una regola che mettesse `no-store` anche su di loro
// risolverebbe la pagina bianca creando il difetto opposto — il
// gestionale che riscarica tutto a ogni apertura.
// ------------------------------------------------------------
prova('next.config.js dichiara delle intestazioni', /async headers\s*\(/.test(config));

// ⚠️ I VALORI SONO SCRITTI COME COSTANTI, non come stringhe in linea:
// nella regola c'e' `value: MAI`, non `value: 'no-store…'`. La prima
// stesura di queste prove cercava la parola `no-store` subito dopo la
// `source` e cadeva su codice giusto — un falso allarme — E, peggio,
// restava rossa allo stesso modo quando il difetto c'era davvero:
// cioe' non distingueva. Quindi le costanti si risolvono prima.
const valore = {};
for (const m of config.matchAll(/const ([A-Z_]+)\s*=\s*'([^']+)'/g)) valore[m[1]] = m[2];

// source → valore vero dell'intestazione Cache-Control
const regole = new Map();
for (const m of config.matchAll(
  /source:\s*'([^']+)',\s*headers:\s*\[\{\s*key:\s*'Cache-Control',\s*value:\s*([A-Za-z_]+|'[^']*')\s*\}\]/g,
)) {
  const grezzo = m[2];
  regole.set(m[1], grezzo.startsWith("'") ? grezzo.slice(1, -1) : (valore[grezzo] ?? `??${grezzo}`));
}

prova(`si leggono le regole di cache (${regole.size})`, regole.size >= 4);

const radice = regole.get(CONFINE_APP);
prova(`${CONFINE_APP} (la radice) ha una regola`, typeof radice === 'string');
prova(`${CONFINE_APP} (la radice) e no-store`, /no-store/.test(radice || ''));

const perPrefisso = (p) => [...regole.entries()].find(([s]) => s.startsWith(`${CONFINE_APP}/${p}`));
for (const cartella of ['_expo', 'assets']) {
  const trovata = perPrefisso(cartella);
  prova(`gli asset di ${cartella} hanno la loro regola`, !!trovata);
  if (!trovata) continue;
  prova(`gli asset di ${cartella} sono immutabili`, /immutable/.test(trovata[1]));
  prova(`gli asset di ${cartella} NON sono no-store`, !/no-store/.test(trovata[1]));
}

// Le regole profonde che portano `no-store` devono essere quelle
// dell'HTML, e nessun'altra.
const profondeNoStore = [...regole.entries()]
  .filter(([s, v]) => s.startsWith(`${CONFINE_APP}/:`) && /no-store/.test(v));
prova('c e una regola profonda con no-store', profondeNoStore.length === 1);

// ⚠️ E QUI NON SI GUARDA CHE LA STRINGA «_expo» COMPAIA: si PRENDE
// l'espressione scritta nella regola e la si ESEGUE sui percorsi veri.
// Una prova che si accontenta di vedere un pezzo di testo sarebbe
// passata anche con l'esclusione scritta al contrario.
const regolaProfonda = config.match(
  new RegExp(`source:\\s*'${CONFINE_APP}/:[A-Za-z]+\\(([\\s\\S]*?)\\)',`),
);
prova('la regola profonda ha un espressione da esaminare', !!regolaProfonda);
if (regolaProfonda) {
  let espressione = null;
  try { espressione = new RegExp(`^${regolaProfonda[1]}$`); } catch { espressione = null; }
  prova('l espressione della regola profonda e valida', espressione !== null);
  if (espressione) {
    for (const coda of ['allievi', 'accesso', 'allievo/AbC123xYz', 'corsi/nuovo']) {
      prova(`no-store copre ${CONFINE_APP}/${coda}`, espressione.test(coda));
    }
    for (const coda of [
      '_expo/static/js/web/entry-abc123.js',
      'assets/node_modules/@expo-google-fonts/outfit/700Bold/Outfit_700Bold.abc.ttf',
    ]) {
      prova(
        `no-store NON tocca ${coda.split('/')[0]}/…`,
        !espressione.test(coda),
      );
    }
  }
}

// ============================================================
// ⚠️ LA PROPORZIONE DEL MENU, GEMELLA DI QUELLA DELL'APP — 17 settembre.
//
// Il pannello Super Admin e il gestionale del maestro sono due
// schermate che si somigliano: il menu vale il 20% in tutte e due, fra
// un minimo di 240 punti e un massimo di 360. Due proporzioni diverse si
// notano subito passando dall'una all'altra, e non danno nessun errore.
//
// ⚠️ L'ALTRA META' STA IN UN ALTRO REPOSITORY: `rf-coach`, in
// `theme/misureScrivania.ts`, come QUOTA_MENU / MENU_MINIMO /
// MENU_MASSIMO. Nessuna delle due prove puo' vedere l'altra — ci hanno
// gia' provato, e il 17 settembre quella dell'app e' caduta perche'
// leggeva un file archiviato. Quindi ognuna sorveglia il proprio lato e
// nomina l'altro per nome e cognome.
// ============================================================
const cssRfcoach = readFileSync(join(RADICE, 'app', 'rfcoach', 'rfcoach.css'), 'utf8');
const misura = cssRfcoach.match(/--menu:\s*clamp\((\d+)px,\s*(\d+)%,\s*(\d+)px\)/);
prova('la larghezza del menu si legge nel css', !!misura);
if (misura) {
  // ⚠️ I TRE NUMERI SONO CALATI IL 29 SETTEMBRE 2026 — richiesta di Giorgio:
  // «riduci spazio vuoto nei menu». Erano 20 / 240 / 360. I gemelli stanno nell'app,
  // in `rf-coach/theme/misureScrivania.ts`, e la prova gemella in
  // `rf-coach/prove/sezioni.mjs`.
  prova(`menu: la quota e il 17% (trovato ${misura[2]}%)`, misura[2] === '17');
  prova(`menu: il minimo e 210 (trovato ${misura[1]})`, misura[1] === '210');
  prova(`menu: il massimo e 300 (trovato ${misura[3]})`, misura[3] === '300');
}

// ============================================================
// ⚠️ E I NUMERI DEL MENU, non solo la sua larghezza — 29 settembre 2026, rilievo di
// una revisione ostile.
//
// Il CSS di questo pannello e gli stili di `rf-coach/theme/Scrivania.tsx` si
// dichiarano gemelli a parola dal 16 settembre, e per due giorni NON lo sono stati:
// margini 12/5 contro 10/3, e `.famiglia` senza nessun `font-weight` contro un 800.
// Un commento che dichiara un gemellaggio e non lo prova e' esattamente cio' che fa
// smettere di controllare.
//
// ⚠️ E OGNI LATO SORVEGLIA IL PROPRIO, nominando l'altro: e' la regola di questo
// progetto — una prova che leggesse dentro l'altro repository cadrebbe il giorno che
// qualcuno sposta una cartella, e su Cloud Build, dove accanto non c'e' niente, non
// potrebbe mai girare. La gemella sta in `rf-coach/prove/gestionale.mjs`.
// ============================================================
{
  const blocco = (nome) => {
    const i = cssRfcoach.indexOf(nome);
    return i < 0 ? '' : cssRfcoach.slice(i, cssRfcoach.indexOf('}', i));
  };
  const fam = blocco('.rfcoach .famiglia {');
  prova('la famiglia del menu e di 10 punti, come nell app',
    /font-size:\s*10px/.test(fam), fam.slice(0, 80));
  prova('e in grassetto, come nell app', /font-weight:\s*800/.test(fam));
  prova('e con gli stessi margini dell app (10 sopra, 3 sotto)',
    /margin:\s*10px\s+6px\s+3px/.test(fam));
  const bot = blocco('.rfcoach .bottone-menu {');
  prova('la voce del menu ha l imbottitura dell app (7 e 8)',
    /padding:\s*7px\s+8px/.test(bot));
  prova('e le voci si staccano di un punto', /margin-bottom:\s*1px/.test(bot));
  prova('e il testo della voce e di 13 punti, come nell app',
    /\.bottone-menu b \{[^}]*font-size:\s*13px/.test(cssRfcoach));
  // ⚠️ E IL PRIMO GRUPPO NON PORTA IL MARGINE SOPRA, come nell'app: e' la regola che
  // l'app non aveva e questo CSS si', ed e' stata portata di la' nella stessa tornata.
  prova('e il primo gruppo non porta il margine sopra',
    /\.famiglia:first-child \{ margin-top: 0; \}/.test(cssRfcoach));
}

// ------------------------------------------------------------
// 2. ⚠️ LA ROTTA NEXT DEVE ESSERE SPARITA.
// Una pagina dell'App Router batte i file statici: finche' esiste
// `app/rfcoach/admin/page.tsx`, il gestionale non si vede e al suo
// posto resta il segnaposto — e nessuno capisce perche'.
// ------------------------------------------------------------
prova(
  'non esiste piu la pagina segnaposto app/rfcoach/admin',
  !existsSync(join(RADICE, 'app', 'rfcoach', 'admin')),
);

// ⚠️ E il bottone deve essere un `<a>`: `<Link>` farebbe una
// navigazione interna a Next, senza caricare davvero l'app.
const porte = readFileSync(join(RADICE, 'app', 'rfcoach', 'page.tsx'), 'utf8');
prova(
  'il bottone del gestionale e un <a>, non un <Link>',
  new RegExp(`<a[^>]*href=["']${CONFINE_APP}["']`).test(porte)
    && !new RegExp(`<Link[^>]*href=["']${CONFINE_APP}["']`).test(porte),
);

// ------------------------------------------------------------
// 3. ⚠️ L'EXPORT DEVE ESSERCI.
// Se manca, il sito si costruisce lo stesso e va online lo stesso: il
// gestionale risponde `index.html`… che non esiste, quindi 404. Meglio
// che la consegna si fermi qui.
// ------------------------------------------------------------
prova(
  'la cartella public/rfcoach/admin esiste (l export e stato copiato)',
  existsSync(CARTELLA),
);
prova(
  'c e un index.html solo, come vuole la modalita single',
  existsSync(join(CARTELLA, 'index.html')),
);

let file = [];
if (existsSync(CARTELLA)) {
  (function percorri(c) {
    for (const voce of readdirSync(c)) {
      const pieno = join(c, voce);
      if (statSync(pieno).isDirectory()) { percorri(pieno); continue; }
      file.push('/' + relative(RADICE, pieno).split(sep).join('/').replace(/^public\//, ''));
    }
  })(CARTELLA);
}

const html = file.filter((f) => f.endsWith('.html'));
prova(`la modalita e single: un solo .html (trovati ${html.length})`, html.length === 1);

// ⚠️ E l'index deve chiamare il proprio codice SOTTO il confine. Se
// `experiments.baseUrl` non fosse impostato in `rf-coach/app.json`,
// qui ci sarebbe `/_expo/...` — cioe' la radice del dominio, dove c'e'
// il sito e non c'e' nessun pacchetto. E' l'unico punto in cui questo
// repository puo' accorgersi di un errore fatto nell'altro.
if (existsSync(join(CARTELLA, 'index.html'))) {
  const indice = readFileSync(join(CARTELLA, 'index.html'), 'utf8');
  const sorgenti = [...indice.matchAll(/(?:src|href)="([^"]+)"/g)].map((m) => m[1]);
  const assoluti = sorgenti.filter((s) => s.startsWith('/'));
  prova('l index.html ha dei riferimenti assoluti da controllare', assoluti.length > 0);
  prova(
    `ogni riferimento dell index parte da ${CONFINE_APP} (fuori posto: `
      + `${assoluti.filter((s) => !s.startsWith(CONFINE_APP + '/')).join(', ') || 'nessuno'})`,
    assoluti.every((s) => s.startsWith(CONFINE_APP + '/')),
  );
}

// ------------------------------------------------------------
// 4. ⚠️ IL CUORE: IL MIDDLEWARE NON DEVE TOCCARE NESSUN FILE DELL APP.
//
// Non su una lista inventata: su TUTTI i file davvero esportati, uno
// per uno. Il giorno che l'app aggiunge un carattere o un'icona con una
// maiuscola nel nome, questa prova lo vede senza che nessuno abbia
// dovuto prevederlo.
// ------------------------------------------------------------
const toccati = file.filter((f) => daReindirizzare(f) !== null);
prova(
  `il middleware non tocca nessuno dei ${file.length} file esportati `
    + `(toccati: ${toccati.slice(0, 3).join(', ') || 'nessuno'}${toccati.length > 3 ? ' …' : ''})`,
  toccati.length === 0,
);

// ⚠️ E si controlla che ci fosse davvero qualcosa da sbagliare: se
// l'export non contenesse nemmeno un nome con le maiuscole, la prova
// qui sopra sarebbe verde per caso invece che per merito.
const conMaiuscole = file.filter((f) => /[A-Z]/.test(f));
prova(
  `fra i file esportati ce ne sono con le maiuscole, quindi la prova sopra morde `
    + `(${conMaiuscole.length})`,
  conMaiuscole.length > 0,
);

// ------------------------------------------------------------
// 5. GLI IDENTIFICATIVI DI FIRESTORE, che hanno le maiuscole per natura
// ------------------------------------------------------------
for (const indirizzo of [
  '/rfcoach/admin/allievo/AbC123xYz',
  '/rfcoach/admin/lezione/QqWwEe9',
  '/rfcoach/admin/corsi/modifica/ZZtop42',
  '/rfcoach/admin/videoreview/MiXeD',
]) {
  prova(`resta intatto: ${indirizzo}`, minuscolato(indirizzo) === indirizzo);
}

// ------------------------------------------------------------
// 6. E SOPRA IL CONFINE IL SITO RESTA PADRONE A CASA SUA.
// La richiesta del 16 settembre era questa, e non deve essersi persa
// per strada mentre si difendeva l'app.
// ------------------------------------------------------------
prova('/rfcoach/SuperAdmin si minuscola', minuscolato('/rfcoach/SuperAdmin') === '/rfcoach/superadmin');
prova('/rfcoach/Admin si minuscola', minuscolato('/rfcoach/Admin') === '/rfcoach/admin');
prova('/rfcoach/Entra si minuscola', minuscolato('/rfcoach/Entra') === '/rfcoach/entra');
prova(
  '/rfcoach/SuperAdmin/Spazi si minuscola tutto',
  minuscolato('/rfcoach/SuperAdmin/Spazi') === '/rfcoach/superadmin/spazi',
);
prova('un indirizzo gia minuscolo non si tocca', daReindirizzare('/rfcoach/superadmin') === null);
prova('la radice del gestionale non si tocca', daReindirizzare(CONFINE_APP) === null);
prova('la barra finale si conserva', minuscolato('/rfcoach/admin/') === '/rfcoach/admin/');

// ------------------------------------------------------------
console.log(`\nPROVE GESTIONALE — ${passate} passate, ${cadute.length} cadute`);
if (cadute.length) {
  for (const c of cadute) console.log(`  ✗ ${c}`);
  process.exit(1);
}
console.log('  ✓ tutto in ordine\n');
