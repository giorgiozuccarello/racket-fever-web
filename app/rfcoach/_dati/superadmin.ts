'use client';

// ============================================================
// LE CHIAMATE DEL PANNELLO — 12 ottobre 2026.
//
// ⚠️ IL PANNELLO NON LEGGE E NON SCRIVE CONTRATTI E RICHIESTE DA SOLO:
// `contratti` e `richiesteCoach` non hanno nessuna regola Firestore, quindi
// dal browser sono chiuse a tutti, Super Admin compreso. Passa tutto da
// `coachSuperAdmin` (e da `coachAzzeraSpazio`), che controllano chi chiama
// con l'Admin SDK. Le funzioni stanno in
// `rf-coach/functions/src/superadmin.ts`.
// ============================================================

import { httpsCallable } from 'firebase/functions';
import { funzioni } from '../_lib/firebase';
import type { Contratto } from './contratti';

async function chiama<T>(azione: string, dati: Record<string, unknown> = {}): Promise<T> {
  const porta = httpsCallable<Record<string, unknown>, T>(funzioni, 'coachSuperAdmin');
  const risposta = await porta({ azione, ...dati });
  return risposta.data;
}

// ---------- contratti ----------

export async function leggiContratti(): Promise<Contratto[]> {
  const r = await chiama<{ contratti: Contratto[] }>('contratti');
  return r.contratti;
}

export type DatiContratto = {
  inizio: string;
  scadenza: string;
  importoCent: number;
  valuta: string;
  stato: 'inProva' | 'attivo' | 'disdetto';
  pagato: boolean;
  note: string;
};

export async function salvaContratto(spazioId: string, c: DatiContratto): Promise<void> {
  await chiama('salvaContratto', { spazioId, ...c });
}

export async function rinnovaContratto(spazioId: string): Promise<{ inizio: string; scadenza: string }> {
  return chiama('rinnovaContratto', { spazioId });
}

// ---------- numeri ----------

export type NumeriSpazio = {
  conti: Record<string, number>;
  byte: number;
  ultimoAccessoMs: number;
  creatoMs: number;
};

export async function numeriSpazio(spazioId: string): Promise<NumeriSpazio> {
  return chiama('numeri', { spazioId });
}

// ---------- pronto soccorso ----------

export type AccessoTitolare = {
  uid: string;
  email: string;
  verificata: boolean;
  disattivato: boolean;
  ultimoAccessoMs: number;
  creatoMs: number;
  fornitori: string[];
};

export async function accessoTitolare(spazioId: string): Promise<AccessoTitolare> {
  return chiama('accesso', { spazioId });
}

export async function cambiaEmailTitolare(spazioId: string, email: string): Promise<{ email: string; link: string }> {
  return chiama('cambiaEmail', { spazioId, email });
}

export async function linkTitolare(
  spazioId: string, tipo: 'linkPassword' | 'linkVerifica',
): Promise<{ email: string; link: string }> {
  return chiama(tipo, { spazioId });
}

export async function esciOvunque(spazioId: string): Promise<void> {
  await chiama('esciOvunque', { spazioId });
}

// ---------- richieste ----------

export type Richiesta = {
  id: string;
  nome: string;
  cognome: string;
  email: string;
  telefono: string;
  citta: string;
  paese: string;
  tipo: string;
  allievi: string;
  stato: string;
  spazioId: string;
  creataIlMs: number;
};

export async function leggiRichieste(): Promise<Richiesta[]> {
  const r = await chiama<{ richieste: Richiesta[] }>('richieste');
  return r.richieste;
}

export async function statoRichiesta(richiestaId: string, stato: string, spazioId = ''): Promise<void> {
  await chiama('statoRichiesta', { richiestaId, stato, spazioId });
}

// ---------- azzeramento ----------

export type EsitoAzzera = {
  livello: string;
  tolti: Record<string, number>;
  interrotto: boolean;
};

