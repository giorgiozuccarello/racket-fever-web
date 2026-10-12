'use client';

// ============================================================
// VIDEO ANALYSIS — la dashboard dell'attivita'. 12 ottobre 2026.
//
// Richiesta di Giorgio: tutti i dati dei video mandati al software — stato,
// analizzati, da analizzare, dimensione, risoluzione, FPS.
//
// ⚠️ SOLA LETTURA: da qui non si manda, non si cancella e non si guarda nessun
// video. Il server non restituisce nemmeno gli indirizzi dei file — solo i
// numeri. I video sono del maestro.
//
// In alto i numeri e le distribuzioni; sotto l'elenco e la scheda affiancati,
// come nel resto del pannello, con cerca e filtro per stato.
// ============================================================

import React, { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AnalisiRiga, leggiAnalisiTutte, pesoScritto, quandoConOra } from '../../_dati/superadmin';
import {
  DETTO_STATO_ANALISI, STATI_DASHBOARD, TINTA_STATO_ANALISI, durataLunga, etichettaRisoluzione,
  riepilogo,
} from '../../_dati/analisiDashboard';
import { motivo } from '../../_dati/onboarding';
import {
  Affiancati, Capitoli, Capitolo, Dati, Eroe, Fascia, GruppoElenco, Numeri, Numero, Pillola,
  RigaElenco,
} from '../../_pezzi/Pezzi';

