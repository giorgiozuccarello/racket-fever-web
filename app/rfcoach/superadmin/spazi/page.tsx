'use client';

// ============================================================
// SPAZI — chi c'e', e com'e' messo.
//
// ⚠️ DUE PILLOLE E NON UNA, perche' `attivo` e `visibile` sono due cose
// diverse e confonderle costa un pomeriggio: `attivo` e' l'abbonamento
// in corso, `visibile` e' la scelta del maestro di farsi trovare. Uno
// spazio attivo e invisibile e' legittimo — chi lavora solo su
// presentazione — ma uno spazio che il cliente giura di aver acceso e
// che gli allievi non trovano e' quasi sempre questo, e la schermata
// deve dirlo senza che nessuno debba aprire la console.
//
// ⚠️ E LO STATO SI ASCOLTA, non si legge una volta: dopo aver sospeso
// uno spazio, la riga cambia da sola. Senza, si preme «sospendi», non
// succede niente di visibile, e si preme di nuovo.
// ============================================================

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ascoltaSpazi, SpazioRiga, statoDi } from '../../_dati/spazi';

const DETTO: Record<string, string> = {
  attivo: 'Attivo',
  sospeso: 'Sospeso',
  chiuso: 'Chiuso',
};

function quando(ms: number): string {
  if (!ms) return '—';
  return new Date(ms).toLocaleDateString('it-CH', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  });
}

export default function Spazi() {
  const router = useRouter();
  const [spazi, setSpazi] = useState<SpazioRiga[] | null>(null);
  const [guasto, setGuasto] = useState('');

  // ⚠️ IL GUASTO LO DICE FIRESTORE, non un orologio. La prima stesura
  // metteva un `setTimeout` di dodici secondi che accendeva l'allarme se
  // l'elenco non era ancora arrivato — e la closure leggeva lo stato del
  // PRIMO render, dove l'elenco e' sempre vuoto. Risultato: il riquadro
  // rosso «l'elenco non arriva» compariva SEMPRE, sopra una tabella
  // piena di spazi, dodici secondi dopo l'apertura. Rilievo della
  // revisione del 16 settembre.
  useEffect(() => {
    let vivo = true;
    const basta = ascoltaSpazi(
      (tutti) => { if (vivo) { setSpazi(tutti); setGuasto(''); } },
      (perche) => { if (vivo) setGuasto(perche); },
    );
    return () => { vivo = false; basta(); };
  }, []);

  return (
    <>
      <h1 className="titolo">Spazi</h1>
      <p className="sottotitolo">
        Tutti i clienti di RF Coach. Tocca una riga per aprirne la scheda.
      </p>

      {guasto ? <div className="avviso male">{guasto}</div> : null}

      <div className="foglio">
        {spazi === null ? <div className="vuoto">Un momento…</div> : null}
        {spazi !== null && spazi.length === 0 ? (
          <div className="vuoto">
            Non c’e’ ancora nessuno spazio. Si comincia da «Nuovo spazio».
          </div>
        ) : null}
        {spazi !== null && spazi.length > 0 ? (
          <table className="elenco">
            <thead>
              <tr>
                <th>Nome</th>
                <th>Dove</th>
                <th>Stato</th>
                <th>Dal</th>
              </tr>
            </thead>
            <tbody>
              {spazi.map((s) => {
                const stato = statoDi(s);
                return (
                  // ⚠️ `tabIndex` e `onKeyDown` perche' una riga cliccabile
                  // che non risponde alla tastiera e' una riga che, per chi
                  // non usa il mouse, non esiste: un `<tr>` non e' un
                  // bottone e nessun browser gli da' il fuoco da solo.
                  <tr
                    key={s.id}
                    className="tocca"
                    role="button"
                    tabIndex={0}
                    onClick={() => router.push(`/rfcoach/superadmin/spazio/?id=${s.id}`)}
                    onKeyDown={(e) => {
                      if (e.key !== 'Enter' && e.key !== ' ') return;
                      e.preventDefault();
                      router.push(`/rfcoach/superadmin/spazio/?id=${s.id}`);
                    }}
                  >
                    <td>
                      <b>{s.nome || '(senza nome)'}</b>
                      <div style={{ color: 'var(--testo-tenue)', fontSize: 12.5 }}>
                        {s.tipo === 'scuola' ? 'Scuola' : 'Maestro'} · {s.valuta || '—'}
                      </div>
                    </td>
                    <td>
                      {s.citta || '—'}
                      {s.zona ? <div style={{ color: 'var(--testo-tenue)', fontSize: 12.5 }}>{s.zona}</div> : null}
                      <div style={{ color: 'var(--testo-tenue)', fontSize: 12.5 }}>{s.paese}</div>
                    </td>
                    <td>
                      <span className={`pillola ${stato}`}>{DETTO[stato]}</span>
                      {stato === 'attivo' && !s.visibile ? (
                        <div style={{ marginTop: 4 }}>
                          <span className="pillola nascosto">Non si trova</span>
                        </div>
                      ) : null}
                    </td>
                    <td>{quando(s.creatoIlMs)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : null}
      </div>
    </>
  );
}
