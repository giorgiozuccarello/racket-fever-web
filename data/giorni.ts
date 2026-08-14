// ============================================================
// GIORNI E LINK — le poche funzioni che due parti dell'app devono
// per forza calcolare allo stesso modo.
//
// ⚠️ PERCHE' STANNO IN UN FILE LORO. Nascono dentro i Tornei, e la
// tentazione, arrivando alla Bacheca, era di ricopiarle: sono cinque
// righe l'una. Ma la data e' proprio il posto in cui una copia si
// stacca dall'originale senza che nessuno se ne accorga — e' gia'
// successo con i quindici giorni di coda sommati in millisecondi, che
// nella notte del cambio d'ora facevano sparire un torneo un giorno
// prima del dovuto. Una volta l'anno, e impossibile da spiegare a chi
// lo vedeva.
//
// `tornei.ts` continua a esportarle come prima, cosi' chi le
// importava di la' non ha dovuto cambiare una riga.
// ============================================================

export const MESI = [
  'gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno',
  'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre',
];

// 'YYYY-MM-DD' → istante locale di INIZIO giornata. Mai new Date con la
// Z: il confronto e' con l'orologio di chi guarda, non con Greenwich.
export function giornoDi(iso: string): Date {
  return new Date(`${iso}T00:00:00`);
}

export function soloGiorno(d: Date): Date {
  const x = new Date(d.getTime());
  x.setHours(0, 0, 0, 0);
  return x;
}

export function oggiIso(adesso: Date = new Date()): string {
  return isoDi(soloGiorno(adesso));
}

export function isoDi(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const gg = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${gg}`;
}

// ⚠️ Si aggiunge ai GIORNI, non ai millisecondi. Sommare trenta volte
// ventiquattro ore sembra la stessa cosa e non lo e': la notte in cui
// torna l'ora solare dura venticinque ore, e il conto perde un giorno.
export function fraGiorni(da: string, quanti: number): string {
  const d = giornoDi(da);
  d.setDate(d.getDate() + quanti);
  return isoDi(d);
}

// Una data scritta a mano e' davvero una data? La forma non basta:
// "2026-13-45" ha la forma giusta e non esiste, e "2026-02-30"
// JavaScript la trasforma in silenzio nel 2 marzo. Il giro completo —
// costruisci e riscrivi — e' l'unico controllo che le prende tutte.
export function dataScrittaBene(v: string): boolean {
  const pulito = (v ?? '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(pulito)) return false;
  const d = giornoDi(pulito);
  if (Number.isNaN(d.getTime())) return false;
  return isoDi(d) === pulito;
}

// Nomi a mano e non toLocaleDateString: su Hermes i dati di
// localizzazione possono mancare del tutto, e uscirebbe in inglese o
// con un errore a runtime.
export function giornoBreve(iso: string): string {
  const d = giornoDi(iso);
  return `${d.getDate()} ${MESI[d.getMonth()]}`;
}

export function dataNumerica(iso: string): string {
  const d = giornoDi(iso);
  const gg = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${gg}/${mm}/${d.getFullYear()}`;
}

// Un indirizzo su cui si puo' mandare qualcuno. Serve perche' il link
// lo incolla una persona: senza il protocollo davanti il browser non
// parte, e "www.qualcosa.it" e' esattamente quello che si incolla.
export function linkNavigabile(link?: string | null): string | null {
  const pulito = (link ?? '').trim();
  if (!pulito) return null;
  if (/^https?:\/\//i.test(pulito)) return pulito;
  // ⚠️ Solo indirizzi web. Senza questo controllo un link scritto male
  // — o messo li' apposta — poteva essere un javascript: o un intent:,
  // e aprirlo e' tutto un altro genere di cosa.
  if (/^[a-z][a-z0-9+.-]*:/i.test(pulito)) return null;
  return `https://${pulito}`;
}
