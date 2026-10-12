'use client';

// ============================================================
// IL CONTRATTO DI UNO SPAZIO — lo stesso pezzo nella scheda dello spazio e
// nella pagina Contratti. 12 ottobre 2026.
//
// ⚠️ UN PEZZO SOLO, DUE POSTI: scritto due volte, il giorno che si aggiunge
// un campo lo si aggiunge in un posto solo, e le due pagine smettono di dire
// la stessa cosa sullo stesso contratto.
//
// ⚠️ IL CONTROLLO VERO STA SUL SERVER (`contrattoSano` in
// `rf-coach/functions/src/superadminRegole.ts`): qui si aiuta a scrivere
// giusto, e quello che il server rifiuta torna scritto nell'avviso rosso con
// le sue parole.
// ============================================================

import React, { useState } from 'react';
import {
  Contratto, DETTO_STATO, TINTA_STATO, centDaScritto, dataScritta, giorniFra, importoScritto,
  oggiISO, statoVisto, unAnnoDopo,
} from '../_dati/contratti';
import { DatiContratto, rinnovaContratto, salvaContratto } from '../_dati/superadmin';
import { motivo } from '../_dati/onboarding';
import { Capitolo, Dati, Pillola } from './Pezzi';

type Modulo = {
  inizio: string;
  scadenza: string;
  importo: string;
  valuta: string;
  stato: DatiContratto['stato'];
  pagato: boolean;
  note: string;
};

function moduloDa(c: Contratto | null, valutaSpazio: string): Modulo {
  if (c) {
    return {
      inizio: c.inizio,
      scadenza: c.scadenza,
      importo: (c.importoCent / 100).toFixed(2),
      valuta: c.valuta,
      stato: (['inProva', 'attivo', 'disdetto'].includes(c.stato) ? c.stato : 'attivo') as Modulo['stato'],
      pagato: c.pagato,
      note: c.note,
    };
  }
  const oggi = oggiISO();
  return {
    inizio: oggi,
    scadenza: unAnnoDopo(oggi),
    importo: '',
    valuta: valutaSpazio === 'EUR' ? 'EUR' : 'CHF',
    stato: 'attivo',
    pagato: false,
    note: '',
  };
}

