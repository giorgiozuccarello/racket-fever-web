'use client';

// ============================================================
// FATTURAZIONE — quanto deve ogni circolo, e quando scade.
//
// ⚠️ I NUMERI ARRIVANO DALLA FOTOGRAFIA NOTTURNA, non dalle tessere. È
// l'unica scelta possibile: contare dal vivo vorrebbe dire leggere le
// tessere di TUTTI i circoli della rete a ogni apertura di questa
// pagina — a cento circoli sono decine di migliaia di documenti, per un
// elenco che si guarda una volta al mese. Il giro notturno le tessere
// le sta già leggendo per conto suo, quindi il conto lo scrive lì.
//
// ⚠️ E LA DATA DELLO SCATTO SI DICE, riga per riga. Il giro notturno
// fotografa un numero limitato di circoli per notte: un circolo può
// essere rimasto indietro di qualche giorno, e su un numero che diventa
// una fattura la differenza va vista, non nascosta. Il circolo, nella
// propria Panoramica, vede invece il conto dal vivo — lì le tessere
// sono già in memoria.
// ============================================================

import { useEffect, useMemo, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import SezioneCollassabile from '../../admin/dashboard/SezioneCollassabile';
import { Circolo, statoCircolo, etichettaStatoCircolo } from '../../../data/circoli';
import { ascoltaCircoli } from '../../../data/circoliRepo';
import { FatturazioneFoto } from '../../../data/schedaCircolo';
import { FASCE, euro } from '../../../data/fatturazione';

interface Riga {
  circolo: Circolo;
  conto: FatturazioneFoto | null;
  scattataIlMs: number | null;
  // ⚠️ «Non c'è ancora» e «non me l'hanno fatta leggere» sono due cose
  // diverse, e il primo tentativo le confondeva: qualunque errore
  // diventava `conto: null`, cioè la stessa riga di un circolo appena
  // creato. Una lettura respinta dalle regole non si risolve
  // aspettando il giro notturno — si risolve guardando le regole — e
  // scriverla come «arriva stanotte» significa non guardarle mai.
  respinta: boolean;
}

const EURO = (n: number) => euro(n ?? 0);
const giorno = (ms: number | null | undefined) =>
  (ms && ms > 0 ? new Date(ms).toLocaleDateString('it-IT') : '—');

// Quanti giorni mancano al rinnovo. Negativo = è già scaduto.
const giorniA = (ms: number) => Math.round((ms - Date.now()) / (24 * 60 * 60 * 1000));

// ⚠️ Vero solo se la fotografia dice esplicitamente che il periodo è
// ancorato a una data di attivazione. Le fotografie scattate prima che
// il campo esistesse non lo dicono, e in quel caso la risposta prudente
// è no: meglio «da impostare» che una scadenza inventata.
const haScadenzaVera = (c: FatturazioneFoto | null) => !!c && c.periodoAncorato === true;

export default function SezioneFatturazione() {
  const [circoli, setCircoli] = useState<Circolo[]>([]);
  const [righe, setRighe] = useState<Riga[] | null>(null);
  const [errore, setErrore] = useState('');
  const [caricando, setCaricando] = useState(false);

  useEffect(() => ascoltaCircoli(setCircoli), []);

  // ⚠️ A richiesta, non all'apertura della pagina. Sono N letture, una
  // per circolo: farle a ogni apertura del pannello vorrebbe dire
  // pagarle anche a chi era entrato per tutt'altro.
  const carica = async () => {
    setErrore(''); setCaricando(true);
    try {
      const esiti = await Promise.all(circoli.map(async (c) => {
        try {
          const snap = await getDoc(doc(db, 'circoli', c.id, 'fotografie', 'ultima'));
          const dati = snap.exists() ? snap.data() : null;
          return {
            circolo: c,
            conto: (dati?.fatturazione as FatturazioneFoto | undefined) ?? null,
            scattataIlMs: (dati?.scattataIlMs as number | undefined) ?? null,
            respinta: false,
          };
        } catch {
          return { circolo: c, conto: null, scattataIlMs: null, respinta: true };
        }
      }));
      // In ordine di scadenza: chi rinnova prima sta in cima, ed è
      // l'unico ordinamento che serve davvero a chi apre questa pagina.
      // ⚠️ Chi non ha una scadenza vera va in fondo, non in cima. Le
      // fotografie senza ancoraggio hanno `periodoFineMs` uguale a
      // oggi: ordinando alla cieca finivano tutte in testa all'elenco,
      // proprio davanti ai circoli che scadono davvero.
      esiti.sort((a, b) => (haScadenzaVera(a.conto) ? a.conto!.periodoFineMs : Infinity)
        - (haScadenzaVera(b.conto) ? b.conto!.periodoFineMs : Infinity));
      setRighe(esiti);
    } catch (e: unknown) {
      setErrore(e instanceof Error ? e.message : 'Lettura non riuscita.');
    } finally {
      setCaricando(false);
    }
  };

  const totali = useMemo(() => {
    if (!righe) return null;
    // ⚠️ I TOTALI GUARDANO SOLO I CIRCOLI ATTIVI: un circolo sospeso o
    // chiuso non si fattura, e sommarne la quota gonfierebbe il numero
    // che si guarda per capire quanto incassa la rete.
    const conConto = righe.filter((r) => r.conto && statoCircolo(r.circolo) === 'attivo');
    return {
      circoli: conConto.length,
      // ⚠️ Solo fra gli ATTIVI, e prima non era così: erano contati
      // anche i circoli chiusi, che una fotografia non ce l'hanno
      // proprio perché il giro notturno li salta apposta. Il pannello
      // annunciava così un pugno di circoli «in attesa del primo giro»
      // che non sarebbero mai arrivati.
      senzaConto: righe.filter((r) => !r.conto && !r.respinta && statoCircolo(r.circolo) === 'attivo').length,
      respinte: righe.filter((r) => r.respinta).length,
      utenti: conConto.reduce((s, r) => s + (r.conto?.utenti ?? 0), 0),
      atteso: conConto.reduce((s, r) => s + (r.conto?.quota ?? 0), 0),
    };
  }, [righe]);

  return (
    <SezioneCollassabile
      id="fatturazione"
      titolo="Fatturazione"
      descrizione="Utenti conteggiati, fascia e quota di ogni circolo, in ordine di scadenza"
    >
      <div className="admin-card">
        <div className="admin-card-title">Quote annuali della rete</div>
        <p className="admin-card-hint">
          Si contano le persone che ogni circolo ha accettato — soci, tesserati e ospiti allo
          stesso modo — e che hanno aperto l’app almeno una volta. Chi è entrato conta anche se
          poi è uscito. Le fasce: {FASCE.map((f) => `${f.descrizione} → ${EURO(f.quota)}`).join(' · ')}.
        </p>

        <button className="admin-btn-full" onClick={carica} disabled={caricando || circoli.length === 0}>
          {caricando ? 'Lettura in corso…' : (righe ? 'Rileggi' : 'Calcola le quote')}
        </button>
        {!!errore && <div className="admin-error-text">{errore}</div>}

        {totali && (
          <div className="admin-ok-text">
            {totali.circoli} circoli attivi con un conteggio, {totali.utenti} utenti in tutto,{' '}
            <strong>{EURO(totali.atteso)}</strong> di quote sull’anno in corso.
            {totali.senzaConto > 0
              ? ` ${totali.senzaConto === 1 ? 'Un circolo attivo non ha' : `${totali.senzaConto} circoli attivi non hanno`} ancora una fotografia: il conteggio arriva con il primo giro notturno.`
              : ''}
            {totali.respinte > 0
              ? ` ${totali.respinte === 1 ? 'Una lettura è stata respinta' : `${totali.respinte} letture sono state respinte`} dalle regole: non è un ritardo del giro notturno, va guardato.`
              : ''}
          </div>
        )}

        {righe && righe.length > 0 && (
          <div className="scheda-tabella-culla" style={{ marginTop: '.8rem' }}>
            <table className="scheda-tabella">
              <thead>
                <tr>
                  <th>Circolo</th><th>Utenti</th><th>Fascia</th><th>Quota</th>
                  <th>Rinnovo</th><th>Mai usata</th><th>Aggiornato al</th>
                </tr>
              </thead>
              <tbody>
                {righe.map((r) => {
                  const stato = statoCircolo(r.circolo);
                  const scade = haScadenzaVera(r.conto) ? giorniA(r.conto!.periodoFineMs) : null;
                  // ⚠️ Un circolo non attivo il giro notturno lo salta:
                  // i suoi numeri sono fermi al giorno della
                  // sospensione, e vanno letti come storia, non come
                  // fotografia di oggi.
                  const fermo = stato !== 'attivo';
                  return (
                    <tr key={r.circolo.id}>
                      <td>
                        <div className="scheda-td-nome">{r.circolo.nome}</div>
                        <div className="scheda-td-sub">
                          {r.circolo.citta}
                          {fermo ? ` · ${etichettaStatoCircolo(stato)} · numeri fermi, esclusi dai totali` : ''}
                        </div>
                      </td>
                      <td>{r.conto ? r.conto.utenti : '—'}</td>
                      <td>{r.conto ? r.conto.fascia : '—'}</td>
                      <td>{r.conto ? EURO(r.conto.quota) : '—'}</td>
                      <td className={scade !== null && scade <= 30 ? 'scheda-td-debito' : undefined}>
                        {scade !== null ? giorno(r.conto!.periodoFineMs) : (r.conto ? 'data da impostare' : '—')}
                        {scade !== null && scade <= 30 && scade >= 0 ? ` · fra ${scade} gg` : ''}
                        {scade !== null && scade < 0 ? ' · scaduto' : ''}
                      </td>
                      {/* Accettati e mai entrati nell'app: non si
                          contano, ma dicono al circolo quanti dei suoi
                          soci non stanno usando quello per cui paga. */}
                      <td>{r.conto ? r.conto.accettatiMaiUsati : '—'}</td>
                      <td>{r.respinta ? 'lettura respinta' : giorno(r.scattataIlMs)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {righe && righe.length === 0 && (
          <p className="admin-empty-text">Nessun circolo nella rete.</p>
        )}
      </div>
    </SezioneCollassabile>
  );
}
