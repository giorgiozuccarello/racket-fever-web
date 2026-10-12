'use client';

// ============================================================
// CONTRATTI — chi paga, quanto, fino a quando. 12 ottobre 2026.
//
// ⚠️ IL MODELLO DI BUSINESS DI RF COACH: l'app e' gratuita, il maestro paga
// un importo annuale con un contratto rinnovabile, fatturato fuori dall'app.
// Fino a oggi non stava scritto da nessuna parte, e «chi scade questo mese?»
// era una domanda senza risposta.
//
// ⚠️ L'ELENCO E' IN ORDINE DI COSE DA FARE: scaduti, in scadenza entro 30
// giorni, da pagare, in prova, senza contratto — e in fondo quelli in regola,
// che non chiedono niente. Lo stato si calcola ogni volta da date e importi
// (`statoVisto` in `_dati/contratti.ts`): non c'e' un campo «scaduto» da
// tenere aggiornato, che il primo giorno di ritardo direbbe il falso.
//
// ⚠️ IL TOTALE E' PER VALUTA E SOLO DEI CONTRATTI ATTIVI: franchi ed euro
// sommati sarebbero un numero senza senso.
// ============================================================

import React, { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ascoltaSpazi, SpazioRiga, statoDi } from '../../_dati/spazi';
import {
  Contratto, DETTO_STATO, ORDINE_STATI, StatoVisto, TINTA_STATO, dataScritta, importoScritto,
  oggiISO, statoVisto, totaleAnnuo,
} from '../../_dati/contratti';
import { leggiContratti } from '../../_dati/superadmin';
import { motivo } from '../../_dati/onboarding';
import CapitoloContratto from '../../_pezzi/Contratto';
import { Riservata } from '../../_pezzi/Guscio';
import {
  Affiancati, Capitoli, Capitolo, Dati, Eroe, Fascia, GruppoElenco, Invito, Numeri, Numero, Pillola,
  RigaElenco,
} from '../../_pezzi/Pezzi';

type Riga = { spazio: SpazioRiga; contratto: Contratto | null; visto: StatoVisto };

