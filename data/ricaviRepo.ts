// ============================================================
// RICAVI — la lettura dei conteggi.
//
// La matematica sta in `data/ricavi.ts`; i numeri li scrive il server
// (`functions/src/ricavi.ts`). Qui c'è solo il modo di andarseli a
// prendere.
//
// ⚠️ SI LEGGE, NON SI CONTA. Nessuna funzione di questo file rilegge
// le prenotazioni per rifare il totale, e non è pigrizia: un circolo
// da cinque campi produce fra le cinque e le ottomila mezz'ore a
// trimestre, e le prenotazioni annullate non ci sono più. Contare dal
// vivo darebbe un numero più piccolo del vero, con l'aria di essere
// giusto — che è il modo peggiore di sbagliare una fattura.
// ============================================================

import {
  collection, doc, getDoc, getDocs, limit, orderBy, query, where,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import {
  Cadenza, CONTEGGIO_VUOTO, ConteggioPeriodo, PeriodoRicavi,
  chiavePeriodo, periodoRicavi,
} from './ricavi';

// Una riga per mezz'ora fatturata: è l'elenco che si mette in mano al
// circolo che contesta il totale.
export interface SlotFatturato {
  id: string;
  periodo: string;
  prenotatoIlMs: number;
  data: string | null;
  orario: string | null;
  campoId: string | null;
  campoNome: string | null;
  tipo: string;
  prenotataDa: string;
  tipoUtente: string | null;
  centesimiCircolo: number;
  utenteId: string | null;
  annullatoIlMs: number | null;
  annullatoNelPeriodo: string | null;
}

export interface LetturaRicavi {
  periodo: PeriodoRicavi;
  conteggio: ConteggioPeriodo;
  // Falso quando il documento del periodo non esiste ancora: vuol dire
  // che in questo periodo non è stata prenotata nemmeno una mezz'ora,
  // oppure che il circolo è nato prima dei contatori.
  //
  // ⚠️ VA DISTINTO DA «zero», e a schermo va detto: «nessuna
  // prenotazione» e «non stiamo ancora contando» sono due frasi
  // diverse, e la seconda è quella che spiega un totale sorprendente.
  trovato: boolean;
}

export async function leggiConteggio(
  circoloId: string,
  attivatoIlMs: number | null,
  adessoMs: number,
  cadenza: Cadenza,
): Promise<LetturaRicavi> {
  const periodo = periodoRicavi(attivatoIlMs, adessoMs, cadenza);
  const chiave = chiavePeriodo(periodo);
  const snap = await getDoc(doc(db, 'circoli', circoloId, 'conteggi', chiave));
  if (!snap.exists()) {
    return { periodo, conteggio: { ...CONTEGGIO_VUOTO }, trovato: false };
  }
  const v = snap.data() as Record<string, unknown>;
  return {
    periodo,
    conteggio: {
      slotPrenotati: numero(v.slotPrenotati),
      slotAnnullati: numero(v.slotAnnullati),
      aggiornatoIlMs: numero(v.aggiornatoIlMs),
    },
    trovato: true,
  };
}

// ============================================================
// ⚠️ LE RIGHE SI LEGGONO A RICHIESTA, MAI ALL'APERTURA.
//
// Sono migliaia per periodo. La sezione mostra i totali — che sono un
// documento solo — e va a prendere le righe quando qualcuno tocca
// «vedi il dettaglio», che è il gesto di chi sta contestando o
// controllando, non di chi apre la pagina.
//
// ⚠️ E SI LEGGONO A PAGINE. Il tetto non è una precauzione: è quello
// che impedisce a una schermata di provare a disegnare ottomila righe
// e bloccare il telefono di chi l'ha aperta.
// ============================================================
export const RIGHE_PER_PAGINA = 200;

export async function leggiSlot(
  circoloId: string,
  chiave: string,
  quante: number = RIGHE_PER_PAGINA,
): Promise<SlotFatturato[]> {
  const q = query(
    collection(db, 'circoli', circoloId, 'slot_fatturati'),
    where('periodo', '==', chiave),
    orderBy('prenotatoIlMs', 'desc'),
    limit(quante),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => {
    const v = d.data() as Record<string, unknown>;
    return {
      id: d.id,
      periodo: String(v.periodo ?? ''),
      prenotatoIlMs: numero(v.prenotatoIlMs),
      data: (v.data as string) ?? null,
      orario: (v.orario as string) ?? null,
      campoId: (v.campoId as string) ?? null,
      campoNome: (v.campoNome as string) ?? null,
      tipo: String(v.tipo ?? 'campo'),
      prenotataDa: String(v.prenotataDa ?? 'socio'),
      tipoUtente: (v.tipoUtente as string) ?? null,
      centesimiCircolo: numero(v.centesimiCircolo),
      utenteId: (v.utenteId as string) ?? null,
      annullatoIlMs: v.annullatoIlMs == null ? null : numero(v.annullatoIlMs),
      annullatoNelPeriodo: (v.annullatoNelPeriodo as string) ?? null,
    };
  });
}

// ============================================================
// I NUMERI INCROCIATI SI RICAVANO DALLE RIGHE.
//
// ⚠️ E QUINDI SONO ESATTI SOLO SE LE RIGHE CI SONO TUTTE. Con il tetto
// di pagina, su un periodo grosso si sta guardando un campione: la
// schermata deve dirlo invece di far passare una stima per un totale.
// I due numeri che vanno in fattura — slot prenotati e annullati —
// vengono dal contatore e non da qui, quindi restano esatti comunque.
// ============================================================
export function incrocioDaSlot(righe: SlotFatturato[]): {
  centesimiCircolo: number;
  sociCheHannoPrenotato: number;
  perTipo: Record<string, number>;
  perOrigine: Record<string, number>;
} {
  const soci = new Set<string>();
  const perTipo: Record<string, number> = {};
  const perOrigine: Record<string, number> = {};
  let centesimiCircolo = 0;
  for (const r of righe) {
    // ⚠️ Le righe annullate non contano nel valore: quel campo è
    // tornato libero e il circolo non l'ha incassato.
    if (r.annullatoIlMs) continue;
    centesimiCircolo += r.centesimiCircolo;
    if (r.utenteId) soci.add(r.utenteId);
    perTipo[r.tipo] = (perTipo[r.tipo] ?? 0) + 1;
    perOrigine[r.prenotataDa] = (perOrigine[r.prenotataDa] ?? 0) + 1;
  }
  return { centesimiCircolo, sociCheHannoPrenotato: soci.size, perTipo, perOrigine };
}

function numero(v: unknown): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : 0;
}
