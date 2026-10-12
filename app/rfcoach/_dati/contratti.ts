// ============================================================
// I CONTRATTI — come si leggono a schermo. 12 ottobre 2026.
//
// ⚠️ NIENTE IMPORT: funzioni pure, provate con Node da
// `prove/superadmin.mjs`. Le regole di cio' che si puo' SCRIVERE stanno sul
// server, in `rf-coach/functions/src/superadminRegole.ts`
// (`contrattoSano`, `rinnovato`): qui c'e' solo come si mostra.
//
// ⚠️ IL MODELLO DI BUSINESS DI RF COACH, in una riga: l'app e' gratuita, il
// maestro paga un importo annuale con un contratto annuale rinnovabile,
// fatturato fuori dall'app. Questa pagina e' il solo posto dove si vede chi
// paga, quanto, e fino a quando.
// ============================================================

export type Contratto = {
  spazioId: string;
  inizio: string;
  scadenza: string;
  importoCent: number;
  valuta: string;
  stato: string;
  pagato: boolean;
  note: string;
  aggiornatoIlMs: number;
};

// ⚠️ TRENTA GIORNI: il tempo per chiamare, mandare la fattura e farsela
// pagare prima che scada. Un avviso a sette giorni arriva quando e' gia'
// tardi per tutto tranne che per scusarsi.
export const GIORNI_PREAVVISO = 30;

export type StatoVisto = 'scaduto' | 'inScadenza' | 'daPagare' | 'attivo' | 'inProva' | 'disdetto' | 'senza';

// ⚠️ L'ORDINE E' QUELLO DELLE COSE DA FARE: prima chi e' scaduto, poi chi
// scade, poi chi non ha pagato. Gli attivi in regola stanno in fondo,
// perche' non chiedono niente.
export const ORDINE_STATI: StatoVisto[] = ['scaduto', 'inScadenza', 'daPagare', 'inProva', 'senza', 'attivo', 'disdetto'];

export const DETTO_STATO: Record<StatoVisto, string> = {
  scaduto: 'Scaduto',
  inScadenza: 'In scadenza',
  daPagare: 'Da pagare',
  attivo: 'In regola',
  inProva: 'In prova',
  disdetto: 'Disdetto',
  senza: 'Senza contratto',
};

// La tinta della pastiglia, con le classi di `rfcoach.css`.
export const TINTA_STATO: Record<StatoVisto, string> = {
  scaduto: 'male',
  inScadenza: 'attesa',
  daPagare: 'attesa',
  attivo: 'bene',
  inProva: 'accento',
  disdetto: 'spento',
  senza: 'spento',
};

export function oggiISO(adesso: Date = new Date()): string {
  const a = adesso.getFullYear();
  const m = String(adesso.getMonth() + 1).padStart(2, '0');
  const g = String(adesso.getDate()).padStart(2, '0');
  return `${a}-${m}-${g}`;
}

// Giorni da `oggi` a `data`, tutti e due «AAAA-MM-GG». Negativo se e'
// passata. ⚠️ In UTC, perche' fra due date senza ora l'ora legale non
// deve togliere o aggiungere un giorno.
export function giorniFra(oggi: string, data: string): number {
  const [a1, m1, g1] = oggi.split('-').map(Number);
  const [a2, m2, g2] = data.split('-').map(Number);
  return Math.round((Date.UTC(a2, m2 - 1, g2) - Date.UTC(a1, m1 - 1, g1)) / 86400000);
}

// ============================================================
// LO STATO COME SI VEDE — una cosa sola per contratto.
//
// ⚠️ SCADUTO VINCE SU TUTTO TRANNE DISDETTO: un contratto disdetto e'
// scaduto per definizione, ed e' giusto che non chieda niente. Un contratto
// «in prova» scaduto invece e' una prova finita senza decisione — cioe'
// esattamente la cosa da guardare oggi.
// ============================================================
export function statoVisto(c: Contratto | null | undefined, oggi: string): StatoVisto {
  if (!c) return 'senza';
  if (c.stato === 'disdetto') return 'disdetto';
  const giorni = giorniFra(oggi, c.scadenza);
  if (giorni < 0) return 'scaduto';
  if (c.stato === 'inProva') return 'inProva';
  if (giorni <= GIORNI_PREAVVISO) return 'inScadenza';
  if (!c.pagato) return 'daPagare';
  return 'attivo';
}

// ============================================================
// GLI IMPORTI — nella forma del paese della valuta.
//
// ⚠️ CHF COME IN SVIZZERA: apostrofo per le migliaia, punto per i decimali —
// «CHF 1'250.00», con l'apostrofo dritto come `data/numeri.ts` dell'app (de-CH). EUR come in Italia: «€ 1.250,00». E' la stessa regola delle
// cinque lingue dell'app (de-CH), e il pannello la segue per la stessa
// ragione: un importo scritto nella forma sbagliata si legge sbagliato.
// ============================================================
function migliaia(intero: string, separatore: string): string {
  return intero.replace(/\B(?=(\d{3})+(?!\d))/g, separatore);
}

export function importoScritto(cent: number, valuta: string): string {
  const segno = cent < 0 ? '-' : '';
  const assoluto = Math.abs(Math.round(cent));
  const intero = String(Math.floor(assoluto / 100));
  const decimi = String(assoluto % 100).padStart(2, '0');
  if (valuta === 'EUR') return `${segno}€ ${migliaia(intero, '.')},${decimi}`;
  return `${segno}${valuta || 'CHF'} ${migliaia(intero, "'")}.${decimi}`;
}

// Da quello che si scrive nel campo («950», «950.50», «1'200», «1.200,00») ai
// centesimi. Torna null se non e' un numero.
export function centDaScritto(t: string): number | null {
  let s = String(t ?? '').trim().replace(/[\s'’]/g, '');
  if (!s) return null;
  // «1.200,50» → la virgola e' il decimale, i punti sono migliaia.
  if (/,\d{1,2}$/.test(s)) s = s.replace(/\./g, '').replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
  return Math.round(Number(s) * 100);
}

// ============================================================
// IL TOTALE ANNUO, PER VALUTA — e solo dei contratti che portano soldi.
//
// ⚠️ PER VALUTA, MAI SOMMATI: franchi ed euro nella stessa cifra sarebbero
// un numero che non vuol dire niente, e il mercato e' Italia e Svizzera
// insieme. In prova e disdetti non contano: non sono soldi che arrivano.
// ============================================================
export function totaleAnnuo(contratti: Contratto[]): Record<string, number> {
  const fuori: Record<string, number> = {};
  contratti.forEach((c) => {
    if (c.stato !== 'attivo') return;
    fuori[c.valuta] = (fuori[c.valuta] ?? 0) + c.importoCent;
  });
  return fuori;
}

// La data come la leggono le persone: «31.12.2026».
export function dataScritta(iso: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return '—';
  const [a, m, g] = iso.split('-');
  return `${g}.${m}.${a}`;
}

// Un anno dopo, lo stesso giorno: la scadenza che si propone per un
// contratto nuovo. ⚠️ Gemella di `unAnnoDopo` nel server; qui serve solo a
// riempire il campo, la scadenza vera la controlla la Cloud Function.
export function unAnnoDopo(data: string): string {
  const [a, m, g] = data.split('-').map(Number);
  const ultimo = new Date(Date.UTC(a + 1, m, 0)).getUTCDate();
  return `${a + 1}-${String(m).padStart(2, '0')}-${String(Math.min(g, ultimo)).padStart(2, '0')}`;
}
