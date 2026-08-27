'use client';

// ============================================================
// COME STA QUESTO CIRCOLO — la parte in sola lettura della scheda.
//
// Sta in cima, sopra i campi modificabili, e non è un vezzo: chi apre
// un circolo quasi sempre vuole sapere come va, non correggergli la
// sigla. I campi anagrafici restano subito sotto.
//
// ⚠️ QUI NON SI LEGGONO PIÙ PRENOTAZIONI E MOVIMENTI, e la cosa più
// importante di questo file è quella che non c'è più. Erano due ascolti
// senza limite né filtro di data — e non potevano averlo, perché i
// numeri sono storici e un elenco tagliato darebbe totali sbagliati con
// l'aria di essere giusti. Il risultato era che aprire un circolo
// costava decine di migliaia di letture, sempre, anche solo per
// correggerne la sigla, e cresceva ogni anno.
//
// Adesso quel conto lo fa il server una volta al giorno
// (functions/src/index.ts, fotografiaCircoli) e qui si legge un
// documento. Restano dal vivo solo le tessere e i maestri: sono query
// limitate dal numero di persone, e sono i dati che non possono
// mostrarsi vecchi di un giorno — il credito di un socio è denaro
// versato in segreteria stamattina.
//
// ⚠️ E la scheda DICE a quando risale ciò che mostra. Un totale fermo a
// stanotte va benissimo; diventa una bugia se chi legge lo crede di
// adesso.
// ============================================================

import { useEffect, useMemo, useState } from 'react';
import { ascoltaMaestriCircolo, MaestroConUid } from '../../../data/maestriRepo';
import { ascoltaTessereCircolo, Tessera } from '../../../data/tessere';
import {
  ascoltaFotografia, aggiornaFotografia, Fotografia, GIORNI_FINESTRA, GIORNI_FOTO_VECCHIA,
  ATTIVITA_SENZA_FOTO, REGISTRO_SENZA_FOTO,
  riepilogoPersone, riepilogoDenaro, righeSocio,
} from '../../../data/schedaCircolo';
import { riepilogoFatturazione, euro } from '../../../data/fatturazione';
import { Lingua } from '../../../data/lingue';
import { Traduttore } from '../../../data/testi';
import { useLingua } from '../../../lib/lingua';
import { Conteggio, euroDaCentesimi, mezzOreNette } from '../../../data/ricavi';
import { ricostruisciConteggi } from '../../../data/ricaviRepo';
// ⚠️ QUESTO IMPORT PUÒ STARE SOLO QUI SOTTO `app/superadmin/`. Il
// motivo è scritto per esteso in testa a `data/commissione.ts`: la
// dashboard del circolo si apre con credenziali che un revisore di App
// Store potrebbe avere, e lì non deve comparire nulla di quanto il
// circolo paga a Racket Fever. Chi si trovasse a importarlo da
// `app/admin/` o da `data/ricavi.ts` si fermi e rilegga quel file.
import { commissioneCentesimi } from '../../../data/commissione';
import RiquadriConteggio, {
  RigaAttivoDal, TestiAttivoDal, TestiConteggio, TestiMaturato,
} from '../../admin/dashboard/RiquadriConteggio';

// ============================================================
// LE PAROLE DEI RIQUADRI, IN ITALIANO E BASTA.
//
// I riquadri sono lo stesso componente che la Dashboard dell'Admin
// monta nella sezione «Conteggio delle mezz'ore», e le frasi gliele
// passa chi lo monta: di là dal dizionario in tre lingue, qui scritte a
// mano. È la stessa scelta che questo file fa già in cinque punti — i
// rami `perAdmin ? t(...) : 'italiano'` — e il motivo è che il pannello
// di rete lo legge solo il team Racket Fever, che un selettore della
// lingua non ce l'ha.
//
// ⚠️ DUE OGGETTI PERCHÉ I CONTI SONO DUE, e le frasi non si possono
// riusare: il pulsante del live rilegge e quello del maturato chiama il
// server, quindi non si chiamano allo stesso modo; e il maturato ha
// quattro frasi in più che al live non servirebbero a niente.
//
// ⚠️ Stanno fuori dal componente, non dentro: dentro sarebbero oggetti
// nuovi a ogni disegno della scheda.
// ============================================================
const TESTI_MATURATO: TestiMaturato = {
  aggiorna: 'Aggiorna il maturato',
  attendi: 'Attendere…',
  etPrenotate: 'Mezz’ore prenotate',
  etAnnullate: 'Mezz’ore annullate',
  etNette: 'Mezz’ore nette',
  etOre: 'Ore nette',
  etIncasso: 'Totale incasso',
  nonTrovato: 'Per questo circolo il maturato non è ancora stato calcolato. Non vuol dire zero: vuol dire che il conto non è mai stato fatto. Premi «Aggiorna il maturato».',
  erroreLettura: (motivo) => `Lettura del maturato respinta (${motivo}). Di solito vuol dire che le regole del database non consentono questa lettura — non che il circolo sia vuoto.`,
  nota: 'Il giorno in corso non è compreso: una giornata entra nel maturato quando è finita per intero. È voluto — un numero su cui si fattura non deve muoversi mentre lo si guarda.',
  erroreAggiornamento: (motivo) => `Il maturato non è stato portato avanti (${motivo}). I numeri qui sotto restano quelli dell’ultimo aggiornamento riuscito.`,
  incompleto: 'Il server si è fermato prima di arrivare a ieri: su un circolo aperto da molto tempo i giorni da sommare sono più di quelli che stanno in una chiamata sola. Premi di nuovo «Aggiorna il maturato» e prosegue da dove si era fermato.',
  finoAl: (data) => `Il conto comprende i giorni fino al ${data} compreso.`,
  finoANiente: 'Nessun giorno è ancora entrato nel conto: il maturato esiste ma è fermo al punto di partenza.',
};

const TESTI_LIVE: TestiConteggio = {
  // ⚠️ «Rileggi» e non «Aggiorna»: questo tasto non chiama nessuna
  // funzione del server, rilegge il documento. Chiamarlo come l'altro
  // insegnerebbe che i due tasti fanno la stessa cosa.
  aggiorna: 'Rileggi il prenotato',
  attendi: 'Attendere…',
  etPrenotate: 'Mezz’ore prenotate',
  etAnnullate: 'Mezz’ore annullate',
  etNette: 'Mezz’ore nette',
  etOre: 'Ore nette',
  etIncasso: 'Totale incasso',
  nonTrovato: 'Per questo circolo il conteggio dal vivo non esiste ancora. Non vuol dire zero: il documento nasce con la prima prenotazione, e finché non ne arriva una non c’è niente da leggere.',
  erroreLettura: (motivo) => `Lettura del prenotato respinta (${motivo}). Di solito vuol dire che le regole del database non consentono questa lettura — non che il circolo sia vuoto.`,
  nota: 'Dentro ci sono anche le partite ancora da giocare: domani, la settimana prossima, il mese prossimo. Sale a ogni prenotazione e scende a ogni disdetta, senza che nessuno prema niente.',
};

