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
  frasePosizioniFuoriElenco,
  ATTIVITA_SENZA_FOTO, REGISTRO_SENZA_FOTO,
  riepilogoPersone, riepilogoDenaro, righeSocio,
} from '../../../data/schedaCircolo';
import { riepilogoFatturazione, euro } from '../../../data/fatturazione';

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

function quandoLeggibile(ms: number | null): string {
  if (ms === null) return '—';
  return new Date(ms).toLocaleDateString('it-IT', { day: '2-digit', month: 'long', year: 'numeric' });
}

// "3 giorni fa", "oggi". Serve accanto alla data: una data da sola
// costringe chi legge a fare il conto a mente, ed è proprio il conto
// che dice se il circolo è vivo.
function daQuanto(ms: number | null, adesso = Date.now()): string {
  if (ms === null) return '';
  const giorni = Math.floor((adesso - ms) / (24 * 60 * 60 * 1000));
  if (giorni <= 0) return 'oggi';
  if (giorni === 1) return 'ieri';
  if (giorni < 30) return `${giorni} giorni fa`;
  const mesi = Math.floor(giorni / 30);
  return mesi === 1 ? 'un mese fa' : `${mesi} mesi fa`;
}

function giorniDa(ms: number | null): string {
  if (ms === null) return '';
  const giorni = Math.floor(ms / (24 * 60 * 60 * 1000));
  if (giorni <= 0) return 'da oggi';
  return giorni === 1 ? 'da ieri' : `da ${giorni} giorni`;
}

