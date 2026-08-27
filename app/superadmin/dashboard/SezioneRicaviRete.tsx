'use client';

// ============================================================
// RICAVI DI RETE — quanto sta incassando Racket Fever su TUTTI i
// circoli, nel periodo in corso di ciascuno.
//
// È la gemella di `app/admin/dashboard/SezioneRicavi.tsx` vista
// dall'altra parte del tavolo: là un circolo solo guarda quanto deve,
// qui il team guarda quanto entra da tutta la rete e da chi.
//
// La matematica non sta qui: sta in `data/ricavi.ts`, la lettura in
// `data/ricaviRepo.ts`. Questa schermata non conta niente per conto
// suo — somma numeri che il server ha già scritto. Chi si trovasse a
// rileggere prenotazioni dentro questo file si fermi e rilegga il
// riquadro in cima a `ricaviRepo.ts`.
//
// ⚠️ I PERIODI DEI CIRCOLI NON COINCIDONO, e il totale di rete è la
// somma di trimestri che cominciano in giorni diversi. Il periodo è
// ancorato all'anniversario di ciascun circolo (vedi il riquadro «IL
// PERIODO» in `data/ricavi.ts`), quindi in questa pagina si sommano un
// circolo che è all'ottantesimo giorno del suo trimestre e uno che è al
// terzo. Non è un difetto ed è l'unico modo di avere una fattura per
// circolo che cada sul suo anniversario — ma è la prima cosa che
// qualcuno noterà, e per questo è scritta a schermo sopra i totali
// invece che in un commento come questo. Chi volesse un totale «di
// rete al 31 marzo» deve chiedere al server un conteggio a calendario:
// non si può ricavare da qui.
//
// ⚠️ SI LEGGE A PRESSIONE DI TASTO, MAI ALL'APERTURA. È un documento
// per circolo: su una rete di cento circoli sono cento letture, e
// farle a ogni apertura del pannello vorrebbe dire pagarle anche a chi
// era entrato per tutt'altro. È la stessa regola — e la stessa
// ragione — della sezione Fatturazione qui accanto.
//
// ⚠️ NIENTE `useLingua` IN QUESTO FILE. Il pannello Super Admin non è
// tradotto e non deve esserlo: lo guarda il team Racket Fever, che
// scrive in italiano. Vale per tutte le sezioni di `app/superadmin/`.
// ============================================================

import { useEffect, useMemo, useState } from 'react';
import SezioneCollassabile from '../../admin/dashboard/SezioneCollassabile';
import {
  Circolo, attivazioneCircoloMs, etichettaStatoCircolo, statoCircolo,
} from '../../../data/circoli';
import { ascoltaCircoli } from '../../../data/circoliRepo';
import {
  CENTESIMI_PER_SLOT, Cadenza, ConteggioPeriodo, PeriodoRicavi,
  centesimiDovuti, conMigliaia, euroDaCentesimi, slotNetti,
} from '../../../data/ricavi';
import { leggiConteggio } from '../../../data/ricaviRepo';

// ⚠️ TRIMESTRE FISSO E NIENTE TENDINA, esattamente come nella gemella
// dell'Admin: la chiave del periodo entra nel nome del documento che il
// server scrive, e il server ne scrive UNA sola. Scegliendo «anno» qui
// non si vedrebbe lo stesso conto raggruppato diversamente — si
// vedrebbe «non stiamo ancora contando» per tutta la rete, perché il
// documento `anno-0001` non esiste.
const CADENZA: Cadenza = 'trimestre';

// ⚠️ QUANTI CIRCOLI PER ONDATA. Le letture sono una per circolo e si
// fanno in parallelo, ma non tutte insieme: cento `getDoc` sparati nello
// stesso istante li apre davvero tutti e cento, e su una connessione
// normale il risultato è che le ultime scadono in timeout mentre le
// prime sono già tornate — cioè una tabella con dei buchi che sembrano
// «nessun conteggio» e non lo sono.
//
// ⚠️ NON C'ERA GIÀ UN MODO DA RIUSARE: la sezione Fatturazione fa un
// `Promise.all` su tutti i circoli in una volta. Su una rete piccola
// non si nota; il giorno che si nota, il rimedio va messo lì e qui
// insieme — meglio ancora, va spostato in un aiuto condiviso.
const CIRCOLI_PER_ONDATA = 10;

