'use client';

// ============================================================
// I CINQUE RIQUADRI DEL CONTEGGIO — un solo componente, due padroni.
//
// Mezz'ore prenotate, mezz'ore annullate, il netto fra le due, quel
// netto detto in ore, e il totale incassato. Nient'altro: niente
// commissioni, niente periodi, niente righe di dettaglio. Si conta
// dalla creazione del circolo a oggi, e il totale cresce da solo.
//
// ⚠️ ESISTE IN UNA COPIA SOLA, ed è tutto il motivo per cui questo file
// c'è. Gli stessi cinque numeri si leggono nella Dashboard dell'Admin
// (sezione «Conteggio delle mezz'ore») e nella scheda che il Super
// Admin apre su un circolo qualunque. Scriverli due volte vorrebbe dire
// che il giorno in cui uno dei cinque cambia definizione, una delle due
// schermate resta indietro — e sono i numeri con cui il circolo si
// giudica.
//
// ⚠️ LE PAROLE ARRIVANO DA FUORI, i numeri no. La Dashboard dell'Admin
// è tradotta in tre lingue e passa le frasi prese dal dizionario; il
// pannello Super Admin non è tradotto e passa le stesse frasi scritte
// in italiano. Se questo componente chiamasse `useLingua` per conto
// suo, il pannello di rete si troverebbe in tedesco perché l'Admin di
// un circolo ha scelto così — è la stessa ragione scritta in cima a
// `lib/lingua.tsx`. Da qui l'oggetto `TestiConteggio`: la lingua è una
// decisione di chi monta, non di chi disegna.
//
// ⚠️ LA MATEMATICA NON STA QUI. Sta in `data/ricavi.ts`, la lettura in
// `data/ricaviRepo.ts`. Qui si prendono i numeri già fatti e si mettono
// in cinque caselle. Chi si trovasse a sommare prenotazioni dentro
// questo file si fermi e rilegga i riquadri di quei due moduli.
// ============================================================

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  conMigliaia, euroDaCentesimi, mezzOreNette, oreNette, oreScritte,
} from '../../../data/ricavi';
import { LetturaConteggio, aggiornaConteggio, leggiConteggio } from '../../../data/ricaviRepo';

// ============================================================
// LE PAROLE.
//
// Le etichette secche sono stringhe; le frasi che hanno un buco dentro
// sono funzioni, e non stringhe con `{data}` da rimpiazzare qui. Il
// rimpiazzo lo sa fare il dizionario (`traduci`), e rifarlo qui
// vorrebbe dire due meccanismi per la stessa cosa: chi passa italiano
// diretto compone la frase con un template, chi passa il dizionario la
// chiede al traduttore. Nessuno dei due deve sapere come funziona
// l'altro.
// ============================================================
export interface TestiConteggio {
  // Il pulsante e la sua attesa.
  aggiorna: string;
  attendi: string;
  // Le cinque etichette, nell'ordine in cui compaiono.
  etPrenotate: string;
  etAnnullate: string;
  etNette: string;
  etOre: string;
  etIncasso: string;
  // Da quando si conta.
  etAttivoDal: string;
  attivoDal: (data: string) => string;
  attivoDalIgnoto: string;
  // Fin dove arriva il conto, e perché non arriva fino ad adesso.
  finoA: (ora: string, data: string) => string;
  oraInCorso: string;
  // I tre casi che non sono «ecco i numeri».
  nonTrovato: string;
  incompleto: string;
  erroreAggiornamento: (motivo: string) => string;
  erroreLettura: (motivo: string) => string;
  // Che cosa sono quegli euro.
  notaIncasso: string;
}

