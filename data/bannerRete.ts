// ============================================================
// BANNER DI RETE — gli sponsor del Super Admin.
//
// Sono banner che compaiono nella fascia dei circoli SENZA che il
// circolo li carichi, li ordini o li possa togliere: li vende Racket
// Fever, e il circolo non li amministra. Vivono in una collezione
// loro, non nell'array del circolo, e la ragione sta scritta nella
// specifica: dentro l'array, ogni volta che l'Admin carica un suo
// banner rischierebbe di spostare o cancellare i nostri, e per
// cambiare uno sponsor provinciale bisognerebbe riscrivere venti
// circoli uno per uno. Cosi' invece un banner si carica una volta,
// compare ovunque serva, e alla scadenza sparisce da solo.
//
// ⚠️ LA POSIZIONE NELLA ROTAZIONE NON SI SCEGLIE, e non e' una
// semplificazione: e' una garanzia data ai circoli. Un circolo puo'
// aver promesso al proprio Main Sponsor di stare per primo, e un
// banner di rete che si mettesse davanti romperebbe quell'accordo
// senza che nessuno dei due lo sappia. Il Super Admin decide DOVE
// (la copertura) e PER QUANTO (la durata). Il posto lo decide la
// regola di alternanza qui sotto.
// ============================================================

// Quanti banner di rete al massimo possono comparire in UN circolo.
// Oltre, la fascia diventerebbe piu' lunga della pazienza di chi
// guarda.
export const MAX_BANNER_RETE = 10;

export type CoperturaTipo = 'italia' | 'regioni' | 'province';

export interface BannerRete {
  id: string;
  immagineUrl: string;
  // Secondi. Stesso significato che ha per il circolo, MENO lo zero:
  // un banner di rete non puo' prendersi la scena da solo, o
  // spegnerebbe gli sponsor che il circolo ha venduto.
  durata: number;
  copertura: CoperturaTipo;
  regioni?: string[] | null;
  province?: string[] | null;
  // ⚠️ LE ZONE IN UN ARRAY SOLO, ed e' l'unico modo per chiedere a
  // Firestore «dammi i banner che valgono per QUESTO circolo» con una
  // query sola. Dentro ci sono voci come 'ITALIA', 'R:Sicilia',
  // 'P:Messina': il circolo cerca le tre che lo riguardano e trova
  // tutto quello che lo copre, comunque sia stato venduto.
  // Si scrive da sola — vedi zoneDi() — e non si tocca a mano.
  zone: string[];
  // Da quando a quando. Facoltativi: senza, vale sempre.
  daGiorno?: string | null;   // 'YYYY-MM-DD'
  aGiorno?: string | null;    // 'YYYY-MM-DD'
  creatoIlMs?: number;
}

// ⚠️ LA NOTA INTERNA NON STA QUI DENTRO, e non e' un dettaglio di
// ordine. Il documento del banner lo legge OGNI SOCIO di ogni circolo
// coperto — deve, per disegnare la fascia — quindi qualunque campo
// scritto qui e' pubblico dentro l'app. Chi e' lo sponsor, quanto ha
// pagato e con chi si e' parlato stanno in `banner_rete_note`, che
// leggono e scrivono solo i Super Admin. Il commento diceva «non esce
// mai dal pannello»: era vero come intenzione e falso come regola.
export const COLLEZIONE_NOTE_RETE = 'banner_rete_note';

export const DURATE_BANNER_RETE = [5, 10, 15, 20];
export const DURATA_BANNER_RETE_PREDEFINITA = 10;

// Le voci di copertura da scrivere sul documento.
export function zoneDi(
  copertura: CoperturaTipo, regioni?: string[] | null, province?: string[] | null,
): string[] {
  if (copertura === 'italia') return ['ITALIA'];
  if (copertura === 'regioni') return (regioni ?? []).filter(Boolean).map((r) => `R:${r}`);
  return (province ?? []).filter(Boolean).map((p) => `P:${p}`);
}

// Le voci che riguardano un circolo: quelle da cercare.
// ⚠️ 'ITALIA' c'e' sempre, anche se il circolo non ha ne' regione ne'
// provincia: un banner nazionale deve arrivare anche al circolo che
// non ha ancora compilato l'anagrafica, o il primo giorno di un
// circolo nuovo sarebbe l'unico giorno in cui non vede niente.
export function zoneDelCircolo(circolo?: { regione?: string | null; provincia?: string | null } | null): string[] {
  const voci = ['ITALIA'];
  if (circolo?.regione) voci.push(`R:${circolo.regione}`);
  if (circolo?.provincia) voci.push(`P:${circolo.provincia}`);
  return voci;
}

// Se un banner e' nel suo periodo. Gli estremi sono compresi.
export function bannerInCorso(b: { daGiorno?: string | null; aGiorno?: string | null }, oggi: string): boolean {
  if (b.daGiorno && oggi < b.daGiorno) return false;
  if (b.aGiorno && oggi > b.aGiorno) return false;
  return true;
}

// ============================================================
// L'ALTERNANZA.
//
// ⚠️ UNO E UNO, non prima i suoi e poi i nostri. Mettendo i banner di
// rete in coda, in un circolo con otto sponsor i nostri sarebbero
// arrivati dopo un minuto e mezzo di fascia — cioe' quasi mai. In
// testa, avremmo scavalcato gli accordi del circolo. Alternati, ogni
// giro ne mostra uno per parte e nessuno dei due gruppi si presenta
// tutto di fila.
//
// Quando una delle due file finisce, l'altra continua di seguito: e'
// l'unica cosa sensata, e vuol dire che un circolo senza sponsor
// mostra solo i nostri, come chiesto.
// ============================================================
export function alternaBanner<T>(delCircolo: T[], dellaRete: T[]): T[] {
  const uscita: T[] = [];
  const quanti = Math.max(delCircolo.length, dellaRete.length);
  for (let i = 0; i < quanti; i++) {
    if (i < delCircolo.length) uscita.push(delCircolo[i]);
    if (i < dellaRete.length) uscita.push(dellaRete[i]);
  }
  return uscita;
}
