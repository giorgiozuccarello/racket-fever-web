'use client';

// ============================================================
// I CINQUE RIQUADRI DEL CONTEGGIO — UN GRUPPO ALLA VOLTA.
//
// Mezz'ore prenotate, mezz'ore annullate, il netto fra le due, quel
// netto detto in ore, e il totale incassato. Sempre gli stessi cinque
// numeri, nello stesso ordine.
//
// ⚠️ QUESTO COMPONENTE DISEGNA UN CONTO SOLO, e chi lo monta lo monta
// DUE VOLTE: una con `modo="live"` e una con `modo="maturato"`. Non è
// un dettaglio di comodo — sono due domande diverse, e la ragione per
// cui vanno tenute separate è scritta per esteso in cima a
// `data/ricavi.ts`:
//
//   - «Prenotato adesso» (live): quante mezz'ore risultano prenotate
//     nel momento in cui si guarda, comprese quelle di domani e del
//     mese prossimo. È la fotografia del presente.
//   - «Maturato»: quante mezz'ore sono state davvero giocate, con il
//     taglio a mezzanotte di ieri. È il numero su cui si fattura.
//
// ⚠️ E I DUE PULSANTI NON FANNO LA STESSA COSA. Il live è già giusto
// da sé — lo tengono aggiornato i trigger del server a ogni
// prenotazione e a ogni disdetta — quindi il suo pulsante RILEGGE il
// documento e basta, senza chiamare nessuna funzione. Il maturato
// invece va portato avanti: il suo pulsante chiama il server
// (`aggiornaMaturato`) e poi rilegge. Chi unificasse i due rami per
// «togliere una condizione» farebbe una chiamata al server ogni volta
// che qualcuno vuole solo rivedere il prenotato.
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
// ⚠️ QUI DENTRO NON C'È NESSUNA COMMISSIONE, e non ce ne deve arrivare.
// Questo file sta sotto `app/admin/`, cioè in una schermata che si apre
// con le credenziali di un Admin di circolo — credenziali che un
// revisore di App Store potrebbe avere. Quanto il circolo paga a Racket
// Fever vive in `data/commissione.ts`, che lo importa SOLO
// `app/superadmin/`. Il riquadro della commissione esiste, ma lo
// disegna il pannello di rete e glielo passa da fuori con
// `riquadroInPiu` — così il numero non passa nemmeno di qui.
//
// ⚠️ LA MATEMATICA NON STA QUI. Sta in `data/ricavi.ts`, la lettura in
// `data/ricaviRepo.ts`. Qui si prendono i numeri già fatti e si mettono
// in cinque caselle. Chi si trovasse a sommare prenotazioni dentro
// questo file si fermi e rilegga i riquadri di quei due moduli.
// ============================================================

import { ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import {
  Conteggio, conMigliaia, euroDaCentesimi, mezzOreNette, oreNette, oreScritte,
} from '../../../data/ricavi';
import {
  LetturaConteggio, aggiornaMaturato, leggiLive, leggiMaturato,
} from '../../../data/ricaviRepo';

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

// Quello che serve a tutti e due i conti.
export interface TestiConteggio {
  // Il pulsante e la sua attesa. ⚠️ Il pulsante del live e quello del
  // maturato NON si chiamano allo stesso modo, e non è un vezzo: fanno
  // due cose diverse, e due tasti gemelli in colonna insegnano che
  // premerne uno o l'altro è lo stesso.
  aggiorna: string;
  attendi: string;
  // Le cinque etichette, nell'ordine in cui compaiono.
  etPrenotate: string;
  etAnnullate: string;
  etNette: string;
  etOre: string;
  etIncasso: string;
  // «Non abbiamo ancora contato», che non è «zero».
  nonTrovato: string;
  erroreLettura: (motivo: string) => string;
  // La riga di chiusura del gruppo: che cosa c'è dentro questi numeri.
  nota: string;
}

// Quello che serve al solo maturato. ⚠️ È un tipo a parte e non cinque
// campi facoltativi: così chi monta il maturato NON PUÒ dimenticarsi la
// frase che dice fin dove arriva il conto — è un errore rosso in
// compilazione, non una schermata muta.
export interface TestiMaturato extends TestiConteggio {
  erroreAggiornamento: (motivo: string) => string;
  incompleto: string;
  finoAl: (data: string) => string;
  finoANiente: string;
}

// Da quando si conta. Sta fuori dai due gruppi perché la data di
// ingresso in rete è una sola e vale per tutti e due: ripeterla sopra
// ogni fila sarebbe la stessa riga scritta due volte a mezzo schermo di
// distanza.
export interface TestiAttivoDal {
  etichetta: string;
  attivoDal: (data: string) => string;
  ignoto: string;
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

// 'YYYY-MM-DD' → 'DD/MM/YYYY'. Il giorno del taglio arriva già scritto
// così e non è un timestamp: si riordina, non si converte.
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

// ============================================================
// LA RIGA «ATTIVO DAL …».
//
// Sta sopra i due gruppi e non dentro nessuno dei due: un totale senza
// il suo punto di partenza è un numero che non si può giudicare —
// grande o piccolo rispetto a che cosa?
// ============================================================
export function RigaAttivoDal({ attivatoIlMs, testi }: {
  // Null quando il circolo è nato prima che il dato venisse raccolto —
  // e allora si dice, invece di inventarne una.
  attivatoIlMs: number | null;
  testi: TestiAttivoDal;
}) {
  return (
    <div className="scheda-vivo">
      <span className="scheda-vivo-et">{testi.etichetta}</span>
      <span className="scheda-vivo-n">
        {attivatoIlMs ? testi.attivoDal(giornoLeggibile(attivatoIlMs)) : testi.ignoto}
      </span>
    </div>
  );
}

type Comuni = {
  circoloId: string;
  // ⚠️ UN RIQUADRO IN PIÙ, DISEGNATO DA CHI MONTA. Serve al pannello di
  // rete, che accanto ai cinque numeri del maturato mette la
  // commissione dovuta. Il conto della commissione NON può passare di
  // qui — questo file sta sotto `app/admin/` — quindi qui arriva già
  // disegnato, e questo componente si limita a dargli il conteggio su
  // cui farlo. `null` quando una lettura buona non c'è: chi disegna
  // deve mostrare il trattino, non uno zero.
  riquadroInPiu?: (conteggio: Conteggio | null) => ReactNode;
};

export type PropsRiquadri =
  | (Comuni & { modo: 'live'; testi: TestiConteggio })
  | (Comuni & { modo: 'maturato'; testi: TestiMaturato });

export default function RiquadriConteggio(props: PropsRiquadri) {
  const { circoloId, modo, testi, riquadroInPiu } = props;
  // Le frasi che esistono solo per il maturato. `null` sul live, e
  // sotto si guarda sempre con `?.`: così il ramo del live non può
  // finire a leggere una frase che non gli è stata data.
  const testiMat = props.modo === 'maturato' ? props.testi : null;

  const [lettura, setLettura] = useState<LetturaConteggio | null>(null);
  const [caricando, setCaricando] = useState(false);
  // ⚠️ TRE SPIE E NON UNA, perché sono tre fatti diversi e chi legge
  // deve poterli distinguere:
  //   - `erroreLettura`: i numeri non ci sono. È l'unico caso in cui i
  //     riquadri non vogliono dire niente.
  //   - `avvisoAggiornamento`: i numeri ci sono ma sono quelli di
  //     prima, perché la richiesta di portare avanti il maturato non è
  //     passata (permessi, rete). Non è un errore dei numeri.
  //   - `incompleto`: il server si è fermato al suo tetto di giorni per
  //     chiamata. I numeri sono veri ma non arrivano a ieri.
  // Le ultime due riguardano il solo maturato: sul live non c'è niente
  // da portare avanti, quindi non c'è niente che possa fermarsi a metà.
  const [erroreLettura, setErroreLettura] = useState('');
  const [avvisoAggiornamento, setAvvisoAggiornamento] = useState('');
  const [incompleto, setIncompleto] = useState(false);

  // ⚠️ Serve a non scrivere lo stato di un componente smontato, e non è
  // teoria: la scheda del Super Admin si chiude con un tasto mentre le
  // chiamate sono ancora in volo.
  const vivo = useRef(true);
  useEffect(() => {
    vivo.current = true;
    return () => { vivo.current = false; };
  }, []);

  // ============================================================
  // IL CARICAMENTO — e i due modi si separano proprio qui.
  //
  // ⚠️ SUL LIVE NON SI CHIAMA IL SERVER. Il documento del prenotato lo
  // riscrivono i trigger a ogni prenotazione e a ogni disdetta: è già
  // giusto nell'istante in cui lo si legge, e una funzione che lo
  // «aggiorna» non esiste. Il pulsante rilegge, e basta.
  //
  // ⚠️ SUL MATURATO SI AGGIORNA E POI SI LEGGE, e le due cose non si
  // annullano a vicenda. SE L'AGGIORNAMENTO FALLISCE SI LEGGE LO
  // STESSO: il totale salvato esiste anche quando la funzione del
  // server risponde di no — è quello dell'ultima volta che qualcuno ha
  // aggiornato — e mostrarlo dicendo che è fermo è molto meglio di una
  // schermata vuota. Il caso capita davvero: un Collaboratore, una rete
  // che cade.
  // ============================================================
  const carica = useCallback(async () => {
    setCaricando(true);
    setErroreLettura('');
    setAvvisoAggiornamento('');

    if (modo === 'maturato') {
      try {
        const esito = await aggiornaMaturato(circoloId);
        if (!vivo.current) return;
        setIncompleto(!esito.completo);
      } catch (e: unknown) {
        if (!vivo.current) return;
        // Il motivo che manda il server si riporta: «riprova più tardi»
        // è l'unica frase che non aiuta nessuno.
        const motivo = e instanceof Error ? e.message.trim() : String(e);
        setAvvisoAggiornamento(testiMat?.erroreAggiornamento(motivo) ?? motivo);
      }
    }

    try {
      const l = modo === 'live' ? await leggiLive(circoloId) : await leggiMaturato(circoloId);
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
    // ⚠️ `testi` e `testiMat` NON stanno fra le dipendenze, ed è voluto:
    // chi monta li ricompone a ogni disegno, e metterli qui vorrebbe
    // dire una chiamata al server a ogni disegno. Servono solo a
    // scrivere le frasi d'errore, e quelle si guardano nell'istante in
    // cui si scrivono.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [circoloId, modo]);

  // All'apertura, e a ogni cambio di circolo.
  //
  // ⚠️ Sul maturato questo vuol dire una chiamata al server all'apertura
  // della sezione, e non è uno spreco: di norma il server ha uno o due
  // mucchietti da sommare — i giorni chiusi da quando qualcuno ha
  // guardato l'ultima volta — e senza, il conto resterebbe fermo al
  // giorno della prima apertura e il pulsante servirebbe a recuperare
  // mesi. Sul live non costa niente: è una lettura di un documento.
  useEffect(() => {
    // Si azzera anche quello che c'è: passando da un circolo all'altro
    // senza smontare il componente si vedrebbero per un istante i
    // numeri di uno sotto il nome di un altro.
    setLettura(null);
    setIncompleto(false);
    carica();
  }, [carica]);

  // I numeri valgono solo se una lettura è arrivata E ha trovato il
  // documento.
  const conteggio = lettura && lettura.trovato ? lettura.conteggio : null;
  const nette = conteggio ? mezzOreNette(conteggio) : 0;

  return (
    <>
      <button className="admin-btn-full" onClick={carica} disabled={caricando}>
        {caricando ? testi.attendi : testi.aggiorna}
      </button>

      <div className="scheda-conti" style={{ marginTop: '.6rem' }}>
        <Riquadro
          valore={conteggio ? conMigliaia(conteggio.prenotate) : NIENTE}
          etichetta={testi.etPrenotate}
        />
        <Riquadro
          valore={conteggio ? conMigliaia(conteggio.annullate) : NIENTE}
          etichetta={testi.etAnnullate}
        />
        <Riquadro
          valore={conteggio ? conMigliaia(nette) : NIENTE}
          etichetta={testi.etNette}
        />
        <Riquadro
          valore={conteggio ? oreScritte(oreNette(conteggio)) : NIENTE}
          etichetta={testi.etOre}
        />
        <Riquadro
          valore={conteggio ? `${euroDaCentesimi(conteggio.centesimi)} €` : NIENTE}
          etichetta={testi.etIncasso}
        />
        {/* Il riquadro che chi monta aggiunge in coda — oggi solo la
            commissione del pannello di rete. Sta dentro la stessa fila
            apposta: è lo stesso oggetto degli altri cinque e deve
            somigliargli. */}
        {riquadroInPiu?.(conteggio)}
      </div>

      {/* ⚠️ «Non abbiamo ancora contato» e «zero» sono due frasi
          diverse, e la seconda sarebbe una bugia. */}
      {lettura && !lettura.trovato && (
        <p className="admin-card-hint scheda-attesa">{testi.nonTrovato}</p>
      )}
      {incompleto && !!testiMat && (
        <p className="admin-card-hint scheda-attesa">{testiMat.incompleto}</p>
      )}
      {!!avvisoAggiornamento && (
        <p className="admin-card-hint scheda-attesa">{avvisoAggiornamento}</p>
      )}
      {!!erroreLettura && <div className="admin-error-text">{erroreLettura}</div>}

      {/* Fin dove arriva il conto. Solo sul maturato: il live non ha un
          «fino a», è adesso. Senza questa riga il maturato si legge come
          «adesso», e le mezz'ore di oggi mancherebbero all'appello senza
          che nessuno sappia perché. */}
      {!!testiMat && !!lettura && lettura.trovato && (
        <p className="admin-card-hint scheda-nota">
          {lettura.finoAlGiornoIso
            ? testiMat.finoAl(giornoDaIso(lettura.finoAlGiornoIso))
            : testiMat.finoANiente}
        </p>
      )}

      <p className="admin-card-hint scheda-nota">{testi.nota}</p>
    </>
  );
}
