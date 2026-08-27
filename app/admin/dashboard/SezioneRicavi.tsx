'use client';

// ============================================================
// RICAVI — quello che il Circolo incassa dai campi e quello che
// Racket Fever trattiene, nello stesso periodo e uno sotto l'altro.
//
// La matematica non sta qui: sta in `data/ricavi.ts`, e la lettura in
// `data/ricaviRepo.ts`. Questa schermata non conta niente per conto
// suo — prende i numeri che il server ha già scritto e li mette in
// fila. Chi si trovasse a sommare prenotazioni dentro questo file si
// fermi e rilegga il riquadro in cima a `ricaviRepo.ts`: contare dal
// vivo dà un numero più piccolo del vero con l'aria di essere giusto.
//
// ⚠️ DUE FAMIGLIE DI NUMERI, E NON VANNO CONFUSE. Questa è la cosa da
// capire prima di toccare qualunque riga.
//
//   1. QUELLI DEL CONTATORE — mezz'ore prenotate, annullate, nette e
//      la commissione che ne discende. Li scrive il server su un
//      documento solo, si leggono sempre, e sono ESATTI. Sono i numeri
//      che vanno in fattura.
//
//   2. QUELLI RICAVATI DALLE RIGHE — quanto ha incassato il Circolo,
//      l'incidenza, il costo per Socio, il prezzo medio, le
//      ripartizioni. Esistono solo dopo che qualcuno ha caricato il
//      dettaglio, e con il tetto di pagina possono essere un CAMPIONE.
//      Non vanno in fattura, e la schermata lo dice ogni volta.
//
// ⚠️ E QUANDO SI GUARDA UN CAMPIONE, LA COMMISSIONE DEL CAMPIONE NON È
// QUELLA DEL PERIODO. È l'errore che questa sezione è costruita per
// non fare: l'incidenza è un rapporto fra due numeri, e se al
// numeratore ci si mette la commissione di ottomila mezz'ore e al
// denominatore l'incasso delle duecento righe lette, viene fuori una
// percentuale quaranta volte più grande del vero — con l'aria di
// essere un dato. Perciò tutti i numeri incrociati si calcolano sulla
// STESSA base delle righe lette (vedi `incrocioCoerente` più sotto), e
// la frase grande «Racket Fever sta incassando» resta invece attaccata
// al contatore, che è la sola cifra fatturabile.
//
// ⚠️ IL SOCIO NON C'ENTRA. Questo conto è fra il Circolo e Racket
// Fever: nell'app del Socio non compare, e non deve comparire. Vedi il
// riquadro in cima a `data/ricavi.ts`.
// ============================================================

import { useMemo, useState } from 'react';
import { Campo, Circolo, ORARI, attivazioneCircoloMs } from '../../../data/circoli';
import {
  CENTESIMI_PER_SLOT, Cadenza, IncrocioRicavi,
  centesimiDovuti, centesimiMediPerSlot, centesimiPerSocioAttivo,
  chiavePeriodo, euroDaCentesimi, incidenzaPercento, proiezioneSlot,
  riempimentoPercento, slotNetti,
} from '../../../data/ricavi';
import {
  LetturaRicavi, RIGHE_PER_PAGINA, SlotFatturato, incrocioDaSlot, leggiConteggio, leggiSlot,
} from '../../../data/ricaviRepo';
import { useLingua } from '../../../lib/lingua';

// ⚠️ TRIMESTRE FISSO, E NIENTE SELETTORE. La cadenza è un parametro in
// `data/ricavi.ts` perché è materia di contratto e cambierà, ma qui un
// menu a tendina sarebbe un comando che mente: la chiave del periodo
// entra nel nome del documento che il server scrive, e il server ne
// scrive UNA sola: quella della cadenza in uso. Scegliendo «anno»
// l'Admin non vedrebbe lo stesso conto raggruppato diversamente —
// vedrebbe «non stiamo ancora contando», perché il documento
// `anno-0001` non esiste. Il giorno che la cadenza cambia, si cambia
// questa costante insieme a quella del server, non con una tendina.
const CADENZA: Cadenza = 'trimestre';

const GIORNO_MS = 24 * 60 * 60 * 1000;

