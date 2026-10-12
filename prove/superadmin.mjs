// ============================================================
// LE PROVE DEL PANNELLO SUPER ADMIN, LATO SITO — `npm run prova-superadmin`.
// 12 ottobre 2026.
//
// ⚠️ COSA SORVEGLIANO:
//   1. come si leggono i contratti (`app/rfcoach/_dati/contratti.ts`), sui
//      valori: stato, giorni, importi in franchi e in euro, totale per valuta;
//   2. il menu: ogni voce ha la sua cartella e la sua icona, ogni cartella la
//      sua voce;
//   3. il vestito del gestionale: banda col marchio, titoli, capitoli, colonna
//      dell'elenco — i numeri gemelli di `rf-coach/theme/Scrivania.tsx`,
//      `Marchio.tsx`, `TitoloPagina.tsx`, `PezziScheda.tsx` e
//      `misureScrivania.ts`, nominati qui perche' stanno nell'altro repository;
//   4. il guasto trovato fotografando la prima stesura: `<section>` e `<nav>`
//      hanno uno stile GLOBALE nel sito dei circoli (fondo nero, imbottitura
//      enorme) e dentro il pannello facevano i capitoli neri;
//   5. che il pannello non scriva mai Firestore da solo, e che la porta
//      pubblica non abbia campi liberi.
//
// ⚠️ LA META' SERVER STA IN `rf-coach/prove/superadmin.mjs`. Questa legge
// solo file di questo repository.
// ============================================================

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  statoVisto, giorniFra, importoScritto, centDaScritto, totaleAnnuo, unAnnoDopo, dataScritta,
  ORDINE_STATI, DETTO_STATO, TINTA_STATO, GIORNI_PREAVVISO,
} from '../app/rfcoach/_dati/contratti.ts';
import { SEZIONI_SUPERADMIN, ROTTE_SENZA_BOTTONE, sezioniPer, vedeSezione } from '../app/rfcoach/_dati/sezioni.ts';
import { riepilogo, etichettaRisoluzione, durataLunga, STATI_DASHBOARD, DETTO_STATO_ANALISI } from '../app/rfcoach/_dati/analisiDashboard.ts';

let passate = 0;
const cadute = [];
const prova = (nome, esito) => { esito ? (passate += 1) : cadute.push(nome); };

const RADICE = fileURLToPath(new URL('..', import.meta.url));
const PANNELLO = join(RADICE, 'app', 'rfcoach');
const leggi = (...p) => readFileSync(join(RADICE, ...p), 'utf8');
const senzaCommenti = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');

function tutti(cartella) {
  const fuori = [];
  for (const voce of readdirSync(cartella)) {
    const dentro = join(cartella, voce);
    if (statSync(dentro).isDirectory()) fuori.push(...tutti(dentro));
    else if (/\.tsx?$/.test(voce)) fuori.push(dentro);
  }
  return fuori;
}

// ------------------------------------------------------------
// 1. I CONTRATTI
// ------------------------------------------------------------
const OGGI = '2026-10-12';
const c = (x) => ({
  spazioId: 's', inizio: '2026-01-01', scadenza: '2026-12-31', importoCent: 95000, valuta: 'CHF',
  stato: 'attivo', pagato: true, note: '', aggiornatoIlMs: 0, ...x,
});
prova('senza contratto e «senza»', statoVisto(null, OGGI) === 'senza');
prova('un contratto passato e scaduto', statoVisto(c({ scadenza: '2026-10-11' }), OGGI) === 'scaduto');
prova('oggi non e ancora scaduto', statoVisto(c({ scadenza: OGGI }), OGGI) === 'inScadenza');
prova(`entro ${GIORNI_PREAVVISO} giorni e in scadenza`, statoVisto(c({ scadenza: '2026-11-11' }), OGGI) === 'inScadenza');
prova('oltre e in regola se pagato', statoVisto(c({ scadenza: '2027-06-30' }), OGGI) === 'attivo');
prova('e da pagare se non pagato', statoVisto(c({ scadenza: '2027-06-30', pagato: false }), OGGI) === 'daPagare');
prova('un disdetto resta disdetto anche scaduto', statoVisto(c({ stato: 'disdetto', scadenza: '2025-01-01' }), OGGI) === 'disdetto');
prova('una prova scaduta e scaduta: va decisa oggi', statoVisto(c({ stato: 'inProva', scadenza: '2026-10-01' }), OGGI) === 'scaduto');
prova('una prova in corso e in prova', statoVisto(c({ stato: 'inProva', scadenza: '2026-10-20' }), OGGI) === 'inProva');
prova('ogni stato ha il suo posto, il suo nome e la sua tinta',
  ['scaduto', 'inScadenza', 'daPagare', 'attivo', 'inProva', 'disdetto', 'senza']
    .every((s) => ORDINE_STATI.includes(s) && DETTO_STATO[s] && TINTA_STATO[s]));
