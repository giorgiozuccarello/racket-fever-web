'use client';

// ============================================================
// SIMULATORE MODELLI DI REVENUE — pagina protetta Super Admin.
//
// ⚠️ STESSO CANCELLO DELLA DASHBOARD, e non è un di più. Qui dentro ci
// sono la quota agevolata, la quota a regime, le fasce del banner, il
// tasso di conversione atteso e la percentuale di commissione: sono i
// numeri con cui trattiamo, non quelli che mostriamo. Una pagina
// lasciata aperta — o messa in `public/` — la legge chiunque conosca
// l'indirizzo, e il primo a cercarlo sarà proprio il circolo dall'altra
// parte del tavolo. Quindi: `onAuthStateChanged`, poi `leggiSuperAdmin`,
// e se una delle due non passa si torna al login. Copia fedele del
// guard di `app/superadmin/dashboard/page.tsx`, compresi i due `try`
// che gli sono costati cari (una lettura respinta o un `signOut` che
// rigetta dentro un callback `async` che nessuno attende lasciano la
// pagina su «Caricamento…» per sempre, senza una parola).
//
// ⚠️ TUTTO IL CSS È PREFISSATO `sim-`, e non per pignoleria. La pagina
// nasce come file HTML a sé, e i suoi nomi di classe sono quelli
// generici del mestiere: `.card`, `.badge`, `.wrap`, `.sub`,
// `.eyebrow`, più `section`, `header` e `footer` come selettori di
// elemento. In `app/globals.css` esistono GIÀ `.wrap`, `.sub`,
// `.eyebrow`, `section` e `footer`, con altri valori: lasciarli così
// voleva dire una pagina sfigurata e — peggio — il rischio inverso, di
// cambiare per sbaglio l'aspetto del sito istituzionale. Ogni regola
// vive sotto `.sim-modelli` e ogni classe ha il suo prefisso.
//
// ⚠️ I NUMERI SI FORMATTANO A MANO, senza `toLocaleString`. Il motivo
// non è Hermes (qui siamo nel browser, non nell'app): è che la stessa
// pagina viene resa una volta dal server e una volta dal browser, e se
// i due ambienti hanno dati di localizzazione diversi il numero esce
// diverso e React segnala il disallineamento. Le due funzioni qui
// sotto danno sempre lo stesso risultato ovunque girino: punto per le
// migliaia, virgola per i decimali.
//
// ⚠️ I TRE CARATTERI ARRIVANO CON UN `<link>` NORMALE, non con
// `next/font`. `next/font` scarica i file al momento della build: la
// build gira anche dove Google Fonts non è raggiungibile, e la
// fermerebbe. Con il `<link>` li scarica il browser di chi guarda, e
// se non arrivano restano le alternative dichiarate in `--sim-font-*`.
// ============================================================

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import { auth } from '../../../lib/firebase';
import { leggiSuperAdmin, ProfiloSuperAdmin } from '../../../data/superadmin';

// ------------------------------------------------------------
// FORMATTAZIONE
// ------------------------------------------------------------

function conMigliaia(interoSenzaSegno: string): string {
  let fuori = '';
  let contati = 0;
  for (let i = interoSenzaSegno.length - 1; i >= 0; i -= 1) {
    fuori = interoSenzaSegno[i] + fuori;
    contati += 1;
    if (contati % 3 === 0 && i > 0) fuori = `.${fuori}`;
  }
  return fuori;
}

function fmtInt(n: number): string {
  const arrotondato = Math.round(Number.isFinite(n) ? n : 0);
  const segno = arrotondato < 0 ? '-' : '';
  return segno + conMigliaia(String(Math.abs(arrotondato)));
}

function fmtEUR(n: number): string {
  return `${fmtInt(n)} €`;
}

function fmtEUR2(n: number): string {
  const valore = Number.isFinite(n) ? n : 0;
  const segno = valore < 0 ? '-' : '';
  const centesimi = Math.round(Math.abs(valore) * 100);
  const intero = Math.floor(centesimi / 100);
  const resto = centesimi % 100;
  return `${segno}${conMigliaia(String(intero))},${String(resto).padStart(2, '0')} €`;
}

function unDecimale(n: number): string {
  const decimi = Math.round(n * 10);
  return `${Math.floor(decimi / 10)},${decimi % 10}`;
}

function dueDecimali(n: number): string {
  const centesimi = Math.round(n * 100);
  const intero = Math.floor(centesimi / 100);
  const resto = centesimi % 100;
  return `${intero},${String(resto).padStart(2, '0')}`;
}

// ------------------------------------------------------------
// FOGLIO DI STILE — tutto sotto `.sim-modelli`
// ------------------------------------------------------------