export default function CapitoloContratto({
  spazioId, contratto, valutaSpazio, quandoCambia,
}: {
  spazioId: string;
  contratto: Contratto | null;
  valutaSpazio: string;
  quandoCambia: () => void | Promise<void>;
}) {
  const [modulo, setModulo] = useState<Modulo | null>(null);
  const [lavoro, setLavoro] = useState(false);
  const [guasto, setGuasto] = useState('');
  const [detto, setDetto] = useState('');
  const oggi = oggiISO();
  const visto = statoVisto(contratto, oggi);

  async function salva(e: React.FormEvent) {
    e.preventDefault();
    if (!modulo) return;
    setGuasto('');
    setDetto('');
    const cent = centDaScritto(modulo.importo);
    if (cent === null) { setGuasto('L’importo va scritto in cifre, per esempio 950 oppure 1’200.50.'); return; }
    setLavoro(true);
    try {
      await salvaContratto(spazioId, {
        inizio: modulo.inizio,
        scadenza: modulo.scadenza,
        importoCent: cent,
        valuta: modulo.valuta,
        stato: modulo.stato,
        pagato: modulo.pagato,
        note: modulo.note,
      });
      setModulo(null);
      setDetto('Contratto salvato.');
      await quandoCambia();
    } catch (e2) {
      setGuasto(motivo(e2));
    }
    setLavoro(false);
  }

  async function rinnova() {
    if (!contratto) return;
    // ⚠️ SI CHIEDE CONFERMA PERCHE' IL RINNOVO ARCHIVIA IL PERIODO VECCHIO e
    // ne apre uno nuovo da pagare: non e' un errore che si corregge con
    // «Correggi», e' un anno in piu' sul conto di un cliente.
    const nuova = unAnnoDopo(contratto.scadenza);
    if (!window.confirm(`Rinnovo fino al ${dataScritta(nuova)}? Il periodo attuale va nello storico e il nuovo anno risulta da pagare.`)) return;
    setGuasto('');
    setDetto('');
    setLavoro(true);
    try {
      const r = await rinnovaContratto(spazioId);
      setDetto(`Rinnovato: dal ${dataScritta(r.inizio)} al ${dataScritta(r.scadenza)}.`);
      await quandoCambia();
    } catch (e2) {
      setGuasto(motivo(e2));
    }
    setLavoro(false);
  }

  async function segnaPagato() {
    if (!contratto) return;
    setGuasto('');
    setDetto('');
    setLavoro(true);
    try {
      await salvaContratto(spazioId, {
        inizio: contratto.inizio,
        scadenza: contratto.scadenza,
        importoCent: contratto.importoCent,
        valuta: contratto.valuta,
        stato: contratto.stato as DatiContratto['stato'],
        pagato: true,
        note: contratto.note,
      });
      setDetto('Segnato come pagato.');
      await quandoCambia();
    } catch (e2) {
      setGuasto(motivo(e2));
    }
    setLavoro(false);
  }

  const giorni = contratto ? giorniFra(oggi, contratto.scadenza) : 0;

  return (
    <Capitolo titolo="Contratto">
      {guasto ? <div className="avviso male">{guasto}</div> : null}
      {detto ? <div className="avviso bene">{detto}</div> : null}

      {!modulo ? (
        <>
          <p><Pillola tinta={TINTA_STATO[visto]}>{DETTO_STATO[visto]}</Pillola></p>
          {contratto ? (
            <>
              <Dati righe={[
                ['Importo annuo', importoScritto(contratto.importoCent, contratto.valuta)],
                ['Periodo', `${dataScritta(contratto.inizio)} – ${dataScritta(contratto.scadenza)}`],
                ['Scadenza', giorni < 0 ? `scaduto da ${-giorni} giorni` : giorni === 0 ? 'oggi' : `fra ${giorni} giorni`],
                ['Pagato', contratto.pagato ? 'Si’' : 'No'],
                ['Note', contratto.note],
              ]}
              />
              {visto === 'scaduto' && contratto.stato !== 'disdetto' ? (
                <div className="avviso attenzione">
                  <b>Il contratto e’ scaduto.</b>
                  Lo spazio continua a funzionare: l’app non spegne niente da sola. Si rinnova, o
                  si sospende lo spazio dal capitolo «Stato».
                </div>
              ) : null}
            </>
          ) : (
            <p className="aiuto">
              Nessun contratto registrato. L’importo annuale si fattura fuori dall’app: qui si tiene
              traccia di quanto, da quando e fino a quando.
            </p>
          )}
          <div className="azioni">
            <button type="button" className="bottone leggero piccolo" disabled={lavoro}
              onClick={() => setModulo(moduloDa(contratto, valutaSpazio))}
            >
              {contratto ? 'Correggi' : 'Registra il contratto'}
            </button>
            {contratto && !contratto.pagato && contratto.stato !== 'disdetto' ? (
              <button type="button" className="bottone acceso piccolo" disabled={lavoro} onClick={segnaPagato}>
                Segna pagato
              </button>
            ) : null}
            {contratto && contratto.stato !== 'disdetto' ? (
              <button type="button" className="bottone piccolo" disabled={lavoro} onClick={rinnova}>
                Rinnova di un anno
              </button>
            ) : null}
          </div>
        </>
      ) : (
        <form onSubmit={salva}>
          <div className="campi">
            <div className="campo">
              <label htmlFor="cinizio">Inizio</label>
              <input id="cinizio" type="date" required value={modulo.inizio}
                onChange={(e) => setModulo({ ...modulo, inizio: e.target.value })}
              />
            </div>
            <div className="campo">
              <label htmlFor="cscadenza">Scadenza</label>
              <input id="cscadenza" type="date" required value={modulo.scadenza}
                onChange={(e) => setModulo({ ...modulo, scadenza: e.target.value })}
              />
            </div>
            <div className="campo">
              <label htmlFor="cimporto">Importo annuo</label>
              <input id="cimporto" inputMode="decimal" required placeholder="950" value={modulo.importo}
                onChange={(e) => setModulo({ ...modulo, importo: e.target.value })}
              />
            </div>
            <div className="campo">
              <label htmlFor="cvaluta">Valuta</label>
              <select id="cvaluta" value={modulo.valuta}
                onChange={(e) => setModulo({ ...modulo, valuta: e.target.value })}
              >
                <option value="CHF">CHF</option>
                <option value="EUR">EUR</option>
              </select>
            </div>
            <div className="campo">
              <label htmlFor="cstato">Stato</label>
              <select id="cstato" value={modulo.stato}
                onChange={(e) => setModulo({ ...modulo, stato: e.target.value as Modulo['stato'] })}
              >
                <option value="inProva">In prova</option>
                <option value="attivo">Attivo</option>
                <option value="disdetto">Disdetto</option>
              </select>
              <div className="aiuto">«In prova» e «Disdetto» non contano nel totale annuo.</div>
            </div>
            <div className="campo">
              <label className="interruttore" htmlFor="cpagato">
                <input id="cpagato" type="checkbox" checked={modulo.pagato}
                  onChange={(e) => setModulo({ ...modulo, pagato: e.target.checked })}
                />
                <span><b>Pagato</b><small>La fattura di questo periodo e’ stata saldata.</small></span>
              </label>
            </div>
            <div className="campo largo">
              <label htmlFor="cnote">Note</label>
              <textarea id="cnote" maxLength={500} value={modulo.note}
                onChange={(e) => setModulo({ ...modulo, note: e.target.value })}
              />
            </div>
          </div>
          <div className="azioni">
            <button type="submit" className="bottone acceso" disabled={lavoro}>{lavoro ? 'Salvo…' : 'Salva'}</button>
            <button type="button" className="bottone leggero" onClick={() => setModulo(null)}>Lascia stare</button>
          </div>
        </form>
      )}
    </Capitolo>
  );
}