const GIORNO_MS = 24 * 60 * 60 * 1000;

// I numeri si separano all'italiana come nel resto della dashboard.
// ⚠️ `conMigliaia` e non `toLocaleString`: è la funzione del progetto,
// ed è la stessa che compone la parte intera degli euro — due formati
// diversi per due numeri vicini si leggono come un errore.
const CONTA = (n: number) => conMigliaia(n);
const EURO = (centesimi: number) => `${euroDaCentesimi(centesimi)} €`;
const PERCENTO = (n: number) =>
  `${n.toLocaleString('it-IT', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;

// La data si compone a mano, gemella di quella della sezione
// dell'Admin: la stessa data scritta in due modi nella stessa pagina fa
// dubitare del numero che le sta accanto.
function giorno(ms: number | null | undefined): string {
  if (!ms || ms <= 0) return '—';
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`;
}

interface Riga {
  circolo: Circolo;
  periodo: PeriodoRicavi | null;
  conteggio: ConteggioPeriodo | null;
  // Falso quando il documento del periodo non esiste: vuol dire che in
  // questo periodo non è stata prenotata nemmeno una mezz'ora, oppure
  // che il circolo è nato prima dei contatori.
  //
  // ⚠️ «NESSUN CONTEGGIO» NON È «ZERO PRENOTAZIONI», e a schermo sono
  // due frasi diverse: la prima dice che per quel circolo non stiamo
  // ancora contando — cioè che un numero mancante è nostro, non suo.
  trovato: boolean;
  // ⚠️ E «non me l'hanno fatta leggere» è una terza cosa ancora. Una
  // lettura respinta dalle regole non si risolve aspettando: si risolve
  // guardando le regole. Confonderla con «non c'è ancora» significa non
  // guardarle mai. È la stessa distinzione della sezione Fatturazione.
  respinta: boolean;
  netti: number;
  centesimi: number;
}

// Un numero grande con la sua etichetta. Gli stili sono qui e non in
// `globals.css` perché questa è una bozza: quando la forma è decisa si
// spostano di là, in una classe con un nome. Gemello di quello della
// sezione dell'Admin.
function Grande({ etichetta, valore, sotto }: {
  etichetta: string; valore: string; sotto?: string;
}) {
  return (
    <div
      style={{
        flex: 1, minWidth: 200, background: '#fff', border: '1.5px solid #E9E5D9',
        borderRadius: 12, padding: '.9rem 1rem',
      }}
    >
      <div style={{ fontSize: '.78rem', fontWeight: 800, color: 'var(--grigio)', lineHeight: 1.3 }}>
        {etichetta}
      </div>
      <div style={{ fontSize: '2.1rem', fontWeight: 900, lineHeight: 1.15, marginTop: '.2rem' }}>
        {valore}
      </div>
      {!!sotto && (
        <div style={{ fontSize: '.74rem', color: 'var(--grigio)', marginTop: '.25rem', lineHeight: 1.4 }}>
          {sotto}
        </div>
      )}
    </div>
  );
}

function Dato({ valore, etichetta }: { valore: string; etichetta: string }) {
  return (
    <div className="scheda-conto">
      <span className="scheda-conto-n">{valore}</span>
      <span className="scheda-conto-et">{etichetta}</span>
    </div>
  );
}