const CSS = `
.sim-modelli{
  --sim-green-900:#0f2e21;
  --sim-green-800:#153826;
  --sim-green-700:#1c4a35;
  --sim-green-600:#26603f;
  --sim-gold:#cda45e;
  --sim-gold-soft:#e4c890;
  --sim-cream:#f7f4ec;
  --sim-cream-2:#efe9da;
  --sim-ink:#1a1f1c;
  --sim-ink-soft:#5a6259;
  --sim-line:#d8d2c2;
  --sim-warn:#8c3a2b;
  --sim-amber:#b8862f;
  --sim-good:#2f6b4f;
  --sim-font-display:'Fraunces', Georgia, serif;
  --sim-font-body:'Inter', -apple-system, sans-serif;
  --sim-font-mono:'IBM Plex Mono', 'SF Mono', monospace;

  min-height:100vh;
  background:var(--sim-cream);
  color:var(--sim-ink);
  font-family:var(--sim-font-body);
  line-height:1.5;
  -webkit-font-smoothing:antialiased;
}
.sim-modelli *{ box-sizing:border-box; }
.sim-wrap{ max-width:1180px; margin:0 auto; padding:0 24px 64px; }

/* HEADER / SCOREBOARD */
.sim-modelli .sim-header{
  background:linear-gradient(160deg, var(--sim-green-900) 0%, var(--sim-green-800) 100%);
  color:var(--sim-cream); padding:24px 24px 28px; margin-bottom:8px;
}
.sim-modelli .sim-header-inner{ max-width:1180px; margin:0 auto; }
.sim-modelli .sim-torna{
  display:inline-block; font-family:var(--sim-font-mono); font-size:11px;
  letter-spacing:.12em; text-transform:uppercase; color:var(--sim-gold-soft);
  border:1px solid rgba(205,164,94,.45); border-radius:20px; padding:5px 12px;
  margin-bottom:16px; background:transparent; cursor:pointer; text-decoration:none;
}
.sim-modelli .sim-torna:hover{ background:rgba(205,164,94,.14); }
.sim-modelli .sim-eyebrow{
  font-family:var(--sim-font-mono); font-size:11px; letter-spacing:.18em; text-transform:uppercase;
  color:var(--sim-gold-soft); margin:0 0 6px;
}
.sim-modelli .sim-h1{
  font-family:var(--sim-font-display); font-weight:600; font-size:clamp(26px,4vw,38px);
  margin:0 0 4px; letter-spacing:-.01em; text-transform:none; line-height:1.15;
}
.sim-modelli .sim-sub{
  font-family:var(--sim-font-body); color:#c9d4cb; font-size:14.5px;
  margin:0 0 26px; max-width:640px; line-height:1.5;
}
.sim-modelli .sim-scoreboard{
  display:grid; grid-template-columns:repeat(3,1fr); border:1px solid rgba(205,164,94,.35);
  border-radius:10px; overflow:hidden; background:rgba(0,0,0,.15);
}
.sim-modelli .sim-score-cell{ padding:16px 18px; border-right:1px solid rgba(205,164,94,.25); position:relative; }
.sim-modelli .sim-score-cell:last-child{ border-right:none; }
.sim-modelli .sim-score-cell .sim-label{
  font-family:var(--sim-font-mono); font-size:10.5px; letter-spacing:.14em; text-transform:uppercase;
  color:var(--sim-gold-soft); display:flex; justify-content:space-between; align-items:center;
}
.sim-modelli .sim-score-cell .sim-value{
  font-family:var(--sim-font-mono); font-size:clamp(22px,3vw,30px); font-weight:600; color:#fff; margin-top:6px;
  font-variant-numeric:tabular-nums;
}
.sim-modelli .sim-score-cell .sim-value small{ font-size:13px; color:#a8b6ac; font-weight:400; margin-left:4px; }
.sim-modelli .sim-badge{
  font-family:var(--sim-font-mono); font-size:9.5px; padding:2px 6px; border-radius:20px; letter-spacing:.05em;
}
.sim-modelli .sim-badge.leader{ background:var(--sim-gold); color:var(--sim-green-900); font-weight:700; }
.sim-modelli .sim-badge.dim{ background:rgba(255,255,255,.08); color:#8fa094; }

/* SEZIONI */
.sim-modelli .sim-section{ padding-top:36px; }
.sim-modelli .sim-section-head{ display:flex; align-items:baseline; gap:10px; margin-bottom:18px; }
.sim-modelli .sim-section-head .sim-num{ font-family:var(--sim-font-mono); color:var(--sim-gold); font-size:13px; font-weight:600; }
.sim-modelli .sim-section-head h2{
  font-family:var(--sim-font-display); font-size:20px; font-weight:600; margin:0;
  text-transform:none; letter-spacing:0; line-height:1.2;
}
.sim-modelli .sim-section-head .sim-hint{ font-size:12.5px; color:var(--sim-ink-soft); margin-left:auto; }

.sim-modelli .sim-card{
  background:#fff; border:1px solid var(--sim-line); border-radius:12px; padding:22px 24px;
}

/* PROFILO */
.sim-modelli .sim-profile-grid{ display:grid; grid-template-columns:repeat(3,1fr); gap:22px; }
@media (max-width:900px){ .sim-modelli .sim-profile-grid{ grid-template-columns:repeat(2,1fr); } }
@media (max-width:560px){ .sim-modelli .sim-profile-grid{ grid-template-columns:1fr; } }

.sim-modelli .sim-field{ display:flex; flex-direction:column; gap:8px; }
.sim-modelli .sim-field-label{ font-size:12.5px; color:var(--sim-ink-soft); display:flex; justify-content:space-between; align-items:baseline; }
.sim-modelli .sim-field-label span.sim-name{ font-weight:600; color:var(--sim-ink); }
.sim-modelli .sim-field-label span.sim-val{ font-family:var(--sim-font-mono); font-weight:600; color:var(--sim-green-700); font-size:13px; }

.sim-modelli input[type=range]{
  -webkit-appearance:none; appearance:none; width:100%; height:4px; border-radius:3px;
  background:var(--sim-line); outline:none; margin:6px 0 2px;
}
.sim-modelli input[type=range]::-webkit-slider-thumb{
  -webkit-appearance:none; width:17px; height:17px; border-radius:50%;
  background:var(--sim-gold); border:2px solid var(--sim-green-900); cursor:pointer;
  box-shadow:0 1px 3px rgba(0,0,0,.25);
}
.sim-modelli input[type=range]::-moz-range-thumb{
  width:15px; height:15px; border-radius:50%; background:var(--sim-gold);
  border:2px solid var(--sim-green-900); cursor:pointer;
}
.sim-modelli .sim-range-ticks{ display:flex; justify-content:space-between; font-family:var(--sim-font-mono); font-size:10px; color:#a19c8c; }

/* MODELLI */
.sim-modelli .sim-models-grid{ display:grid; grid-template-columns:repeat(3,1fr); gap:18px; align-items:start; }
@media (max-width:980px){ .sim-modelli .sim-models-grid{ grid-template-columns:1fr; } }

.sim-modelli .sim-model-card{ border-radius:14px; overflow:hidden; border:1px solid var(--sim-line); background:#fff; }
.sim-modelli .sim-model-head{ padding:16px 20px; display:flex; justify-content:space-between; align-items:center; }
.sim-modelli .sim-model-head.a{ background:var(--sim-green-700); }
.sim-modelli .sim-model-head.b{ background:var(--sim-green-600); }
.sim-modelli .sim-model-head.c{ background:#3a4f42; }
.sim-modelli .sim-model-head .sim-tag{ font-family:var(--sim-font-mono); font-size:11px; color:var(--sim-gold-soft); letter-spacing:.08em; }
.sim-modelli .sim-model-head h3{
  font-family:var(--sim-font-display); color:#fff; font-size:19px; margin:2px 0 0;
  text-transform:none; font-weight:600; letter-spacing:0;
}
.sim-modelli .sim-model-body{ padding:18px 20px 20px; display:flex; flex-direction:column; gap:16px; }

.sim-modelli .sim-toggle-row{ display:flex; gap:6px; }
.sim-modelli .sim-toggle-btn{
  flex:1; text-align:center; font-family:var(--sim-font-mono); font-size:11.5px; padding:7px 4px;
  border:1px solid var(--sim-line); border-radius:7px; cursor:pointer; background:var(--sim-cream);
  color:var(--sim-ink-soft); transition:.12s;
}
.sim-modelli .sim-toggle-btn.active{ background:var(--sim-green-800); color:#fff; border-color:var(--sim-green-800); }

.sim-modelli select{
  width:100%; padding:8px 10px; border:1px solid var(--sim-line); border-radius:7px;
  font-family:var(--sim-font-body); font-size:13px; background:#fff; color:var(--sim-ink);
}

.sim-modelli .sim-output-block{
  background:var(--sim-cream-2); border-radius:10px; padding:14px 16px; margin-top:2px;
}
.sim-modelli .sim-output-row{ display:flex; justify-content:space-between; align-items:baseline; padding:5px 0; font-size:13px; gap:10px; }
.sim-modelli .sim-output-row + .sim-output-row{ border-top:1px dashed var(--sim-line); }
.sim-modelli .sim-output-row .sim-k{ color:var(--sim-ink-soft); }
.sim-modelli .sim-output-row .sim-v{ font-family:var(--sim-font-mono); font-weight:600; text-align:right; }
.sim-modelli .sim-output-row.sim-primary .sim-v{ font-size:17px; color:var(--sim-green-700); }
.sim-modelli .sim-flag{ font-size:11.5px; padding:8px 10px; border-radius:7px; margin-top:4px; line-height:1.4; }
.sim-modelli .sim-flag.warn{ background:#f6e8e2; color:var(--sim-warn); }
.sim-modelli .sim-flag.amber{ background:#f7edd9; color:var(--sim-amber); }
.sim-modelli .sim-flag.good{ background:#e4efe6; color:var(--sim-good); }

/* CONFRONTO */
.sim-modelli .sim-compare-card{ padding:24px; }
.sim-modelli .sim-bars{ display:flex; flex-direction:column; gap:14px; margin-bottom:20px; }
.sim-modelli .sim-bar-row{ display:grid; grid-template-columns:90px 1fr 100px; align-items:center; gap:12px; }
.sim-modelli .sim-bar-row .sim-name{ font-family:var(--sim-font-mono); font-size:12.5px; font-weight:600; }
.sim-modelli .sim-bar-track{ height:22px; background:var(--sim-cream-2); border-radius:6px; overflow:hidden; }
.sim-modelli .sim-bar-fill{ height:100%; border-radius:6px; transition:width .25s ease; }
.sim-modelli .sim-bar-fill.a{ background:linear-gradient(90deg,var(--sim-green-700),var(--sim-green-600)); }
.sim-modelli .sim-bar-fill.b{ background:linear-gradient(90deg,var(--sim-green-600),#4d7a5f); }
.sim-modelli .sim-bar-fill.c{ background:linear-gradient(90deg,#3a4f42,#5c7466); }
.sim-modelli .sim-bar-row .sim-num-bar{ font-family:var(--sim-font-mono); font-size:13px; text-align:right; font-weight:600; }

.sim-modelli .sim-breakeven-grid{ display:grid; grid-template-columns:1fr 1fr; gap:16px; }
@media (max-width:700px){ .sim-modelli .sim-breakeven-grid{ grid-template-columns:1fr; } }
.sim-modelli .sim-be-box{ background:var(--sim-cream-2); border-radius:10px; padding:16px 18px; }
.sim-modelli .sim-be-box .sim-be-title{ font-family:var(--sim-font-mono); font-size:11px; text-transform:uppercase; letter-spacing:.08em; color:var(--sim-ink-soft); margin-bottom:6px; }
.sim-modelli .sim-be-box .sim-be-value{ font-family:var(--sim-font-mono); font-size:20px; font-weight:600; color:var(--sim-green-800); }
.sim-modelli .sim-be-box .sim-be-note{ font-size:12.5px; color:var(--sim-ink-soft); margin-top:4px; line-height:1.4; }

.sim-modelli .sim-footer{ text-align:center; padding:36px 0 8px; font-size:11.5px; color:#a19c8c; font-family:var(--sim-font-mono); }
`;

