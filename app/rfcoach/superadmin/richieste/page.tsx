'use client';

// ============================================================
// RICHIESTE — i maestri che chiedono di entrare. 12 ottobre 2026.
//
// ⚠️ ARRIVANO DA `/rfcoach/attiva`, la pagina pubblica nata in questa stessa
// tornata, attraverso `coachRichiediAttivazione`. NON sono le richieste del
// modulo in home: quello e' dei circoli di Racket Fever, e scrive nel
// database dei circoli.
//
// ⚠️ DA UNA RICHIESTA SI CREA LO SPAZIO SENZA RISCRIVERE NIENTE: «Crea lo
// spazio» apre «Nuovo spazio» con nome, cognome, email, citta', paese e tipo
// gia' dentro, e alla fine la richiesta passa da sola ad «attivata».
//
// ⚠️ I QUATTRO STATI SONO UN ELENCO CHIUSO (`STATI_RICHIESTA` sul server):
// nuova → contattata → attivata, oppure scartata. Si puo' tornare indietro:
// una richiesta scartata per sbaglio si rimette «nuova».
// ============================================================

import React, { Suspense, useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Richiesta, leggiRichieste, quandoConOra, statoRichiesta } from '../../_dati/superadmin';
import { motivo } from '../../_dati/onboarding';
import {
  Affiancati, Capitoli, Capitolo, Dati, Eroe, Fascia, GruppoElenco, Invito, Pillola, RigaElenco,
} from '../../_pezzi/Pezzi';

const STATI: { chiave: string; titolo: string; uno: string; tinta: string }[] = [
  { chiave: 'nuova', titolo: 'Nuove', uno: 'Nuova', tinta: 'accento' },
  { chiave: 'contattata', titolo: 'Contattate', uno: 'Contattata', tinta: 'attesa' },
  { chiave: 'attivata', titolo: 'Attivate', uno: 'Attivata', tinta: 'bene' },
  { chiave: 'scartata', titolo: 'Scartate', uno: 'Scartata', tinta: 'spento' },
];

const DETTO_ALLIEVI: Record<string, string> = {
  '1-10': 'fino a 10', '11-30': 'da 11 a 30', '31-60': 'da 31 a 60', oltre60: 'oltre 60',
};