// ⚠️ I conteggi si separano all'italiana in tutte e tre le lingue,
// come già fa la Panoramica: «1.284» invece di «1284». Un numero
// scritto in due modi nella stessa dashboard si legge come un errore.
const CONTA = (n: number) => n.toLocaleString('it-IT');
const EURO = (centesimi: number) => `${euroDaCentesimi(centesimi)} €`;
const PERCENTO = (n: number) =>
  `${n.toLocaleString('it-IT', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;

// La data si compone a mano, gemella di quella della scheda circolo:
// `toLocaleDateString` cambierebbe forma con la lingua, e la stessa
// data scritta in due modi nella stessa pagina fa dubitare del numero
// che le sta accanto.
function giorno(ms: number | null | undefined): string {
  if (!ms || ms <= 0) return '—';
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`;
}

// 'YYYY-MM-DD' → 'DD/MM/YYYY'. Il giorno di gioco arriva già scritto
// così dal server e non è un timestamp: si riordina, non si converte.
function giornoDaStringa(s: string | null): string {
  if (!s) return '—';
  const p = s.split('-');
  return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : s;
}

function quandoConOra(ms: number | null | undefined): string {
  if (!ms || ms <= 0) return '—';
  // L'ora resta quella dell'orologio del circolo, a 24 ore, in tutte e
  // tre le lingue: è la stessa scelta della testata della dashboard.
  const ora = new Date(ms).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
  return `${giorno(ms)} · ${ora}`;
}

// Un numero grande con la sua etichetta. Gli stili sono qui e non in
// `globals.css` perché questa è una bozza: quando la forma è decisa si
// spostano di là, in una classe con un nome.
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

