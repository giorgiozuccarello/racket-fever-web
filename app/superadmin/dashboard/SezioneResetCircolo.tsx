'use client';

// ============================================================
// RESET DEL CIRCOLO — lo strumento che prima stava nella Dashboard di
// ogni presidente, sotto il nome «Test Reset».
//
// ⚠️ TRE GESTI, NON UNO, e la differenza fra loro non è di grado: è di
// natura. Il primo rimette in gioco le sfide, il secondo pulisce anche
// quello che il circolo ha pubblicato, il terzo porta via il denaro —
// crediti, debiti, registro. Un pulsante solo che facesse tutto sarebbe
// premuto per azzerare due sfide di prova e si porterebbe via i conti di
// quaranta soci.
//
// ⚠️ E IL TOTALE PROPONE L'ARCHIVIO PRIMA DI TOCCARE NIENTE. Il registro
// movimenti è il libro contabile del circolo: è la sola prova che ha il
// giorno che un socio contesta un addebito. Cancellarlo senza copia non
// è ripartire puliti, è distruggere la difesa di qualcun altro. Quindi
// il percorso passa da un riquadro che lo dice, con l'archiviazione in
// evidenza e il «senza archiviare» defilato — e l'archivio si riapre e
// si riscarica da qui sotto, altrimenti non varrebbe niente.
// ============================================================

import { useEffect, useMemo, useState } from 'react';
import {
  LivelloReset, ArchivioRegistro, RigaArchivio,
  ascoltaArchiviCircolo, leggiRigheArchivio, archiviaRegistro, resettaCircolo, csvDaRighe,
} from '../../../data/resetCircolo';

const LIVELLI: Array<{
  chiave: LivelloReset; titolo: string; cosaFa: string; quando: string; grave: boolean;
}> = [
  {
    chiave: 'sfide',
    titolo: 'Reset Sfide',
    cosaFa: 'Cancella tutte le sfide del circolo — anche quelle concluse — con le loro chat, '
      + 'libera le ore prenotate rimborsando quelle non ancora giocate, e azzera le posizioni '
      + 'della classifica sociale.',
    quando: 'Quando le sfide si sono impuntate, o dopo una sessione di prove.',
    grave: false,
  },
  {
    chiave: 'medio',
    titolo: 'Reset Medio',
    cosaFa: 'Tutto quello del Reset Sfide, più la bacheca e i tornei pubblicati dal circolo.',
    quando: 'Quando il circolo vuole ripartire con la vetrina pulita.',
    grave: false,
  },
  {
    chiave: 'totale',
    titolo: 'Reset Totale',
    cosaFa: 'Tutto quello sopra, più prenotazioni, richieste di lezione, notifiche di soci, '
      + 'maestri e circolo, e — questa è la parte seria — crediti, debiti e l’intero registro '
      + 'movimenti. I portafogli tornano a zero e il registro riparte con una riga di apertura '
      + 'per ogni socio ancora tesserato.',
    quando: 'Solo per un blocco tecnico permanente. Non è uno strumento di manutenzione.',
    grave: true,
  },
];

const euro = (n: number) => `€ ${(n ?? 0).toFixed(2).replace('.', ',')}`;
const quando = (ms: number | null) => (ms && ms > 0 ? new Date(ms).toLocaleString('it-IT') : '—');