export async function azzeraSpazio(
  spazioId: string, livello: 'attivita' | 'tutto', conferma: string,
): Promise<EsitoAzzera> {
  const porta = httpsCallable<Record<string, unknown>, EsitoAzzera>(
    funzioni, 'coachAzzeraSpazio', { timeout: 540000 },
  );
  const r = await porta({ spazioId, livello, conferma });
  return r.data;
}

// ---------- la porta pubblica ----------

export type DatiRichiestaPubblica = {
  nome: string;
  cognome: string;
  email: string;
  telefono: string;
  citta: string;
  paese: string;
  tipo: string;
  allievi: string;
  sito: string;
};

export async function richiediAttivazione(d: DatiRichiestaPubblica): Promise<void> {
  const porta = httpsCallable(funzioni, 'coachRichiediAttivazione');
  await porta(d);
}

// ---------- in comune ----------

export function quandoScritto(ms: number): string {
  if (!ms) return '—';
  return new Date(ms).toLocaleDateString('it-CH', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function quandoConOra(ms: number): string {
  if (!ms) return 'mai';
  return new Date(ms).toLocaleString('it-CH', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

export function pesoScritto(byte: number): string {
  if (byte < 0) return 'non letto';
  if (byte < 1024 * 1024) return `${Math.round(byte / 1024)} KB`;
  if (byte < 1024 ** 3) return `${(byte / 1024 ** 2).toFixed(1)} MB`;
  return `${(byte / 1024 ** 3).toFixed(2)} GB`;
}

// ---------- la dashboard di Video Analysis (12 ottobre) ----------

export type AnalisiRiga = {
  id: string;
  spazioId: string;
  nomeSpazio: string;
  titolo: string;
  stato: string;
  origine: string;
  byte: number;
  byteAnalizzato: number;
  altezza: number;
  fps: number;
  durataSec: number;
  errore: string;
  driveNome: string;
  nomeAnalizzato: string;
  allievo: string;
  creatoIlMs: number;
  inAnalisiIlMs: number;
  analizzatoIlMs: number;
  inviatoIlMs: number;
  // ⚠️ DAL 13 OTTOBRE 2026: la scheda c'e' ma il video nel bucket no (per
  // esempio cancellato a mano dalla console). Il server elenca il bucket.
  fileMancante: boolean;
  analizzatoMancante: boolean;
};

export async function leggiAnalisiTutte(): Promise<AnalisiRiga[]> {
  const r = await chiama<{ analisi: AnalisiRiga[] }>('analisi');
  return r.analisi;
}

// ⚠️ ELIMINARE UN VIDEO PER SEMPRE (13 ottobre 2026): titolare e A. Sparisce
// dall'app del maestro e da quella dell'allievo, e i file vanno via dal bucket
// e da Drive. Il server ricontrolla il livello (`puoEliminareAnalisi`).
export async function eliminaVideo(id: string): Promise<{ videoReviewTolta: boolean }> {
  return chiama('eliminaAnalisi', { id });
}

// ---------- i collaboratori (12 ottobre) ----------

export type Collaboratore = {
  uid: string;
  email: string;
  livello: 'titolare' | 'A' | 'B';
  creatoIlMs: number;
  ultimoAccessoMs: number;
};

export async function leggiCollaboratori(): Promise<Collaboratore[]> {
  const r = await chiama<{ collaboratori: Collaboratore[] }>('collaboratori');
  return r.collaboratori;
}

export async function aggiungiCollaboratore(email: string, password: string, livello: 'A' | 'B'): Promise<void> {
  await chiama('aggiungiCollaboratore', { email, password, livello });
}

export async function passwordCollaboratore(uid: string, password: string): Promise<void> {
  await chiama('passwordCollaboratore', { uid, password });
}

export async function livelloCollaboratore(uid: string, livello: 'A' | 'B'): Promise<void> {
  await chiama('livelloCollaboratore', { uid, livello });
}

export async function revocaCollaboratore(uid: string): Promise<void> {
  await chiama('revocaCollaboratore', { uid });
}