function Elenco() {
  const router = useRouter();
  const scelta = useSearchParams().get('id') ?? '';
  const [richieste, setRichieste] = useState<Richiesta[] | null>(null);
  const [guasto, setGuasto] = useState('');
  const [cerca, setCerca] = useState('');
  const [filtro, setFiltro] = useState('tutte');
  const [lavoro, setLavoro] = useState(false);

  const rileggi = useCallback(async () => {
    try {
      setRichieste(await leggiRichieste());
      setGuasto('');
    } catch (e) {
      setGuasto(`Le richieste non si leggono: ${motivo(e)}`);
    }
  }, []);
  useEffect(() => { void rileggi(); }, [rileggi]);

  async function cambia(id: string, stato: string) {
    setLavoro(true);
    try {
      await statoRichiesta(id, stato);
      await rileggi();
    } catch (e) {
      setGuasto(motivo(e));
    }
    setLavoro(false);
  }

  const t = cerca.trim().toLowerCase();
  const visti = (richieste ?? []).filter((r) => (filtro === 'tutte' || r.stato === filtro)
    && (!t || [r.nome, r.cognome, r.email, r.citta].some((v) => v.toLowerCase().includes(t))));
  const aperta = (richieste ?? []).find((r) => r.id === scelta) ?? null;

  const elenco = (
    <>
      {guasto ? <div className="avviso male">{guasto}</div> : null}
      {richieste === null ? <div className="vuoto">Un momento…</div> : null}
      {richieste !== null && visti.length === 0 ? (
        <div className="vuoto">{richieste.length === 0 ? 'Nessuna richiesta, per ora.' : 'Nessuna richiesta con questi filtri.'}</div>
      ) : null}
      {STATI.map((st) => {
        const qui = visti.filter((r) => r.stato === st.chiave);
        if (qui.length === 0) return null;
        return (
          <React.Fragment key={st.chiave}>
            <GruppoElenco titolo={st.titolo} quanti={qui.length} />
            {qui.map((r) => (
              <RigaElenco
                key={r.id}
                acceso={r.id === scelta}
                nome={`${r.nome} ${r.cognome}`.trim()}
                sotto={[r.citta, r.paese, quandoConOra(r.creataIlMs)].filter(Boolean).join('  ·  ')}
                onClick={() => router.replace(`/rfcoach/superadmin/richieste?id=${r.id}`)}
              />
            ))}
          </React.Fragment>
        );
      })}
    </>
  );

  const quanti = (s: string) => (richieste ?? []).filter((r) => r.stato === s).length;
  const stato = STATI.find((s) => s.chiave === aperta?.stato) ?? STATI[0];

  return (
    <>
      <Fascia
        cerca={cerca}
        scriviCerca={setCerca}
        segnaposto="Cerca per nome, email o citta’"
        filtri={[
          { chiave: 'tutte', detto: 'Tutte', quanti: richieste?.length },
          ...STATI.map((s) => ({ chiave: s.chiave, detto: s.titolo, quanti: quanti(s.chiave) })),
        ]}
        filtro={filtro}
        scegli={setFiltro}
        azzera={() => { setCerca(''); setFiltro('tutte'); }}
      />
      <Affiancati elenco={elenco}>
        {aperta ? (
          <>
            <Eroe
              nome={`${aperta.nome} ${aperta.cognome}`.trim()}
              sotto={`Richiesta del ${quandoConOra(aperta.creataIlMs)}`}
              pastiglie={<Pillola tinta={stato.tinta}>{stato.uno}</Pillola>}
            />
            <Capitoli>
              <Capitolo titolo="Chi e’">
                <Dati righe={[
                  ['Email', <a key="e" href={`mailto:${aperta.email}`}>{aperta.email}</a>],
                  ['Telefono', aperta.telefono ? <a key="t" href={`tel:${aperta.telefono.replace(/[^+0-9]/g, '')}`}>{aperta.telefono}</a> : ''],
                  ['Citta’', aperta.citta],
                  ['Paese', aperta.paese === 'CH' ? 'Svizzera' : 'Italia'],
                  ['Lavora come', aperta.tipo === 'scuola' ? 'Scuola' : 'Maestro'],
                  ['Allievi', DETTO_ALLIEVI[aperta.allievi] ?? aperta.allievi],
                ]}
                />
              </Capitolo>
              <Capitolo titolo="Cosa farne">
                {aperta.stato === 'attivata' ? (
                  <>
                    <p>Lo spazio e’ stato creato.</p>
                    {aperta.spazioId ? (
                      <div className="azioni">
                        <button type="button" className="bottone leggero piccolo" onClick={() => router.push(`/rfcoach/superadmin/spazi?id=${aperta.spazioId}`)}>
                          Apri lo spazio
                        </button>
                      </div>
                    ) : null}
                  </>
                ) : (
                  <>
                    <p className="aiuto">
                      Chiamalo o scrivigli. Quando siete d’accordo, «Crea lo spazio» apre il modulo con i
                      suoi dati gia’ dentro.
                    </p>
                    <div className="azioni">
                      <button type="button" className="bottone acceso piccolo" disabled={lavoro}
                        onClick={() => router.push(`/rfcoach/superadmin/nuovo?richiesta=${aperta.id}`)}
                      >
                        Crea lo spazio
                      </button>
                      {aperta.stato !== 'contattata' ? (
                        <button type="button" className="bottone leggero piccolo" disabled={lavoro} onClick={() => cambia(aperta.id, 'contattata')}>
                          Segna contattato
                        </button>
                      ) : null}
                      {aperta.stato !== 'scartata' ? (
                        <button type="button" className="bottone leggero piccolo" disabled={lavoro} onClick={() => cambia(aperta.id, 'scartata')}>
                          Scarta
                        </button>
                      ) : (
                        <button type="button" className="bottone leggero piccolo" disabled={lavoro} onClick={() => cambia(aperta.id, 'nuova')}>
                          Rimetti fra le nuove
                        </button>
                      )}
                    </div>
                  </>
                )}
              </Capitolo>
            </Capitoli>
          </>
        ) : (
          <Invito icona="richieste" testo="Scegli una richiesta dall’elenco." />
        )}
      </Affiancati>
    </>
  );
}

export default function Richieste() {
  return (
    <Suspense fallback={<div className="vuoto">Un momento…</div>}>
      <Elenco />
    </Suspense>
  );
}