const TESTI_ATTIVO_DAL: TestiAttivoDal = {
  etichetta: 'Si conta da',
  attivoDal: (data) => `Attivo dal ${data}.`,
  ignoto: 'Data di ingresso in rete non registrata: il conteggio parte dal primo giorno che il server riesce a leggere, non da una data certa.',
};

// La frase che spiega che cosa sono quegli euro. Vale identica per i due
// conti, quindi si scrive una volta sola.
const NOTA_INCASSO = 'Il totale incasso è la somma del prezzo che ogni mezz’ora aveva in griglia nell’istante in cui è stata prenotata: sono soldi del circolo, e non si muovono se il circolo ritocca il listino. Le mezz’ore annullate non ci sono dentro.';

// ⚠️ Il denaro resta con il punto e due decimali, come in TUTTO il
// resto dell'applicazione (registro, dashboard Admin, pop-up di
// rimborso). Formattarlo all'italiana solo qui vorrebbe dire che la
// stessa cifra si scrive in due modi a seconda della schermata, ed e'
// il genere di dettaglio che fa dubitare del numero. I conteggi
// invece sono grandi e si leggono meglio separati: "1.284" contro
// "1284".
// ⚠️ Dal modulo comune, non `toFixed`: quello scrive «200.00 €»,
// col punto inglese, sul credito o sul debito di un socio — cioè su
// soldi veri che qualcuno ha versato in segreteria.
const EURO = (n: number) => euro(n);
const CONTA = (n: number) => n.toLocaleString('it-IT');
const ORE = (n: number) => n.toLocaleString('it-IT', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

// ⚠️ LA DATA SI COMPONE A MANO, gemella della funzione dell'app. Qui
// nel browser `toLocaleDateString('de-DE')` funzionerebbe davvero —
// ma la stessa data scritta in due modi sul telefono e sul computer e'
// esattamente il genere di differenza che fa dubitare del numero
// accanto. Un solo modo, in tutti e due i progetti.
//
// ⚠️ E l'ordine cambia con la lingua: in tedesco il giorno vuole il
// punto, «26. August 2026», perche' li' e' un ordinale.
function quandoLeggibile(ms: number | null, t: Traduttore, lingua: Lingua): string {
  if (ms === null) return '—';
  const d = new Date(ms);
  const mese = t(`com.M.${d.getMonth() + 1}` as any);
  return lingua === 'de'
    ? `${d.getDate()}. ${mese} ${d.getFullYear()}`
    : `${d.getDate()} ${mese} ${d.getFullYear()}`;
}

// "3 giorni fa", "oggi". Serve accanto alla data: una data da sola
// costringe chi legge a fare il conto a mente, ed è proprio il conto
// che dice se il circolo è vivo.
function daQuanto(ms: number | null, t: Traduttore, adesso = Date.now()): string {
  if (ms === null) return '';
  const giorni = Math.floor((adesso - ms) / (24 * 60 * 60 * 1000));
  if (giorni <= 0) return t('com.oggi');
  if (giorni === 1) return t('com.ieri');
  if (giorni < 30) return t('com.giorniFa', { n: giorni });
  const mesi = Math.floor(giorni / 30);
  return mesi === 1 ? t('com.unMeseFa') : t('com.mesiFa', { n: mesi });
}

function giorniDa(ms: number | null, t: Traduttore): string {
  if (ms === null) return '';
  const giorni = Math.floor(ms / (24 * 60 * 60 * 1000));
  if (giorni <= 0) return t('com.daOggi');
  return giorni === 1 ? t('com.daIeri') : t('com.daGiorni', { n: giorni });
}

function giornoLeggibile(ms: number | null): string {
  if (ms === null) return '—';
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`;
}

// ⚠️ Una funzione e non piu' una tabella fissa: le cinque parole
// cambiano con la lingua, e una tabella costruita al caricamento del
// modulo resterebbe ferma a quella del momento.
function etichettaStato(stato: string, t: Traduttore): string {
  const chiavi: Record<string, string> = {
    approvata: 'pan.stato.approvata', in_attesa: 'pan.stato.in_attesa',
    sospesa: 'pan.stato.sospesa', chiusa: 'pan.stato.chiusa', rifiutata: 'pan.stato.rifiutata',
  };
  const c = chiavi[stato];
  return c ? t(c as any) : stato;
}

// ⚠️ La frase sugli importi fuori elenco, ricomposta qui invece di
// arrivare gia' scritta da data/schedaCircolo.ts: quel modulo fa i
// conti ed e' gemello di quello dell'app, e portarci dentro le tre
// lingue vorrebbe dire far dipendere i calcoli dal dizionario. Qui si
// prendono i numeri e si compongono le parole.
function fraseFuoriElencoT(
  d: { debitiFuoriElenco: number; creditoFuoriElenco: number; posizioniFuoriElenco: number },
  eur: (n: number) => string,
  t: Traduttore,
): string | null {
  if (d.debitiFuoriElenco === 0 && d.creditoFuoriElenco === 0) return null;
  const pezzi: string[] = [];
  if (d.debitiFuoriElenco > 0) pezzi.push(t('pan.den.fuori.debito', { importo: eur(d.debitiFuoriElenco) }));
  else if (d.debitiFuoriElenco < 0) pezzi.push(t('pan.den.fuori.debitoRientrato', { importo: eur(-d.debitiFuoriElenco) }));
  if (d.creditoFuoriElenco > 0) pezzi.push(t('pan.den.fuori.credito', { importo: eur(d.creditoFuoriElenco) }));
  else if (d.creditoFuoriElenco < 0) pezzi.push(t('pan.den.fuori.creditoRosso', { importo: eur(-d.creditoFuoriElenco) }));
  const insieme = pezzi.join(t('pan.den.fuori.e'));
  return pezzi.length === 1
    ? t('pan.den.fuori.uno', { pezzi: insieme, n: d.posizioniFuoriElenco })
    : t('pan.den.fuori.tanti', { pezzi: insieme, n: d.posizioniFuoriElenco });
}

function Dato({ valore, etichetta, allarme }: {
  valore: string; etichetta: string; allarme?: boolean;
}) {
  return (
    <div className={`scheda-conto${allarme ? ' scheda-conto-allarme' : ''}`}>
      <span className="scheda-conto-n">{valore}</span>
      <span className="scheda-conto-et">{etichetta}</span>
    </div>
  );
}

// ============================================================
// RICOSTRUISCI I CONTEGGI — solo Super Admin, e con una conferma.
//
// ⚠️ NON È UN «AGGIORNA PIÙ FORTE». Ricontare vuol dire ripartire dalle
// prenotazioni che esistono adesso, e una prenotazione disdetta non
// esiste più da nessuna parte: il documento è stato cancellato. Il
// risultato è che «mezz'ore annullate» torna a zero e il netto sale, e
// non c'è modo di rimetterle dentro — quel dato lo teneva soltanto il
// conteggio che stiamo per riscrivere.
//
// Serve dopo un Reset Totale, o quando i numeri sono andati storti in
// modo evidente. Non come aggiornamento di tutti i giorni: per quello
// c'è il tasto del maturato, che somma i giorni nuovi e non tocca
// quello che c'è già.
//
// ⚠️ LA CONFERMA È UNA CASELLA DA SPUNTARE, non il nome del circolo
// riscritto come nel Reset Totale. È la misura giusta della cosa: qui
// non si perdono prenotazioni, movimenti o soci — si perde un numero
// che si può ricalcolare da capo ogni volta tranne uno. Chiedere di
// riscrivere il nome per questo insegnerebbe a riscriverlo in fretta
// anche là dove il dato non torna più.
// ============================================================
function TastoRicostruisci({ circoloId, onFatto }: {
  circoloId: string;
  // Rimonta i due gruppi di riquadri: dopo la ricostruzione i numeri a
  // schermo sono quelli di prima, e lasciarli lì sarebbe la bugia
  // peggiore proprio nel momento in cui sono appena cambiati.
  onFatto: () => void;
}) {
  const [aperto, setAperto] = useState(false);
  const [capito, setCapito] = useState(false);
  const [inCorso, setInCorso] = useState(false);
  const [esito, setEsito] = useState('');
  const [errore, setErrore] = useState('');

  const chiudi = () => {
    if (inCorso) return;
    setAperto(false);
    setCapito(false);
    setErrore('');
  };

  const esegui = async () => {
    setInCorso(true);
    setErrore('');
    setEsito('');
    try {
      const r = await ricostruisciConteggi(circoloId);
      setEsito(`Conteggi rifatti: ${r.giorniRifatti} giorni ricostruiti, ${r.prenotazioniLette} prenotazioni lette. I riquadri qui sopra sono stati riletti.`);
      setAperto(false);
      setCapito(false);
      onFatto();
    } catch (e: unknown) {
      // Il motivo che manda il server si riporta: «riprova» è l'unica
      // frase che non aiuta nessuno.
      const motivo = e instanceof Error ? e.message.trim() : String(e);
      setErrore(`Ricostruzione non riuscita (${motivo}). I conteggi sono rimasti quelli di prima.`);
    } finally {
      setInCorso(false);
    }
  };

  return (
    <>
      <button
        className="admin-btn-piccolo admin-btn-danger"
        style={{ marginTop: '.8rem' }}
        onClick={() => setAperto(true)}
        disabled={inCorso}
      >
        Ricostruisci conteggi
      </button>
      <p className="admin-card-hint scheda-nota">
        Riservato al team Racket Fever. Riconta tutto da capo dalle prenotazioni che esistono
        adesso: serve dopo un Reset Totale o quando i numeri sono andati storti, non come
        aggiornamento di tutti i giorni.
      </p>
      {!!esito && <div className="admin-ok-text">{esito}</div>}
      {!!errore && <div className="admin-error-text">{errore}</div>}

      {aperto && (
        <div className="admin-modal-backdrop" onClick={chiudi}>
          <div className="admin-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="admin-modal-title">Ricostruisci i conteggi</div>
            <p className="admin-modal-sub">
              I due conteggi di questo circolo — il prenotato e il maturato — vengono buttati via
              e rifatti da zero.
            </p>
            {/* ⚠️ L'avvertimento sta dentro la conferma e non solo
                accanto al tasto: chi arriva qui ha già deciso, e la
                riga che gli fa cambiare idea deve stargli davanti nel
                momento in cui clicca. */}
            <div className="reset-archivio-avviso">
              <strong>Le disdette passate si perdono.</strong> La ricostruzione riconta dalle
              prenotazioni vive, e una prenotazione annullata non esiste più da nessuna parte:
              il suo documento è stato cancellato. Dopo questa operazione «mezz’ore annullate»
              torna a zero e il netto sale di conseguenza. Non è un guasto ed è irreversibile:
              quel dato lo teneva soltanto il conteggio che stai per riscrivere.
            </div>
            <label
              className="admin-card-hint"
              style={{ display: 'flex', gap: '.5rem', alignItems: 'flex-start', marginTop: '.8rem' }}
            >
              <input
                type="checkbox"
                checked={capito}
                onChange={(e) => setCapito(e.target.checked)}
                disabled={inCorso}
              />
              <span>
                Ho capito: <strong>«mezz’ore annullate» torna a zero</strong> e lo storico delle
                disdette di questo circolo non sarà più recuperabile.
              </span>
            </label>
            {!!errore && <div className="admin-error-text">{errore}</div>}
            <div className="admin-modal-btn-row">
              <button className="admin-modal-btn-cancel" onClick={chiudi} disabled={inCorso}>
                Annulla
              </button>
              <button
                className="admin-modal-btn-confirm danger"
                onClick={esegui}
                disabled={!capito || inCorso}
              >
                {inCorso ? 'In corso…' : 'Ricostruisci'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ⚠️ QUESTA SCHEDA HA DUE PADRONI, da quando il pannello Admin la monta
// nella sua «Panoramica Circolo». È voluto — i numeri con cui un
// circolo si giudica devono avere una definizione sola — ma due cose
// vanno sapute da chi la tocca:
//
// 1. `perAdmin` cambia SOLO le frasi che parlano di chi guarda. Un
//    Admin che leggeva «serve un accesso Super Admin» o «questi numeri
//    servono all'assistenza e alla fatturazione» si trovava un pannello
//    che parla di lui in terza persona, in casa sua.
// 2. Se qui dentro si aggiunge una lettura riservata al Super Admin,
//    l'Admin non vedrà un errore chiaro: vedrà il banner «Lettura
//    respinta» e numeri incompleti. Ogni lettura nuova va verificata
//    contro le regole per tutti e due i ruoli.
export default function SchedaCircoloVista({
  circoloId, perAdmin = false, statoCircolo, attivatoIlMs, puoAggiornare = true,
}: {
  circoloId: string;
  perAdmin?: boolean;
  // ⚠️ Serve a UNA cosa sola, ed e' un allarme da spegnere. Il giro
  // notturno fotografa solo i circoli attivi: su un circolo sospeso o
  // chiuso la fotografia resta ferma per sempre, e senza sapere lo
  // stato questa scheda dopo quattro giorni accusava il server di
  // essere indietro e invitava a premere un tasto che quel circolo lo
  // rifiuta. Campo assente = attivo, come ovunque nel progetto.
  statoCircolo?: string;
  // Quando il circolo è entrato nella rete: ancora il periodo del
  // conteggio al suo anniversario. Senza, il conto si fa sugli ultimi
  // dodici mesi, e la scheda lo dichiara invece di inventare una data.
  attivatoIlMs?: number | null;
  // ⚠️ Falso per il Collaboratore. LEGGE i numeri come tutti — dentro
  // la fotografia non c'è niente che non veda già nelle tessere che
  // maneggia ogni giorno alla cassa — ma non ha il tasto che la RIFÀ:
  // uno scatto rilegge tutto lo storico del circolo, ed è lavoro
  // pesante che non si mette in mano a una password condivisa.
  puoAggiornare?: boolean;
}) {
  // ⚠️ SENZA IL CONTENITORE SI RESTA IN ITALIANO, ed e' il
  // comportamento giusto: questa scheda la apre anche il Super Admin
  // dal pannello di rete, dove un selettore della lingua non c'e'.
  // Il contenitore lo mette solo la Panoramica dell'Admin.
  const { lingua, t } = useLingua();
  const [tessere, setTessere] = useState<Tessera[]>([]);
  const [maestri, setMaestri] = useState<MaestroConUid[]>([]);
  // Tre stati, non due. undefined = non si sa ancora; null = non c'è
  // nessuna fotografia (si preme il tasto e c'è); 'respinta' = la
  // lettura è stata negata, e premere il tasto non servirà MAI, perché
  // anche riuscendo lo scatto il documento resterebbe illeggibile.
  // ⚠️ Mappare la lettura respinta su "non c'è" è esattamente il difetto
  // che il commento in data/schedaCircolo.ts dichiara di voler evitare:
  // il tasto premuto all'infinito senza che cambi niente.
  const [foto, setFoto] = useState<Fotografia | null | 'respinta' | undefined>(undefined);
  const conFoto = foto && foto !== 'respinta' ? foto : null;
  const [pronto, setPronto] = useState({ tessere: false, maestri: false });
  // ⚠️ Distinto da "non è arrivato": una lettura RESPINTA non torna
  // più, quindi lasciare il banner "caricamento…" per sempre sarebbe
  // un'altra bugia. Chi legge deve sapere che il problema è di
  // permessi, non di rete lenta.
  const [respinto, setRespinto] = useState<string[]>([]);
  const [elencoAperto, setElencoAperto] = useState(false);
  const [scattando, setScattando] = useState(false);
  const [erroreScatto, setErroreScatto] = useState('');
  // ⚠️ DUE STATI, non uno. Il freno dei due minuti non e' un guasto: e'
  // il server che dice «i numeri sono gia' quelli nuovi». In rosso,
  // insieme agli errori veri, si legge come «non ha funzionato» e si
  // ripreme il tasto — l'esatto contrario di quello che dice.
  const [avvisoScatto, setAvvisoScatto] = useState('');
  // ⚠️ UN CONTATORE USATO COME `key`, e non uno stato dei conteggi
  // sollevato qui dentro. Dopo una ricostruzione i due documenti sono
  // stati riscritti dal server e i numeri a schermo sono quelli di
  // prima: cambiando la `key` i due gruppi si rimontano e rileggono da
  // capo, che è esattamente quello che fanno all'apertura della scheda.
  // Sollevare qui la lettura vorrebbe dire riscrivere in questo file la
  // logica che sta già in `RiquadriConteggio`, e tenerne due copie.
  const [giroConteggi, setGiroConteggi] = useState(0);

  useEffect(() => {
    // ⚠️ Si azzerano anche i DATI, non solo le spie. Tenendo quelli del
    // circolo precedente, passando da un circolo all'altro senza
    // smontare il componente si vedrebbero i numeri di uno sotto il
    // nome di un altro. Oggi si passa sempre dall'elenco e il
    // componente si smonta; questa riga serve al giorno in cui non sarà
    // più vero.
    setTessere([]); setMaestri([]); setFoto(undefined);
    setPronto({ tessere: false, maestri: false });
    setRespinto([]); setErroreScatto(''); setAvvisoScatto('');
    const segnalaRifiuto = (che: string) =>
      setRespinto((prec) => (prec.includes(che) ? prec : [...prec, che]));

    const u1 = ascoltaTessereCircolo(
      circoloId,
      (t) => { setTessere(t); setPronto((p) => ({ ...p, tessere: true })); },
      () => segnalaRifiuto('tessere'),
    );
    const u2 = ascoltaMaestriCircolo(
      circoloId,
      (m) => { setMaestri(m); setPronto((p) => ({ ...p, maestri: true })); },
      () => segnalaRifiuto('maestri'),
    );
    const u3 = ascoltaFotografia(
      circoloId,
      (f) => setFoto(f),
      () => { setFoto('respinta'); segnalaRifiuto('fotografia'); },
    );
    return () => { u1(); u2(); u3(); };
  }, [circoloId]);

  const scatta = async () => {
    setErroreScatto(''); setAvvisoScatto('');
    setScattando(true);
    try {
      const esito = await aggiornaFotografia(circoloId);
      // ⚠️ Il «no» del server si dice, e prima si buttava via: quando il
      // freno dei due minuti scattava, la rotella girava, i numeri
      // restavano quelli e chi guardava ripremeva convinto che fosse
      // rotto.
      if (!esito.aggiornata && esito.appenaFatta) {
        // ⚠️ Senza dire «due minuti»: la durata del riposo la decide il
        // server (RIPOSO_SCATTO_MS in functions/src/index.ts), e
        // riscriverla qui vuol dire che il giorno che cambia una
        // schermata ne annuncia un'altra.
        setAvvisoScatto(t('pan.foto.appenaFatta'));
      }
    } catch (e: any) {
      // ⚠️ Le cause non si equivalgono, e dire sempre "riprova" manda
      // qualcuno a ripremere un tasto che non funzionera' mai.
      const codice = String(e?.code ?? '');
      // ⚠️ E il motivo che manda il server si riporta: «riprova fra un
      // momento» e' l'unica frase che non aiuta nessuno.
      const dalServer = String(e?.message ?? '').trim();
      setErroreScatto(
        codice.includes('permission-denied')
          ? (perAdmin
            ? t('pan.foto.erroreNegato')
            // ⚠️ Il ramo del Super Admin resta in italiano scritto qui:
            // lo legge solo il team Racket Fever, che di selettore non
            // ne ha uno. Passarlo dal dizionario vorrebbe dire tre
            // traduzioni di una frase che nessuno leggera' mai
            // tradotta.
            : 'Aggiornamento non consentito: serve un accesso Super Admin.')
          : codice.includes('deadline-exceeded') || codice.includes('internal')
            ? t('pan.foto.erroreLento')
            : dalServer
              ? t('pan.foto.erroreAltro', { motivo: dalServer })
              : t('pan.foto.erroreSecco'),
      );
    } finally {
      setScattando(false);
    }
  };

  // Le tessere sono limitate dal numero di soci: qui useMemo serve a
  // non rifare il giro a ogni tocco sul pulsante dell'elenco, non a
  // salvare una situazione difficile.
  const persone = useMemo(() => riepilogoPersone(tessere, maestri.length), [tessere, maestri]);
  // ⚠️ DAL VIVO, non dalla fotografia. La fotografia lo scrive lo stesso
  // — serve all'elenco Fatturazione del pannello di rete, che non può
  // leggere le tessere di tutti i circoli — ma qui le tessere sono già
  // in memoria, quindi il numero che il circolo vede è quello di adesso
  // e non quello di stanotte. Un socio approvato stamattina che apre
  // l'app deve comparire stamattina: se comparisse domani, la prima
  // cosa che il circolo impara è che il numero non è affidabile.
  // ⚠️ Il nome `fattura` è rimasto, il contenuto no: dal 21 agosto 2026
  // qui dentro non ci sono più euro né fasce, solo il conto delle
  // persone. Il prezzo sta nel contratto.
  const fattura = useMemo(
    () => riepilogoFatturazione(tessere, attivatoIlMs ?? null, Date.now()),
    [tessere, attivatoIlMs],
  );
  const denaro = useMemo(() => riepilogoDenaro(tessere), [tessere]);
  const righe = useMemo(
    () => righeSocio(tessere, conFoto?.perSocio ?? {}),
    [tessere, conFoto],
  );
  const attivita = conFoto?.attivita ?? ATTIVITA_SENZA_FOTO;
  const registro = conFoto?.registro ?? REGISTRO_SENZA_FOTO;
  // ⚠️ scattataIlMs a zero non è "il primo gennaio 1970": è un campo
  // mancante. Senza questa riga la barra annunciava con tutta serietà
  // una fotografia di cinquantasei anni fa.
  const scattoMs = conFoto && conFoto.scattataIlMs > 0 ? conFoto.scattataIlMs : null;
  // ⚠️ Dalla costante e non «2» scritto qui: il giro notturno fotografa
  // un numero limitato di circoli per notte, quindi con la rete che
  // cresce il ritardo normale cresce con lei. Il commento sta in
  // data/schedaCircolo.ts, accanto al numero.
  const circoloFermo = (statoCircolo ?? 'attivo') !== 'attivo';
  const fraseFuoriElenco = fraseFuoriElencoT(denaro, EURO, t);
  const fotoVecchia = !circoloFermo && scattoMs !== null
    && Date.now() - scattoMs > GIORNI_FOTO_VECCHIA * 24 * 60 * 60 * 1000;
  // ⚠️ `foto === undefined` vuol dire «non si sa ancora», e prima
  // finiva qui dentro insieme a «non c'e'»: al primo disegno della
  // pagina la barra passava in ambra da allarme e la nota del Denaro
  // annunciava che una fotografia non c'era, mezzo secondo prima che
  // arrivasse. Su una rete lenta quella frase restava. E adesso la
  // Panoramica nasce aperta, quindi la vedeva ogni Admin a ogni
  // apertura.
  const inAttesaFoto = foto === undefined;
  // Vero quando i numeri della fotografia non ci sono DAVVERO: gli zeri
  // qui sotto vanno detti, non mostrati come dati.
  const senzaNumeri = !inAttesaFoto && conFoto === null;

  const tutteArrivate = pronto.tessere && pronto.maestri && foto !== undefined;
  const CONTA_GIORNI = GIORNI_FINESTRA;

  return (
    <div className="scheda-circolo">
      {respinto.length > 0 ? (
        <p className="admin-card-hint scheda-attesa">
          {/* ⚠️ Al presidente di un circolo non si parla di «regole del
              database». Il fatto — i numeri sono incompleti e non
              miglioreranno — vale per tutti e due; la spiegazione
              tecnica serve solo a chi puo' farci qualcosa. */}
          {perAdmin
            ? t('pan.avvisoRespinto', {
              cosa: respinto.map((r) => t(`pan.parte.${r}` as any)).join(', '),
            })
            // ⚠️ Il ramo del Super Admin resta in italiano: parla di
            // regole del database ed e' scritto per chi puo' metterci
            // mano, cioe' noi.
            : `Lettura respinta (${respinto.join(', ')}): i numeri qui sotto sono incompleti e non lo diventeranno. Di solito vuol dire che le regole del database non consentono questa lettura — non che il circolo sia vuoto.`}
        </p>
      ) : !tutteArrivate && (
        // ⚠️ Non `scheda-attesa`: quella è la veste ambra dell'avviso,
        // e un caricamento normale vestito da problema insegna a
        // ignorare l'ambra il giorno che il problema c'è davvero.
        <p className="admin-card-hint scheda-nota">
          {t('pan.caricamento')}
        </p>
      )}

      {/* ---------- PERSONE ---------- */}
      <div className="superadmin-subtitolo">{t('pan.persone')}</div>
      <div className="scheda-conti">
        <Dato valore={CONTA(persone.soci)} etichetta={t('pan.persone.soci')} />
        <Dato valore={CONTA(persone.ospiti)} etichetta={t('pan.persone.ospiti')} />
        <Dato valore={CONTA(persone.maestri)} etichetta={t('pan.persone.maestri')} />
        <Dato
          valore={CONTA(persone.inAttesa)} etichetta={t('pan.persone.attesa')}
          allarme={persone.inAttesa > 0}
        />
      </div>
      <p className="admin-card-hint scheda-nota">
        {persone.inAttesa > 0 && persone.attesaPiuLungaMs !== null
          ? t('pan.persone.attesaPiuVecchia', { quando: giorniDa(persone.attesaPiuLungaMs, t) })
          : ''}
        {persone.sospese > 0 ? t('pan.persone.sospese', { n: persone.sospese }) : ''}
        {persone.chiuse > 0 ? `${t('pan.persone.chiuse', { n: persone.chiuse })} ` : ''}
        {persone.sospese === 0 && persone.chiuse === 0 && persone.inAttesa === 0
          ? t('pan.persone.tutteApposto')
          : ''}
      </p>

      {/* ---------- CHI USA L'APP ---------- */}
      {/* ⚠️ QUI C'ERA «QUOTA ANNUALE», CON LA FASCIA E GLI EURO. Tolti
          il 21 agosto 2026 da tutto il progetto: quanto un circolo paga
          a Racket Fever si scrive nel contratto fra le due parti, e non
          in una schermata. Un listino nel software è un listino che
          cambia da trattativa a trattativa mentre le versioni in giro
          restano quelle vecchie — e ogni schermata che lo mostra è una
          schermata che prima o poi dice un prezzo che non è più quello.

          ⚠️ IL CONTEGGIO INVECE RESTA, ED È IL PUNTO. Quante persone
          hanno scaricato e aperto l'app è la misura di quanto il
          servizio è entrato davvero nel circolo: serve a noi per
          l'assistenza, e serve al circolo per sapere quanti dei suoi
          soci non stanno usando quello che gli è stato messo in mano.
          È lo stesso numero che si legge nella Panoramica dentro
          l'app — stesso `riepilogoFatturazione`, stessi campi — così
          non esistono due versioni dello stesso dato. */}
      <div className="superadmin-subtitolo">{t('pan.uso')}</div>
      <div className="scheda-conti">
        <Dato valore={CONTA(fattura.utenti)} etichetta={t('pan.uso.aperto')} />
        <Dato valore={CONTA(fattura.accettatiMaiUsati)} etichetta={t('pan.uso.maiEntrati')} />
        <Dato valore={CONTA(fattura.usciteNelPeriodo)} etichetta={t('pan.uso.usciti')} />
      </div>
      <p className="admin-card-hint scheda-nota">
        {t('pan.uso.nota')}
        {fattura.accettatiMaiUsati === 1
          ? t('pan.uso.maiEntratiUno')
          : fattura.accettatiMaiUsati > 1
            ? t('pan.uso.maiEntratiTanti', { n: fattura.accettatiMaiUsati })
            : ''}
      </p>
      <p className="admin-card-hint scheda-nota">
        {/* ⚠️ Si guarda `ancorato`, non `attivatoIlMs`: la condizione
            di prima chiedeva anche `numero === 1`, e al tredicesimo
            mese un circolo senza data di attivazione tornava a
            stampare una scadenza che non esisteva. */}
        {!fattura.periodo.ancorato
          ? t('pan.uso.periodoLibero')
          : t('pan.uso.periodoAncorato', {
            n: fattura.periodo.numero,
            da: quandoLeggibile(fattura.periodo.inizioMs, t, lingua),
            a: quandoLeggibile(fattura.periodo.fineMs, t, lingua),
          })}
      </p>

      {/* ---------- ATTIVITÀ (dalla fotografia) ---------- */}
      <div className="superadmin-subtitolo">{t('pan.attivita')}</div>
      {/* ⚠️ La data dello scatto sta PRIMA dei numeri, non dopo. Sotto
          si legge come una nota a piè di pagina, e i totali si sono già
          presi per correnti. */}
      <div className={`scheda-foto-barra${(senzaNumeri || fotoVecchia) ? ' scheda-foto-barra-allarme' : ''}`}>
        <span className="scheda-foto-quando">
          {foto === undefined
            ? t('pan.foto.lettura')
            : foto === 'respinta'
              ? (puoAggiornare ? t('pan.foto.respintaAdmin') : t('pan.foto.respintaCollab'))
              : foto === null
                ? (circoloFermo
                  ? t('pan.foto.mancaFermo')
                  : t('pan.foto.mancaAttivo')
                    + (puoAggiornare ? t('pan.foto.mancaPremi') : t('pan.foto.mancaNotte')))
                : scattoMs === null
                  ? (puoAggiornare ? t('pan.foto.senzaDataAdmin') : t('pan.foto.senzaDataCollab'))
                  : t('pan.foto.aggiornataAl', {
                    data: quandoLeggibile(scattoMs, t, lingua),
                    quando: daQuanto(scattoMs, t),
                  }) + (
                    circoloFermo
                      ? t('pan.foto.codaFermo')
                      : fotoVecchia
                        ? t('pan.foto.codaVecchia')
                          + (puoAggiornare ? t('pan.foto.codaPremi') : '')
                        : '')}
        </span>
        {/* ⚠️ A chi non può aggiornare il tasto non si mostra spento:
            si toglie. Un comando visibile ma inerte fa credere di aver
            sbagliato qualcosa; assente, non pone la domanda. */}
        {puoAggiornare && (
        <button
          className="scheda-foto-tasto" onClick={scatta}
          // ⚠️ Spento anche a circolo non attivo: il server rifiuta lo
          // scatto con `failed-precondition`, e un tasto acceso che
          // risponde sempre di no è peggio di un tasto spento.
          // ⚠️ Niente `title` per spiegare il tasto spento: Chrome non
          // mostra il tooltip su un elemento `disabled`, e il motivo e'
          // gia' scritto nella barra qui accanto.
          disabled={scattando || foto === 'respinta' || circoloFermo}
        >
          {scattando ? t('pan.foto.calcolo') : t('pan.foto.aggiorna')}
        </button>
        )}
      </div>
      {erroreScatto && <div className="admin-error-text">{erroreScatto}</div>}
      {avvisoScatto && <p className="admin-card-hint scheda-nota">{avvisoScatto}</p>}
      <p className="admin-card-hint scheda-nota">
        {t('pan.foto.spiegaSito')}
      </p>
      <div className="scheda-conti">
        <Dato valore={CONTA(attivita.prenotazioni)} etichetta={t('pan.att.prenotazioni')} />
        {/* ⚠️ Dalla costante e non «30» scritto a mano: e' proprio il
            difetto contro cui mette in guardia il commento di
            GIORNI_FINESTRA in data/schedaCircolo.ts — il giorno che la
            finestra cambia, il server conta un periodo e la schermata
            ne annuncia un altro. */}
        <Dato valore={CONTA(attivita.prenotazioni30)} etichetta={t('pan.att.ultimiGiorni', { n: CONTA_GIORNI })} />
        <Dato valore={ORE(attivita.oreGiocate)} etichetta={t('pan.att.oreCampo')} />
      </div>
      {/* ⚠️ È il numero che dice davvero se un circolo è vivo, e sta da
          solo apposta: dentro la fila degli altri si legge come una
          statistica, e invece è un semaforo. */}
      <div className="scheda-vivo">
        <span className="scheda-vivo-et">{t('pan.att.ultima')}</span>
        <span className="scheda-vivo-n">
          {quandoLeggibile(attivita.ultimaPrenotazioneMs, t, lingua)}
          {attivita.ultimaPrenotazioneMs !== null && (
            <em> · {daQuanto(attivita.ultimaPrenotazioneMs, t)}</em>
          )}
        </span>
      </div>
      {attivita.senzaDataDiCreazione > 0 && (
        <p className="admin-card-hint scheda-nota">
          {t('pan.att.senzaDataSito', { n: attivita.senzaDataDiCreazione, giorni: CONTA_GIORNI })}
        </p>
      )}
      <div className="scheda-due-colonne">
        <div>
          <div className="scheda-mini-titolo">{t('pan.att.campi')}</div>
          {attivita.campiPiuUsati.length === 0
            ? <p className="admin-empty-text">{t('pan.att.nessuna')}</p>
            : attivita.campiPiuUsati.map((c) => (
              <div key={c.etichetta} className="scheda-riga-mini">
                <span>{c.etichetta}</span><span>{CONTA(c.quante)} {t('com.mezzore')}</span>
              </div>
            ))}
        </div>
        <div>
          <div className="scheda-mini-titolo">{t('pan.att.fasce')}</div>
          {attivita.fascePunta.length === 0
            ? <p className="admin-empty-text">{t('pan.att.nessuna')}</p>
            : attivita.fascePunta.map((f) => (
              <div key={f.etichetta} className="scheda-riga-mini">
                <span>{f.etichetta}</span><span>{CONTA(f.quante)} {t('com.mezzore')}</span>
              </div>
            ))}
        </div>
      </div>

      {/* ---------- LE MEZZ'ORE ----------
          ⚠️ SOLO NEL PANNELLO SUPER ADMIN, e non è una dimenticanza.
          Sono gli stessi riquadri della sezione «Conteggio delle
          mezz'ore» della Dashboard dell'Admin: mostrarli anche lì
          vorrebbe dire gli stessi numeri due volte nella stessa pagina,
          a mezzo schermo di distanza, con pulsanti gemelli. Il
          componente è uno solo
          (`app/admin/dashboard/RiquadriConteggio.tsx`); qui cambia chi
          lo monta, le parole, e il riquadro della commissione — che di
          là non c'è e non ci deve essere.

          ⚠️ Sta subito dopo «Attività» perché è la stessa domanda —
          quanto si gioca su questi campi — misurata in soldi invece che
          in prenotazioni, e prima di «Denaro», che parla invece dei
          conti dei soci in segreteria.

          ⚠️ E il pulsante del maturato chiama il server per il circolo
          APERTO: qui si apre una scheda alla volta, quindi è una
          chiamata a circolo, non una a ogni circolo della rete.

          ⚠️ DUE SOTTOSEZIONI, e l'ordine è invertito rispetto alla
          Dashboard dell'Admin: là il prenotato viene prima perché è la
          domanda di tutti i giorni, qui viene prima il maturato perché
          è quello su cui si fattura, ed è la ragione per cui un circolo
          si apre da questo pannello. */}
      {!perAdmin && (
        <>
          <div className="superadmin-subtitolo">Mezz’ore vendute e incasso</div>
          <p className="admin-card-hint">
            Quante mezz’ore sono state <strong>davvero giocate</strong>, con il taglio a
            mezzanotte di ieri: entrano solo i giorni chiusi per intero. È il numero su cui si
            fattura, e non cambia più una volta scritto.
          </p>
          {/* Da quando si conta: una volta sola per tutti e due i conti. */}
          <RigaAttivoDal attivatoIlMs={attivatoIlMs ?? null} testi={TESTI_ATTIVO_DAL} />
          {/* ⚠️ LA COMMISSIONE STA ACCANTO AL MATURATO E A NIENT'ALTRO.
              Si calcola su `mezzOreNette` del maturato, mai sul live: il
              live comprende le partite di domani e del mese prossimo, e
              fatturarle vorrebbe dire farsi pagare campo che non è
              ancora stato giocato e che potrebbe non esserlo mai — una
              disdetta lo toglie dal conto e il denaro andrebbe reso.
              La costante e la funzione stanno in `data/commissione.ts`,
              che vive solo in questo progetto: il riquadro arriva da
              qui e non da dentro `RiquadriConteggio`, così quel numero
              non passa nemmeno per un file sotto `app/admin/`. */}
          <RiquadriConteggio
            key={`maturato-${giroConteggi}`}
            modo="maturato"
            circoloId={circoloId}
            testi={TESTI_MATURATO}
            riquadroInPiu={(c: Conteggio | null) => (
              <div className="scheda-conto scheda-conto-allarme">
                <span className="scheda-conto-n">
                  {/* ⚠️ `euroDaCentesimi` e non `euro`: la commissione
                      nasce in centesimi interi e va scritta come
                      l'incasso che le sta accanto. Passarla per un
                      numero in virgola darebbe due totali che non
                      tornano nella stessa fila di riquadri. */}
                  {c ? `${euroDaCentesimi(commissioneCentesimi(mezzOreNette(c)))} €` : '—'}
                </span>
                <span className="scheda-conto-et">Commissione dovuta</span>
              </div>
            )}
          />
          <p className="admin-card-hint scheda-nota">{NOTA_INCASSO}</p>
          <p className="admin-card-hint scheda-nota">
            La commissione è calcolata sulle <strong>mezz’ore nette maturate</strong> — prenotate
            meno annullate, sui soli giorni chiusi. Non sul prenotato: quelle mezz’ore non sono
            ancora state giocate, e una disdetta le toglie dal conto.
          </p>

          <div className="superadmin-subtitolo">Prenotato adesso</div>
          <p className="admin-card-hint">
            Quante mezz’ore risultano prenotate <strong>in questo momento</strong>, comprese
            quelle di domani e del mese prossimo. È la fotografia del presente e serve a vedere
            come gira il circolo, non a fare i conti: qui accanto non c’è nessuna commissione
            perché sarebbe campo non ancora giocato.
          </p>
          <RiquadriConteggio
            key={`live-${giroConteggi}`}
            modo="live"
            circoloId={circoloId}
            testi={TESTI_LIVE}
          />

          <TastoRicostruisci
            circoloId={circoloId}
            onFatto={() => setGiroConteggi((n) => n + 1)}
          />
        </>
      )}

      {/* ---------- DENARO ---------- */}
      <div className="superadmin-subtitolo">{t('pan.denaro')}</div>
      <div className="scheda-conti">
        <Dato valore={EURO(denaro.creditoInGiacenza)} etichetta={t('pan.den.giacenza')} />
        <Dato
          valore={EURO(denaro.debiti)} etichetta={t('pan.den.debiti')}
          allarme={denaro.debiti > 0}
        />
        {/* ⚠️ QUI STAVA «fido concesso», la somma dei tetti di Fido di
            tutti i soci. Tolto il 25 agosto 2026: il Fido non è più un
            numero per socio ma uno solo per circolo, e la somma non
            voleva più dire niente. Si legge nella sezione «Fido». */}
      </div>
      <p className="admin-card-hint scheda-nota">
        {/* ⚠️ QUATTRO CASI, non due. Con un booleano solo, mentre la
            fotografia stava arrivando si finiva nel ramo dei numeri e
            si leggeva «0 movimenti, € 0,00 di ricariche — dalla
            fotografia»: zeri di ripiego presentati come letture vere,
            firmati da una fotografia che non era ancora arrivata. */}
        {inAttesaFoto
          ? t('pan.den.movCaricamento', { giorni: CONTA_GIORNI })
          : foto === 'respinta'
            ? t('pan.den.movRespinti', { giorni: CONTA_GIORNI })
            : senzaNumeri
              ? t('pan.den.movSenzaFoto', { giorni: CONTA_GIORNI })
              : t('pan.den.movNumeri', {
                giorni: CONTA_GIORNI,
                movimenti: CONTA(registro.movimenti30),
                ricariche: EURO(registro.ricariche30),
                addebiti: EURO(registro.addebiti30),
              })}
        {t('pan.den.giacenzaNota')}
        {/* ⚠️ La differenza si DICE. Questi totali contano tutte le
            tessere; gli elenchi «Soci» e «Debiti» qui sotto mostrano
            solo chi è ancora del circolo. Finché le due cose stavano
            lontane nessuno le confrontava: adesso stanno una sopra
            l'altra, e senza questa riga sembra che una delle due
            sbagli. */}
        {/* La frase la scrive data/schedaCircolo.ts, cioè lo stesso
            file che calcola i numeri di cui parla. Qui si aggiunge solo
            la coda che riguarda le due sezioni, che esistono nella
            Panoramica dell'Admin e non nel pannello Super Admin. */}
        {fraseFuoriElenco !== null && (
          <>
            {fraseFuoriElenco}
            {perAdmin ? t('pan.den.fuori.coda') : '.'}
          </>
        )}
      </p>

      {/* ---------- ELENCO PER SOCIO ---------- */}
      <button
        className="scheda-elenco-tasto" onClick={() => setElencoAperto((v) => !v)}
        aria-expanded={elencoAperto}
      >
        {elencoAperto ? t('pan.elenco.chiudi') : t('pan.elenco.apri', { n: righe.length })}
      </button>
      {elencoAperto && (inAttesaFoto || senzaNumeri) && (
        <p className="admin-card-hint scheda-nota">
          {inAttesaFoto
            ? t('pan.elenco.inArrivo')
            : foto === 'respinta'
              ? t('pan.elenco.respinta')
              : t('pan.elenco.assente')}
        </p>
      )}
      {elencoAperto && (
        righe.length === 0
          ? <p className="admin-empty-text">{t('pan.elenco.vuoto')}</p>
          : (
            <div className="scheda-tabella-culla">
              <table className="scheda-tabella">
                <thead>
                  <tr>
                    <th>{t('pan.tab.persona')}</th><th>{t('pan.tab.stato')}</th><th>{t('pan.tab.pren')}</th>
                    <th>{t('pan.tab.credito')}</th><th>{t('pan.tab.debito')}</th>
                    <th>{t('pan.tab.classifica')}</th><th>{t('pan.tab.ultimaPren')}</th>
                  </tr>
                </thead>
                <tbody>
                  {righe.map((r) => (
                    <tr key={r.uid || r.email}>
                      <td>
                        <div className="scheda-td-nome">{r.nome}</div>
                        <div className="scheda-td-sub">
                          {r.ruolo === 'ospite' ? t('pan.elenco.ospite') : t('pan.elenco.socio')}
                        </div>
                      </td>
                      <td>{etichettaStato(r.stato, t)}</td>
                      <td>{CONTA(r.prenotazioni)}</td>
                      <td>{EURO(r.credito)}</td>
                      <td className={r.debito > 0 ? 'scheda-td-debito' : undefined}>
                        {EURO(r.debito)}
                      </td>
                      <td>{r.posizione ?? '—'}</td>
                      <td>{giornoLeggibile(r.ultimaPrenotazioneMs)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
      )}

      {/* ⚠️ Questa riga non è un disclaimer di cortesia: è la decisione
          presa sulla privacy, scritta dove chi usa il pannello la legge.
          La stessa decisione sta nelle regole Firestore, che è il posto
          dove conta davvero — l'interfaccia non protegge niente. */}
      {/* ⚠️ Questa riga è stata riscritta dopo una revisione, e la
          versione di prima è istruttiva: prometteva che le chat «non
          sono accessibili nemmeno tecnicamente». Non era vero — il Super
          Admin può creare documenti in /responsabili e /tessere, e da lì
          diventare admin o socio di un circolo. Quella strada adesso è
          chiusa nelle regole (non può crearli intestati a sé), ma
          «impossibile» resta una parola che un'interfaccia non può
          promettere: qui si dice cosa fanno le regole, non cosa non
          potrà mai succedere. */}
      <p className="admin-card-hint scheda-privacy">
        {perAdmin
          ? t('pan.privacy')
          // ⚠️ Ramo del Super Admin: lo legge solo il team Racket
          // Fever, resta in italiano.
          : 'Questi numeri servono all’assistenza e alla fatturazione. Le conversazioni dei soci non compaiono qui e le regole del database non ne concedono la lettura al team Racket Fever.'}
      </p>
    </div>
  );
}