// ⚠️ La data si compone a mano, gemella di quella della scheda circolo
// e di quella della Dashboard: `toLocaleDateString` cambia forma con la
// lingua, e la stessa data scritta in due modi nella stessa pagina fa
// dubitare del numero che le sta accanto.
export function giornoLeggibile(ms: number | null | undefined): string {
  if (!ms || ms <= 0) return '—';
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`;
}

// 'YYYY-MM-DD' → 'DD/MM/YYYY'. Il giorno della soglia arriva già
// scritto così e non è un timestamp: si riordina, non si converte.
function giornoDaIso(s: string): string {
  const p = s.split('-');
  return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : s;
}

// ⚠️ Il trattino e non «0»: finché non c'è una lettura buona quei
// numeri non esistono, e uno zero direbbe «non è stata prenotata
// nemmeno una mezz'ora» — che è un'altra affermazione, e falsa.
const NIENTE = '—';

function Riquadro({ valore, etichetta }: { valore: string; etichetta: string }) {
  // Le stesse classi delle caselle della Panoramica: sono lo stesso
  // oggetto — numerone ed etichetta — ed è voluto che si somiglino.
  return (
    <div className="scheda-conto">
      <span className="scheda-conto-n">{valore}</span>
      <span className="scheda-conto-et">{etichetta}</span>
    </div>
  );
}

export default function RiquadriConteggio({ circoloId, attivatoIlMs, testi }: {
  circoloId: string;
  // Da quando si conta: la data di creazione del circolo. Null quando
  // il circolo è nato prima che il dato venisse raccolto — e allora si
  // dice, invece di inventarne una.
  attivatoIlMs: number | null;
  testi: TestiConteggio;
}) {
  const [lettura, setLettura] = useState<LetturaConteggio | null>(null);
  const [caricando, setCaricando] = useState(false);
  // ⚠️ TRE SPIE E NON UNA, perché sono tre fatti diversi e chi legge
  // deve poterli distinguere:
  //   - `erroreLettura`: i numeri non ci sono. È l'unico caso in cui i
  //     riquadri non vogliono dire niente.
  //   - `avvisoAggiornamento`: i numeri ci sono ma sono quelli di
  //     prima, perché la richiesta di rifare la somma non è passata
  //     (permessi, rete). Non è un errore dei numeri.
  //   - `incompleto`: il server si è fermato al suo tetto di giorni per
  //     chiamata. I numeri sono veri ma non arrivano a oggi.
  const [erroreLettura, setErroreLettura] = useState('');
  const [avvisoAggiornamento, setAvvisoAggiornamento] = useState('');
  const [incompleto, setIncompleto] = useState(false);

  // ⚠️ Serve a non scrivere lo stato di un componente smontato, e non è
  // teoria: la scheda del Super Admin si chiude con un tasto mentre le
  // due chiamate sono ancora in volo.
  const vivo = useRef(true);
  useEffect(() => {
    vivo.current = true;
    return () => { vivo.current = false; };
  }, []);

  // ============================================================
  // PRIMA SI AGGIORNA, POI SI LEGGE — e le due cose non si annullano a
  // vicenda.
  //
  // ⚠️ SE L'AGGIORNAMENTO FALLISCE SI LEGGE LO STESSO. Il totale
  // salvato esiste anche quando la funzione del server risponde di no:
  // è quello dell'ultima volta che qualcuno ha aggiornato, e mostrarlo
  // dicendo che è fermo è molto meglio di una schermata vuota. Il caso
  // capita davvero — un Collaboratore, una rete che cade.
  // ============================================================
  const carica = useCallback(async () => {
    setCaricando(true);
    setErroreLettura('');
    setAvvisoAggiornamento('');

    try {
      const esito = await aggiornaConteggio(circoloId);
      if (!vivo.current) return;
      setIncompleto(!esito.completo);
    } catch (e: unknown) {
      if (!vivo.current) return;
      // Il motivo che manda il server si riporta: «riprova più tardi» è
      // l'unica frase che non aiuta nessuno.
      const motivo = e instanceof Error ? e.message.trim() : String(e);
      setAvvisoAggiornamento(testi.erroreAggiornamento(motivo));
    }

    try {
      const l = await leggiConteggio(circoloId, Date.now());
      if (!vivo.current) return;
      setLettura(l);
    } catch (e: unknown) {
      if (!vivo.current) return;
      const motivo = e instanceof Error ? e.message.trim() : String(e);
      setErroreLettura(testi.erroreLettura(motivo));
      setLettura(null);
    } finally {
      if (vivo.current) setCaricando(false);
    }
    // ⚠️ `testi` NON sta fra le dipendenze, ed è voluto: chi monta lo
    // ricompone a ogni disegno, e metterlo qui vorrebbe dire una
    // chiamata al server a ogni disegno. Serve solo a scrivere le frasi
    // d'errore, e quelle si guardano nell'istante in cui si scrivono.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [circoloId]);

  // All'apertura, e a ogni cambio di circolo. ⚠️ Non è uno spreco: di
  // norma il server ha uno o due mucchietti da sommare — quelli dei
  // giorni chiusi da quando qualcuno ha guardato l'ultima volta — e
  // senza, il conto resterebbe fermo al giorno della prima apertura.
  useEffect(() => {
    // Si azzera anche quello che c'è: passando da un circolo all'altro
    // senza smontare il componente si vedrebbero per un istante i
    // numeri di uno sotto il nome di un altro.
    setLettura(null);
    setIncompleto(false);
    carica();
  }, [carica]);

  // I numeri valgono solo se una lettura è arrivata E ha trovato il
  // documento del totale.
  const totale = lettura && lettura.trovato ? lettura.totale : null;
  const nette = totale ? mezzOreNette(totale) : 0;

  return (
    <>
      <button className="admin-btn-full" onClick={carica} disabled={caricando}>
        {caricando ? testi.attendi : testi.aggiorna}
      </button>

      {/* Da quando si conta. Sta sopra i numeri, non sotto: un totale
          senza il suo punto di partenza è un numero che non si può
          giudicare. */}
      <div className="scheda-vivo">
        <span className="scheda-vivo-et">{testi.etAttivoDal}</span>
        <span className="scheda-vivo-n">
          {attivatoIlMs ? testi.attivoDal(giornoLeggibile(attivatoIlMs)) : testi.attivoDalIgnoto}
        </span>
      </div>

      <div className="scheda-conti" style={{ marginTop: '.6rem' }}>
        <Riquadro
          valore={totale ? conMigliaia(totale.prenotate) : NIENTE}
          etichetta={testi.etPrenotate}
        />
        <Riquadro
          valore={totale ? conMigliaia(totale.annullate) : NIENTE}
          etichetta={testi.etAnnullate}
        />
        <Riquadro
          valore={totale ? conMigliaia(nette) : NIENTE}
          etichetta={testi.etNette}
        />
        <Riquadro
          valore={totale ? oreScritte(oreNette(totale)) : NIENTE}
          etichetta={testi.etOre}
        />
        <Riquadro
          valore={totale ? `${euroDaCentesimi(totale.centesimi)} €` : NIENTE}
          etichetta={testi.etIncasso}
        />
      </div>

      {/* ⚠️ «Non abbiamo ancora contato» e «zero» sono due frasi
          diverse, e la seconda sarebbe una bugia. */}
      {lettura && !lettura.trovato && (
        <p className="admin-card-hint scheda-attesa">{testi.nonTrovato}</p>
      )}
      {incompleto && (
        <p className="admin-card-hint scheda-attesa">{testi.incompleto}</p>
      )}
      {!!avvisoAggiornamento && (
        <p className="admin-card-hint scheda-attesa">{avvisoAggiornamento}</p>
      )}
      {!!erroreLettura && <div className="admin-error-text">{erroreLettura}</div>}

      {/* Fin dove arriva il conto, e perché non arriva fino ad adesso.
          Senza questa riga il totale si legge come «adesso», e alle
          18:40 mancherebbero all'appello le mezz'ore delle 18:00 senza
          che nessuno sappia perché. */}
      {lettura && (
        <p className="admin-card-hint scheda-nota">
          {testi.finoA(lettura.sogliaOra, giornoDaIso(lettura.sogliaGiornoIso))}
          {' '}
          {testi.oraInCorso}
        </p>
      )}
      <p className="admin-card-hint scheda-nota">{testi.notaIncasso}</p>
    </>
  );
}