// ------------------------------------------------------------
// LE LEVE
// ------------------------------------------------------------

const FORMULE_BANNER = [
  { valore: 475, testo: 'Base annuale — stima 475 €' },
  { valore: 800, testo: 'Premium annuale — stima 800 €' },
  { valore: 1680, testo: 'Vetrina mensile — stima 1.680 €' },
  { valore: 1440, testo: 'Mista (consigliata) — stima 1.440 €' },
];

interface Stato {
  soci: number; prezzoOra: number; oreAnno: number;
  faseA: 'agevolata' | 'regime'; quotaAgevolata: number; quotaRegime: number;
  bannerFormula: number; gestioneA: 'locale' | 'centralizzata'; splitRF: number;
  prezzoAbb: number; tassoConv: number; faseB: 'anno1' | 'dopo';
  ristoroAnno1: number; ristoroDopo: number;
  commissionePct: number; chiPaga: 'circolo' | 'socio';
}

const PARTENZA: Stato = {
  soci: 150, prezzoOra: 6, oreAnno: 4380,
  faseA: 'agevolata', quotaAgevolata: 150, quotaRegime: 280,
  bannerFormula: 1440, gestioneA: 'centralizzata', splitRF: 100,
  prezzoAbb: 10, tassoConv: 47, faseB: 'anno1', ristoroAnno1: 5, ristoroDopo: 5,
  commissionePct: 2, chiPaga: 'socio',
};

