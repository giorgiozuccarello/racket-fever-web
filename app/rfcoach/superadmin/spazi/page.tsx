'use client';

// ============================================================
// SPAZI — l'elenco a sinistra, la scheda a destra. 12 ottobre 2026.
//
// ⚠️ COME IL GESTIONALE (`rf-coach/sezioni/GestionaleIncordature.tsx`): in
// alto la fascia con cerca e filtri, sotto l'elenco raggruppato e la scheda
// accanto. Prima la scheda era un'altra pagina, e per confrontare due clienti
// si andava avanti e indietro.
//
// ⚠️ LO SPAZIO APERTO STA NELL'INDIRIZZO (`?id=…`), non in uno stato: si
// manda a qualcuno, sopravvive a una ricarica, e «indietro» torna allo spazio
// di prima.
//
// ⚠️ E L'ELENCO SI ASCOLTA, non si legge una volta: dopo aver sospeso uno
// spazio, la riga cambia da sola.
// ============================================================

import React, { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ascoltaSpazi, SpazioRiga, statoDi, StatoSpazio } from '../../_dati/spazi';
import {
  Affiancati, Fascia, GruppoElenco, Invito, Pillola, RigaElenco,
} from '../../_pezzi/Pezzi';
import SchedaSpazio from '../../_pezzi/SchedaSpazio';

const GRUPPI: { stato: StatoSpazio; titolo: string }[] = [
  { stato: 'attivo', titolo: 'Attivi' },
  { stato: 'sospeso', titolo: 'Sospesi' },
  { stato: 'chiuso', titolo: 'Chiusi' },
];

const FILTRI = [
  { chiave: 'tutti', detto: 'Tutti' },
  { chiave: 'attivo', detto: 'Attivi' },
  { chiave: 'sospeso', detto: 'Sospesi' },
  { chiave: 'chiuso', detto: 'Chiusi' },
  { chiave: 'prova', detto: 'Di prova' },
];

function passa(s: SpazioRiga, filtro: string, cerca: string): boolean {
  if (filtro === 'prova' && !s.diProva) return false;
  if (filtro !== 'tutti' && filtro !== 'prova' && statoDi(s) !== filtro) return false;
  const t = cerca.trim().toLowerCase();
  if (!t) return true;
  return [s.nome, s.citta, s.zona].some((v) => v.toLowerCase().includes(t));
}

function Elenco() {
  const router = useRouter();
  const parametri = useSearchParams();
  const scelto = parametri.get('id') ?? '';
  const [spazi, setSpazi] = useState<SpazioRiga[] | null>(null);
  const [guasto, setGuasto] = useState('');
  const [cerca, setCerca] = useState('');
  const [filtro, setFiltro] = useState('tutti');

  useEffect(() => {
    let vivo = true;
    const basta = ascoltaSpazi(
      (tutti) => { if (vivo) { setSpazi(tutti); setGuasto(''); } },
      (perche) => { if (vivo) setGuasto(perche); },
    );
    return () => { vivo = false; basta(); };
  }, []);

  const visti = useMemo(() => (spazi ?? []).filter((s) => passa(s, filtro, cerca)), [spazi, filtro, cerca]);
  const scegli = (id: string) => router.replace(`/rfcoach/superadmin/spazi?id=${id}`);

  const elenco = (
    <>
      {guasto ? <div className="avviso male">{guasto}</div> : null}
      {spazi === null ? <div className="vuoto">Un momento…</div> : null}
      {spazi !== null && visti.length === 0 ? (
        <div className="vuoto">{spazi.length === 0 ? 'Non c’e’ ancora nessuno spazio. Si comincia da «Nuovo spazio».' : 'Nessuno spazio con questi filtri.'}</div>
      ) : null}
      {GRUPPI.map((g) => {
        const qui = visti.filter((s) => statoDi(s) === g.stato);
        if (qui.length === 0) return null;
        return (
          <React.Fragment key={g.stato}>
            <GruppoElenco titolo={g.titolo} quanti={qui.length} />
            {qui.map((s) => (
              <RigaElenco
                key={s.id}
                acceso={s.id === scelto}
                nome={s.nome || '(senza nome)'}
                sotto={[s.citta, s.tipo === 'scuola' ? 'Scuola' : 'Maestro', s.valuta].filter(Boolean).join('  ·  ')}
                pastiglie={(s.diProva || (g.stato === 'attivo' && !s.visibile)) ? (
                  <>
                    {g.stato === 'attivo' && !s.visibile ? <Pillola tinta="nascosto">Non si trova</Pillola> : null}
                    {s.diProva ? <Pillola tinta="accento">Di prova</Pillola> : null}
                  </>
                ) : undefined}
                onClick={() => scegli(s.id)}
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
        segnaposto="Cerca per nome o citta’"
        filtri={FILTRI.map((f) => ({
          ...f,
          quanti: spazi ? spazi.filter((s) => passa(s, f.chiave, '')).length : undefined,
        }))}
        filtro={filtro}
        scegli={setFiltro}
        azzera={() => { setCerca(''); setFiltro('tutti'); }}
      />
      <Affiancati elenco={elenco}>
        {scelto ? <SchedaSpazio key={scelto} spazioId={scelto} /> : <Invito icona="spazi" testo="Scegli uno spazio dall’elenco." />}
      </Affiancati>
    </>
  );
}

// ⚠️ IL `Suspense` NON E' DECORAZIONE: `useSearchParams` obbliga a una
// frontiera, e senza il `build` si ferma.
export default function Spazi() {
  return (
    <Suspense fallback={<div className="vuoto">Un momento…</div>}>
      <Elenco />
    </Suspense>
  );
}
