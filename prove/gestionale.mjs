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