prova('lo scaduto viene per primo', ORDINE_STATI[0] === 'scaduto');

prova('i giorni contano anche attraverso l ora legale', giorniFra('2026-10-24', '2026-10-26') === 2);
prova('e sono negativi se e passata', giorniFra('2026-10-12', '2026-10-10') === -2);
prova('franchi alla svizzera, con l apostrofo dritto dell app', importoScritto(125000, 'CHF') === "CHF 1'250.00");
prova('euro all italiana', importoScritto(125050, 'EUR') === '€ 1.250,50');
prova('importi piccoli senza separatore', importoScritto(9500, 'CHF') === 'CHF 95.00');
prova('dal campo ai centesimi: 950', centDaScritto('950') === 95000);
prova('con i decimali col punto', centDaScritto('950.5') === 95050);
prova('con l apostrofo delle migliaia', centDaScritto("1'200.00") === 120000);
prova('all italiana', centDaScritto('1.200,50') === 120050);
prova('una parola no', centDaScritto('mille') === null && centDaScritto('') === null);
{
  const t = totaleAnnuo([
    c({ importoCent: 100000 }), c({ importoCent: 50000 }), c({ importoCent: 70000, valuta: 'EUR' }),
    c({ importoCent: 99999, stato: 'inProva' }), c({ importoCent: 99999, stato: 'disdetto' }),
  ]);
  prova('il totale e per valuta, mai sommato', t.CHF === 150000 && t.EUR === 70000);
  prova('e prova e disdetti non contano', Object.keys(t).length === 2);
}
prova('un anno dopo, e il 29 febbraio diventa il 28', unAnnoDopo('2026-10-12') === '2027-10-12' && unAnnoDopo('2028-02-29') === '2029-02-28');
prova('la data come la leggono le persone', dataScritta('2026-12-31') === '31.12.2026' && dataScritta('') === '—');

// ------------------------------------------------------------
// 2. IL MENU
// ------------------------------------------------------------
const icone = leggi('app', 'rfcoach', '_pezzi', 'Icona.tsx');
for (const s of SEZIONI_SUPERADMIN) {
  prova(`la sezione ${s.chiave} ha la sua pagina`, existsSync(join(PANNELLO, 'superadmin', s.chiave, 'page.tsx')));
  prova(`la sezione ${s.chiave} ha un icona che esiste`, new RegExp(`\\n  ${s.icona}: '`).test(icone));
}
const cartelle = readdirSync(join(PANNELLO, 'superadmin')).filter((n) => statSync(join(PANNELLO, 'superadmin', n)).isDirectory());
for (const n of cartelle) {
  prova(`la cartella ${n} e dichiarata`, SEZIONI_SUPERADMIN.some((s) => s.chiave === n) || ROTTE_SENZA_BOTTONE.includes(n));
}
prova('contratti e richieste sono nel menu', ['contratti', 'richieste'].every((k) => SEZIONI_SUPERADMIN.some((s) => s.chiave === k)));
prova('la vecchia scheda rimanda alla nuova',
  leggi('app', 'rfcoach', 'superadmin', 'spazio', 'page.tsx').includes('/rfcoach/superadmin/spazi?id='));

