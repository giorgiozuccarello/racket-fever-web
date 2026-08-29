// ============================================================
// RESET DI UN CIRCOLO E ARCHIVIO DEL REGISTRO — lato Super Admin.
//
// ⚠️ QUI NON C'È UNA SOLA CANCELLAZIONE. Tutte le operazioni passano da
// due Cloud Functions: il browser chiede, il server decide e fa. È il
// motivo per cui questa cosa ha potuto lasciare la Dashboard del
// circolo — dove viveva appoggiandosi a `modalitaTest()`, cioè a
// permessi aperti al telefono di ogni Admin — senza perdere niente per
// strada. Una Cloud Function usa l'Admin SDK: non ha bisogno di nessun
// permesso lato client, e controlla una cosa sola, chi chiama.
//
// Le due collezioni che legge sono in sola lettura anche per il Super
// Admin (firestore.rules): un archivio modificabile da chi lo custodisce
// non prova niente.
// ============================================================

import {
  collection, query, where, onSnapshot, getDocs, doc, getDoc,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../lib/firebase';

export type LivelloReset = 'sfide' | 'medio' | 'totale';

export interface RigaArchivio {
  id: string;
  quandoMs: number;
  socioNome: string;
  socioUid: string;
  tipo: string;
  importo: number;
  saldoPrima: number;
  saldoDopo: number;
  debitoPrima: number;
  debitoDopo: number;
  descrizione: string;
  eseguitoDaNome: string;
  eseguitoDaRuolo: string;
}

export interface ArchivioRegistro {
  id: string;
  circoloId: string;
  nomeCircolo: string;
  creatoIlMs: number;
  righe: number;
  pagine: number;
  totaleEntrate: number;
  totaleUscite: number;
  primaRigaMs: number | null;
  ultimaRigaMs: number | null;
}

// ⚠️ Ordinati dal più recente, e l'ordinamento si fa QUI e non con
// orderBy: un orderBy su Firestore esclude i documenti che quel campo
// non ce l'hanno, e su una collezione appena nata è il modo più rapido
// di far sparire dall'elenco proprio il primo archivio scritto.
export function ascoltaArchiviCircolo(
  circoloId: string,
  callback: (elenco: ArchivioRegistro[]) => void,
  suErrore?: (e: unknown) => void,
) {
  const q = query(collection(db, 'archivi_registro'), where('circoloId', '==', circoloId));
  return onSnapshot(q, (snap) => {
    const elenco = snap.docs.map((d) => ({ id: d.id, ...(d.data() as object) })) as ArchivioRegistro[];
    elenco.sort((a, b) => (b.creatoIlMs ?? 0) - (a.creatoIlMs ?? 0));
    callback(elenco);
  }, (e) => { if (suErrore) suErrore(e); });
}

// Rilegge tutte le pagine e ricompone il registro. È la funzione che
// rende l'archivio un archivio: senza, sarebbe una copia che nessuno
// può riaprire.
// ⚠️ UNA LETTURA SOLA, PER UNA DOMANDA SOLA: «di questo circolo chiuso
// esiste una copia dei conti, e di quando?». La scheda del circolo la
// fa una volta all'apertura, e non ha bisogno di restare in ascolto
// come l'elenco completo qui sopra: un archivio nasce quando qualcuno
// preme un pulsante, non da solo.
export async function leggiUltimoArchivio(circoloId: string): Promise<ArchivioRegistro | null> {
  const istantanea = await getDocs(query(collection(db, 'archivi_registro'), where('circoloId', '==', circoloId)));
  const elenco = istantanea.docs
    .map((d) => ({ id: d.id, ...(d.data() as Omit<ArchivioRegistro, 'id'>) }))
    .sort((a, b) => (b.creatoIlMs ?? 0) - (a.creatoIlMs ?? 0));
  return elenco[0] ?? null;
}

export async function leggiRigheArchivio(archivioId: string): Promise<RigaArchivio[]> {
  const snap = await getDocs(collection(db, 'archivi_registro', archivioId, 'pagine'));
  const pagine = snap.docs
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((d) => ((d.data() as { righe?: RigaArchivio[] }).righe ?? []));
  return pagine.flat();
}

export async function leggiArchivio(archivioId: string): Promise<ArchivioRegistro | null> {
  const d = await getDoc(doc(db, 'archivi_registro', archivioId));
  return d.exists() ? ({ id: d.id, ...(d.data() as object) } as ArchivioRegistro) : null;
}

export async function archiviaRegistro(circoloId: string): Promise<{
  archivioId: string; righe: number; totaleEntrate: number; totaleUscite: number;
}> {
  const chiama = httpsCallable(functions, 'archiviaRegistroCircolo', { timeout: 540000 });
  const esito = await chiama({ circoloId });
  return esito.data as { archivioId: string; righe: number; totaleEntrate: number; totaleUscite: number };
}

export async function resettaCircolo(
  circoloId: string, livello: LivelloReset, confermaNome: string,
): Promise<{ livello: LivelloReset; nomeCircolo: string; conta: Record<string, number> }> {
  const chiama = httpsCallable(functions, 'resettaCircolo', { timeout: 540000 });
  const esito = await chiama({ circoloId, livello, confermaNome });
  return esito.data as { livello: LivelloReset; nomeCircolo: string; conta: Record<string, number> };
}

// ============================================================
// IL FILE DA SCARICARE.
//
// ⚠️ Punto e virgola e non virgola, e il BOM davanti: è quello che fa
// aprire il file a Excel italiano con le colonne al posto giusto invece
// che tutto in una colonna sola. Un archivio che si scarica e si apre
// male è un archivio che nessuno consulta.
// ⚠️ E ogni campo fra virgolette, con le virgolette interne raddoppiate:
// una descrizione con dentro un punto e virgola spezzerebbe la riga.
// ============================================================
export function csvDaRighe(righe: RigaArchivio[]): string {
  const cella = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const data = (ms: number) => (ms > 0 ? new Date(ms).toLocaleString('it-IT') : '');
  const euro = (n: number) => (n ?? 0).toFixed(2).replace('.', ',');
  const intestazione = [
    'Data e ora', 'Socio', 'Tipo', 'Importo', 'Saldo prima', 'Saldo dopo',
    'Debito prima', 'Debito dopo', 'Descrizione', 'Eseguito da', 'Ruolo',
  ];
  const corpo = righe.map((r) => [
    data(r.quandoMs), r.socioNome, r.tipo, euro(r.importo), euro(r.saldoPrima), euro(r.saldoDopo),
    euro(r.debitoPrima), euro(r.debitoDopo), r.descrizione, r.eseguitoDaNome, r.eseguitoDaRuolo,
  ].map(cella).join(';'));
  return '﻿' + [intestazione.map(cella).join(';'), ...corpo].join('\r\n');
}
