'use client';

// ============================================================
// FATTURAZIONE — quante persone usano l'app in ogni circolo, e quando
// scade il periodo.
//
// ⚠️ QUI NON CI SONO PIU' EURO, dal 21 agosto 2026, e non e' una
// dimenticanza. Le colonne «Fascia» e «Quota» e il totale «di quote
// sull'anno in corso» sono stati tolti: quanto ogni circolo paga si
// scrive nel contratto fra le due parti, e un listino replicato in una
// schermata e' un listino che diverge dal contratto il giorno che una
// trattativa va diversamente dalle altre. Questo elenco resta perche'
// serve, ma per quello che sa davvero: quante persone hanno aperto
// l'app in ogni circolo, quante sono state accettate e non l'hanno mai
// aperta, e quando scade il periodo di ognuno — cioe' l'ordine in cui
// vanno richiamati.
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
// essere rimasto indietro di qualche giorno, e un numero fermo a
// martedì letto come se fosse di oggi è il modo più rapido di fare una
// telefonata sbagliata a un circolo. Il circolo, nella propria
// Panoramica, vede invece il conto dal vivo — lì le tessere sono già in
// memoria.
// ============================================================

import { useEffect, useMemo, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import SezioneCollassabile from '../../admin/dashboard/SezioneCollassabile';
import { Circolo, statoCircolo, etichettaStatoCircolo } from '../../../data/circoli';
import { ascoltaCircoli } from '../../../data/circoliRepo';
import { FatturazioneFoto } from '../../../data/schedaCircolo';
// ⚠️ NESSUN IMPORT DA `data/fatturazione`, e prima ce n'erano due:
// `FASCE` (il listino) e `euro` (per stamparlo). Questa pagina non
// mostra piu' importi, quindi non le serve piu' niente da li'.

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
      // ⚠️ NON UNA SOTTRAZIONE FRA I DUE VALORI: con due righe senza
      // scadenza vera faceva `Infinity - Infinity`, cioe' `NaN`, e per
      // `sort` un comparatore che restituisce NaN ha esito non
      // specificato — l'ordine reciproco dei circoli «data da
      // impostare» cambiava senza motivo fra una lettura e l'altra.
      // Confronto a gradini: prima chi ha una scadenza, poi per data,
      // e a parita' per nome, cosi' l'elenco e' sempre lo stesso.
      esiti.sort((a, b) => {
        const sa = haScadenzaVera(a.conto), sb = haScadenzaVera(b.conto);
        if (sa && sb) return a.conto!.periodoFineMs - b.conto!.periodoFineMs;
        if (sa !== sb) return sa ? -1 : 1;
        return a.circolo.nome.localeCompare(b.circolo.nome, 'it');
      });
      setRighe(esiti);
    } catch (e: unknown) {
      setErrore(e instanceof Error ? e.message : 'Lettura non riuscita.');
    } finally {
      setCaricando(false);
    }
  };

  const totali = useMemo(() => {
    if (!righe) return null;
    // ⚠️ I TOTALI GUARDANO SOLO I CIRCOLI ATTIVI: su un circolo
    // sospeso o chiuso il giro notturno non passa piu', quindi i suoi
    // numeri sono fermi al giorno della sospensione. Sommarli vorrebbe
    // dire raccontare come utenti di oggi delle persone che l'app non
    // la aprono da mesi.
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
      // ⚠️ QUI C'ERA `atteso`, la somma delle quote in euro. Tolto: il
      // fatturato della rete non si legge da una schermata che somma un
      // listino scritto nel codice — si legge dai contratti firmati.
      maiUsata: conConto.reduce((s, r) => s + (r.conto?.accettatiMaiUsati ?? 0), 0),
    };
  }, [righe]);

  return (
    <SezioneCollassabile
      id="fatturazione"
      titolo="Fatturazione"
      descrizione="Quante persone usano l’app in ogni circolo, in ordine di scadenza del periodo"
    >
      <div className="admin-card">
        <div className="admin-card-title">Chi usa l’app, circolo per circolo</div>
        <p className="admin-card-hint">
          Si contano le persone che ogni circolo ha accettato — soci, tesserati e ospiti allo
          stesso modo — e che hanno aperto l’app almeno una volta. Chi è entrato conta anche se
          poi è uscito: il numero dice quante persone l’app ha raggiunto nel periodo, non quante
          ce ne sono stamattina. Gli importi non stanno qui: quanto ogni circolo paga è scritto
          nel contratto fra le parti.
        </p>

        <button className="admin-btn-full" onClick={carica} disabled={caricando || circoli.length === 0}>
          {caricando ? 'Lettura in corso…' : (righe ? 'Rileggi' : 'Leggi i conteggi')}
        </button>
        {!!errore && <div className="admin-error-text">{errore}</div>}

        {totali && (
          <div className="admin-ok-text">
            {/* ⚠️ CINQUE FRASI, CINQUE SINGOLARI — circoli, utenti,
                mai usate, senza conteggio, respinte — e le prime tre
                erano nate senza: «1 circoli attivi», «1 persone che
                hanno aperto», «Altre 1 sono state accettate». Su una
                rete che comincia da un circolo solo, quella riga e' la
                prima che si legge. Chi ne aggiunge una sesta la provi
                con 0, 1 e 2 prima di consegnarla. */}
            {totali.circoli === 0
              ? 'Nessun circolo attivo ha ancora un conteggio.'
              : (
                <>
                  {totali.circoli === 1
                    ? 'Un circolo attivo con un conteggio'
                    : `${totali.circoli} circoli attivi con un conteggio`},{' '}
                  <strong>{totali.utenti}</strong>{' '}
                  {totali.utenti === 1 ? 'persona che ha' : 'persone che hanno'} aperto l’app in tutto.
                </>
              )}
            {totali.maiUsata > 0
              ? ` ${totali.maiUsata === 1
                ? 'Un’altra persona è stata accettata'
                : `Altre ${totali.maiUsata} persone sono state accettate`} senza mai aprirla.`
              : ''}
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
                  <th>Circolo</th><th>Hanno aperto l’app</th>
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
                      <td className={scade !== null && scade <= 30 ? 'scheda-td-debito' : undefined}>
                        {scade !== null ? giorno(r.conto!.periodoFineMs) : (r.conto ? 'data da impostare' : '—')}
                        {scade !== null && scade <= 30 && scade >= 0 ? ` · fra ${scade} gg` : ''}
                        {scade !== null && scade < 0 ? ' · scaduto' : ''}
                      </td>
                      {/* Accettati e mai entrati nell'app: non si
                          contano, ma dicono quanti soci di quel circolo
                          non stanno usando quello che gli e' stato
                          messo in mano. E' il numero da cui parte una
                          telefonata utile all'assistenza. */}
                      <td>{r.conto ? r.conto.accettatiMaiUsati : '—'}</td>
                      <td>{r.respinta ? 'lettura respinta' : giorno(r.scattataIlMs)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* ⚠️ IL VUOTO SI DICE PRIMA DI PREMERE, non dopo. Il ramo di
            prima era `righe && righe.length === 0`, e non poteva
            comparire mai: il pulsante e' disattivato quando la rete e'
            vuota, quindi `righe` non diventa mai un elenco vuoto. Chi
            apriva il pannello su una rete senza circoli trovava un
            tasto spento e nessuna spiegazione. */}
        {circoli.length === 0 && (
          <p className="admin-empty-text">Nessun circolo nella rete: non c’è ancora niente da contare.</p>
        )}
      </div>
    </SezioneCollassabile>
  );
}