function giornoLeggibile(ms: number | null): string {
  if (ms === null) return '—';
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`;
}

const ETICHETTA_STATO: Record<string, string> = {
  approvata: 'attiva', in_attesa: 'in attesa', sospesa: 'sospesa',
  chiusa: 'chiusa', rifiutata: 'rifiutata',
};

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
        setAvvisoScatto('La fotografia è appena stata rifatta: i numeri qui sopra sono già quelli nuovi.');
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
            ? 'Aggiornamento non consentito: puoi aggiornare la fotografia del tuo circolo, e solo se il circolo è attivo.'
            : 'Aggiornamento non consentito: serve un accesso Super Admin.')
          : codice.includes('deadline-exceeded') || codice.includes('internal')
            ? 'Il calcolo ha impiegato troppo: il circolo ha molto storico. Riprova fra qualche minuto — se il server ha finito nel frattempo, i numeri qui sopra si aggiornano da soli.'
            : `Aggiornamento non riuscito.${dalServer ? ` Il server risponde: ${dalServer}` : ' Riprova fra un momento.'}`,
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
  const fraseFuoriElenco = frasePosizioniFuoriElenco(denaro, EURO);
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
            ? `Non riesco a leggere alcuni dati del circolo (${respinto.join(', ')}): i numeri qui sotto sono incompleti e non lo diventeranno. Non vuol dire che il circolo sia vuoto — se il problema resta, scrivici.`
            : `Lettura respinta (${respinto.join(', ')}): i numeri qui sotto sono incompleti e non lo diventeranno. Di solito vuol dire che le regole del database non consentono questa lettura — non che il circolo sia vuoto.`}
        </p>
      ) : !tutteArrivate && (
        // ⚠️ Non `scheda-attesa`: quella è la veste ambra dell'avviso,
        // e un caricamento normale vestito da problema insegna a
        // ignorare l'ambra il giorno che il problema c'è davvero.
        <p className="admin-card-hint scheda-nota">
          Caricamento dei dati del circolo… i numeri qui sotto sono ancora parziali.
        </p>
      )}

      {/* ---------- PERSONE ---------- */}
      <div className="superadmin-subtitolo">Persone</div>
      <div className="scheda-conti">
        <Dato valore={CONTA(persone.soci)} etichetta="soci tesserati" />
        <Dato valore={CONTA(persone.ospiti)} etichetta="ospiti" />
        <Dato valore={CONTA(persone.maestri)} etichetta="maestri" />
        <Dato
          valore={CONTA(persone.inAttesa)} etichetta="richieste in attesa"
          allarme={persone.inAttesa > 0}
        />
      </div>
      <p className="admin-card-hint scheda-nota">
        {persone.inAttesa > 0 && persone.attesaPiuLungaMs !== null
          ? `La richiesta più vecchia aspetta ${giorniDa(persone.attesaPiuLungaMs)}. `
          : ''}
        {persone.sospese > 0 ? `${persone.sospese} tessere sospese. ` : ''}
        {persone.chiuse > 0 ? `${persone.chiuse} chiuse. ` : ''}
        {persone.sospese === 0 && persone.chiuse === 0 && persone.inAttesa === 0
          ? 'Nessuna tessera in attesa, sospesa o chiusa.'
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
      <div className="superadmin-subtitolo">Chi usa l’app</div>
      <div className="scheda-conti">
        <Dato valore={CONTA(fattura.utenti)} etichetta="hanno aperto l’app" />
        <Dato valore={CONTA(fattura.accettatiMaiUsati)} etichetta="accettati, mai entrati" />
        <Dato valore={CONTA(fattura.usciteNelPeriodo)} etichetta="usciti nel periodo" />
      </div>
      <p className="admin-card-hint scheda-nota">
        Si contano le persone che il circolo ha accettato — soci, tesserati e ospiti allo stesso
        modo — e che hanno aperto l’app almeno una volta. Chi è entrato conta anche se poi è
        uscito: il numero dice quante persone il servizio ha raggiunto nel periodo, non quante
        ce ne sono stamattina.
        {fattura.accettatiMaiUsati > 0
          ? ` ${fattura.accettatiMaiUsati === 1 ? 'Una persona è stata accettata ma non ha' : `${fattura.accettatiMaiUsati} persone sono state accettate ma non hanno`} mai aperto l’app: ${fattura.accettatiMaiUsati === 1 ? 'non è' : 'non sono'} nel conteggio.`
          : ''}
      </p>
      <p className="admin-card-hint scheda-nota">
        {/* ⚠️ Si guarda `ancorato`, non `attivatoIlMs`: la condizione
            di prima chiedeva anche `numero === 1`, e al tredicesimo
            mese un circolo senza data di attivazione tornava a
            stampare una scadenza che non esisteva. */}
        {!fattura.periodo.ancorato
          ? 'Periodo: gli ultimi dodici mesi. Il circolo non ha una data di attivazione scritta, quindi il conto non è ancorato a un anniversario.'
          : `Anno ${fattura.periodo.numero} dall’attivazione, dal ${quandoLeggibile(fattura.periodo.inizioMs)} al ${quandoLeggibile(fattura.periodo.fineMs)}. Il numero può ancora salire fino a quella data.`}
      </p>

      {/* ---------- ATTIVITÀ (dalla fotografia) ---------- */}
      <div className="superadmin-subtitolo">Attività</div>
      {/* ⚠️ La data dello scatto sta PRIMA dei numeri, non dopo. Sotto
          si legge come una nota a piè di pagina, e i totali si sono già
          presi per correnti. */}
      <div className={`scheda-foto-barra${(senzaNumeri || fotoVecchia) ? ' scheda-foto-barra-allarme' : ''}`}>
        <span className="scheda-foto-quando">
          {foto === undefined
            ? 'Lettura della fotografia…'
            : foto === 'respinta'
              ? (puoAggiornare
                  ? 'Lettura della fotografia respinta: i numeri qui sotto non ci sono, e il tasto non risolve — è un problema di permessi.'
                  : 'Lettura della fotografia respinta: i numeri qui sotto non ci sono. Se il tuo accesso Collaboratore è scaduto, rientra con la password del circolo.')
              : foto === null
                ? (circoloFermo
                  ? 'Nessuna fotografia: di questo circolo non ne è mai stata calcolata una, e non lo sarà finché il circolo non torna attivo.'
                  : 'Nessuna fotografia ancora: i numeri qui sotto mancano perché non sono stati calcolati, non perché il circolo sia fermo. '
                    + (puoAggiornare
                      ? 'Premi «Aggiorna adesso».'
                      : 'Il calcolo gira ogni notte; per rifarlo subito serve l’accesso del responsabile del circolo.'))
                : scattoMs === null
                  ? (puoAggiornare
                    ? 'Fotografia senza data di scatto: rifalla per sapere a quando risale.'
                    : 'Fotografia senza data di scatto: la prossima notte il calcolo la rifà, e la data torna.')
                  : `Aggiornato al ${quandoLeggibile(scattoMs)} · ${daQuanto(scattoMs)}${
                    circoloFermo
                      ? ' — il circolo non è attivo: questa resta la fotografia dell’ultimo giorno di attività'
                      : fotoVecchia
                        ? ' — il giro notturno fotografa pochi circoli per volta e questo è rimasto indietro'
                          + (puoAggiornare ? ': premi «Aggiorna adesso»' : '')
                        : ''}`}
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
          {scattando ? 'Calcolo in corso…' : 'Aggiorna adesso'}
        </button>
        )}
      </div>
      {erroreScatto && <div className="admin-error-text">{erroreScatto}</div>}
      {avvisoScatto && <p className="admin-card-hint scheda-nota">{avvisoScatto}</p>}
      <p className="admin-card-hint scheda-nota">
        Prenotazioni, ore, campi, fasce, registro e numeri per socio si calcolano una volta a
        notte sul server: contarli qui vorrebbe dire scaricare tutto lo storico del circolo a
        ogni apertura di questa pagina. Persone e denaro in giacenza, invece, sono dal vivo.
      </p>
      <div className="scheda-conti">
        <Dato valore={CONTA(attivita.prenotazioni)} etichetta="prenotazioni in tutto" />
        {/* ⚠️ Dalla costante e non «30» scritto a mano: e' proprio il
            difetto contro cui mette in guardia il commento di
            GIORNI_FINESTRA in data/schedaCircolo.ts — il giorno che la
            finestra cambia, il server conta un periodo e la schermata
            ne annuncia un altro. */}
        <Dato valore={CONTA(attivita.prenotazioni30)} etichetta={`negli ultimi ${CONTA_GIORNI} giorni`} />
        <Dato valore={ORE(attivita.oreGiocate)} etichetta="ore di campo" />
      </div>
      {/* ⚠️ È il numero che dice davvero se un circolo è vivo, e sta da
          solo apposta: dentro la fila degli altri si legge come una
          statistica, e invece è un semaforo. */}
      <div className="scheda-vivo">
        <span className="scheda-vivo-et">Ultima prenotazione fatta</span>
        <span className="scheda-vivo-n">
          {quandoLeggibile(attivita.ultimaPrenotazioneMs)}
          {attivita.ultimaPrenotazioneMs !== null && (
            <em> · {daQuanto(attivita.ultimaPrenotazioneMs)}</em>
          )}
        </span>
      </div>
      {attivita.senzaDataDiCreazione > 0 && (
        <p className="admin-card-hint scheda-nota">
          {attivita.senzaDataDiCreazione} prenotazioni non riportano quando sono state fatte:
          sono più vecchie di quel campo. Contano nel totale e nelle ore di campo, ma restano
          fuori dagli ultimi {CONTA_GIORNI} giorni e non possono essere l&apos;ultima
          prenotazione qui sopra. Non vuol dire che non ci siano state.
        </p>
      )}
      <div className="scheda-due-colonne">
        <div>
          <div className="scheda-mini-titolo">Campi più usati</div>
          {attivita.campiPiuUsati.length === 0
            ? <p className="admin-empty-text">Nessuna prenotazione.</p>
            : attivita.campiPiuUsati.map((c) => (
              <div key={c.etichetta} className="scheda-riga-mini">
                <span>{c.etichetta}</span><span>{CONTA(c.quante)} mezz&apos;ore</span>
              </div>
            ))}
        </div>
        <div>
          <div className="scheda-mini-titolo">Fasce di punta</div>
          {attivita.fascePunta.length === 0
            ? <p className="admin-empty-text">Nessuna prenotazione.</p>
            : attivita.fascePunta.map((f) => (
              <div key={f.etichetta} className="scheda-riga-mini">
                <span>{f.etichetta}</span><span>{CONTA(f.quante)} mezz&apos;ore</span>
              </div>
            ))}
        </div>
      </div>

      {/* ---------- DENARO ---------- */}
      <div className="superadmin-subtitolo">Denaro</div>
      <div className="scheda-conti">
        <Dato valore={EURO(denaro.creditoInGiacenza)} etichetta="credito in giacenza" />
        <Dato
          valore={EURO(denaro.debiti)} etichetta="debiti aperti"
          allarme={denaro.debiti > 0}
        />
        <Dato valore={EURO(denaro.fidoConcesso)} etichetta="fido concesso" />
      </div>
      <p className="admin-card-hint scheda-nota">
        {/* ⚠️ QUATTRO CASI, non due. Con un booleano solo, mentre la
            fotografia stava arrivando si finiva nel ramo dei numeri e
            si leggeva «0 movimenti, € 0,00 di ricariche — dalla
            fotografia»: zeri di ripiego presentati come letture vere,
            firmati da una fotografia che non era ancora arrivata. */}
        {inAttesaFoto
          ? `Movimenti, ricariche e addebiti degli ultimi ${CONTA_GIORNI} giorni: in caricamento…`
          : foto === 'respinta'
            ? `Movimenti, ricariche e addebiti degli ultimi ${CONTA_GIORNI} giorni: non leggibili da qui — è un problema di permessi, non un circolo senza movimenti.`
            : senzaNumeri
              ? `Movimenti, ricariche e addebiti degli ultimi ${CONTA_GIORNI} giorni: non disponibili finché non c’è una fotografia.`
              : `Negli ultimi ${CONTA_GIORNI} giorni: ${CONTA(registro.movimenti30)} movimenti, ${EURO(registro.ricariche30)} di ricariche, ${EURO(registro.addebiti30)} di addebiti — dalla fotografia. Le ricariche contano i versamenti in segreteria, non le ricariche con il Fido.`}
        {' '}Il credito in giacenza è denaro dei soci versato in segreteria: comprende anche le
        tessere chiuse, perché è una posizione ancora aperta con chi se n&apos;è andato.
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
            {perAdmin
              ? ', ma non nelle sezioni «Soci» e «Debiti dei Soci», che mostrano solo chi è del circolo adesso.'
              : '.'}
          </>
        )}
      </p>

      {/* ---------- ELENCO PER SOCIO ---------- */}
      <button
        className="scheda-elenco-tasto" onClick={() => setElencoAperto((v) => !v)}
        aria-expanded={elencoAperto}
      >
        {elencoAperto ? 'Chiudi l’elenco per socio' : `Elenco per socio (${righe.length})`}
      </button>
      {elencoAperto && (inAttesaFoto || senzaNumeri) && (
        <p className="admin-card-hint scheda-nota">
          {inAttesaFoto
            ? 'Prenotazioni e data dell’ultima si leggono dalla fotografia, che sta ancora arrivando: per ora quelle due colonne sono a zero. I nomi e i saldi sono veri.'
            : foto === 'respinta'
              ? 'Prenotazioni e data dell’ultima si leggono dalla fotografia, che da qui non è leggibile: le due colonne dei conteggi restano a zero. I nomi e i saldi sono veri e aggiornati.'
              : 'Prenotazioni e data dell’ultima si leggono dalla fotografia, che qui non c’è: i nomi e i saldi sono veri e aggiornati, le due colonne dei conteggi no.'}
        </p>
      )}
      {elencoAperto && (
        righe.length === 0
          ? <p className="admin-empty-text">Nessuna tessera in questo circolo.</p>
          : (
            <div className="scheda-tabella-culla">
              <table className="scheda-tabella">
                <thead>
                  <tr>
                    <th>Persona</th><th>Stato</th><th>Pren.</th>
                    <th>Credito</th><th>Debito</th><th>Class.</th><th>Ultima pren.</th>
                  </tr>
                </thead>
                <tbody>
                  {righe.map((r) => (
                    <tr key={r.uid || r.email}>
                      <td>
                        <div className="scheda-td-nome">{r.nome}</div>
                        <div className="scheda-td-sub">
                          {r.ruolo === 'ospite' ? 'Ospite' : 'Socio'}
                        </div>
                      </td>
                      <td>{ETICHETTA_STATO[r.stato] ?? r.stato}</td>
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
          ? 'Qui non compaiono le conversazioni: le chat delle sfide e delle lezioni restano fra le persone che le hanno scritte.'
          : 'Questi numeri servono all’assistenza e alla fatturazione. Le conversazioni dei soci non compaiono qui e le regole del database non ne concedono la lettura al team Racket Fever.'}
      </p>
    </div>
  );
}