export default function SezioneRicavi({ circolo, campi }: {
  circolo: Circolo;
  // Servono a un numero solo — il riempimento — ma senza di loro quel
  // numero non si può nemmeno tentare: gli slot disponibili sono campi
  // per mezz'ore al giorno per giorni.
  campi: Campo[];
}) {
  const { t } = useLingua();

  // ⚠️ I TOTALI SI LEGGONO A PRESSIONE DI UN TASTO, non all'apertura
  // della pagina, ed è la stessa regola della Fatturazione del Super
  // Admin. Qui è una lettura sola, ma la dashboard dell'Admin di
  // sezioni ne monta trenta: se ognuna leggesse qualcosa all'apertura,
  // aprirla costerebbe trenta letture a chi era entrato per cambiare
  // il nome di un campo.
  const [lettura, setLettura] = useState<LetturaRicavi | null>(null);
  // L'istante della lettura, congelato: periodo e proiezione si
  // calcolano su questo e non su `Date.now()`, altrimenti i numeri a
  // schermo cambierebbero a ogni ridisegno senza che nessuno abbia
  // toccato niente.
  const [adessoMs, setAdessoMs] = useState(0);
  const [caricando, setCaricando] = useState(false);
  const [errore, setErrore] = useState('');

  // Le righe: SECONDO tasto, mai insieme ai totali. Sono migliaia per
  // periodo, e si vanno a prendere quando qualcuno sta controllando.
  const [righe, setRighe] = useState<SlotFatturato[] | null>(null);
  const [caricandoRighe, setCaricandoRighe] = useState(false);
  const [erroreRighe, setErroreRighe] = useState('');

  const leggi = async () => {
    setErrore(''); setCaricando(true);
    try {
      const ora = Date.now();
      const l = await leggiConteggio(circolo.id, attivazioneCircoloMs(circolo), ora, CADENZA);
      setAdessoMs(ora);
      setLettura(l);
      // ⚠️ Il dettaglio si butta via a ogni rilettura: appartiene al
      // periodo che era in corso quando è stato caricato, e una
      // rilettura può averlo cambiato (a cavallo di un anniversario).
      // Tenerlo vorrebbe dire mostrare le righe di marzo sotto i
      // totali di aprile.
      setRighe(null); setErroreRighe('');
    } catch (e: unknown) {
      setErrore(e instanceof Error ? e.message : t('com.errore.generico'));
    } finally {
      setCaricando(false);
    }
  };

  const leggiDettaglio = async () => {
    if (!lettura) return;
    setErroreRighe(''); setCaricandoRighe(true);
    try {
      setRighe(await leggiSlot(circolo.id, chiavePeriodo(lettura.periodo)));
    } catch (e: unknown) {
      setErroreRighe(e instanceof Error ? e.message : t('com.errore.generico'));
    } finally {
      setCaricandoRighe(false);
    }
  };

  const conteggio = lettura?.conteggio ?? null;
  const netti = conteggio ? slotNetti(conteggio) : 0;
  // La cifra fatturabile: viene dal contatore e non dalle righe, quindi
  // è esatta anche quando il dettaglio non è stato caricato.
  const centesimiRF = conteggio ? centesimiDovuti(conteggio) : 0;

  // Il dettaglio è un campione quando la pagina è arrivata piena: non
  // si può sapere quante righe siano rimaste fuori, si sa solo che ce
  // ne sono. `>=` e non `===` per prudenza.
  const campione = righe !== null && righe.length >= RIGHE_PER_PAGINA;

  const dettaglio = useMemo(() => (righe ? incrocioDaSlot(righe) : null), [righe]);

  // ============================================================
  // ⚠️ L'INCROCIO SI COSTRUISCE SULLA STESSA BASE DELLE RIGHE.
  //
  // `centesimiRacketFever` qui dentro NON è la commissione del periodo:
  // è la commissione delle mezz'ore che stiamo effettivamente
  // guardando. Sembra un dettaglio e non lo è — è tutta la differenza
  // fra un'incidenza credibile e una percentuale quaranta volte più
  // grande del vero su un circolo grosso. Numeratore e denominatore
  // devono descrivere lo stesso insieme di mezz'ore.
  //
  // Quando il dettaglio non è un campione le due basi coincidono a
  // meno degli annullamenti a cavallo di periodo, che il contatore
  // sottrae e le righe no.
  // ============================================================
  const slotDelCampione = useMemo(() => {
    if (!righe) return 0;
    return righe.filter((r) => !r.annullatoIlMs).length;
  }, [righe]);

  // Le mezz'ore vendibili nel periodo già trascorso: campi per
  // mezz'ore al giorno per giorni. Non serve il dettaglio.
  const slotDisponibili = useMemo(() => {
    if (!lettura || campi.length === 0) return 0;
    const trascorsiMs = Math.min(adessoMs, lettura.periodo.fineMs) - lettura.periodo.inizioMs;
    const giorni = Math.max(0, Math.ceil(trascorsiMs / GIORNO_MS));
    return campi.length * ORARI.length * giorni;
  }, [lettura, campi.length, adessoMs]);

  const giorniTrascorsi = useMemo(() => {
    if (!lettura) return 0;
    return Math.max(0, Math.ceil((Math.min(adessoMs, lettura.periodo.fineMs) - lettura.periodo.inizioMs) / GIORNO_MS));
  }, [lettura, adessoMs]);

  const incrocioCoerente: IncrocioRicavi | null = dettaglio && {
    centesimiCircolo: dettaglio.centesimiCircolo,
    centesimiRacketFever: slotDelCampione * CENTESIMI_PER_SLOT,
    sociCheHannoPrenotato: dettaglio.sociCheHannoPrenotato,
    slotDisponibili,
  };

  const incidenza = incrocioCoerente ? incidenzaPercento(incrocioCoerente) : null;
  const perSocio = incrocioCoerente ? centesimiPerSocioAttivo(incrocioCoerente) : null;
  const medioSlot = incrocioCoerente ? centesimiMediPerSlot(incrocioCoerente, slotDelCampione) : null;
  const riempimento = lettura ? riempimentoPercento(netti, slotDisponibili) : null;
  const proiezione = lettura ? proiezioneSlot(netti, lettura.periodo, adessoMs) : null;

  // Le due parole che compaiono nelle ripartizioni. Una mappa esplicita
  // e non una chiave composta: un valore nuovo scritto un giorno dal
  // server (un terzo tipo di prenotazione) deve comparire com'è, non
  // come «adm.ric2.tipo.qualcosa» a schermo.
  const nomeTipo = (v: string) =>
    (v === 'campo' ? t('adm.ric2.tipo.campo') : v === 'lezione' ? t('adm.ric2.tipo.lezione') : v);
  const nomeOrigine = (v: string) =>
    (v === 'socio' ? t('adm.ric2.orig.socio')
      : v === 'maestro' ? t('adm.ric2.orig.maestro')
        : v === 'admin' ? t('adm.ric2.orig.admin') : v);

  const ordinate = (r: Record<string, number>) =>
    Object.entries(r).sort((a, b) => b[1] - a[1]);

  return (
    <div className="admin-card">
      <div className="admin-card-title">{t('adm.ric2.titolo')}</div>
      <p className="admin-card-hint">
        {t('adm.ric2.hint', { tariffa: euroDaCentesimi(CENTESIMI_PER_SLOT) })}
      </p>

      <button className="admin-btn-full" onClick={leggi} disabled={caricando}>
        {caricando ? t('com.attendi') : (lettura ? t('adm.ric2.rileggi') : t('adm.ric2.leggi'))}
      </button>
      {!!errore && <div className="admin-error-text">{errore}</div>}

      {lettura && conteggio && (
        <>
          {/* ---------- IL PERIODO ---------- */}
          <div className="scheda-vivo">
            <span className="scheda-vivo-et">{t('adm.ric2.periodo.et')}</span>
            <span className="scheda-vivo-n">
              {t('adm.ric2.periodo.trimestre', {
                numero: lettura.periodo.numero,
                inizio: giorno(lettura.periodo.inizioMs),
                fine: giorno(lettura.periodo.fineMs),
              })}
            </span>
          </div>
          <p className="admin-card-hint scheda-nota">
            {lettura.periodo.ancorato
              ? t('adm.ric2.periodo.ancorato')
              : t('adm.ric2.periodo.nonAncorato')}
          </p>
          {/* ⚠️ «Non c'è ancora un conteggio» e «zero» sono due frasi
              diverse, e la seconda spiega un totale sorprendente. */}
          {!lettura.trovato && (
            <p className="admin-card-hint scheda-attesa">{t('adm.ric2.nonTrovato')}</p>
          )}
          {lettura.trovato && (
            <p className="admin-card-hint scheda-nota">
              {conteggio.aggiornatoIlMs > 0
                ? t('adm.ric2.aggiornato', { quando: quandoConOra(conteggio.aggiornatoIlMs) })
                : t('adm.ric2.aggiornatoMai')}
            </p>
          )}

          {/* ---------- LE DUE FRASI GRANDI ----------
              Vicine e della stessa dimensione: è il confronto che
              Giorgio ha chiesto, e separarle vorrebbe dire far leggere
              due numeri invece di un rapporto. */}
          <div className="superadmin-subtitolo">{t('adm.ric2.confronto')}</div>
          <div style={{ display: 'flex', gap: '.6rem', flexWrap: 'wrap' }}>
            <Grande
              etichetta={t('adm.ric2.grande.circolo')}
              // ⚠️ Un trattino e non «0 €»: finché il dettaglio non è
              // caricato questo numero non esiste, e uno zero direbbe
              // «il tuo Circolo non ha incassato niente», che è
              // un'altra affermazione.
              valore={dettaglio ? EURO(dettaglio.centesimiCircolo) : t('com.nessunDato')}
              sotto={dettaglio
                ? (campione
                  ? t('adm.ric2.grande.circoloCampione', { righe: CONTA(slotDelCampione) })
                  : t('adm.ric2.grande.notaCircolo'))
                : t('adm.ric2.servDettaglio')}
            />
            <Grande
              etichetta={t('adm.ric2.grande.rf')}
              valore={EURO(centesimiRF)}
              sotto={t('adm.ric2.grande.notaRf', {
                netti: CONTA(netti), tariffa: euroDaCentesimi(CENTESIMI_PER_SLOT),
              })}
            />
          </div>
          {/* Su un campione i due numeri grandi non sono confrontabili:
              uno è tutto il periodo, l'altro sono le righe lette. Si
              affianca allora la commissione delle STESSE righe. */}
          {campione && incrocioCoerente && (
            <p className="admin-card-hint scheda-attesa">
              {t('adm.ric2.grande.campioneConfronto', {
                righe: CONTA(slotDelCampione),
                importo: EURO(incrocioCoerente.centesimiRacketFever),
              })}
            </p>
          )}

          {/* ---------- INCIDENZA ----------
              È la cifra che risponde alla domanda vera — «quanto mi
              costa?» — e per questo sta subito sotto le due grandi e
              non in fondo alla schermata. */}
          <div className="scheda-vivo">
            <span className="scheda-vivo-et">{t('adm.ric2.incidenza.et')}</span>
            <span className="scheda-vivo-n">
              {incidenza === null ? t('com.nessunDato') : PERCENTO(incidenza)}
            </span>
          </div>
          <p className="admin-card-hint scheda-nota">
            {!dettaglio
              ? t('adm.ric2.servDettaglio')
              : incidenza === null
                ? t('adm.ric2.incidenza.ignota')
                : t('adm.ric2.incidenza.nota')}
          </p>

          {/* ---------- I TRE CONTATORI ----------
              La sottrazione si vede: è quello che rende la fattura
              rifacibile a mano da chi la contesta. */}
          <div className="superadmin-subtitolo">{t('adm.ric2.conta.titolo')}</div>
          <div className="scheda-conti">
            <Dato valore={CONTA(conteggio.slotPrenotati)} etichetta={t('adm.ric2.conta.prenotati')} />
            <Dato valore={CONTA(conteggio.slotAnnullati)} etichetta={t('adm.ric2.conta.annullati')} />
            <Dato valore={CONTA(netti)} etichetta={t('adm.ric2.conta.netto')} />
          </div>
          <div className="scheda-vivo">
            <span className="scheda-vivo-n">
              {t('adm.ric2.conta.formula', {
                prenotati: CONTA(conteggio.slotPrenotati),
                annullati: CONTA(conteggio.slotAnnullati),
                netto: CONTA(netti),
                tariffa: euroDaCentesimi(CENTESIMI_PER_SLOT),
                importo: EURO(centesimiRF),
              })}
            </span>
          </div>
          <p className="admin-card-hint scheda-nota">{t('adm.ric2.conta.nota')}</p>

          {/* ---------- PROIEZIONE ---------- */}
          <div className="superadmin-subtitolo">{t('adm.ric2.proiezione.titolo')}</div>
          <div className="scheda-conti">
            <Dato
              valore={proiezione === null ? t('com.nessunDato') : EURO(proiezione * CENTESIMI_PER_SLOT)}
              etichetta={t('adm.ric2.proiezione.et')}
            />
            <Dato
              valore={proiezione === null ? t('com.nessunDato') : CONTA(proiezione)}
              etichetta={t('adm.ric2.proiezione.mezzore')}
            />
          </div>
          <p className="admin-card-hint scheda-nota">
            {proiezione === null ? t('adm.ric2.proiezione.presto') : t('adm.ric2.proiezione.nota')}
          </p>

          {/* ---------- I NUMERI PER CAPIRE SE IL CONTO STA IN PIEDI ---------- */}
          <div className="superadmin-subtitolo">{t('adm.ric2.incrociati.titolo')}</div>
          <div className="scheda-conti">
            <Dato
              valore={perSocio === null ? t('com.nessunDato') : EURO(perSocio)}
              etichetta={t('adm.ric2.perSocio.et')}
            />
            <Dato
              valore={medioSlot === null ? t('com.nessunDato') : EURO(medioSlot)}
              etichetta={t('adm.ric2.medio.et')}
            />
            <Dato
              valore={riempimento === null ? t('com.nessunDato') : PERCENTO(riempimento)}
              etichetta={t('adm.ric2.riemp.et')}
            />
          </div>
          <p className="admin-card-hint scheda-nota">
            {!dettaglio
              ? t('adm.ric2.servDettaglio')
              : t('adm.ric2.perSocio.nota', {
                soci: CONTA(dettaglio.sociCheHannoPrenotato),
              })}
          </p>
          {!!dettaglio && <p className="admin-card-hint scheda-nota">{t('adm.ric2.medio.nota')}</p>}
          {/* ⚠️ IL RIEMPIMENTO È UN ORDINE DI GRANDEZZA E LO DICE. Il
              denominatore non toglie i giorni di chiusura né gli Orari
              Riservati, e il numeratore conta le mezz'ore PRENOTATE nel
              periodo, che non sono esattamente quelle GIOCATE nel
              periodo: chi prenota oggi per il mese prossimo finisce
              qui. Scritto senza questa nota sembrerebbe una misura. */}
          <p className="admin-card-hint scheda-nota">
            {campi.length === 0
              ? t('adm.ric2.riemp.senzaCampi')
              : t('adm.ric2.riemp.nota', {
                campi: CONTA(campi.length),
                slotGiorno: CONTA(ORARI.length),
                da: ORARI[0],
                a: ORARI[ORARI.length - 1],
                giorni: CONTA(giorniTrascorsi),
              })}
          </p>

          {/* ---------- IL DETTAGLIO, SECONDO TASTO ---------- */}
          <div className="superadmin-subtitolo">{t('adm.ric2.dettaglio.titolo')}</div>
          <p className="admin-card-hint">{t('adm.ric2.dettaglio.nota')}</p>
          <button
            className="scheda-elenco-tasto"
            onClick={leggiDettaglio}
            disabled={caricandoRighe}
          >
            {caricandoRighe
              ? t('com.attendi')
              : (righe ? t('adm.ric2.dettaglio.ricarica') : t('adm.ric2.dettaglio.apri'))}
          </button>
          {!!erroreRighe && <div className="admin-error-text">{erroreRighe}</div>}

          {righe && (
            <>
              <p className="admin-card-hint scheda-nota">
                {t('adm.ric2.dettaglio.lette', { n: CONTA(righe.length) })}
              </p>
              {campione && (
                <p className="admin-card-hint scheda-attesa">
                  {t('adm.ric2.campione', { righe: CONTA(RIGHE_PER_PAGINA) })}
                </p>
              )}
            </>
          )}

          {/* ---------- RIPARTIZIONI ----------
              Solo con il dettaglio in mano: nascono dalle righe. */}
          {dettaglio && righe && righe.length > 0 && (
            <div className="scheda-due-colonne">
              <div>
                <div className="scheda-mini-titolo">{t('adm.ric2.rip.tipo')}</div>
                {ordinate(dettaglio.perTipo).length === 0
                  ? <p className="admin-empty-text">{t('adm.ric2.rip.niente')}</p>
                  : ordinate(dettaglio.perTipo).map(([k, n]) => (
                    <div key={k} className="scheda-riga-mini">
                      <span>{nomeTipo(k)}</span><span>{CONTA(n)} {t('com.mezzore')}</span>
                    </div>
                  ))}
              </div>
              <div>
                <div className="scheda-mini-titolo">{t('adm.ric2.rip.origine')}</div>
                {ordinate(dettaglio.perOrigine).length === 0
                  ? <p className="admin-empty-text">{t('adm.ric2.rip.niente')}</p>
                  : ordinate(dettaglio.perOrigine).map(([k, n]) => (
                    <div key={k} className="scheda-riga-mini">
                      <span>{nomeOrigine(k)}</span><span>{CONTA(n)} {t('com.mezzore')}</span>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {righe && righe.length === 0 && (
            <p className="admin-empty-text">{t('adm.ric2.dettaglio.vuoto')}</p>
          )}

          {righe && righe.length > 0 && (
            <div className="scheda-tabella-culla">
              <table className="scheda-tabella">
                <thead>
                  <tr>
                    <th>{t('adm.ric2.tab.quando')}</th>
                    <th>{t('adm.ric2.tab.gioco')}</th>
                    <th>{t('adm.ric2.tab.campo')}</th>
                    <th>{t('adm.ric2.tab.tipo')}</th>
                    <th>{t('adm.ric2.tab.origine')}</th>
                    <th>{t('adm.ric2.tab.valore')}</th>
                    <th>{t('adm.ric2.tab.stato')}</th>
                  </tr>
                </thead>
                <tbody>
                  {righe.map((r) => (
                    <tr key={r.id}>
                      <td>{giorno(r.prenotatoIlMs)}</td>
                      <td>
                        <div className="scheda-td-nome">{giornoDaStringa(r.data)}</div>
                        <div className="scheda-td-sub">{r.orario ?? t('com.nessunDato')}</div>
                      </td>
                      <td>{r.campoNome ?? r.campoId ?? t('com.nessunDato')}</td>
                      <td>{nomeTipo(r.tipo)}</td>
                      <td>{nomeOrigine(r.prenotataDa)}</td>
                      {/* ⚠️ Il valore di una riga annullata resta
                          scritto ma non conta: `incrocioDaSlot` la
                          salta, e il campo è tornato libero. */}
                      <td>{EURO(r.centesimiCircolo)}</td>
                      <td className={r.annullatoIlMs ? 'scheda-td-debito' : undefined}>
                        {r.annullatoIlMs
                          ? t('adm.ric2.stato.annullata', { quando: giorno(r.annullatoIlMs) })
                          : t('adm.ric2.stato.conta')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <p className="admin-card-hint scheda-privacy">{t('adm.ric2.notaSocio')}</p>
        </>
      )}
    </div>
  );
}