function Cursore({
  etichetta, valoreScritto, min, max, passo, valore, cambia, tacche, disabilitato,
}: {
  etichetta: string; valoreScritto?: string;
  min: number; max: number; passo: number; valore: number;
  cambia: (n: number) => void;
  tacche?: [string, string]; disabilitato?: boolean;
}) {
  return (
    <div className="sim-field" style={disabilitato ? { opacity: 0.35 } : undefined}>
      <div className="sim-field-label">
        <span className="sim-name">{etichetta}</span>
        {valoreScritto !== undefined ? <span className="sim-val">{valoreScritto}</span> : null}
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={passo}
        value={valore}
        disabled={disabilitato}
        onChange={(e) => cambia(parseFloat(e.target.value))}
      />
      {tacche ? (
        <div className="sim-range-ticks"><span>{tacche[0]}</span><span>{tacche[1]}</span></div>
      ) : null}
    </div>
  );
}

function Interruttore<T extends string>({
  etichetta, valore, scelte, cambia,
}: {
  etichetta: string; valore: T;
  scelte: { val: T; testo: string }[];
  cambia: (v: T) => void;
}) {
  return (
    <div className="sim-field">
      <div className="sim-field-label"><span className="sim-name">{etichetta}</span></div>
      <div className="sim-toggle-row">
        {scelte.map((s) => (
          <button
            key={s.val}
            type="button"
            className={`sim-toggle-btn${valore === s.val ? ' active' : ''}`}
            onClick={() => cambia(s.val)}
          >
            {s.testo}
          </button>
        ))}
      </div>
    </div>
  );
}

