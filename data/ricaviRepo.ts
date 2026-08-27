// ============================================================
// CONTEGGIO DELLE MEZZ'ORE — la lettura.
//
// La matematica sta in `data/ricavi.ts`; i numeri li scrive il server
// (`functions/src/ricavi.ts`). Qui c'è solo come andarseli a prendere.
//
// ⚠️ SI LEGGE UN DOCUMENTO E MEZZO, non le prenotazioni. Il totale dei
// giorni già chiusi è un documento solo; il giorno in corso è un
// secondo documento di cui si prendono le ore prima della soglia.
// Rileggere le prenotazioni sarebbe decine di migliaia di letture a
// ogni apertura della dashboard, e non saprebbe comunque dire quante
// mezz'ore sono state annullate — quei documenti non esistono più.
// ============================================================

import { doc, getDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../lib/firebase';
import {
  GiornoConteggio, TOTALE_VUOTO, TotaleConteggio,
  sogliaOraCorrente, sommaGiorno,
} from './ricavi';

export interface LetturaConteggio {
  totale: TotaleConteggio;
  // Quando il server ha rifatto la somma l'ultima volta.
  aggiornatoIlMs: number;
  // Fin dove arriva il conto: giorno e ora della soglia.
  sogliaGiornoIso: string;
  sogliaOra: string;
  // Falso quando il documento del totale non esiste ancora, cioè
  // nessuno ha mai premuto «aggiorna» su questo circolo.
  //
  // ⚠️ VA DISTINTO DA «zero», e a schermo va detto: «non abbiamo
  // ancora contato» e «non è stata prenotata nemmeno una mezz'ora»
  // sono due frasi diverse, e la seconda sarebbe una bugia.
  trovato: boolean;
}

// ============================================================
// ⚠️ IL GIORNO IN CORSO SI SOMMA QUI, NON SUL SERVER.
//
// Il totale salvato si ferma all'ultimo giorno CHIUSO: assorbire il
// giorno in corso vorrebbe dire congelarlo a metà, e quel giorno
// resterebbe sbagliato per sempre. Le ore di oggi già giocate si
// aggiungono in lettura, dove costano un documento e si rifanno a ogni
// sguardo — che è esattamente quello che serve, visto che maturano
// mentre le si guarda.
// ============================================================
export async function leggiConteggio(
  circoloId: string,
  adessoMs: number,
): Promise<LetturaConteggio> {
  const soglia = sogliaOraCorrente(adessoMs);

  const [snapTotale, snapOggi] = await Promise.all([
    getDoc(doc(db, 'circoli', circoloId, 'conteggi', 'totale')),
    getDoc(doc(db, 'circoli', circoloId, 'giorni', soglia.giornoIso)),
  ]);

  if (!snapTotale.exists()) {
    return {
      totale: { ...TOTALE_VUOTO },
      aggiornatoIlMs: 0,
      sogliaGiornoIso: soglia.giornoIso,
      sogliaOra: soglia.oraLimite,
      trovato: false,
    };
  }

  const v = snapTotale.data() as Record<string, unknown>;
  let totale: TotaleConteggio = {
    prenotate: numero(v.prenotate),
    annullate: numero(v.annullate),
    centesimi: numero(v.centesimi),
  };

  // ⚠️ Si somma il giorno in corso SOLO se il totale non lo comprende
  // già. Il caso non dovrebbe capitare — il server assorbe solo i
  // giorni chiusi — ma se un giorno capitasse, sommarlo due volte
  // sarebbe un errore invisibile e permanente.
  const finoAl = (v.finoAlGiornoIso as string | null) ?? null;
  const oggiGiaDentro = finoAl !== null && finoAl >= soglia.giornoIso;
  if (!oggiGiaDentro && snapOggi.exists()) {
    totale = sommaGiorno(totale, snapOggi.data() as GiornoConteggio, soglia.oraLimite);
  }

  return {
    totale,
    aggiornatoIlMs: numero(v.aggiornatoIlMs),
    sogliaGiornoIso: soglia.giornoIso,
    sogliaOra: soglia.oraLimite,
    trovato: true,
  };
}

// ============================================================
// RIFARE IL TOTALE.
//
// ⚠️ La chiama la dashboard all'APERTURA e sul PULSANTE. All'apertura
// non è uno spreco: di norma ha uno o due mucchietti da sommare —
// quelli dei giorni chiusi da quando qualcuno ha guardato l'ultima
// volta — e senza, il conto resterebbe fermo al giorno in cui è stato
// aperto la prima volta.
//
// `completo: false` vuol dire che il server si è fermato al tetto di
// giorni per chiamata: succede al primo giro su un circolo aperto da
// molto. Chiamarla di nuovo prosegue da dove si era fermata.
// ============================================================
export interface EsitoAggiornamento {
  completo: boolean;
  finoAlGiornoIso: string | null;
  aggiornatoIlMs: number;
}

export async function aggiornaConteggio(circoloId: string): Promise<EsitoAggiornamento> {
  const chiama = httpsCallable(functions, 'aggiornaConteggioMezzore');
  const esito = await chiama({ circoloId });
  const d = (esito.data ?? {}) as Record<string, unknown>;
  return {
    completo: d.completo !== false,
    finoAlGiornoIso: (d.finoAlGiornoIso as string | null) ?? null,
    aggiornatoIlMs: numero(d.aggiornatoIlMs),
  };
}

function numero(v: unknown): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : 0;
}