function durataBreve(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function Dashboard() {
  const router = useRouter();
  const scelta = useSearchParams().get('id') ?? '';
  const [righe, setRighe] = useState<AnalisiRiga[] | null>(null);
  const [guasto, setGuasto] = useState('');
  const [cerca, setCerca] = useState('');
  const [filtro, setFiltro] = useState('tutti');

  useEffect(() => {
    leggiAnalisiTutte().then(setRighe).catch((e) => setGuasto(`Le analisi non si leggono: ${motivo(e)}`));
  }, []);

  const conti = useMemo(() => riepilogo(righe ?? []), [righe]);
  const t = cerca.trim().toLowerCase();
  const visti = (righe ?? []).filter((r) => (filtro === 'tutti' || r.stato === filtro)
    && (!t || [r.titolo, r.nomeSpazio, r.driveNome, r.allievo].some((v) => v.toLowerCase().includes(t))));
  const aperta = (righe ?? []).find((r) => r.id === scelta) ?? null;
  const distribuzione = (mappa: Record<string, number>) => Object.entries(mappa)
    .sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k}: ${n}`).join(' · ') || '—';

  const elenco = (
    <>
      {guasto ? <div className="avviso male">{guasto}</div> : null}
      {righe === null ? <div className="vuoto">Un momento…</div> : null}
      {righe !== null && visti.length === 0 ? <div className="vuoto">Nessun video con questi filtri.</div> : null}
      {STATI_DASHBOARD.map((st) => {
        const qui = visti.filter((r) => r.stato === st);
        if (qui.length === 0) return null;
        return (
          <React.Fragment key={st}>
            <GruppoElenco titolo={DETTO_STATO_ANALISI[st]} quanti={qui.length} />
            {qui.map((r) => (
              <RigaElenco
                key={r.id}
                acceso={r.id === scelta}
                nome={r.titolo || r.driveNome || '(senza nome)'}
                sotto={[r.nomeSpazio, etichettaRisoluzione(r.altezza), r.fps ? `${r.fps} FPS` : '', durataBreve(r.durataSec)].filter(Boolean).join('  ·  ')}
                destra={pesoScritto(r.byte)}
                onClick={() => router.replace(`/rfcoach/superadmin/analisi?id=${r.id}`)}
              />
            ))}
          </React.Fragment>
        );
      })}
    </>
  );

  return (
    <>
      <Fascia
        cerca={cerca}
        scriviCerca={setCerca}
        segnaposto="Cerca per nome, maestro o allievo"
        filtri={[
          { chiave: 'tutti', detto: 'Tutti', quanti: conti.totale },
          ...STATI_DASHBOARD.map((s) => ({ chiave: s, detto: DETTO_STATO_ANALISI[s], quanti: conti.perStato[s] ?? 0 })),
        ]}
        filtro={filtro}
        scegli={setFiltro}
        azzera={() => { setCerca(''); setFiltro('tutti'); }}
      />
      <Affiancati elenco={elenco}>
        {aperta ? (
          <>
            <Eroe
              nome={aperta.titolo || aperta.driveNome || '(senza nome)'}
              sotto={aperta.nomeSpazio}
              pastiglie={<Pillola tinta={TINTA_STATO_ANALISI[aperta.stato] ?? 'spento'}>{DETTO_STATO_ANALISI[aperta.stato] ?? aperta.stato}</Pillola>}
            />
            <Numeri>
              <Numero valore={pesoScritto(aperta.byte)} etichetta="Peso" />
              <Numero valore={etichettaRisoluzione(aperta.altezza)} etichetta="Risoluzione" />
              <Numero valore={aperta.fps ? String(aperta.fps) : '—'} etichetta="FPS" />
              <Numero valore={durataBreve(aperta.durataSec)} etichetta="Durata" />
              {aperta.byteAnalizzato > 0 ? <Numero valore={pesoScritto(aperta.byteAnalizzato)} etichetta="Analizzato" tinta="verde" /> : null}
            </Numeri>
            <Capitoli>
              <Capitolo titolo="Il percorso">
                <Dati righe={[
                  ['Caricato', quandoConOra(aperta.creatoIlMs)],
                  ['Arrivato in Drive', aperta.inAnalisiIlMs ? quandoConOra(aperta.inAnalisiIlMs) : ''],
                  ['Tornato analizzato', aperta.analizzatoIlMs ? quandoConOra(aperta.analizzatoIlMs) : ''],
                  ['Inviato', aperta.inviatoIlMs ? `${quandoConOra(aperta.inviatoIlMs)}${aperta.allievo ? ` a ${aperta.allievo}` : ''}` : ''],
                ]}
                />
                {aperta.errore ? <div className="avviso male"><b>Errore</b>{aperta.errore}</div> : null}
              </Capitolo>
              <Capitolo titolo="I nomi">
                <Dati righe={[
                  ['Nel pannello del maestro', aperta.titolo],
                  ['In Drive (INPUT)', aperta.driveNome],
                  ['Tornato da OUTPUT', aperta.nomeAnalizzato],
                  ['Origine', aperta.origine === 'caricato' ? 'Caricato da file' : 'Ripreso con l’app'],
                ]}
                />
              </Capitolo>
            </Capitoli>
          </>
        ) : (
          <>
            <Numeri>
              <Numero valore={conti.totale} etichetta="Video" />
              <Numero valore={conti.perStato.daAnalizzare ?? 0} etichetta="Da analizzare" />
              <Numero valore={(conti.perStato.inCoda ?? 0) + (conti.perStato.inAnalisi ?? 0)} etichetta="In analisi" tinta="giallo" />
              <Numero valore={conti.perStato.analizzato ?? 0} etichetta="Analizzati" tinta="verde" />
              <Numero valore={conti.perStato.inviato ?? 0} etichetta="Inviati" />
              <Numero valore={conti.perStato.errore ?? 0} etichetta="In errore" tinta={(conti.perStato.errore ?? 0) > 0 ? 'rosso' : ''} />
              <Numero valore={pesoScritto(conti.byte)} etichetta="Spazio" sotto={conti.byteAnalizzati ? `+ ${pesoScritto(conti.byteAnalizzati)} analizzati` : ''} />
              <Numero valore={durataLunga(conti.durataSec)} etichetta="Durata totale" />
            </Numeri>
            <Capitoli>
              <Capitolo titolo="Risoluzione e FPS">
                <Dati righe={[
                  ['Risoluzione', distribuzione(conti.perRisoluzione)],
                  ['FPS', distribuzione(conti.perFps)],
                ]}
                />
              </Capitolo>
              <Capitolo titolo="Per maestro">
                {conti.perSpazio.length === 0 ? <p className="aiuto">Nessun video ancora.</p> : (
                  <table className="elenco">
                    <thead><tr><th>Spazio</th><th>Video</th><th>Peso</th></tr></thead>
                    <tbody>
                      {conti.perSpazio.map((s) => (
                        <tr key={s.spazioId}><td>{s.nome}</td><td>{s.quanti}</td><td>{pesoScritto(s.byte)}</td></tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </Capitolo>
            </Capitoli>
            <p className="aiuto" style={{ marginTop: 18 }}>Scegli un video dall’elenco per vederne i dettagli.</p>
          </>
        )}
      </Affiancati>
    </>
  );
}

export default function VideoAnalysis() {
  return (
    <Suspense fallback={<div className="vuoto">Un momento…</div>}>
      <Dashboard />
    </Suspense>
  );
}
