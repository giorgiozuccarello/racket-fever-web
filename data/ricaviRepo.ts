// ============================================================
// CONTEGGIO DELLE MEZZ'ORE — la lettura.
//
// La matematica sta in `data/ricavi.ts`; i numeri li scrive il server
// (`functions/src/ricavi.ts`). Qui c'è solo come andarseli a prendere.
//
// ⚠️ DUE DOCUMENTI, NON LE PRENOTAZIONI. Il live è un documento solo
// ed è sempre già giusto; il maturato è un altro documento, che il
// server porta avanti a giorni chiusi. Rileggere le prenotazioni
// sarebbe decine di migliaia di letture a ogni apertura — e non
// saprebbe comunque dire quante mezz'ore sono state disdette, perché
// quei documenti non esistono più.
// ============================================================

import { doc, getDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../lib/firebase';
import { Conteggio, CONTEGGIO_VUOTO } from './ricavi';

export interface LetturaConteggio {
  conteggio: Conteggio;
  aggiornatoIlMs: number;
  // Solo per il maturato: fin dove arriva il conto. Nullo finché
  // nessun giorno è stato assorbito.
  finoAlGiornoIso: string | null;
  // Falso quando il documento non esiste ancora.
  //
  // ⚠️ VA DISTINTO DA «zero», e a schermo va detto: «non abbiamo
  // ancora contato» e «non è stata prenotata nemmeno una mezz'ora»
  // sono due frasi diverse, e la seconda sarebbe una bugia.
  trovato: boolean;
}

const VUOTA: LetturaConteggio = {
  conteggio: { ...CONTEGGIO_VUOTO },
  aggiornatoIlMs: 0,
  finoAlGiornoIso: null,
  trovato: false,
};

async function leggi(circoloId: string, quale: 'live' | 'maturato'): Promise<LetturaConteggio> {
  const snap = await getDoc(doc(db, 'circoli', circoloId, 'conteggi', quale));
  if (!snap.exists()) return { ...VUOTA, conteggio: { ...CONTEGGIO_VUOTO } };
  const v = snap.data() as Record<string, unknown>;
  return {
    conteggio: {
      prenotate: numero(v.prenotate),
      annullate: numero(v.annullate),
      centesimi: numero(v.centesimi),
    },
    aggiornatoIlMs: numero(v.aggiornatoIlMs),
    finoAlGiornoIso: (v.finoAlGiornoIso as string | null) ?? null,
    trovato: true,
  };
}

// «Cosa risulta prenotato adesso», comprese le partite future.
export function leggiLive(circoloId: string): Promise<LetturaConteggio> {
  return leggi(circoloId, 'live');
}

// «Cosa è stato davvero giocato», con il taglio a mezzanotte di ieri.
export function leggiMaturato(circoloId: string): Promise<LetturaConteggio> {
  return leggi(circoloId, 'maturato');
}

// ============================================================
// PORTARE AVANTI IL MATURATO.
//
// ⚠️ Il live NON ha bisogno di questo: è già giusto, sale e scende da
// solo. Il suo pulsante rilegge il documento e basta — nessuna
// chiamata al server.
//
// `completo: false` vuol dire che il server si è fermato al tetto di
// giorni per giro: succede al primo passaggio su un circolo aperto da
// molto. Chiamarla di nuovo prosegue da dove si era fermata.
// ============================================================
export interface EsitoAggiornamento {
  completo: boolean;
  finoAlGiornoIso: string | null;
  aggiornatoIlMs: number;
}

export async function aggiornaMaturato(circoloId: string): Promise<EsitoAggiornamento> {
  const chiama = httpsCallable(functions, 'aggiornaConteggioMezzore');
  const esito = await chiama({ circoloId });
  const d = (esito.data ?? {}) as Record<string, unknown>;
  return {
    completo: d.completo !== false,
    finoAlGiornoIso: (d.finoAlGiornoIso as string | null) ?? null,
    aggiornatoIlMs: numero(d.aggiornatoIlMs),
  };
}

// ============================================================
// RICOSTRUIRE DA ZERO — solo Super Admin.
//
// ⚠️ LE DISDETTE PASSATE SI PERDONO. Una prenotazione cancellata non
// esiste più da nessuna parte: la ricostruzione riconta dalle
// prenotazioni vive e ignora quelle che non ci sono. Su un circolo in
// funzione questo azzera «annullate» e fa salire il netto. Serve dopo
// un Reset Totale, o quando i numeri sono andati storti — non come
// aggiornamento di tutti i giorni.
// ============================================================
export async function ricostruisciConteggi(circoloId: string): Promise<{
  giorniRifatti: number; prenotazioniLette: number;
}> {
  const chiama = httpsCallable(functions, 'ricostruisciConteggi');
  const esito = await chiama({ circoloId });
  const d = (esito.data ?? {}) as Record<string, unknown>;
  return {
    giorniRifatti: numero(d.giorniRifatti),
    prenotazioniLette: numero(d.prenotazioniLette),
  };
}

function numero(v: unknown): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : 0;
}
