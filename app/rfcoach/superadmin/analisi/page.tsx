'use client';

// ============================================================
// VIDEO ANALYSIS — la dashboard dell'attivita'. 12 ottobre 2026.
//
// Richiesta di Giorgio: tutti i dati dei video mandati al software — stato,
// analizzati, da analizzare, dimensione, risoluzione, FPS.
//
// ⚠️ SOLA LETTURA, TRANNE «ELIMINA»: da qui non si manda e non si guarda nessun
// video. Il server non restituisce nemmeno gli indirizzi dei file — solo i
// numeri. I video sono del maestro.
//
// In alto i numeri e le distribuzioni; sotto l'elenco e la scheda affiancati,
// come nel resto del pannello, con cerca e filtro per stato.
//
// ⚠️ DAL 13 OTTOBRE 2026 DUE COSE IN PIU' (richiesta di Giorgio):
//   · «Elimina definitivamente», in fondo alla scheda di ogni video, per il
//     titolare e il livello A (non il B). Sparisce dalle app del maestro e
//     dell'allievo, e i file vanno via dal bucket e da Drive. E' l'UNICA
//     eccezione alla sola lettura qui sotto, e passa dal server.
//   · la scheda rossa «File mancante»: una scheda il cui video nel bucket non
//     c'e' piu' (Giorgio ne aveva cancellati a mano dalla console, e il
//     pannello li mostrava come se niente fosse). Si toglie con «Elimina».
// ============================================================

import React, { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AnalisiRiga, eliminaVideo, leggiAnalisiTutte, pesoScritto, quandoConOra } from '../../_dati/superadmin';
import {
  DETTO_STATO_ANALISI, STATI_DASHBOARD, TINTA_STATO_ANALISI, dettoMancante, durataLunga,
  etichettaRisoluzione, puoEliminareVideo, riepilogo,
} from '../../_dati/analisiDashboard';
import { motivo } from '../../_dati/onboarding';
import { useLivello } from '../../_pezzi/Guscio';
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
  const [eliminando, setEliminando] = useState(false);
  const [detto, setDetto] = useState('');
  const livello = useLivello();

  const rileggi = useCallback(async () => {
    try {
      setRighe(await leggiAnalisiTutte());
    } catch (e) {
      setGuasto(`Le analisi non si leggono: ${motivo(e)}`);
    }
  }, []);
  useEffect(() => { void rileggi(); }, [rileggi]);

  const conti = useMemo(() => riepilogo(righe ?? []), [righe]);
  const t = cerca.trim().toLowerCase();
  const mancante = (r: AnalisiRiga) => r.fileMancante || r.analizzatoMancante;
  const visti = (righe ?? []).filter((r) => (filtro === 'tutti' || r.stato === filtro || (filtro === 'mancanti' && mancante(r)))
    && (!t || [r.titolo, r.nomeSpazio, r.driveNome, r.allievo].some((v) => v.toLowerCase().includes(t))));
  const aperta = (righe ?? []).find((r) => r.id === scelta) ?? null;
  const distribuzione = (mappa: Record<string, number>) => Object.entries(mappa)
    .sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k}: ${n}`).join(' · ') || '—';

  // ⚠️ LA DOMANDA DICE TUTTO QUELLO CHE SI PORTA VIA: di chi e' il video e,
  // se e' stato inviato, a quale allievo sparisce. Un'eliminazione non si
  // disfa.
  async function elimina(r: AnalisiRiga) {
    const nome = r.titolo || r.driveNome || '(senza nome)';
    const domanda = `Elimino per sempre «${nome}» di ${r.nomeSpazio || 'questo maestro'}?\n\n`
      + 'Sparisce dall’app del maestro'
      + (r.stato === 'inviato' && r.allievo ? ` e da quella di ${r.allievo}` : '')
      + ', e i file vanno via dal deposito e da Drive. Non si puo’ tornare indietro.';
    if (!window.confirm(domanda)) return;
    setGuasto('');
    setDetto('');
    setEliminando(true);
    try {
      await eliminaVideo(r.id);
      setDetto(`«${nome}» eliminato.`);
      router.replace('/rfcoach/superadmin/analisi');
      await rileggi();
    } catch (e) {
      setGuasto(`Il video non si elimina: ${motivo(e)}`);
    }
    setEliminando(false);
  }

  const elenco = (
    <>
      {guasto ? <div className="avviso male">{guasto}</div> : null}
      {detto ? <div className="avviso bene">{detto}</div> : null}
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
                pastiglie={mancante(r) ? <Pillola tinta="male">{dettoMancante(r)}</Pillola> : undefined}
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
          ...(conti.mancanti > 0 ? [{ chiave: 'mancanti', detto: 'File mancanti', quanti: conti.mancanti }] : []),
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
              pastiglie={(
                <>
                  <Pillola tinta={TINTA_STATO_ANALISI[aperta.stato] ?? 'spento'}>{DETTO_STATO_ANALISI[aperta.stato] ?? aperta.stato}</Pillola>
                  {mancante(aperta) ? <Pillola tinta="male">{dettoMancante(aperta)}</Pillola> : null}
                </>
              )}
            />
            {mancante(aperta) ? (
              <div className="avviso male">
                <b>{dettoMancante(aperta)}</b>
                La scheda c’e’, ma il video nel deposito no: il maestro la vede ancora e non si apre.
                Per toglierla dalle app, eliminala qui sotto.
              </div>
            ) : null}
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
              {puoEliminareVideo(livello) ? (
                <Capitolo titolo="Elimina">
                  <p className="aiuto">
                    Il video sparisce dall’app del maestro
                    {aperta.stato === 'inviato' && aperta.allievo ? ` e da quella di ${aperta.allievo}` : ''}
                    , e i file vanno via dal deposito e da Drive. Non si puo’ tornare indietro.
                  </p>
                  <div className="azioni">
                    <button type="button" className="bottone rosso" disabled={eliminando} onClick={() => void elimina(aperta)}>
                      {eliminando ? 'Elimino…' : 'Elimina definitivamente'}
                    </button>
                  </div>
                </Capitolo>
              ) : null}
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
              {conti.mancanti > 0 ? <Numero valore={conti.mancanti} etichetta="File mancanti" tinta="rosso" /> : null}
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