// ------------------------------------------------------------
// 3. IL VESTITO DEL GESTIONALE
// ------------------------------------------------------------
const css = senzaCommenti(leggi('app', 'rfcoach', 'rfcoach.css'));
const blocco = (nome) => { const i = css.indexOf(nome); return i < 0 ? '' : css.slice(i, css.indexOf('}', i)); };
prova('la testata e alta 56, come ALTEZZA_TESTATA di Scrivania.tsx', /--testata:\s*56px;/.test(css));
prova('la testata e grigia (sfondoA del tema grigio)', /--testata-fondo:\s*#ededed;/.test(css) && blocco('.rfcoach .testata {').includes('var(--testata-fondo)'));
prova('la colonna dell elenco e 340, come LARGHEZZA_COLONNA_ELENCO', /--colonna-elenco:\s*340px;/.test(css));
{
  const b = blocco('.rfcoach .banda {');
  prova('la banda ha la punta di 30 a sinistra (PUNTA_BANDA)', b.includes('clip-path: polygon(30px 0, 100% 0, 100% 100%, 0 100%)'));
  prova('la banda e nera', b.includes('var(--fondo-banda)') && /--fondo-banda:\s*#000000;/.test(css));
  prova('il marchio e largo 106 (LARGHEZZA_MARCHIO_GESTIONALE)', /\.rfcoach \.banda img \{[^}]*width:\s*106px/.test(css));
}
{
  const png = join(RADICE, 'public', 'rfcoach', 'marchio-banda.png');
  prova('il marchio sta in public/rfcoach, fuori dalla cartella che aggiorna.ps1 svuota', existsSync(png));
  if (existsSync(png)) {
    const d = readFileSync(png);
    prova('ed e il disegno del gestionale (1227 x 360)', d.readUInt32BE(16) === 1227 && d.readUInt32BE(20) === 360);
  }
  prova('il guscio lo chiama per quell indirizzo', leggi('app', 'rfcoach', '_pezzi', 'Guscio.tsx').includes("MARCHIO_BANDA = '/rfcoach/marchio-banda.png'"));
}
{
  const t = blocco('.rfcoach h1.titolo {');
  prova('il titolo di pagina e quello del gestionale (21, 800, maiuscolo)',
    /font-size:\s*21px/.test(t) && /font-weight:\s*800/.test(t) && /text-transform:\s*uppercase/.test(t));
  const cap = blocco('.rfcoach .capitolo {');
  prova('il capitolo ha il filo d accento di due punti in alto', cap.includes('border-top: 2px solid var(--accento)'));
  prova('e parte da 420 punti, come sezioneGestionale', cap.includes('flex: 1 1 420px'));
  const h2 = blocco('.rfcoach .capitolo h2 {');
  prova('il titolo del capitolo e 11.5, maiuscolo, spaziato 1.4', /font-size:\s*11\.5px/.test(h2) && /letter-spacing:\s*1\.4px/.test(h2) && /uppercase/.test(h2));
  const num = blocco('.rfcoach .numero::before {');
  prova('il numero ha il filo di tre punti in alto', /height:\s*3px/.test(num));
  prova('la targhetta del ruolo in cima al menu', blocco('.rfcoach .gestionale {').includes('text-transform: uppercase'));
}

// ------------------------------------------------------------
// 4. NIENTE <section> E <nav> NEL PANNELLO
// ------------------------------------------------------------
const PAGINE = tutti(PANNELLO);
const conTag = PAGINE.filter((p) => /<(section|nav)\b/.test(readFileSync(p, 'utf8')));
prova(`nessun <section> o <nav> nel pannello (il sito li veste di nero: ${conTag.map((p) => p.slice(RADICE.length)).join(', ') || 'nessuno'})`, conTag.length === 0);
prova('e il motivo c e ancora: globals.css veste section e nav', /\nsection\s*\{/.test(leggi('app', 'globals.css')) || /(^|\})\s*section\s*\{/.test(leggi('app', 'globals.css')));

// ------------------------------------------------------------
// 5. IL PANNELLO NON SCRIVE DA SOLO, LA PORTA PUBBLICA NON HA TESTO LIBERO
// ------------------------------------------------------------
const scrive = PAGINE.filter((p) => /\b(setDoc|addDoc|updateDoc|deleteDoc|writeBatch)\(/.test(readFileSync(p, 'utf8')));
prova(`il pannello non scrive Firestore da solo (${scrive.map((p) => p.slice(RADICE.length)).join(', ') || 'nessuno'})`, scrive.length === 0);
const sa = leggi('app', 'rfcoach', '_dati', 'superadmin.ts');
prova('contratti e richieste passano da coachSuperAdmin', sa.includes("httpsCallable<Record<string, unknown>, T>(funzioni, 'coachSuperAdmin')"));
prova('l azzeramento ha la sua porta e il tempo di aspettarla', sa.includes("'coachAzzeraSpazio', { timeout: 540000 }"));
{
  const att = senzaCommenti(leggi('app', 'rfcoach', 'attiva', 'page.tsx'));
  prova('la porta pubblica non ha campi di testo libero', !/<textarea/.test(att));
  prova('ha la trappola', att.includes('className="trappola"') && att.includes('d.sito'));
  prova('e passa dalla funzione', att.includes('richiediAttivazione('));
  const iConsenso = att.indexOf('if (!consenso) { setGuasto(');
  prova('e chiede il consenso prima di mandare', iConsenso > 0 && iConsenso < att.indexOf('richiediAttivazione('));
  prova('la porta di /rfcoach la nomina', leggi('app', 'rfcoach', 'page.tsx').includes('href="/rfcoach/attiva"'));
}

// ------------------------------------------------------------
// 6. LA SCHEDA DELLO SPAZIO
// ------------------------------------------------------------
{
  const s = senzaCommenti(leggi('app', 'rfcoach', '_pezzi', 'SchedaSpazio.tsx'));
  const modifica = s.split('await modificaSpazio(spazioId, {')[1]?.split('});')[0] ?? '';
  // ⚠️ IL GUASTO DELLA VECCHIA SCHEDA: mandava telefono, email pubblica e
  // presentazione VUOTI, e la funzione li svuotava davvero.
  prova('correggere l anagrafica non manda campi vuoti di proposito', !/:\s*''/.test(modifica) && !modifica.includes('presentazione'));
  prova('e manda telefono ed email coi valori veri', modifica.includes('telefono: modulo.telefono') && modifica.includes('emailPubblica: modulo.emailPubblica'));
  prova('l azzeramento si vede solo su uno spazio di prova', s.includes('{spazio.diProva ? (') && s.indexOf('{spazio.diProva ? (') < s.indexOf('Azzera lo spazio di prova'));
  prova('e il bottone resta spento finche il nome non e riscritto',
    s.includes("conferma.trim().toLowerCase() !== spazio.nome.trim().toLowerCase()"));
  prova('cambiare email avvisa che l account e anche di Racket Fever', s.includes('Racket Fever: da adesso entra con quello nuovo'));
}
for (const p of ['spazi', 'contratti', 'richieste', 'nuovo', 'spazio']) {
  const t = leggi('app', 'rfcoach', 'superadmin', p, 'page.tsx');
  if (!t.includes('useSearchParams')) continue;
  prova(`la pagina ${p} usa l indirizzo dentro un Suspense`, t.includes('<Suspense'));
}

// ------------------------------------------------------------
// 7. I COLLABORATORI E I LIVELLI (12 ottobre)
// ------------------------------------------------------------
{
  const chiavi = (l) => sezioniPer(l).map((x) => x.chiave);
  prova('il titolare vede tutto', chiavi('titolare').length === SEZIONI_SUPERADMIN.length);
  prova('A non vede i collaboratori ma vede i contratti', !chiavi('A').includes('collaboratori') && chiavi('A').includes('contratti'));
  prova('B non vede collaboratori e contratti', !chiavi('B').includes('collaboratori') && !chiavi('B').includes('contratti'));
  prova('A e B vedono tutto il resto',
    SEZIONI_SUPERADMIN.filter((x) => !['collaboratori', 'contratti'].includes(x.chiave)).every((x) => vedeSezione('A', x.chiave) && vedeSezione('B', x.chiave)));
  prova('le sezioni nuove sono nel menu', ['analisi', 'collaboratori'].every((k) => SEZIONI_SUPERADMIN.some((x) => x.chiave === k)));
  const gus = senzaCommenti(leggi('app', 'rfcoach', '_pezzi', 'Guscio.tsx'));
  prova('il menu si disegna per livello', gus.includes('famiglie(sezioniPer(livello))') && !gus.includes('famiglie(SEZIONI_SUPERADMIN)'));
  prova('la porta passa il livello al guscio', leggi('app', 'rfcoach', 'superadmin', 'layout.tsx').includes('livello={sessione.livello}'));
  const ses = senzaCommenti(leggi('app', 'rfcoach', '_lib', 'sessione.ts'));
  prova('chi non ha livello e il titolare, uno sconosciuto vale B (come il server)',
    ses.includes("if (dato === undefined || dato === null || dato === '') return 'titolare';") && ses.includes("if (dato === 'A') return 'A';\n  return 'B';"));
  for (const sez of SEZIONI_SUPERADMIN.filter((x) => (x.nascostaA ?? []).length > 0)) {
    prova(`la pagina ${sez.chiave} si rifiuta anche digitando l indirizzo`,
      leggi('app', 'rfcoach', 'superadmin', sez.chiave, 'page.tsx').includes(`<Riservata chiave="${sez.chiave}">`));
  }
  const sch = senzaCommenti(leggi('app', 'rfcoach', '_pezzi', 'SchedaSpazio.tsx'));
  prova('la scheda dello spazio non mostra il contratto a chi non lo vede',
    sch.includes("const conContratti = vedeSezione(useLivello(), 'contratti');") && sch.includes('{conContratti ? (') && sch.includes('if (conContratti) void rileggiContratto();'));
  const sic = senzaCommenti(leggi('app', 'rfcoach', 'superadmin', 'sicurezza', 'page.tsx'));
  prova('il collaboratore non cambia la propria password', sic.includes("sessione.livello !== 'titolare' ? (") && sic.indexOf("sessione.livello !== 'titolare'") < sic.indexOf('Mandami il link'));
  const col = senzaCommenti(leggi('app', 'rfcoach', 'superadmin', 'collaboratori', 'page.tsx'));
  prova('la password chiede almeno dieci caratteri, come il server', col.includes('minLength={10}') && col.includes('password.length < 10'));
  prova('il titolare non si revoca e non si declassa dal pannello', col.includes("c.livello === 'titolare' ? null : (") && col.includes("c.livello === 'titolare' ? (\n                        <Pillola"));
  prova('revocare chiede conferma', col.includes('window.confirm(`Revoco l’accesso'));
}

// ------------------------------------------------------------
// 8. LA DASHBOARD DI VIDEO ANALYSIS (12 ottobre)
// ------------------------------------------------------------
{
  const r = (x) => ({ stato: 'daAnalizzare', byte: 0, byteAnalizzato: 0, altezza: 1080, fps: 60, durataSec: 60, spazioId: 's1', nomeSpazio: 'Mario', ...x });
  // ⚠️ Luca viene PRIMA nei dati: l'ordine «dal piu' attivo» si vede solo se
  // non coincide con quello di arrivo.
  const c = riepilogo([
    r({ stato: 'errore', spazioId: 's2', nomeSpazio: 'Luca', durataSec: 30 }),
    r({ byte: 100 }), r({ stato: 'analizzato', byte: 200, byteAnalizzato: 50, altezza: 2160, fps: 120 }),
    r({ stato: 'inviato', byte: -1 }),
  ]);
  prova('conta i video', c.totale === 4);
  prova('conta per stato, anche quelli a zero', c.perStato.daAnalizzare === 1 && c.perStato.analizzato === 1 && c.perStato.errore === 1 && c.perStato.inCoda === 0);
  prova('somma il peso, senza i numeri sbagliati', c.byte === 300 && c.byteAnalizzati === 50);
  prova('somma la durata', c.durataSec === 210);
  prova('distribuisce per risoluzione e FPS', c.perRisoluzione['1080p'] === 3 && c.perRisoluzione['4K'] === 1 && c.perFps['60 FPS'] === 3 && c.perFps['120 FPS'] === 1);
  prova('e per maestro, dal piu attivo', c.perSpazio[0].spazioId === 's1' && c.perSpazio[0].quanti === 3 && c.perSpazio[1].nome === 'Luca');
  prova('le risoluzioni si chiamano come nel gestionale', etichettaRisoluzione(1080) === '1080p' && etichettaRisoluzione(2160) === '4K' && etichettaRisoluzione(0) === '—');
  prova('la durata lunga si legge', durataLunga(45) === '45 s' && durataLunga(720) === '12 min' && durataLunga(3900) === '1 h 05 min');
  prova('gli stati sono quelli dell app, con un nome ciascuno',
    STATI_DASHBOARD.join() === 'daAnalizzare,inCoda,inAnalisi,analizzato,inviato,errore' && STATI_DASHBOARD.every((x) => DETTO_STATO_ANALISI[x]));
  const pag = senzaCommenti(leggi('app', 'rfcoach', 'superadmin', 'analisi', 'page.tsx'));
  prova('la dashboard non apre video (non tocca nessun indirizzo)', !/\burl\b|<video|Lettore/i.test(pag));
  prova('e legge dal server', pag.includes('leggiAnalisiTutte()'));
}

console.log(`\nPROVE SUPER ADMIN — ${passate} passate, ${cadute.length} cadute`);
if (cadute.length) {
  for (const x of cadute) console.log(`  ✗ ${x}`);
  process.exit(1);
}
console.log('  ✓ tutto in ordine\n');