export default function SezioneRicaviRete() {
  const [circoli, setCircoli] = useState<Circolo[]>([]);
  const [righe, setRighe] = useState<Riga[] | null>(null);
  // L'istante della lettura, congelato: i periodi si calcolano su
  // questo e non su `Date.now()`, altrimenti i confini a schermo
  // cambierebbero a ogni ridisegno senza che nessuno abbia toccato
  // niente — e su una tabella di cento righe si vedrebbe.
  const [adessoMs, setAdessoMs] = useState(0);
  const [caricando, setCaricando] = useState(false);
  const [errore, setErrore] = useState('');

  useEffect(() => ascoltaCircoli(setCircoli), []);

  // ⚠️ SI LEGGONO SOLO I CIRCOLI ATTIVI. Su un circolo sospeso o chiuso
  // non si prenota più: il suo contatore è fermo al giorno della
  // sospensione, e sommarlo vorrebbe dire mettere nel fatturato di
  // questo trimestre delle mezz'ore che nessuno ha giocato. È anche la
  // ragione per cui non si spende una lettura per andarlo a prendere.
  const attivi = useMemo(
    () => circoli.filter((c) => statoCircolo(c) === 'attivo'),
    [circoli],
  );
  const nonAttivi = circoli.length - attivi.length;

  const carica = async () => {
    setErrore(''); setCaricando(true);
    try {
      const ora = Date.now();
      const esiti: Riga[] = [];
      // In parallelo ma a ondate: dentro l'ondata le letture partono
      // insieme, l'ondata dopo aspetta che la precedente sia finita.
      for (let i = 0; i < attivi.length; i += CIRCOLI_PER_ONDATA) {
        const ondata = attivi.slice(i, i + CIRCOLI_PER_ONDATA);
        // eslint-disable-next-line no-await-in-loop
        const parte = await Promise.all(ondata.map(async (c): Promise<Riga> => {
          try {
            const l = await leggiConteggio(c.id, attivazioneCircoloMs(c), ora, CADENZA);
            return {
              circolo: c,
              periodo: l.periodo,
              conteggio: l.conteggio,
              trovato: l.trovato,
              respinta: false,
              netti: slotNetti(l.conteggio),
              centesimi: centesimiDovuti(l.conteggio),
            };
          } catch {
            // ⚠️ Il guasto di un circolo non fa cadere tutta la
            // tabella: la riga dice «lettura respinta» e le altre
            // novantanove restano leggibili. Un `Promise.all` che
            // rigetta al primo errore avrebbe lasciato la pagina vuota
            // per colpa di un circolo solo.
            return {
              circolo: c,
              periodo: null,
              conteggio: null,
              trovato: false,
              respinta: true,
              netti: 0,
              centesimi: 0,
            };
          }
        }));
        esiti.push(...parte);
      }

      // ⚠️ IN ORDINE DI COMMISSIONE DECRESCENTE: chi vale di più sta in
      // alto, ed è l'unico ordinamento che serve a chi apre questa
      // pagina. Confronto a gradini e non una sottrazione fra valori
      // che possono mancare: le righe respinte non hanno un numero, e
      // sarebbero finite in mezzo alle altre come se valessero zero —
      // cioè in fondo, confuse con i circoli davvero fermi. Vanno in
      // coda, ma dichiarate.
      esiti.sort((a, b) => {
        if (a.respinta !== b.respinta) return a.respinta ? 1 : -1;
        if (a.centesimi !== b.centesimi) return b.centesimi - a.centesimi;
        // A parità di commissione (tipicamente due circoli a zero) il
        // nome, così l'elenco è sempre lo stesso fra due letture.
        return a.circolo.nome.localeCompare(b.circolo.nome, 'it');
      });

      setAdessoMs(ora);
      setRighe(esiti);
    } catch (e: unknown) {
      setErrore(e instanceof Error ? e.message : 'Lettura non riuscita.');
    } finally {
      setCaricando(false);
    }
  };

  const totali = useMemo(() => {
    if (!righe) return null;
    // I circoli su cui si somma: quelli che un conteggio ce l'hanno.
    // ⚠️ Non «tutti gli attivi»: un circolo senza documento non vale
    // zero, vale «non lo sappiamo», e infilarlo nella somma con uno
    // zero lo farebbe sparire dentro un totale che sembra completo.
    const conConteggio = righe.filter((r) => r.trovato && !r.respinta);
    const centesimi = conConteggio.reduce((s, r) => s + r.centesimi, 0);

    // ⚠️ QUANTI CIRCOLI FANNO LA METÀ DEL FATTURATO. È il numero che
    // dice se la rete è fragile o distribuita: «2 circoli su 40» vuol
    // dire che due telefonate andate male dimezzano l'incasso. Si
    // accumula dalle righe già ordinate per commissione decrescente.
    // ⚠️ Non si può dire quando il totale è zero — non «tutti» e non
    // «nessuno»: una metà di zero non è una soglia da raggiungere.
    let perMeta: number | null = null;
    if (centesimi > 0) {
      let somma = 0;
      let quanti = 0;
      for (const r of conConteggio) {
        somma += r.centesimi;
        quanti += 1;
        if (somma * 2 >= centesimi) break;
      }
      perMeta = quanti;
    }

    const migliore = conConteggio.length > 0 && conConteggio[0].centesimi > 0
      ? conConteggio[0]
      : null;

    return {
      circoliConConteggio: conConteggio.length,
      // ⚠️ «Nessun conteggio» ≠ «zero prenotazioni». Il primo è un
      // circolo per cui NON STIAMO ANCORA CONTANDO — nato prima dei
      // contatori, o mai toccato dal server in questo periodo — e va
      // guardato da noi, non chiamato al telefono.
      senzaConteggio: righe.filter((r) => !r.trovato && !r.respinta).length,
      respinte: righe.filter((r) => r.respinta).length,
      centesimi,
      prenotati: conConteggio.reduce((s, r) => s + (r.conteggio?.slotPrenotati ?? 0), 0),
      annullati: conConteggio.reduce((s, r) => s + (r.conteggio?.slotAnnullati ?? 0), 0),
      netti: conConteggio.reduce((s, r) => s + r.netti, 0),
      // ⚠️ LA MEDIA SI DIVIDE PER I CIRCOLI CHE CONTANO, non per tutti
      // gli attivi: mettere al denominatore anche quelli senza
      // conteggio abbasserebbe la media di una quantità che non
      // significa niente.
      mediaCentesimi: conConteggio.length > 0 ? centesimi / conConteggio.length : null,
      migliore,
      quotaMigliore: migliore && centesimi > 0
        ? (migliore.centesimi / centesimi) * 100
        : null,
      perMeta,
      // ⚠️ «A ZERO» È chi un conteggio ce l'ha e dice zero PRENOTAZIONI:
      // il circolo è acceso, il server lo sta guardando, e in tutto il
      // trimestre non è passata una mezz'ora. Sono le telefonate da
      // fare. Non si guarda il netto: un circolo che ha prenotato e poi
      // annullato tutto ha comunque un'app che qualcuno usa, ed è un
      // problema diverso.
      aZero: conConteggio.filter((r) => (r.conteggio?.slotPrenotati ?? 0) === 0).length,
    };
  }, [righe]);

  return (
    <SezioneCollassabile
      id="ricavi-rete"
      titolo="Ricavi di rete"
      descrizione="Quanto incassa Racket Fever su tutti i circoli, e da chi"
    >
      <div className="admin-card">
        <div className="admin-card-title">La commissione sulle mezz&rsquo;ore, circolo per circolo</div>
        <p className="admin-card-hint">
          Racket Fever trattiene {euroDaCentesimi(CENTESIMI_PER_SLOT)} € per ogni mezz&rsquo;ora di
          campo prenotata dall&rsquo;app. I numeri qui sotto sono quelli dei contatori scritti dal
          server — le stesse cifre che il circolo vede nella sua dashboard — e non un conto rifatto
          da questa pagina. Si guardano solo i circoli attivi.
        </p>

        {/* ⚠️ L'AVVERTENZA STA SOPRA I NUMERI, non sotto la tabella.
            Il totale di rete somma trimestri che cominciano in giorni
            diversi, ed è la prima cosa che qualcuno noterà: dirla dopo
            averla fatta notare è già troppo tardi. */}
        <p className="admin-card-hint scheda-attesa">
          Il trimestre di ogni circolo parte dal suo anniversario di attivazione, quindi
          i periodi <strong>non coincidono</strong>: questo totale somma trimestri che cominciano in
          giorni diversi e che sono a punti diversi del loro cammino — c&rsquo;è chi è al terzo giorno
          e chi all&rsquo;ottantesimo. Va letto come «quanto stiamo maturando adesso in tutta la
          rete», non come l&rsquo;incasso di un trimestre di calendario.
        </p>

        <button
          className="admin-btn-full"
          onClick={carica}
          disabled={caricando || attivi.length === 0}
        >
          {caricando ? 'Lettura in corso…' : (righe ? 'Rileggi' : 'Leggi i conteggi di rete')}
        </button>
        {!!errore && <div className="admin-error-text">{errore}</div>}

        {attivi.length === 0 && (
          <p className="admin-empty-text">
            {circoli.length === 0
              ? 'Nessun circolo nella rete: non c’è ancora niente da contare.'
              : 'Nessun circolo attivo: i circoli sospesi o chiusi non maturano commissioni.'}
          </p>
        )}

        {totali && righe && (
          <>
            {/* ---------- QUANTO STIAMO INCASSANDO ----------
                È la cifra per cui questa sezione esiste, e per questo
                sta per prima e da sola. */}
            <div className="superadmin-subtitolo">Quanto sta incassando Racket Fever</div>
            <div style={{ display: 'flex', gap: '.6rem', flexWrap: 'wrap' }}>
              <Grande
                etichetta="Commissione di rete, periodo in corso"
                // ⚠️ Uno zero qui è un numero vero e va scritto: vuol
                // dire che i circoli che stiamo contando non hanno
                // maturato niente. È il caso «senza conteggio» a non
                // dover diventare zero, e infatti sta nella riga sotto.
                valore={totali.circoliConConteggio === 0 ? '—' : EURO(totali.centesimi)}
                sotto={totali.circoliConConteggio === 0
                  ? 'Nessun circolo ha ancora un conteggio: non c’è niente da sommare.'
                  : `${CONTA(totali.netti)} mezz’ore nette × ${euroDaCentesimi(CENTESIMI_PER_SLOT)} €, su ${
                    totali.circoliConConteggio === 1
                      ? 'un circolo'
                      : `${CONTA(totali.circoliConConteggio)} circoli`}`}
              />
              <Grande
                etichetta="Mezz’ore nette di rete"
                valore={totali.circoliConConteggio === 0 ? '—' : CONTA(totali.netti)}
                sotto={totali.circoliConConteggio === 0
                  ? 'Nessun contatore da leggere.'
                  : `${CONTA(totali.prenotati)} prenotate − ${CONTA(totali.annullati)} annullate`}
              />
            </div>

            {/* ---------- I TRE CONTATORI ----------
                La sottrazione si vede, come nella schermata del
                circolo: è quello che rende il totale rifacibile a mano
                da chi lo contesta, riga per riga. */}
            <div className="superadmin-subtitolo">I contatori sommati</div>
            <div className="scheda-conti">
              <Dato
                valore={totali.circoliConConteggio === 0 ? '—' : CONTA(totali.prenotati)}
                etichetta="Mezz’ore prenotate"
              />
              <Dato
                valore={totali.circoliConConteggio === 0 ? '—' : CONTA(totali.annullati)}
                etichetta="Mezz’ore annullate"
              />
              <Dato
                valore={totali.circoliConConteggio === 0 ? '—' : CONTA(totali.netti)}
                etichetta="Mezz’ore nette"
              />
            </div>

            {/* ---------- CHI STIAMO CONTANDO E CHI NO ---------- */}
            <div className="admin-ok-text" style={{ marginTop: '.6rem' }}>
              {/* ⚠️ QUATTRO FRASI, QUATTRO SINGOLARI. La rete comincia
                  da un circolo solo, e «1 circoli attivi» è la prima
                  riga che si legge su una rete nuova. Chi ne aggiunge
                  una quinta la provi con 0, 1 e 2 prima di consegnarla. */}
              {totali.circoliConConteggio === 0
                ? 'Nessun circolo attivo ha ancora un conteggio in questo periodo.'
                : (
                  <>
                    {totali.circoliConConteggio === 1
                      ? 'Un circolo attivo sta maturando commissioni'
                      : `${CONTA(totali.circoliConConteggio)} circoli attivi stanno maturando commissioni`}
                    {' '}per <strong>{EURO(totali.centesimi)}</strong> in tutto.
                  </>
                )}
              {totali.senzaConteggio > 0
                ? ` ${totali.senzaConteggio === 1
                  ? 'Un circolo attivo non ha ancora un conteggio'
                  : `${CONTA(totali.senzaConteggio)} circoli attivi non hanno ancora un conteggio`}: per quelli non stiamo ancora contando, e non vuol dire che siano a zero.`
                : ''}
              {totali.respinte > 0
                ? ` ${totali.respinte === 1
                  ? 'Una lettura è stata respinta'
                  : `${CONTA(totali.respinte)} letture sono state respinte`} dalle regole: non è un ritardo del server, va guardato.`
                : ''}
              {nonAttivi > 0
                ? ` ${nonAttivi === 1
                  ? 'Un circolo sospeso o chiuso è'
                  : `${CONTA(nonAttivi)} circoli sospesi o chiusi sono`} fuori da questi conti: non ci si prenota più.`
                : ''}
            </div>

            {/* ---------- COM'È FATTA LA RETE ----------
                Non è colore: è quello che serve a chi decide. La media
                accanto al circolo migliore dice quanto sono diversi fra
                loro, e i due numeri sotto dicono su che gambe sta il
                fatturato. */}
            <div className="superadmin-subtitolo">Com&rsquo;è fatta la rete</div>
            <div className="scheda-conti">
              <Dato
                valore={totali.mediaCentesimi === null ? '—' : EURO(totali.mediaCentesimi)}
                etichetta="Commissione media per circolo"
              />
              <Dato
                valore={totali.migliore === null ? '—' : EURO(totali.migliore.centesimi)}
                etichetta="Il circolo che vale di più"
              />
              <Dato
                valore={totali.perMeta === null ? '—' : CONTA(totali.perMeta)}
                etichetta="Circoli che fanno metà del fatturato"
              />
              <Dato
                valore={totali.circoliConConteggio === 0 ? '—' : CONTA(totali.aZero)}
                etichetta="Circoli attivi a zero prenotazioni"
              />
            </div>
            <p className="admin-card-hint scheda-nota">
              {totali.mediaCentesimi === null
                ? 'La media non si può fare: nessun circolo ha un conteggio in questo periodo.'
                : `La media è divisa per i ${
                  totali.circoliConConteggio === 1 ? 'circolo' : 'circoli'
                } che un conteggio ce l’hanno, non per tutti gli attivi.`}
              {totali.migliore !== null && totali.quotaMigliore !== null
                ? ` Il primo è ${totali.migliore.circolo.nome}, da solo ${PERCENTO(totali.quotaMigliore)} del totale di rete.`
                : ' Nessun circolo ha ancora maturato una commissione, quindi non c’è un primo.'}
            </p>
            <p className="admin-card-hint scheda-nota">
              {totali.perMeta === null
                ? 'Non si può dire quanti circoli facciano metà del fatturato finché il fatturato è zero.'
                : `${totali.perMeta === 1
                  ? 'Basta un circolo solo'
                  : `Bastano ${CONTA(totali.perMeta)} circoli`} per arrivare alla metà del totale di rete${
                  totali.perMeta === 1 ? ': la rete è appesa a lui.' : '.'} Più il numero è piccolo, più il fatturato è fragile.`}
            </p>
            <p className="admin-card-hint scheda-nota">
              {totali.circoliConConteggio === 0
                ? 'Senza conteggi non si sa quali circoli siano fermi.'
                : totali.aZero === 0
                  ? 'Nessun circolo che stiamo contando è fermo a zero prenotazioni.'
                  : `${totali.aZero === 1
                    ? 'Un circolo attivo che stiamo contando non ha'
                    : `${CONTA(totali.aZero)} circoli attivi che stiamo contando non hanno`} avuto nemmeno una prenotazione nel periodo: ${
                    totali.aZero === 1 ? 'è la telefonata da fare.' : 'sono le telefonate da fare.'}`}
            </p>

            {/* ---------- LA TABELLA ---------- */}
            <div className="superadmin-subtitolo">Circolo per circolo</div>
            {righe.length > 0 && (
              <div className="scheda-tabella-culla">
                <table className="scheda-tabella">
                  <thead>
                    <tr>
                      <th>Circolo</th>
                      <th>Mezz&rsquo;ore nette</th>
                      <th>Prenotate</th>
                      <th>Annullate</th>
                      <th>Commissione</th>
                      <th>Periodo</th>
                      <th>Aggiornato al</th>
                    </tr>
                  </thead>
                  <tbody>
                    {righe.map((r) => {
                      // Quanto del trimestre è già passato. Serve a
                      // leggere la riga per quello che è: una
                      // commissione piccola al terzo giorno di periodo
                      // non è un circolo fermo, e senza questo numero
                      // le due cose sono indistinguibili.
                      const giorniFatti = r.periodo
                        ? Math.max(0, Math.ceil(
                          (Math.min(adessoMs, r.periodo.fineMs) - r.periodo.inizioMs) / GIORNO_MS,
                        ))
                        : null;
                      const giorniTotali = r.periodo
                        ? Math.max(1, Math.round((r.periodo.fineMs - r.periodo.inizioMs) / GIORNO_MS))
                        : null;
                      return (
                        <tr key={r.circolo.id}>
                          <td>
                            <div className="scheda-td-nome">{r.circolo.nome}</div>
                            <div className="scheda-td-sub">
                              {r.circolo.citta}
                              {statoCircolo(r.circolo) !== 'attivo'
                                ? ` · ${etichettaStatoCircolo(statoCircolo(r.circolo))}`
                                : ''}
                            </div>
                          </td>
                          {/* ⚠️ TRATTINO E NON ZERO su tutta la riga
                              quando il conteggio non c'è: uno zero
                              direbbe «questo circolo non ha prenotato
                              niente», che è un'altra affermazione — e
                              la più facile da confondere con quella
                              vera. */}
                          <td>{r.trovato ? CONTA(r.netti) : '—'}</td>
                          <td>{r.trovato ? CONTA(r.conteggio!.slotPrenotati) : '—'}</td>
                          <td>{r.trovato ? CONTA(r.conteggio!.slotAnnullati) : '—'}</td>
                          <td>{r.trovato ? EURO(r.centesimi) : '—'}</td>
                          <td>
                            {r.periodo ? (
                              <>
                                <div className="scheda-td-nome">
                                  {`Trimestre ${r.periodo.numero}`}
                                </div>
                                <div className="scheda-td-sub">
                                  {giorno(r.periodo.inizioMs)} → {giorno(r.periodo.fineMs)}
                                  {giorniFatti !== null && giorniTotali !== null
                                    ? ` · giorno ${CONTA(giorniFatti)} di ${CONTA(giorniTotali)}`
                                    : ''}
                                  {/* ⚠️ Un periodo non ancorato non è
                                      sbagliato, ma non è l'anniversario
                                      di niente: è ricavato all'indietro
                                      da oggi perché la data di
                                      attivazione manca. Chi legge deve
                                      saperlo, riga per riga. */}
                                  {r.periodo.ancorato
                                    ? ' · ancorato all’attivazione'
                                    : ' · non ancorato, data di attivazione mancante'}
                                </div>
                              </>
                            ) : '—'}
                          </td>
                          <td className={r.respinta ? 'scheda-td-debito' : undefined}>
                            {r.respinta
                              ? 'lettura respinta'
                              : r.trovato
                                ? (r.conteggio!.aggiornatoIlMs > 0
                                  ? giorno(r.conteggio!.aggiornatoIlMs)
                                  : 'mai')
                                : 'nessun conteggio'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            <p className="admin-card-hint scheda-privacy">
              Questo conto è fra Racket Fever e i circoli: il socio non lo paga, non lo vede e non
              deve vederlo. Vedi il riquadro in cima a <code>data/ricavi.ts</code>.
            </p>
          </>
        )}
      </div>
    </SezioneCollassabile>
  );
}