function Elenco() {
  const router = useRouter();
  const scelto = useSearchParams().get('id') ?? '';
  const [spazi, setSpazi] = useState<SpazioRiga[] | null>(null);
  const [contratti, setContratti] = useState<Contratto[] | null>(null);
  const [guasto, setGuasto] = useState('');
  const [cerca, setCerca] = useState('');
  const [filtro, setFiltro] = useState('tutti');
  const oggi = oggiISO();

  useEffect(() => {
    let vivo = true;
    const basta = ascoltaSpazi(
      (tutti) => { if (vivo) setSpazi(tutti); },
      (perche) => { if (vivo) setGuasto(perche); },
    );
    return () => { vivo = false; basta(); };
  }, []);

  const rileggi = useCallback(async () => {
    try {
      setContratti(await leggiContratti());
    } catch (e) {
      setGuasto(`I contratti non si leggono: ${motivo(e)}`);
    }
  }, []);
  useEffect(() => { void rileggi(); }, [rileggi]);

  // ⚠️ GLI SPAZI CHIUSI SENZA CONTRATTO NON SI MOSTRANO: sono clienti finiti,
  // e in un elenco di cose da fare starebbero sempre in mezzo come «senza
  // contratto». Un chiuso CON contratto invece si vede: e' storia economica.
  const righe = useMemo<Riga[]>(() => {
    if (!spazi || !contratti) return [];
    return spazi
      .map((s) => {
        const c = contratti.find((x) => x.spazioId === s.id) ?? null;
        return { spazio: s, contratto: c, visto: statoVisto(c, oggi) };
      })
      .filter((r) => r.contratto || statoDi(r.spazio) !== 'chiuso');
  }, [spazi, contratti, oggi]);

  const t = cerca.trim().toLowerCase();
  const visti = righe.filter((r) => (filtro === 'tutti' || r.visto === filtro)
    && (!t || [r.spazio.nome, r.spazio.citta].some((v) => v.toLowerCase().includes(t))));
  const totale = totaleAnnuo(contratti ?? []);
  const aperta = righe.find((r) => r.spazio.id === scelto) ?? null;
  const scegli = (id: string) => router.replace(`/rfcoach/superadmin/contratti?id=${id}`);

  const elenco = (
    <>
      {guasto ? <div className="avviso male">{guasto}</div> : null}
      {spazi === null || contratti === null ? <div className="vuoto">Un momento…</div> : null}
      {spazi && contratti && visti.length === 0 ? <div className="vuoto">Nessun contratto con questi filtri.</div> : null}
      {ORDINE_STATI.map((st) => {
        const qui = visti.filter((r) => r.visto === st);
        if (qui.length === 0) return null;
        return (
          <React.Fragment key={st}>
            <GruppoElenco titolo={DETTO_STATO[st]} quanti={qui.length} />
            {qui
              .sort((a, b) => (a.contratto?.scadenza ?? '9999').localeCompare(b.contratto?.scadenza ?? '9999'))
              .map((r) => (
                <RigaElenco
                  key={r.spazio.id}
                  acceso={r.spazio.id === scelto}
                  nome={r.spazio.nome || '(senza nome)'}
                  sotto={r.contratto ? `scade il ${dataScritta(r.contratto.scadenza)}` : r.spazio.citta}
                  destra={r.contratto ? importoScritto(r.contratto.importoCent, r.contratto.valuta) : ''}
                  onClick={() => scegli(r.spazio.id)}
                />
              ))}
          </React.Fragment>
        );
      })}
    </>
  );

  const conti = (st: StatoVisto) => righe.filter((r) => r.visto === st).length;

  return (
    <>
      <Fascia
        cerca={cerca}
        scriviCerca={setCerca}
        segnaposto="Cerca per nome o citta’"
        filtri={[
          { chiave: 'tutti', detto: 'Tutti', quanti: righe.length },
          { chiave: 'scaduto', detto: 'Scaduti', quanti: conti('scaduto') },
          { chiave: 'inScadenza', detto: 'In scadenza', quanti: conti('inScadenza') },
          { chiave: 'daPagare', detto: 'Da pagare', quanti: conti('daPagare') },
          { chiave: 'senza', detto: 'Senza contratto', quanti: conti('senza') },
        ]}
        filtro={filtro}
        scegli={setFiltro}
        azzera={() => { setCerca(''); setFiltro('tutti'); }}
      >
        <span className="fascia-dato">
          {'Attivi l’anno: '}
          <b>{Object.keys(totale).length === 0 ? '—' : Object.entries(totale).map(([v, c]) => importoScritto(c, v)).join(' · ')}</b>
        </span>
      </Fascia>
      <Affiancati elenco={elenco}>
        {aperta ? (
          <>
            <Eroe
              nome={aperta.spazio.nome || '(senza nome)'}
              sotto={[aperta.spazio.citta, aperta.spazio.paese, aperta.spazio.valuta].filter(Boolean).join(' · ')}
              pastiglie={<Pillola tinta={TINTA_STATO[aperta.visto]}>{DETTO_STATO[aperta.visto]}</Pillola>}
            />
            {aperta.contratto ? (
              <Numeri>
                <Numero valore={importoScritto(aperta.contratto.importoCent, aperta.contratto.valuta)} etichetta="Annuo" />
                <Numero valore={dataScritta(aperta.contratto.scadenza)} etichetta="Scadenza" tinta={aperta.visto === 'scaduto' ? 'rosso' : aperta.visto === 'inScadenza' ? 'giallo' : ''} />
                <Numero valore={aperta.contratto.pagato ? 'Si’' : 'No'} etichetta="Pagato" tinta={aperta.contratto.pagato ? 'verde' : 'giallo'} />
              </Numeri>
            ) : null}
            <Capitoli>
              <CapitoloContratto
                key={aperta.spazio.id}
                spazioId={aperta.spazio.id}
                contratto={aperta.contratto}
                valutaSpazio={aperta.spazio.valuta}
                quandoCambia={rileggi}
              />
              <Capitolo titolo="Lo spazio">
                <Dati righe={[
                  ['Stato', statoDi(aperta.spazio) === 'attivo' ? 'Attivo' : statoDi(aperta.spazio) === 'sospeso' ? 'Sospeso' : 'Chiuso'],
                  ['Tipo', aperta.spazio.tipo === 'scuola' ? 'Scuola' : 'Maestro'],
                  ['Di prova', aperta.spazio.diProva ? 'Si’' : ''],
                ]}
                />
                <div className="azioni">
                  <button type="button" className="bottone leggero piccolo" onClick={() => router.push(`/rfcoach/superadmin/spazi?id=${aperta.spazio.id}`)}>
                    Apri la scheda dello spazio
                  </button>
                </div>
              </Capitolo>
            </Capitoli>
          </>
        ) : (
          <Invito icona="contratti" testo="Scegli uno spazio per vederne o registrarne il contratto." />
        )}
      </Affiancati>
    </>
  );
}

export default function Contratti() {
  return (
    // ⚠️ IL COLLABORATORE «B» NON VEDE I CONTRATTI (12 ottobre 2026).
    <Riservata chiave="contratti">
      <Suspense fallback={<div className="vuoto">Un momento…</div>}>
        <Elenco />
      </Suspense>
    </Riservata>
  );
}