export default function SezioneResetCircolo({ circoloId, nomeCircolo }: {
  circoloId: string; nomeCircolo: string;
}) {
  const [archivi, setArchivi] = useState<ArchivioRegistro[]>([]);
  const [erroreArchivi, setErroreArchivi] = useState('');
  const [scelto, setScelto] = useState<LivelloReset | null>(null);
  const [nomeScritto, setNomeScritto] = useState('');
  const [inCorso, setInCorso] = useState('');
  const [errore, setErrore] = useState('');
  const [esito, setEsito] = useState('');
  const [archiviato, setArchiviato] = useState('');
  const [senzaArchivioAccettato, setSenzaArchivioAccettato] = useState(false);

  // Archivio aperto a schermo: id, righe e stato di caricamento.
  const [aperto, setAperto] = useState<ArchivioRegistro | null>(null);
  const [righeAperte, setRigheAperte] = useState<RigaArchivio[] | null>(null);
  const [erroreApertura, setErroreApertura] = useState('');
  // ⚠️ Separato da `erroreApertura`, che si vede solo dentro un archivio
  // aperto: premendo «Scarica» su una riga chiusa, un errore finiva in
  // uno stato che nessuno stava mostrando — nessun file, nessun
  // messaggio, un tasto che non fa niente.
  const [erroreScarico, setErroreScarico] = useState('');

  useEffect(() => {
    setArchivi([]); setErroreArchivi(''); setAperto(null); setRigheAperte(null);
    setScelto(null); setEsito(''); setErrore(''); setArchiviato('');
    return ascoltaArchiviCircolo(circoloId, setArchivi, (e) => {
      setErroreArchivi(e instanceof Error ? e.message : 'Elenco degli archivi non leggibile.');
    });
  }, [circoloId]);

  const livello = useMemo(() => LIVELLI.find((l) => l.chiave === scelto) ?? null, [scelto]);
  // ⚠️ LA STESSA NORMALIZZAZIONE DEL SERVER, spazi interni compresi.
  // Il server confronta con `replace(/\s+/g, ' ')`; qui non lo si
  // faceva, e per un circolo il cui nome contiene un doppio spazio —
  // capita, l'onboarding non lo impedisce — chi digitava il nome in
  // modo naturale si trovava il tasto grigio e inerte, senza una parola
  // che spiegasse perché. Il server lo avrebbe accettato.
  const normalizza = (t: string) => t.trim().toLowerCase().replace(/\s+/g, ' ');
  const nomeGiusto = normalizza(nomeScritto) === normalizza(nomeCircolo);

  const archiviaOra = async () => {
    setErrore(''); setArchiviato(''); setInCorso('archivio');
    try {
      const r = await archiviaRegistro(circoloId);
      setArchiviato(
        r.righe === 0
          ? 'Il registro era vuoto: l’archivio è stato scritto lo stesso, e lo dice.'
          : `Archiviate ${r.righe} righe — ${euro(r.totaleEntrate)} in entrata, ${euro(Math.abs(r.totaleUscite))} in uscita. `
            + 'Adesso la trovi qui sotto, riapribile e scaricabile.',
      );
    } catch (e: unknown) {
      setErrore(e instanceof Error ? e.message : 'Archiviazione non riuscita.');
    } finally {
      setInCorso('');
    }
  };

  const eseguiReset = async () => {
    if (!scelto) return;
    setErrore(''); setEsito(''); setInCorso('reset');
    try {
      const r = await resettaCircolo(circoloId, scelto, nomeScritto);
      const c = r.conta ?? {};
      const pezzi: string[] = [];
      if (c.sfide != null) pezzi.push(`${c.sfide} sfide`);
      if (c.sfideFallite) pezzi.push(`⚠️ ${c.sfideFallite} sfide non cancellate`);
      if (c.avvisi != null) pezzi.push(`${c.avvisi} avvisi di bacheca`);
      if (c.tornei != null) pezzi.push(`${c.tornei} tornei`);
      if (c.prenotazioni != null) pezzi.push(`${c.prenotazioni} prenotazioni`);
      if (c.movimenti != null) pezzi.push(`${c.movimenti} righe di registro`);
      if (c.richieste_lezione != null) pezzi.push(`${c.richieste_lezione} richieste di lezione`);
      if (c.avvisiSenzaCircolo) pezzi.push(`${c.avvisiSenzaCircolo} avvisi senza circolo`);
      if (c.posizioniAzzerate != null) pezzi.push(`${c.posizioniAzzerate} posizioni di classifica azzerate`);
      if (c.sociAzzerati != null) pezzi.push(`${c.sociAzzerati} portafogli azzerati`);
      setEsito(`Fatto su «${r.nomeCircolo}»: ${pezzi.join(', ')}.`);
      setScelto(null); setNomeScritto('');
    } catch (e: unknown) {
      setErrore(e instanceof Error ? e.message : 'Reset non riuscito.');
    } finally {
      setInCorso('');
    }
  };

  const apriArchivio = async (a: ArchivioRegistro) => {
    if (aperto?.id === a.id) { setAperto(null); setRigheAperte(null); return; }
    setAperto(a); setRigheAperte(null); setErroreApertura('');
    try {
      setRigheAperte(await leggiRigheArchivio(a.id));
    } catch (e: unknown) {
      setErroreApertura(e instanceof Error ? e.message : 'Archivio non leggibile.');
    }
  };

  const scarica = async (a: ArchivioRegistro) => {
    setErroreScarico('');
    try {
      const righe = (aperto?.id === a.id && righeAperte) ? righeAperte : await leggiRigheArchivio(a.id);
      const url = URL.createObjectURL(new Blob([csvDaRighe(righe)], { type: 'text/csv;charset=utf-8' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = `registro-${a.nomeCircolo.replace(/[^a-zA-Z0-9]+/g, '-').toLowerCase()}-${new Date(a.creatoIlMs).toISOString().slice(0, 10)}.csv`;
      // ⚠️ Dentro il documento prima del click, e l'indirizzo si libera
      // dopo: su Firefox un <a> mai inserito non scarica, e revocare
      // subito dopo il click lascia a WebKit un indirizzo già morto.
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (e: unknown) {
      setErroreScarico(e instanceof Error ? e.message : 'Download non riuscito.');
    }
  };

  return (
    <>
      <div className="superadmin-subtitolo">Reset del circolo</div>
      <p className="admin-card-hint">
        Strumenti di assistenza. Non sono in mano al circolo: da qui si rimette in piedi un club
        che si è impuntato, senza dare a ogni presidente il potere di svuotare il proprio.
      </p>

      {!!esito && <div className="admin-ok-text">{esito}</div>}
      {!!errore && <div className="admin-error-text">{errore}</div>}

      {LIVELLI.map((l) => (
        <div key={l.chiave} className="reset-livello">
          <div className="reset-livello-testa">
            <span className={`reset-livello-nome${l.grave ? ' grave' : ''}`}>{l.titolo}</span>
            <button
              className={`admin-btn-piccolo${l.grave ? ' admin-btn-danger' : ''}`}
              onClick={() => { setScelto(l.chiave); setNomeScritto(''); setErrore(''); setEsito(''); setArchiviato(''); setSenzaArchivioAccettato(false); }}
            >
              Avvia
            </button>
          </div>
          <p className="admin-card-hint reset-livello-cosa">{l.cosaFa}</p>
          <p className="admin-card-hint reset-livello-quando">{l.quando}</p>
        </div>
      ))}

      {/* ---------------- La conferma ---------------- */}
      {livello && (
        <div className="admin-modal-backdrop" onClick={() => !inCorso && setScelto(null)}>
          <div className="admin-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="admin-modal-title">{livello.titolo} — {nomeCircolo}</div>
            <p className="admin-modal-sub">{livello.cosaFa}</p>

            {/* ⚠️ IL RIQUADRO DELL'ARCHIVIO ESISTE SOLO QUI, sul totale,
                perché solo il totale porta via il registro. Sugli altri
                due livelli sarebbe rumore che insegna a saltare i
                riquadri gialli. */}
            {livello.chiave === 'totale' && (
              <div className="reset-archivio-avviso">
                <strong>Prima archivia il registro.</strong> Il registro movimenti è il libro
                contabile del circolo: è quello che permette di rispondere il giorno che un socio
                contesta un addebito o rivendica un credito. Questo reset lo cancella. L’archivio
                resta qui, si riapre e si riscarica in qualunque momento.
                {!!archiviato && <div className="admin-ok-text" style={{ marginTop: '.5rem' }}>{archiviato}</div>}
                <button
                  className="admin-btn-full"
                  style={{ marginTop: '.6rem' }}
                  onClick={archiviaOra}
                  disabled={inCorso !== ''}
                >
                  {inCorso === 'archivio' ? 'Archiviazione in corso…' : 'Archivia il registro adesso'}
                </button>
              </div>
            )}

            {/* ⚠️ SENZA ARCHIVIO SI PUÒ, MA SI DICHIARA. Il percorso
                «archivio fallito → resetta lo stesso» era a due click e
                senza attriti: se l'archiviazione andava storta il tasto
                restava acceso e il testo diceva «Resetta senza
                archiviare», che a quel punto è una constatazione, non
                una scelta. Ora è una scelta. */}
            {livello.chiave === 'totale' && !archiviato && (
              <label className="admin-card-hint" style={{ display: 'flex', gap: '.5rem', alignItems: 'flex-start', marginTop: '.8rem' }}>
                <input
                  type="checkbox"
                  checked={senzaArchivioAccettato}
                  onChange={(e) => setSenzaArchivioAccettato(e.target.checked)}
                  disabled={inCorso !== ''}
                />
                <span>
                  Procedo <strong>senza archiviare</strong>: so che il registro movimenti di questo
                  circolo sparisce e non sarà più recuperabile.
                </span>
              </label>
            )}

            <p className="admin-card-hint" style={{ marginTop: '.8rem' }}>
              Per confermare, riscrivi il nome esatto del circolo.
            </p>
            <input
              className="admin-input"
              value={nomeScritto}
              onChange={(e) => setNomeScritto(e.target.value)}
              placeholder={nomeCircolo}
              disabled={inCorso !== ''}
            />
            {!!errore && <div className="admin-error-text">{errore}</div>}
            <div className="admin-modal-btn-row">
              <button className="admin-modal-btn-cancel" onClick={() => setScelto(null)} disabled={inCorso !== ''}>
                Annulla
              </button>
              <button
                className="admin-modal-btn-confirm danger"
                onClick={eseguiReset}
                disabled={!nomeGiusto || inCorso !== '' || (livello.chiave === 'totale' && !archiviato && !senzaArchivioAccettato)}
              >
                {inCorso === 'reset' ? 'In corso…' : (livello.chiave === 'totale' && !archiviato ? 'Resetta senza archiviare' : 'Resetta')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---------------- Gli archivi ---------------- */}
      <div className="superadmin-subtitolo">Archivi del registro</div>
      <p className="admin-card-hint">
        Una copia integrale del registro movimenti, riapribile e scaricabile in qualunque
        momento. Si scrive da qui, oppure prima di un Reset Totale.
      </p>
      {!!archiviato && <div className="admin-ok-text">{archiviato}</div>}
      {erroreArchivi && <div className="admin-error-text">{erroreArchivi}</div>}
      {erroreScarico && <div className="admin-error-text">{erroreScarico}</div>}
      {/* ⚠️ L'archiviazione ha una porta SUA, e non solo quella dentro il
          modale del Reset Totale: per consegnare a un circolo la copia
          dei propri conti non si deve essere costretti ad aprire il
          gesto più distruttivo del pannello e poi annullarlo. */}
      <button
        className="admin-btn-piccolo"
        style={{ marginBottom: '.4rem' }}
        onClick={archiviaOra}
        disabled={inCorso !== ''}
      >
        {inCorso === 'archivio' ? 'Archiviazione in corso…' : 'Archivia il registro adesso'}
      </button>
      {archivi.length === 0 ? (
        <p className="admin-empty-text">
          Nessun archivio per questo circolo. Se ne crea uno dal Reset Totale, oppure quando serve
          consegnare al circolo una copia dei propri conti.
        </p>
      ) : archivi.map((a) => (
        <div key={a.id} className="reset-archivio-riga">
          <div className="reset-archivio-testa">
            <div>
              <div className="admin-list-main">{quando(a.creatoIlMs)}</div>
              <div className="admin-list-sub">
                {a.righe} righe · {euro(a.totaleEntrate)} in entrata · {euro(Math.abs(a.totaleUscite))} in uscita
                {a.primaRigaMs ? ` · dal ${quando(a.primaRigaMs)} al ${quando(a.ultimaRigaMs)}` : ''}
              </div>
            </div>
            <div style={{ display: 'flex', gap: '.4rem' }}>
              <button className="admin-btn-piccolo" onClick={() => apriArchivio(a)}>
                {aperto?.id === a.id ? 'Chiudi' : 'Consulta'}
              </button>
              <button className="admin-btn-piccolo" onClick={() => scarica(a)}>Scarica</button>
            </div>
          </div>

          {aperto?.id === a.id && (
            <div className="reset-archivio-corpo">
              {erroreApertura && <div className="admin-error-text">{erroreApertura}</div>}
              {righeAperte === null && !erroreApertura && <p className="admin-card-hint">Lettura dell’archivio…</p>}
              {righeAperte !== null && righeAperte.length === 0 && (
                <p className="admin-empty-text">Questo archivio è vuoto: il registro non aveva righe.</p>
              )}
              {righeAperte !== null && righeAperte.length > 0 && (
                <div className="scheda-tabella-culla">
                  <table className="scheda-tabella">
                    <thead>
                      <tr>
                        <th>Data</th><th>Socio</th><th>Tipo</th><th>Importo</th>
                        <th>Saldo dopo</th><th>Descrizione</th><th>Eseguito da</th>
                      </tr>
                    </thead>
                    <tbody>
                      {righeAperte.map((r) => (
                        <tr key={r.id}>
                          <td>{quando(r.quandoMs)}</td>
                          <td>{r.socioNome || '—'}</td>
                          <td>{r.tipo}</td>
                          <td className={r.importo < 0 ? 'scheda-td-debito' : undefined}>{euro(r.importo)}</td>
                          <td>{euro(r.saldoDopo)}</td>
                          <td>{r.descrizione || '—'}</td>
                          <td>{r.eseguitoDaNome || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      ))}
    </>
  );
}
