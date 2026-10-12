// ============================================================
// LA DASHBOARD DI VIDEO ANALYSIS — i conti. 12 ottobre 2026.
//
// ⚠️ NIENTE IMPORT: funzioni pure, provate con Node da
// `prove/superadmin.mjs`. I dati arrivano da `coachSuperAdmin` (azione
// `analisi`), che legge tutte le analisi di tutti gli spazi.
//
// Gli stati sono quelli di `rf-coach/data/analisiRegole.ts` (`STATI_ANALISI`):
// da analizzare → in coda → in analisi → analizzato → inviato, oppure errore.
// ============================================================

export type RigaAnalisi = {
  stato: string;
  byte: number;
  byteAnalizzato: number;
  altezza: number;
  fps: number;
  durataSec: number;
  spazioId: string;
  nomeSpazio: string;
};

export const STATI_DASHBOARD = ['daAnalizzare', 'inCoda', 'inAnalisi', 'analizzato', 'inviato', 'errore'] as const;

export const DETTO_STATO_ANALISI: Record<string, string> = {
  daAnalizzare: 'Da analizzare',
  inCoda: 'In coda',
  inAnalisi: 'In analisi',
  analizzato: 'Analizzati',
  inviato: 'Inviati',
  errore: 'In errore',
};

export const TINTA_STATO_ANALISI: Record<string, string> = {
  daAnalizzare: 'spento',
  inCoda: 'attesa',
  inAnalisi: 'attesa',
  analizzato: 'bene',
  inviato: 'accento',
  errore: 'male',
};

// La risoluzione come la dice il gestionale: dal lato corto.
export function etichettaRisoluzione(altezza: number): string {
  if (altezza >= 2160) return '4K';
  if (altezza >= 1440) return '2K';
  if (altezza >= 1080) return '1080p';
  if (altezza >= 720) return '720p';
  return altezza > 0 ? `${altezza}p` : '—';
}

export type Riepilogo = {
  totale: number;
  perStato: Record<string, number>;
  byte: number;
  byteAnalizzati: number;
  durataSec: number;
  perRisoluzione: Record<string, number>;
  perFps: Record<string, number>;
  perSpazio: { spazioId: string; nome: string; quanti: number; byte: number }[];
};

export function riepilogo(righe: RigaAnalisi[]): Riepilogo {
  const perStato: Record<string, number> = {};
  STATI_DASHBOARD.forEach((s) => { perStato[s] = 0; });
  const perRisoluzione: Record<string, number> = {};
  const perFps: Record<string, number> = {};
  const spazi = new Map<string, { spazioId: string; nome: string; quanti: number; byte: number }>();
  let byte = 0;
  let byteAnalizzati = 0;
  let durataSec = 0;
  righe.forEach((r) => {
    perStato[r.stato] = (perStato[r.stato] ?? 0) + 1;
    byte += r.byte > 0 ? r.byte : 0;
    byteAnalizzati += r.byteAnalizzato > 0 ? r.byteAnalizzato : 0;
    durataSec += r.durataSec > 0 ? r.durataSec : 0;
    const ris = etichettaRisoluzione(r.altezza);
    perRisoluzione[ris] = (perRisoluzione[ris] ?? 0) + 1;
    const f = r.fps > 0 ? `${r.fps} FPS` : '—';
    perFps[f] = (perFps[f] ?? 0) + 1;
    const s = spazi.get(r.spazioId) ?? { spazioId: r.spazioId, nome: r.nomeSpazio || '(senza nome)', quanti: 0, byte: 0 };
    s.quanti += 1;
    s.byte += r.byte > 0 ? r.byte : 0;
    spazi.set(r.spazioId, s);
  });
  return {
    totale: righe.length,
    perStato,
    byte,
    byteAnalizzati,
    durataSec,
    perRisoluzione,
    perFps,
    perSpazio: [...spazi.values()].sort((a, b) => b.quanti - a.quanti || a.nome.localeCompare(b.nome)),
  };
}

// «1 h 05 min» / «12 min» / «45 s».
export function durataLunga(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  if (s < 60) return `${s} s`;
  const min = Math.floor(s / 60);
  if (min < 60) return `${min} min`;
  return `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, '0')} min`;
}