// ------------------------------------------------------------
// PAGINA
// ------------------------------------------------------------

export default function PaginaModelliRevenue() {
  const router = useRouter();
  const [profilo, setProfilo] = useState<ProfiloSuperAdmin | null>(null);
  const [caricando, setCaricando] = useState(true);
  const [erroreAvvio, setErroreAvvio] = useState('');
  const [s, setS] = useState<Stato>(PARTENZA);

  const tocca = <K extends keyof Stato>(chiave: K, valore: Stato[K]) =>
    setS((prec) => ({ ...prec, [chiave]: valore }));

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user: User | null) => {
      setErroreAvvio('');
      if (!user) {
        router.replace('/superadmin/login');
        return;
      }
      let p: ProfiloSuperAdmin | null = null;
      try {
        p = await leggiSuperAdmin(user.uid);
      } catch {
        setErroreAvvio(
          'Non riesco a leggere il tuo profilo Super Admin. Può essere la connessione, '
          + 'oppure un permesso: esci e rientra, e se il problema resta va guardato.',
        );
        setCaricando(false);
        return;
      }
      if (!p) {
        try { await signOut(auth); } catch { /* si esce comunque */ }
        router.replace('/superadmin/login');
        return;
      }
      setProfilo(p);
      setCaricando(false);
    });
    return unsub;
  }, [router]);

  // ⚠️ I CONTI STANNO IN UN `useMemo` E NON DENTRO IL JSX. Non per
  // velocità — sono tre moltiplicazioni — ma perché così esistono una
  // volta sola, con un nome, nell'ordine in cui li ragiona chi legge il
  // documento ABC. Sparpagliati fra gli attributi diventano tre copie
  // della stessa formula che il giorno che cambia una, cambia in due
  // posti su tre.
  const conti = useMemo(() => {
    const bannerScaled = s.bannerFormula * (s.soci / 200);

    // MODELLO A
    const quotaSel = s.faseA === 'agevolata' ? s.quotaAgevolata : s.quotaRegime;
    const ricavoBannerRF = s.gestioneA === 'centralizzata' ? (bannerScaled * s.splitRF) / 100 : 0;
    const ricavoBannerCircolo = bannerScaled - ricavoBannerRF;
    const ricavoA = quotaSel + ricavoBannerRF;
    const costoCircoloA = quotaSel - ricavoBannerCircolo;
    const perSocioA = costoCircoloA / s.soci;

    // MODELLO B
    const sociPaganti = (s.soci * s.tassoConv) / 100;
    const ricavoB = s.prezzoAbb * sociPaganti;
    const ristoroSel = s.faseB === 'anno1' ? s.ristoroAnno1 : s.ristoroDopo;
    const costoSocioB = s.prezzoAbb - ristoroSel;

    // MODELLO C
    const commOra = (s.prezzoOra * s.commissionePct) / 100;
    const ricavoC = commOra * s.oreAnno;
    const nuovoPrezzo = s.chiPaga === 'socio' ? s.prezzoOra + commOra : s.prezzoOra;

    const massimo = Math.max(ricavoA, ricavoB, ricavoC);
    const maxBar = Math.max(ricavoA, ricavoB, ricavoC, 1);

    const sociBE = ricavoA > 0 ? quotaSel / s.prezzoAbb : 0;
    const oreBE = commOra > 0 ? quotaSel / commOra : 0;

    return {
      quotaSel, ricavoA, costoCircoloA, perSocioA,
      sociPaganti, ricavoB, costoSocioB,
      commOra, ricavoC, nuovoPrezzo,
      massimo, maxBar, sociBE, oreBE,
    };
  }, [s]);

  if (erroreAvvio) {
    return (
      <div className="admin-splash">
        <div className="logo-mark" aria-hidden="true" />
        <p style={{
          marginTop: '1rem', maxWidth: '32rem', color: '#FF8A80',
          fontSize: '.95rem', lineHeight: 1.5, textAlign: 'center',
        }}
        >
          {erroreAvvio}
        </p>
        <div style={{ display: 'flex', gap: '.6rem', marginTop: '1.2rem' }}>
          <button className="btn" onClick={() => window.location.reload()}>Riprova</button>
          <button
            className="btn btn-outline"
            onClick={async () => {
              try { await signOut(auth); } catch { /* si va al login comunque */ }
              router.replace('/superadmin/login');
            }}
          >
            Esci
          </button>
        </div>
      </div>
    );
  }

  if (caricando || !profilo) {
    return (
      <div className="admin-splash">
        <div className="logo-mark" aria-hidden="true" />
        <p className="mono" style={{ marginTop: '1rem', opacity: 0.8 }}>Caricamento…</p>
      </div>
    );
  }

  const badge = (valore: number) => (valore === conti.massimo
    ? { classe: 'sim-badge leader', testo: 'PIÙ ALTO' }
    : { classe: 'sim-badge dim', testo: '' });

  const badgeA = badge(conti.ricavoA);
  const badgeB = badge(conti.ricavoB);
  const badgeC = badge(conti.ricavoC);

  const flagA = s.gestioneA === 'locale'
    ? {
      classe: 'sim-flag good',
      testo: 'Banner locale: ricavo RF limitato alla sola quota, ma zero attrito e zero lavoro commerciale RF.',
    }
    : {
      classe: 'sim-flag amber',
      testo: 'Il ricavo banner centralizzato richiede ~30 min/settimana di lavoro commerciale continuativo — non è passivo.',
    };

  const flagB = s.tassoConv >= 47
    ? {
      classe: 'sim-flag amber',
      testo: "Tasso ≥47% (70/150 soci): è l'obiettivo del documento, non l'atteso — trattare come scenario ottimistico.",
    }
    : {
      classe: 'sim-flag good',
      testo: 'Scenario entro il range prudente (20-40 soci su 150) indicato in pianificazione interna.',
    };

  return (
    <div className="sim-modelli">
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,600;9..144,700&family=Inter:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap"
      />
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      <div className="sim-header">
        <div className="sim-header-inner">
          <Link className="sim-torna" href="/superadmin/dashboard">← Torna alla dashboard</Link>
          <p className="sim-eyebrow">Racket Fever · Modello Operativo</p>
          <h1 className="sim-h1">Simulatore Modelli di Revenue</h1>
          <p className="sim-sub">
            Sposta i cursori per il profilo del circolo e per ciascun modello: i ricavi si
            ricalcolano in tempo reale. Basato sul Documento Consolidato ABC.
          </p>

          <div className="sim-scoreboard">
            <div className="sim-score-cell">
              <div className="sim-label">
                <span>Modello A</span>
                <span className={badgeA.classe}>{badgeA.testo}</span>
              </div>
              <div className="sim-value">{fmtEUR(conti.ricavoA)}<small>/anno RF</small></div>
            </div>
            <div className="sim-score-cell">
              <div className="sim-label">
                <span>Modello B</span>
                <span className={badgeB.classe}>{badgeB.testo}</span>
              </div>
              <div className="sim-value">{fmtEUR(conti.ricavoB)}<small>/anno RF</small></div>
            </div>
            <div className="sim-score-cell">
              <div className="sim-label">
                <span>Modello C</span>
                <span className={badgeC.classe}>{badgeC.testo}</span>
              </div>
              <div className="sim-value">{fmtEUR(conti.ricavoC)}<small>/anno RF</small></div>
            </div>
          </div>
        </div>
      </div>

      <div className="sim-wrap">

        {/* PROFILO CIRCOLO */}
        <div className="sim-section">
          <div className="sim-section-head">
            <span className="sim-num">01</span>
            <h2>Profilo del circolo</h2>
            <span className="sim-hint">variabili esogene — non decise da RF</span>
          </div>
          <div className="sim-card">
            <div className="sim-profile-grid">
              <Cursore
                etichetta="Soci"
                valoreScritto={fmtInt(s.soci)}
                min={50} max={350} passo={5}
                valore={s.soci}
                cambia={(n) => tocca('soci', n)}
                tacche={['50', '350']}
              />
              <Cursore
                etichetta="Prezzo orario campo"
                valoreScritto={`${dueDecimali(s.prezzoOra)} €`}
                min={3} max={15} passo={0.5}
                valore={s.prezzoOra}
                cambia={(n) => tocca('prezzoOra', n)}
                tacche={['3 €', '15 €']}
              />
              <Cursore
                etichetta="Ore prenotate/anno"
                valoreScritto={fmtInt(s.oreAnno)}
                min={1000} max={8000} passo={100}
                valore={s.oreAnno}
                cambia={(n) => tocca('oreAnno', n)}
                tacche={['1.000', '8.000']}
              />
            </div>
          </div>
        </div>

        {/* MODELLI */}
        <div className="sim-section">
          <div className="sim-section-head">
            <span className="sim-num">02</span>
            <h2>Leve per modello</h2>
            <span className="sim-hint">variabili decise da RF</span>
          </div>

          <div className="sim-models-grid">

            {/* MODELLO A */}
            <div className="sim-model-card">
              <div className="sim-model-head a">
                <div>
                  <div className="sim-tag">QUOTA CIRCOLO</div>
                  <h3>Modello A</h3>
                </div>
              </div>
              <div className="sim-model-body">
                <Interruttore
                  etichetta="Fascia quota"
                  valore={s.faseA}
                  scelte={[
                    { val: 'agevolata', testo: 'Agevolata Anno 1' },
                    { val: 'regime', testo: 'A regime' },
                  ]}
                  cambia={(v) => tocca('faseA', v)}
                />

                <Cursore
                  etichetta="Quota agevolata"
                  valoreScritto={`${fmtInt(s.quotaAgevolata)} €`}
                  min={0} max={300} passo={10}
                  valore={s.quotaAgevolata}
                  cambia={(n) => tocca('quotaAgevolata', n)}
                />
                <Cursore
                  etichetta="Quota a regime"
                  valoreScritto={`${fmtInt(s.quotaRegime)} €`}
                  min={150} max={500} passo={10}
                  valore={s.quotaRegime}
                  cambia={(n) => tocca('quotaRegime', n)}
                />

                <div className="sim-field">
                  <div className="sim-field-label"><span className="sim-name">Formula banner</span></div>
                  <select
                    value={s.bannerFormula}
                    onChange={(e) => tocca('bannerFormula', parseInt(e.target.value, 10))}
                  >
                    {FORMULE_BANNER.map((f) => (
                      <option key={f.valore} value={f.valore}>{f.testo}</option>
                    ))}
                  </select>
                </div>

                <Interruttore
                  etichetta="Gestione banner"
                  valore={s.gestioneA}
                  scelte={[
                    { val: 'locale', testo: 'Locale (circolo)' },
                    { val: 'centralizzata', testo: 'Centralizzata RF' },
                  ]}
                  cambia={(v) => tocca('gestioneA', v)}
                />

                {/* ⚠️ Spenta, non nascosta, quando il banner lo gestisce
                    il circolo: sparire e riapparire farebbe saltare la
                    colonna a ogni tocco, e chi guarda perderebbe di
                    vista che la leva esiste ed è a zero. */}
                <Cursore
                  etichetta="Quota RF sul banner"
                  valoreScritto={`${fmtInt(s.splitRF)}%`}
                  min={0} max={100} passo={5}
                  valore={s.splitRF}
                  cambia={(n) => tocca('splitRF', n)}
                  disabilitato={s.gestioneA === 'locale'}
                />

                <div className="sim-output-block">
                  <div className="sim-output-row sim-primary">
                    <span className="sim-k">Ricavo RF/anno</span>
                    <span className="sim-v">{fmtEUR(conti.ricavoA)}</span>
                  </div>
                  <div className="sim-output-row">
                    <span className="sim-k">
                      {conti.costoCircoloA >= 0 ? 'Costo netto circolo/anno' : 'Guadagno netto circolo/anno'}
                    </span>
                    <span className="sim-v">
                      {conti.costoCircoloA >= 0
                        ? fmtEUR(conti.costoCircoloA)
                        : `${fmtEUR(Math.abs(conti.costoCircoloA))} (banner copre tutto)`}
                    </span>
                  </div>
                  <div className="sim-output-row">
                    <span className="sim-k">Impatto per socio</span>
                    <span className="sim-v">{fmtEUR2(Math.max(conti.perSocioA, 0))}</span>
                  </div>
                </div>
                <div className={flagA.classe}>{flagA.testo}</div>
              </div>
            </div>

            {/* MODELLO B */}
            <div className="sim-model-card">
              <div className="sim-model-head b">
                <div>
                  <div className="sim-tag">ABBONAMENTO SOCIO</div>
                  <h3>Modello B</h3>
                </div>
              </div>
              <div className="sim-model-body">
                <Cursore
                  etichetta="Prezzo abbonamento"
                  valoreScritto={`${fmtInt(s.prezzoAbb)} €/anno`}
                  min={5} max={20} passo={1}
                  valore={s.prezzoAbb}
                  cambia={(n) => tocca('prezzoAbb', n)}
                />
                <Cursore
                  etichetta="Tasso di conversione soci"
                  valoreScritto={`${fmtInt(s.tassoConv)}%`}
                  min={10} max={80} passo={1}
                  valore={s.tassoConv}
                  cambia={(n) => tocca('tassoConv', n)}
                  tacche={['scenario prudente', 'scenario attivo']}
                />

                <Interruttore
                  etichetta="Fase"
                  valore={s.faseB}
                  scelte={[
                    { val: 'anno1', testo: 'Anno 1' },
                    { val: 'dopo', testo: 'Anni successivi' },
                  ]}
                  cambia={(v) => tocca('faseB', v)}
                />

                <Cursore
                  etichetta="Ristoro Anno 1"
                  valoreScritto={`${fmtInt(s.ristoroAnno1)} €`}
                  min={0} max={10} passo={1}
                  valore={s.ristoroAnno1}
                  cambia={(n) => tocca('ristoroAnno1', n)}
                />
                <Cursore
                  etichetta="Ristoro anni successivi"
                  valoreScritto={`${fmtInt(s.ristoroDopo)} €`}
                  min={0} max={10} passo={1}
                  valore={s.ristoroDopo}
                  cambia={(n) => tocca('ristoroDopo', n)}
                />

                <div className="sim-output-block">
                  <div className="sim-output-row sim-primary">
                    <span className="sim-k">Ricavo RF/anno</span>
                    <span className="sim-v">{fmtEUR(conti.ricavoB)}</span>
                  </div>
                  <div className="sim-output-row">
                    <span className="sim-k">Soci paganti stimati</span>
                    <span className="sim-v">{fmtInt(conti.sociPaganti)}</span>
                  </div>
                  <div className="sim-output-row">
                    <span className="sim-k">Costo netto per socio</span>
                    <span className="sim-v">{fmtEUR2(conti.costoSocioB)}</span>
                  </div>
                </div>
                <div className={flagB.classe}>{flagB.testo}</div>
              </div>
            </div>

            {/* MODELLO C */}
            <div className="sim-model-card">
              <div className="sim-model-head c">
                <div>
                  <div className="sim-tag">COMMISSIONE SULL&apos;USO</div>
                  <h3>Modello C</h3>
                </div>
              </div>
              <div className="sim-model-body">
                <Cursore
                  etichetta="Commissione"
                  valoreScritto={`${unDecimale(s.commissionePct)}%`}
                  min={1} max={5} passo={0.1}
                  valore={s.commissionePct}
                  cambia={(n) => tocca('commissionePct', n)}
                />

                <Interruttore
                  etichetta="Chi assorbe il costo"
                  valore={s.chiPaga}
                  scelte={[
                    { val: 'circolo', testo: 'Il circolo' },
                    { val: 'socio', testo: 'Il socio' },
                  ]}
                  cambia={(v) => tocca('chiPaga', v)}
                />

                <div className="sim-output-block">
                  <div className="sim-output-row sim-primary">
                    <span className="sim-k">Ricavo RF/anno</span>
                    <span className="sim-v">{fmtEUR(conti.ricavoC)}</span>
                  </div>
                  <div className="sim-output-row">
                    <span className="sim-k">Commissione per ora</span>
                    <span className="sim-v">{fmtEUR2(conti.commOra)}</span>
                  </div>
                  <div className="sim-output-row">
                    <span className="sim-k">Nuovo prezzo orario</span>
                    <span className="sim-v">{fmtEUR2(conti.nuovoPrezzo)}</span>
                  </div>
                </div>
                <div className="sim-flag warn">
                  Non proponibile finché Giorgio non conferma tracciabilità prenotazioni e
                  meccanismo di addebito.
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* CONFRONTO */}
        <div className="sim-section">
          <div className="sim-section-head">
            <span className="sim-num">03</span>
            <h2>Confronto e punti di indifferenza</h2>
          </div>
          <div className="sim-card sim-compare-card">
            <div className="sim-bars">
              {([
                { nome: 'MODELLO A', classe: 'a', valore: conti.ricavoA },
                { nome: 'MODELLO B', classe: 'b', valore: conti.ricavoB },
                { nome: 'MODELLO C', classe: 'c', valore: conti.ricavoC },
              ]).map((riga) => (
                <div className="sim-bar-row" key={riga.nome}>
                  <div className="sim-name">{riga.nome}</div>
                  <div className="sim-bar-track">
                    <div
                      className={`sim-bar-fill ${riga.classe}`}
                      style={{ width: `${((riga.valore / conti.maxBar) * 100).toFixed(1)}%` }}
                    />
                  </div>
                  <div className="sim-num-bar">{fmtEUR(riga.valore)}</div>
                </div>
              ))}
            </div>

            <div className="sim-breakeven-grid">
              <div className="sim-be-box">
                <div className="sim-be-title">Soci paganti necessari perché B eguagli A</div>
                <div className="sim-be-value">{fmtInt(conti.sociBE)} soci</div>
                <div className="sim-be-note">
                  {conti.sociPaganti >= conti.sociBE
                    ? `Con ${fmtInt(conti.sociPaganti)} soci paganti attuali, B supera già A.`
                    : `Con ${fmtInt(conti.sociPaganti)} soci paganti attuali, B resta sotto A di ${fmtEUR(conti.ricavoA - conti.ricavoB)}.`}
                </div>
              </div>
              <div className="sim-be-box">
                <div className="sim-be-title">Ore/anno necessarie perché C eguagli A</div>
                <div className="sim-be-value">{fmtInt(conti.oreBE)} ore</div>
                <div className="sim-be-note">
                  {s.oreAnno >= conti.oreBE
                    ? `Con ${fmtInt(s.oreAnno)} ore/anno attuali, C supera già A.`
                    : `Con ${fmtInt(s.oreAnno)} ore/anno attuali, C resta sotto A di ${fmtEUR(conti.ricavoA - conti.ricavoC)}.`}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="sim-footer">
          RACKET FEVER — SIMULATORE INTERNO — VALORI DI LAVORO, DA VALIDARE CON GIORGIO PRIMA
          DELL&apos;USO IN TRATTATIVA
        </div>
      </div>
    </div>
  );
}
