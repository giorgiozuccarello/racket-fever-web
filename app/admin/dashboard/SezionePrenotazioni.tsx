'use client';

import { useEffect, useRef, useState } from 'react';
import { Campo, Blocco, Circolo, ORARI, fasciaOraria, orarioFineSlot, slotNelPassato,
  circoloOperativo, statoCircolo } from '../../../data/circoli';
import { SocioCircolo } from '../../../data/users';
import { calcolaPrezzo } from '../../../data/prezzi';
import { aggiungiBlocco, modificaBlocco, rimuoviBlocco } from '../../../data/circoliRepo';
import { prenotaPerSocioDaAdmin, prenotaEsternoDaAdmin, prenotaConGiocatori } from '../../../data/prenotazioniRepo';
import { nuovoGruppoId } from '../../../data/movimenti';
import { stessaCard } from '../../../data/raggruppamento';

type PezzoRiserva = { campoId: string; campoNome: string; data: string; dataLabel: string; orario: string };

// ============================================================
// ⚠️ QUESTE DUE TABELLE RESTANO IN ITALIANO, E NON E' UNA DIMENTICANZA
// DELLA TORNATA DELLE LINGUE. Servono a comporre `dataLeggibile`, che
// non e' una scritta: e' il campo `dataLabel` che viene SCRITTO su
// Firestore dentro ogni prenotazione e riletto dal socio mesi dopo. Se
// lo componesse la lingua dell'Admin, un circolo con la dashboard in
// tedesco scriverebbe «Montag 26 Aug.» dentro la prenotazione di un
// socio italiano — e resterebbe li' per sempre. Quello che l'Admin
// LEGGE a schermo e' `dataMostrata`, poco piu' sotto, ed e' tradotto.
// ============================================================
const GIORNI_IT_ESTESO = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato'];
const MESI_IT = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];

// Le stesse due tabelle, ma come chiavi del dizionario comune: da qui
// esce cio' che si vede, indicizzato con `getDay()` (0 = domenica).
const CHIAVI_GIORNO_BREVE = ['com.g.dom', 'com.g.lun', 'com.g.mar', 'com.g.mer', 'com.g.gio', 'com.g.ven', 'com.g.sab'] as const;
const CHIAVI_GIORNO_LUNGO = ['com.G.dom', 'com.G.lun', 'com.G.mar', 'com.G.mer', 'com.G.gio', 'com.G.ven', 'com.G.sab'] as const;
import { PrenotazioneAdmin, cancellaConRimborso, cancellaConRimborsoDiviso, cancellaSenzaRimborso, importoDaRimborsare } from '../../../data/prenotazioniRepo';
import { giocatoriDi, quotaChiPrenota, elencoNomi } from '../../../data/giocatori';
import { Sfida } from '../../../data/sfide';
import { creaNotifica } from '../../../data/notifiche';
import { avviso } from '../../../data/linguaDestinatario';

// Gli avvisi sono un di piu': se falliscono non deve mai sembrare che
// l'annullamento sia fallito — a quel punto la prenotazione e' gia'
// stata cancellata e il credito rimborsato.
async function senzaBloccare(fn: () => Promise<unknown>) {
  try { await fn(); } catch (e) { console.warn('Avviso non inviato:', e); }
}

// ⚠️ QUI NON C'E' PIU' NIENTE SULLE LEZIONI, ed e' voluto. C'era una
// funzione che chiudeva la conversazione quando il circolo annullava
// l'ultima mezz'ora di una lezione: rimediava a meta' a un problema che
// non andava rimediato ma tolto. Le lezioni adesso si annullano intere,
// dalla sezione "Lezioni Prenotate" (data/lezioniAdmin.ts), e da questa
// griglia sono solo consultabili.

import { formatISO } from '../../../data/settimana';
import Modal from './Modal';
import { useLingua } from '../../../lib/lingua';
import { Traduttore } from '../../../data/testi';

// Titolo prominente del pop-up di una prenotazione: chi gioca, con chi —
// la stessa regola in tutta l'app: le info contano più dell'azione.
// ⚠️ Il traduttore arriva dal chiamante: questa funzione sta fuori dal
// componente e un hook, qui dentro, non si puo' chiamare.
function intestazionePrenotazione(p: PrenotazioneAdmin, t: Traduttore): string {
  if (p.tipo === 'lezione') {
    return p.prenotataDa === 'maestro'
      ? t('adm.pre.titoloLezioneDaMaestro', {
        maestro: `${p.maestroNome} ${p.maestroCognome}`, allievo: `${p.utenteNome} ${p.utenteCognome}`,
      })
      : t('adm.pre.titoloLezioneDaSocio', {
        allievo: `${p.utenteNome} ${p.utenteCognome}`, maestro: `${p.maestroNome} ${p.maestroCognome}`,
      });
  }
  if (giocatoriDi(p).length > 0) {
    return t('adm.pre.titoloGiocaCon', {
      socio: `${p.utenteNome} ${p.utenteCognome}`, altri: elencoNomi(giocatoriDi(p)),
    });
  }
  return `${p.utenteNome} ${p.utenteCognome}`;
}

export default function SezionePrenotazioni({ campi, blocchi, prenotazioni, sfide, circolo, soci, nomeEsecutore }: {
  campi: Campo[]; blocchi: Blocco[]; prenotazioni: PrenotazioneAdmin[]; sfide: Sfida[]; circolo: Circolo; soci: SocioCircolo[];
  // Chi sta operando: finisce nel registro movimenti.
  nomeEsecutore: string;
}) {
  const { t } = useLingua();
  const [selDay, setSelDay] = useState(0);
  // Un battito ogni mezzo minuto. Questo pannello sta aperto sul PC
  // della segreteria per ore: senza, gli slot che scoccano non
  // diventerebbero mai passati finche' non arriva un aggiornamento da
  // Firestore. Il valore non si usa, serve solo a ridisegnare.
  const [, battito] = useState(0);
  useEffect(() => {
    const t = setInterval(() => battito((n) => n + 1), 30000);
    return () => clearInterval(t);
  }, []);
  const [selCampoId, setSelCampoId] = useState('');
  const [daAnnullare, setDaAnnullare] = useState<PrenotazioneAdmin | null>(null);
  // Mezz'ora centrale: il pop-up resta completo, sparisce solo il
  // pulsante di cancellazione.
  const [bloccataInMezzo, setBloccataInMezzo] = useState(false);
  // Scelta fra prolungare una prenotazione adiacente e aprirne una nuova.
  const [sceltaProlunga, setSceltaProlunga] = useState<{ ore: string[]; vicine: PrenotazioneAdmin[] } | null>(null);
  const [nuovaPrenotazione, setNuovaPrenotazione] = useState(false);
  const [cardId, setCardId] = useState<string | null>(null);
  // ⚠️ IL TIPO PORTA ANCHE LA MEZZ'ORA TOCCATA, e prima era il solo
  // blocco. Serve a sapere se si sta guardando un'estremita' della
  // riserva: e' l'unico punto da cui si puo' togliere una mezz'ora
  // senza spezzarla in due documenti.
  const [bloccoInfo, setBloccoInfo] = useState<{ blocco: Blocco; ora: string } | null>(null);
  // ⚠️ «STO ALLUNGANDO UNA PRENOTAZIONE CHE C'E' GIA'», e NON e' il
  // contrario di `nuovaPrenotazione`. Quel campo risponde a un'altra
  // domanda — «adiacente sì, ma è una partita a sé?» — e vale `false`
  // anche nel caso più comune, una prenotazione nuova isolata.
  const [prolungamento, setProlungamento] = useState(false);
  // I compagni della partita che si sta allungando: si ereditano e
  // basta, non si scelgono da qui (si cambiano dalla Card in Home).
  const [giocatoriEreditati, setGiocatoriEreditati] = useState<{ uid: string; nome: string; cognome: string }[]>([]);
  const [sceltaProlungaRiserva, setSceltaProlungaRiserva] = useState<{ ore: string[]; vicine: Blocco[] } | null>(null);
  const [elaborandoRiserva, setElaborandoRiserva] = useState(false);
  // ⚠️ LA CONFERMA A DUE PULSANTI. Sul browser `alert()` ha un pulsante
  // solo e `confirm()` non lascia scegliere le parole: in questa
  // schermata il testo dei pulsanti e' portatore di significato — «Togli
  // i giocatori» non e' «Aggiungi», «Allunga lo stesso» non e' «OK» — e
  // quasi tutte queste domande hanno un ramo distruttivo. Si usa quindi
  // uno strato con i suoi pulsanti, come fa l'app.
  const [conferma, setConferma] = useState<{
    titolo: string; testo: string; etichetta: string; azione: () => void;
  } | null>(null);
  const [sfidaInfo, setSfidaInfo] = useState<Sfida | null>(null);
  const [elaborando, setElaborando] = useState(false);
  const [erroreAnnullo, setErroreAnnullo] = useState('');

  // --- Selezione multipla, prenotazione e riserva dalla griglia ---
  // Stesso meccanismo dell'app mobile: si parte da uno slot libero e
  // si estende toccando gli slot adiacenti.
  const [selezioneMultipla, setSelezioneMultipla] = useState<string[]>([]);
  const [oreDaAssegnare, setOreDaAssegnare] = useState<string[]>([]);
  const [oreDaPrenotare, setOreDaPrenotare] = useState<string[]>([]);
  const [oreDaRiservare, setOreDaRiservare] = useState<string[]>([]);
  const [modalitaEsterno, setModalitaEsterno] = useState(false);
  const [nomeEsterno, setNomeEsterno] = useState('');
  const [filtroSocio, setFiltroSocio] = useState('');
  const [socioScelto, setSocioScelto] = useState<SocioCircolo | null>(null);
  const [senzaAddebito, setSenzaAddebito] = useState(false);
  const [etichettaRiserva, setEtichettaRiserva] = useState('');
  const [descrizioneRiserva, setDescrizioneRiserva] = useState('');
  // ============================================================
  // ⚠️ UNA RISERVA SU PIU' GIORNI E PIU' CAMPI, con l'etichetta scritta
  // UNA VOLTA SOLA. La griglia mostra un giorno e un campo per volta e
  // cambiando pagina la selezione si azzera — giustamente, senza si
  // prenotava sul campo sbagliato — quindi la selezione non si allarga:
  // si METTE DA PARTE, con campo e giorno addosso a ogni pezzo. Alla
  // fine diventa un documento di riserva per ogni campo + giorno +
  // tratto continuo.
  // ============================================================
  const [pezziRiserva, setPezziRiserva] = useState<PezzoRiserva[]>([]);
  const [componendoRiserva, setComponendoRiserva] = useState(false);

  useEffect(() => {
    if ((!selCampoId || !campi.some((c) => c.id === selCampoId)) && campi[0]) {
      setSelCampoId(campi[0].id);
    }
  }, [campi]);

  // ⚠️ Quattordici giorni e non piu' sette: componendo una riserva su
  // piu' giorni — un torneo, una manutenzione — sette non bastano, e la
  // griglia dell'app ne mostra gia' quattordici.
  const giorni = Array.from({ length: 14 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    return d;
  });
  const giornoSel = giorni[selDay];
  const dataSelIso = formatISO(giornoSel);

  const bloccoAttivo = (ora: string): Blocco | undefined => {
    if (!selCampoId) return undefined;
    return blocchi.find((b) => {
      if (b.campoId !== selCampoId) return false;
      if (ora < b.orarioInizio || ora >= b.orarioFine) return false;
      if (b.tipo === 'data') return b.data === dataSelIso;
      return (b.giorniSettimana ?? []).includes(giornoSel.getDay());
    });
  };

  const campoSel = campi.find((c) => c.id === selCampoId);
  // ============================================================
  // ⚠️ UNA MEZZ'ORA DA SOLA NON E' UNA PRENOTAZIONE.
  //
  // Regola generale decisa da Giorgio il 24 agosto 2026, portata sul
  // web il giorno dopo: qui era rimasto il sistema vecchio, con il
  // tetto di quattro ore e senza prolungamento. La mezz'ora singola si
  // puo' solo AGGIUNGERE a una prenotazione o a un orario riservato che
  // esistono gia', o TOGLIERE da qualcosa di piu' lungo. Da zero non si
  // crea, e il buco isolato da trenta minuti si perde: perdita
  // accettata, in cambio di una griglia che non si riempie di ritagli
  // invendibili a chi vuole giocare un'ora.
  //
  // ⚠️ IL TETTO INVECE E' STATO TOLTO, su richiesta di Giorgio: per un
  // circolo che riserva una giornata intera per un torneo, quattro ore
  // erano un limite senza senso.
  // ============================================================
  const MINIMO_SLOT_NUOVA_PRENOTAZIONE = 2;

  // Una mezz'ora "in mezzo" non si cancella: spezzerebbe la
  // prenotazione in due tronconi. Vale solo per le PRENOTAZIONI —
  // sugli orari riservati non c'e' vincolo di consequenzialita' — e
  // solo DENTRO una singola prenotazione: due partite consecutive
  // dello stesso socio sono due card distinte e non si vincolano.
  const inMezzoAllaPrenotazione = (ora: string): boolean => {
    const questa = prenotazioneSlot(ora);
    if (!questa) return false;
    const idx = ORARI.indexOf(ora);
    const stessa = (o?: string) => stessaCard(o ? prenotazioneSlot(o) : undefined, questa);
    return stessa(ORARI[idx - 1]) && stessa(ORARI[idx + 1]);
  };

  const slotPrenotabile = (ora: string) =>
    !prenotazioneSlot(ora) && !bloccoAttivo(ora) && !slotNelPassato(dataSelIso, ora);

  // Timer della pressione prolungata: se il dito resta fermo mezzo
  // secondo, parte la selezione. pressioneLunga evita che al rilascio
  // scatti anche il click normale sullo stesso slot.
  // ⚠️ UN RIFERIMENTO SEMPRE FRESCO AI BLOCCHI. Lo strato di conferma
  // cattura l'istanza delle funzioni del render in cui e' stato creato:
  // rileggere `blocchi` dentro `allungaDavvero` restituirebbe l'elenco
  // di allora, quindi la riverifica sarebbe un controllo su un dato gia'
  // validato — cioe' niente. Con il ref si legge sempre l'ultimo.
  const blocchiRif = useRef(blocchi);
  blocchiRif.current = blocchi;

  const timerPressione = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pressioneLunga = useRef(false);

  const avviaTimerPressione = (ora: string) => {
    pressioneLunga.current = false;
    if (timerPressione.current) clearTimeout(timerPressione.current);
    timerPressione.current = setTimeout(() => {
      // ⚠️ Il segno si alza SOLO se la selezione parte davvero. Alzandolo
      // sempre, una pressione lenta su uno slot occupato o riservato
      // veniva mangiata dal filtro all'inizio del click e il pop-up non
      // si apriva al primo tentativo: sembrava uno slot che non
      // risponde.
      if (!slotPrenotabile(ora)) return;
      pressioneLunga.current = true;
      iniziaSelezione(ora);
    }, 500);
  };

  const annullaTimerPressione = () => {
    if (timerPressione.current) {
      clearTimeout(timerPressione.current);
      timerPressione.current = null;
    }
  };

  const iniziaSelezione = (ora: string) => {
    if (!slotPrenotabile(ora)) return;
    setSelezioneMultipla([ora]);
  };

  // Durante la selezione, cliccare un'estremita' la toglie, cliccare
  // uno slot adiacente e libero la estende. Ogni altro click e' inerte.
  const clickDuranteSelezione = (ora: string) => {
    const idx = ORARI.indexOf(ora);
    const idxMin = ORARI.indexOf(selezioneMultipla[0]);
    const idxMax = ORARI.indexOf(selezioneMultipla[selezioneMultipla.length - 1]);
    if (idx === idxMin || idx === idxMax) {
      if (selezioneMultipla.length === 1) { setSelezioneMultipla([]); return; }
      if (idx === idxMin) { setSelezioneMultipla(selezioneMultipla.slice(1)); return; }
      setSelezioneMultipla(selezioneMultipla.slice(0, -1));
      return;
    }
    if (idx === idxMin - 1 && slotPrenotabile(ora)) { setSelezioneMultipla([ora, ...selezioneMultipla]); return; }
    if (idx === idxMax + 1 && slotPrenotabile(ora)) setSelezioneMultipla([...selezioneMultipla, ora]);
  };

  // Prenotazioni ancora attive che toccano le estremita' del blocco
  // scelto: servono a chiedere se prolungare o aprirne una nuova.
  const prenotazioniAdiacenti = (ore: string[]): PrenotazioneAdmin[] => {
    const tocca = (o?: string) => {
      if (!o || ore.includes(o)) return undefined;
      const p = prenotazioneSlot(o);
      // Le lezioni restano fuori: l'Admin scrive sempre prenotazioni di
      // campo, quindi "prolungare" una lezione produceva meta' card di
      // un tipo e meta' dell'altro, con lo stesso cardId. Una lezione
      // la prolunga il Maestro, dalla sua dashboard.
      if (p?.tipo === 'lezione') return undefined;
      // ⚠️ E le Sfide, che sono uno contro uno e le governa il pannello
      // «Sfide in Corso»: prolungarne una creava una mezz'ora fuori
      // dalla sfida, e con l'eredita' dei giocatori si sarebbe portati
      // dietro anche lo sfidato — scritto pero' senza `sfidaId`, che e'
      // proprio cio' che le regole rifiutano.
      if (p?.sfidaId) return undefined;
      return p && p.campoId === selCampoId ? p : undefined;
    };
    const i0 = ORARI.indexOf(ore[0]);
    const i1 = ORARI.indexOf(ore[ore.length - 1]);
    const trovate = [tocca(ORARI[i0 - 1]), tocca(ORARI[i1 + 1])].filter(Boolean) as PrenotazioneAdmin[];
    return trovate.filter((v, i, a) => a.findIndex((x) => x.id === v.id) === i);
  };

  // Passa alla prenotazione vera. Prolungando si eredita il socio (o
  // l'esterno) della prenotazione esistente: l'admin non deve
  // riselezionarlo.
  // ⚠️ SI CHIAMAVA `vaiAPrenotazione`, ed e' stata rinominata: sul
  // mobile quel nome appartiene a un'ALTRA funzione — quella che apre
  // la scelta e contiene la guardia della mezz'ora — e due funzioni con
  // lo stesso nome che fanno cose diverse nei due progetti sono la
  // trappola perfetta per chi porta una modifica dall'uno all'altro.
  const prosegui = (ore: string[], daProlungare: PrenotazioneAdmin | null) => {
    setSceltaProlunga(null);
    setNuovaPrenotazione(daProlungare === null);
    setProlungamento(daProlungare !== null);
    // Prolungando si eredita l'identificativo: in Home resta una sola
    // card. Altrimenti se ne genera uno nuovo.
    setCardId(daProlungare ? (daProlungare.cardId ?? daProlungare.id) : nuovoGruppoId());
    if (daProlungare) {
      if (!daProlungare.utenteId) {
        setModalitaEsterno(true);
        setNomeEsterno(daProlungare.utenteNome);
      } else {
        setModalitaEsterno(false);
        const so = soci.find((x) => x.uid === daProlungare.utenteId);
        if (so) setSocioScelto(so);
      }
      // ⚠️ E I COMPAGNI, che restavano indietro. Senza, la mezz'ora
      // aggiunta nasceva SENZA di loro: il socio se la ritrovava
      // addebitata per intero mentre sulle altre pagava una frazione, e
      // i compagni non venivano nemmeno avvisati. In Home la card
      // restava una sola, quindi non si vedeva: si vedeva solo sul
      // portafoglio. La quota non viaggia: la ricalcola il repository
      // sul prezzo di QUELLA mezz'ora, che puo' essere diverso.
      setGiocatoriEreditati(giocatoriDi(daProlungare).map((g) => ({
        uid: g.uid, nome: g.nome, cognome: g.cognome,
      })));
    } else {
      setModalitaEsterno(false);
      setSocioScelto(null);
      setNomeEsterno('');
      setGiocatoriEreditati([]);
    }
    setOreDaPrenotare(ore);
    setOreDaAssegnare([]);
  };

  // ============================================================
  // ⚠️ CAMBIARE INTESTATARIO SCIOGLIE IL PROLUNGAMENTO.
  // `prosegui` accende `prolungamento` quando si sceglie «Prolunga
  // quella di Mario»; se poi si intesta la prenotazione a Luigi non si
  // sta piu' allungando niente, e senza questo si scriveva una mezz'ora
  // con il cardId di Mario addosso e un avviso che annunciava a Luigi
  // «il circolo ha modificato la tua prenotazione» di una partita che
  // non ha mai avuto.
  // ⚠️ Con l'uscita anticipata: toccare il pulsante GIA' selezionato —
  // gesto comunissimo — non deve sciogliere niente.
  // ============================================================
  const staccaDalProlungamento = () => {
    if (!prolungamento) return;
    setProlungamento(false);
    setNuovaPrenotazione(true);
    setCardId(nuovoGruppoId());
    setGiocatoriEreditati([]);
  };

  // ⚠️ `chiudiTutto` era una funzione sola per due cose diverse, e da
  // quando esistono i pezzi della riserva e gli stati del prolungamento
  // non puo' piu' esserlo: chiudendo la prenotazione non si devono
  // buttare via i giorni gia' messi da parte per una riserva, e
  // viceversa.
  const chiudiPrenotazioneAdmin = () => {
    setOreDaAssegnare([]); setOreDaPrenotare([]);
    setSelezioneMultipla([]); setModalitaEsterno(false); setNomeEsterno('');
    setFiltroSocio(''); setSocioScelto(null); setSenzaAddebito(false);
    // Restando accesi, la prenotazione SUCCESSIVA ripartiva con i
    // compagni e il codice card di quella appena chiusa.
    setGiocatoriEreditati([]); setProlungamento(false); setNuovaPrenotazione(false);
  };

  const chiudiRiserva = () => {
    setOreDaRiservare([]); setSelezioneMultipla([]);
    setEtichettaRiserva(''); setDescrizioneRiserva('');
    setPezziRiserva([]); setComponendoRiserva(false);
  };



  // ============================================================
  // ⚠️ LE RISERVE NON SONO PRENOTAZIONI, e vanno trattate a parte.
  // Una prenotazione e' un documento per mezz'ora legato agli altri da
  // un `cardId`. Una riserva e' UN SOLO documento che copre un
  // intervallo continuo, senza `cardId` e senza raggruppamento: due
  // riserve attaccate restano due righe distinte in «Orari Riservati».
  // Da qui in poi la si allunga spostandone l'estremita', che e'
  // l'unica cosa che tiene insieme quello che l'Admin vede — un blocco
  // solo — e quello che c'e' scritto.
  // ⚠️ SOLO LE RISERVE A DATA: le ricorrenti sono il sistema vecchio,
  // non se ne creano piu', e allungarne una cambierebbe tutte le
  // settimane in un colpo.
  // ============================================================
  const riserveAdiacenti = (ore: string[]): Blocco[] => {
    if (ore.length === 0 || !selCampoId) return [];
    const dopoLUltima = orarioFineSlot(ore[ore.length - 1]);
    return blocchi.filter((b) => b.campoId === selCampoId
      && b.tipo === 'data' && b.data === dataSelIso
      && (b.orarioFine === ore[0] || b.orarioInizio === dopoLUltima));
  };

  const estremitaDellaRiserva = (b: Blocco, ora: string): boolean =>
    ora === b.orarioInizio || orarioFineSlot(ora) === b.orarioFine;

  const unaSolaMezzOra = (b: Blocco): boolean => orarioFineSlot(b.orarioInizio) === b.orarioFine;

  // ⚠️ Il blocco del pop-up letto SEMPRE dall'elenco vivo: `bloccoInfo`
  // porta una fotografia scattata al click, comoda per sapere QUALE
  // mezz'ora e' stata toccata e inaffidabile per tutto il resto.
  const bloccoVivo = bloccoInfo
    ? (blocchi.find((x) => x.id === bloccoInfo.blocco.id) ?? bloccoInfo.blocco)
    : null;

  // ⚠️ `modificaBlocco` riscrive il documento per intero: passando solo
  // il campo cambiato si perderebbero etichetta, descrizione e campo.
  const datiDi = (b: Blocco): Omit<Blocco, 'id'> => {
    const { id, ...resto } = b;
    return resto;
  };

  const togliMezzOraDallaRiserva = async (bFotografia: Blocco, ora: string) => {
    if (elaborandoRiserva) return;
    const b = blocchiRif.current.find((x) => x.id === bFotografia.id);
    if (!b) { setBloccoInfo(null); return; }
    // Se un altro amministratore ha allungato la riserva all'indietro,
    // quella che era la prima mezz'ora adesso e' in mezzo: senza questo
    // controllo si accorciava dalla parte sbagliata, in silenzio.
    if (!estremitaDellaRiserva(b, ora)) {
      alert(t('adm.pre.riservaCambiataRiapri'));
      setBloccoInfo(null);
      return;
    }
    setElaborandoRiserva(true);
    try {
      if (unaSolaMezzOra(b)) {
        await rimuoviBlocco(circolo.id, b.id);
      } else if (ora === b.orarioInizio) {
        await modificaBlocco(circolo.id, b.id, { ...datiDi(b), orarioInizio: orarioFineSlot(ora) });
      } else {
        await modificaBlocco(circolo.id, b.id, { ...datiDi(b), orarioFine: ora });
      }
      setBloccoInfo(null);
    } catch {
      alert(t('adm.pre.erroreModificaRiserva'));
    } finally {
      setElaborandoRiserva(false);
    }
  };

  const prolungaRiserva = (bFotografia: Blocco, ore: string[]) => {
    if (elaborandoRiserva) return;
    const b = blocchiRif.current.find((x) => x.id === bFotografia.id);
    if (!b) {
      alert(t('adm.pre.riservaSparita'));
      setSceltaProlungaRiserva(null); setSelezioneMultipla([]);
      return;
    }
    // Prima la domanda tecnica, poi quella drammatica.
    const dopoLUltima = orarioFineSlot(ore[ore.length - 1]);
    if (b.orarioFine !== ore[0] && b.orarioInizio !== dopoLUltima) {
      alert(t('adm.pre.riservaCambiataRiseleziona'));
      setSceltaProlungaRiserva(null); setSelezioneMultipla([]);
      return;
    }
    // ⚠️ E le prenotazioni sotto si guardano anche qui: il percorso
    // normale avvisa sempre prima di riservare sopra la partita di
    // qualcuno, l'allungamento scriveva e basta.
    const sotto = prenotazioni.filter((x) => x.campoId === b.campoId
      && x.data === b.data && ore.includes(x.orario));
    if (sotto.length > 0) {
      const nomi = Array.from(new Set(sotto.map((x) => `${x.utenteNome} ${x.utenteCognome}`.trim()))).filter(Boolean);
      // ⚠️ Due frasi intere unite da uno spazio, e non una frase spezzata
      // a meta': «c’è {nomi}» da solo e' un pezzo di grammatica italiana
      // che in tedesco non si incastra dove serve.
      setConferma({
        titolo: t('adm.pre.giaPrenotazioneTitolo'),
        testo: `${nomi.length > 0
          ? t('adm.pre.inQuelleMezzOreCe', { nomi: nomi.join(', ') })
          : t('adm.pre.inQuelleMezzOreCePrenotazione')} ${t('adm.pre.allungaNonCancella')}`,
        etichetta: t('adm.pre.allungaLoStesso'),
        azione: () => void allungaDavvero(b, ore),
      });
      return;
    }
    void allungaDavvero(b, ore);
  };

  const allungaDavvero = async (bFotografia: Blocco, ore: string[]) => {
    if (elaborandoRiserva) return;
    // Dal ref, non dalla fotografia: fra la domanda e la risposta c'e'
    // un tempo di lettura umano.
    const b = blocchiRif.current.find((x) => x.id === bFotografia.id);
    if (!b) {
      alert(t('adm.pre.riservaSparita'));
      setSceltaProlungaRiserva(null); setSelezioneMultipla([]);
      return;
    }
    const dopoLUltima = orarioFineSlot(ore[ore.length - 1]);
    // ⚠️ SI RICONTROLLA ANCHE QUI, e sul web serve piu' che sull'app:
    // fra il controllo di `prolungaRiserva` e questa scrittura c'e' di
    // mezzo uno strato di conferma, cioe' un tempo di lettura umano. Il
    // ternario qui sotto ha due sole uscite: su un blocco che nel
    // frattempo si e' spostato prenderebbe comunque il ramo
    // «altrimenti» e scriverebbe un intervallo rovesciato — con
    // `orarioInizio` dopo `orarioFine` — che non corrisponde piu' a
    // nessuno slot: la riserva sparisce dalla griglia e sopravvive solo
    // nell'elenco «Orari Riservati».
    if (b.orarioFine !== ore[0] && b.orarioInizio !== dopoLUltima) {
      alert(t('adm.pre.riservaCambiataRiseleziona'));
      setSceltaProlungaRiserva(null); setSelezioneMultipla([]);
      return;
    }
    setElaborandoRiserva(true);
    try {
      const dati = b.orarioFine === ore[0]
        ? { ...datiDi(b), orarioFine: dopoLUltima }
        : { ...datiDi(b), orarioInizio: ore[0] };
      await modificaBlocco(circolo.id, b.id, dati);
      setSceltaProlungaRiserva(null);
      setSelezioneMultipla([]);
    } catch {
      alert(t('adm.pre.erroreAllungaRiserva'));
    } finally {
      setElaborandoRiserva(false);
    }
  };

  // Trasforma l'elenco sparso dei pezzi in blocchi continui: uno per
  // ogni campo + giorno + tratto senza buchi.
  const blocchiDaiPezzi = (pezzi: PezzoRiserva[]) => {
    // ⚠️ Deduplica prima di tutto: niente impedisce di rimettere da
    // parte le stesse ore due volte, e una sovrapposizione parziale
    // avrebbe scritto due documenti sovrapposti sullo stesso campo.
    const visti = new Set<string>();
    const unici = pezzi.filter((x) => {
      const chiave = `${x.campoId}|${x.data}|${x.orario}`;
      if (visti.has(chiave)) return false;
      visti.add(chiave);
      return true;
    });
    const ordinati = [...unici].sort((a, b) => (
      a.campoId !== b.campoId ? a.campoId.localeCompare(b.campoId)
        : a.data !== b.data ? a.data.localeCompare(b.data)
          : ORARI.indexOf(a.orario) - ORARI.indexOf(b.orario)
    ));
    const gruppi: { campoId: string; campoNome: string; data: string; dataLabel: string; orari: string[] }[] = [];
    for (const x of ordinati) {
      const ultimo = gruppi[gruppi.length - 1];
      const attaccato = !!ultimo && ultimo.campoId === x.campoId && ultimo.data === x.data
        && orarioFineSlot(ultimo.orari[ultimo.orari.length - 1]) === x.orario;
      if (attaccato) ultimo.orari.push(x.orario);
      else gruppi.push({ campoId: x.campoId, campoNome: x.campoNome, data: x.data, dataLabel: x.dataLabel, orari: [x.orario] });
    }
    return gruppi;
  };

  // ⚠️ Qui `dataLabel` NON finisce su Firestore — `aggiungiBlocco` scrive
  // la sola data ISO — quindi si usa la versione tradotta: e' una scritta
  // che l'Admin legge nel riepilogo, e basta.
  const pezziDaOre = (ore: string[]): PezzoRiserva[] => ore.map((o) => ({
    campoId: campoSel?.id ?? '', campoNome: campoSel?.nome ?? '',
    data: dataSelIso, dataLabel: dataMostrata, orario: o,
  }));

  // Vero se la selezione si attacca a un pezzo gia' messo da parte: la
  // mezz'ora singola va bene anche qui, perche' `blocchiDaiPezzi` li
  // fondera' in un tratto unico.
  const tocaUnPezzoGiaMessoDaParte = (ore: string[]): boolean => {
    if (ore.length === 0) return false;
    const dopoLUltima = orarioFineSlot(ore[ore.length - 1]);
    return pezziRiserva.some((x) => x.campoId === selCampoId && x.data === dataSelIso
      && (orarioFineSlot(x.orario) === ore[0] || x.orario === dopoLUltima));
  };

  const aggiungiAltriOrariAllaRiserva = () => {
    setPezziRiserva((prec) => [...prec, ...pezziDaOre(oreDaRiservare)]);
    setOreDaRiservare([]);
    setSelezioneMultipla([]);
    setComponendoRiserva(true);
  };

  // ⚠️ Su TUTTI i pezzi, non solo sulla pagina che si sta guardando:
  // guardare la sola pagina corrente vorrebbe dire coprire in silenzio
  // le prenotazioni di tutti gli altri giorni.
  const prenotazioniSottoLaRiserva = () => {
    const tutti = [...pezziRiserva, ...pezziDaOre(oreDaRiservare)]
      .filter((x) => !slotNelPassato(x.data, x.orario));
    if (tutti.length === 0) return [];
    const chiavi = new Set(tutti.map((x) => `${x.campoId}|${x.data}|${x.orario}`));
    return prenotazioni.filter((x) => chiavi.has(`${x.campoId}|${x.data}|${x.orario}`));
  };

  // ============================================================
  // ⚠️ IL COLLO DI BOTTIGLIA DELLA REGOLA DELLA MEZZ'ORA. Qui passano
  // tutte e due le strade — il click singolo sullo slot e il «Conferma»
  // della barra — e una guardia messa su uno solo dei due ingressi non
  // e' una guardia, e' meta' guardia.
  // ============================================================
  const apriSceltaAdmin = (ore: string[]) => {
    const valide = ore.filter((o) => !slotNelPassato(dataSelIso, o));
    if (valide.length === 0) {
      alert(t('adm.pre.mezzOrePassateScegli'));
      return;
    }
    if (valide.length < ore.length) {
      alert(t('adm.pre.tolteMezzOrePassate'));
    }
    // ⚠️ Il ramo della composizione sta SOPRA la guardia: sotto, chi
    // stava componendo un orario riservato si sentiva parlare di
    // prenotazioni mentre stava facendo tutt'altro.
    if (componendoRiserva) {
      if (valide.length < MINIMO_SLOT_NUOVA_PRENOTAZIONE && !tocaUnPezzoGiaMessoDaParte(valide)) {
        alert(t('adm.pre.trattoMinimo', { ore: MINIMO_SLOT_NUOVA_PRENOTAZIONE * 0.5 }));
        return;
      }
      const attaccate = riserveAdiacenti(valide);
      const prosegue = () => {
        setOreDaRiservare(valide);
        setSelezioneMultipla([]);
        setComponendoRiserva(false);
      };
      if (attaccate.length > 0) {
        setConferma({
          titolo: t('adm.pre.riservaAccantoTitolo'),
          testo: t('adm.pre.pezzoConfinaConRiserva', { etichetta: attaccate[0].etichetta }),
          etichetta: t('adm.pre.vaBene'),
          azione: prosegue,
        });
        return;
      }
      prosegue();
      return;
    }
    // Sotto il minimo si passa solo se c'e' qualcosa da prolungare
    // accanto: allora la mezz'ora e' un'aggiunta.
    if (valide.length < MINIMO_SLOT_NUOVA_PRENOTAZIONE
      && prenotazioniAdiacenti(valide).length === 0
      && riserveAdiacenti(valide).length === 0) {
      alert(`${t('adm.pre.prenotazioneMinimo', { ore: MINIMO_SLOT_NUOVA_PRENOTAZIONE * 0.5 })} `
        + t('adm.pre.comeSiAggiungeLaMezzOra'));
      return;
    }
    setOreDaAssegnare(valide);
  };

  const vaiAPrenotazione = () => {
    const vicine = prenotazioniAdiacenti(oreDaAssegnare);
    if (vicine.length > 0) {
      setSceltaProlunga({ ore: [...oreDaAssegnare], vicine });
      setOreDaAssegnare([]);
      return;
    }
    // ⚠️ Il controllo si rifa' qui: fra `apriSceltaAdmin` e questo click
    // c'e' di mezzo il pannello «Cosa vuoi fare?», e in quel tempo la
    // prenotazione accanto puo' essere stata annullata da qualcun altro.
    if (oreDaAssegnare.length < MINIMO_SLOT_NUOVA_PRENOTAZIONE) {
      alert(`${t('adm.pre.prenotazioneMinimo', { ore: MINIMO_SLOT_NUOVA_PRENOTAZIONE * 0.5 })} `
        + t('adm.pre.vicinaSparita'));
      setOreDaAssegnare([]); setSelezioneMultipla([]);
      return;
    }
    // ⚠️ NON si passa da `prosegui`: quella funzione accende
    // `nuovaPrenotazione`, che NON vuol dire «prenotazione nuova» ma
    // «adiacente sì, ma è una partita a sé». Qui non c'e' niente
    // accanto, quindi vale `false` — ed e' quello che fa il mobile.
    // Il valore finisce nel registro movimenti e decide se aprire una
    // card contabile: due client che lo scrivono diversamente
    // racconterebbero il portafoglio in due modi.
    setSceltaProlunga(null);
    setProlungamento(false);
    setNuovaPrenotazione(false);
    setCardId(nuovoGruppoId());
    setModalitaEsterno(false);
    setSocioScelto(null);
    setNomeEsterno('');
    setFiltroSocio('');
    setSenzaAddebito(false);
    setGiocatoriEreditati([]);
    setOreDaPrenotare([...oreDaAssegnare]);
    setOreDaAssegnare([]);
  };

  const vaiARiserva = () => {
    const vicine = riserveAdiacenti(oreDaAssegnare);
    if (vicine.length > 0) {
      setSceltaProlungaRiserva({ ore: [...oreDaAssegnare], vicine });
      setOreDaAssegnare([]);
      return;
    }
    if (oreDaAssegnare.length < MINIMO_SLOT_NUOVA_PRENOTAZIONE) {
      alert(`${t('adm.pre.riservaMinimo', { ore: MINIMO_SLOT_NUOVA_PRENOTAZIONE * 0.5 })} `
        + t('adm.pre.riservaSoloAggiunta'));
      return;
    }
    setOreDaRiservare([...oreDaAssegnare]);
    setOreDaAssegnare([]);
    setEtichettaRiserva('');
    setDescrizioneRiserva('');
  };

  // Dice se il «Conferma» della barra puo' accendersi: sopra il minimo
  // sempre, sotto il minimo solo quando la selezione tocca qualcosa da
  // allungare — perche' allora e' un'aggiunta, non una cosa nuova.
  // Mentre si compone una riserva le adiacenze con documenti gia'
  // scritti non contano: ogni pezzo aggiunto e' un tratto a se'.
  const confermaPossibile = selezioneMultipla.length >= MINIMO_SLOT_NUOVA_PRENOTAZIONE
    || (componendoRiserva
      ? tocaUnPezzoGiaMessoDaParte(selezioneMultipla)
      : (selezioneMultipla.length > 0
        && (prenotazioniAdiacenti(selezioneMultipla).length > 0
          || riserveAdiacenti(selezioneMultipla).length > 0)));

  const risultatiSoci = filtroSocio.trim().length < 2 ? [] : soci
    .filter((so) => `${so.nome} ${so.cognome}`.toLowerCase().includes(filtroSocio.trim().toLowerCase()))
    .slice(0, 6);

  // ⚠️ DUE DATE E NON UNA, ed e' la distinzione portante di questo file
  // dopo la tornata delle lingue. `dataLeggibile` e' un DATO: viene
  // scritto nel campo `dataLabel` della prenotazione e lo rilegge il
  // socio, che puo' parlare un'altra lingua ancora — resta italiano,
  // come tutto cio' che finisce su Firestore. `dataMostrata` e' una
  // SCRITTA: la legge solo l'Admin, qui e ora, nella sua lingua.
  const dataLeggibile = `${GIORNI_IT_ESTESO[giornoSel.getDay()]} ${giornoSel.getDate()} ${MESI_IT[giornoSel.getMonth()]}`;
  const dataMostrata = t('adm.pre.dataEstesa', {
    giorno: t(CHIAVI_GIORNO_LUNGO[giornoSel.getDay()]),
    numero: giornoSel.getDate(),
    mese: t(`com.m.${giornoSel.getMonth() + 1}` as 'com.m.1'),
  });

  // Blocco sincrono contro il doppio click, come nell'app mobile:
  // "elaborando" e' uno stato React e non chiude la finestra fra il
  // click e il ridisegno. Due click rapidi scrivevano la prenotazione
  // due volte, sugli stessi orari e con lo stesso cardId: in Home la
  // partita si presentava spezzata in tre pezzi.
  const invioInCorso = useRef(false);

  const confermaPrenotazione = async () => {
    // ⚠️ Su un circolo sospeso o chiuso la scrittura viene respinta
    // dalle regole Firestore, e l'Admin si prendeva un generico "Non e'
    // stato possibile completare la prenotazione. Riprova." — un
    // invito a riprovare qualcosa che non riuscira' mai.
    if (!circoloOperativo(circolo)) {
      alert(t('adm.pre.circoloNonOperativo', {
        stato: statoCircolo(circolo) === 'chiuso'
          ? t('adm.pre.circoloChiuso')
          : t('adm.pre.circoloSospeso'),
      }));
      return;
    }
    if (invioInCorso.current) return;
    if (oreDaPrenotare.length === 0 || !campoSel) return;
    // Ultima barriera prima della scrittura: fra la selezione e la
    // conferma puo' essere scoccata la mezz'ora, e il pannello resta
    // aperto anche a lungo. Il controllo sullo slot non basta.
    if (oreDaPrenotare.some((o) => slotNelPassato(dataSelIso, o))) {
      // Stesso canale degli altri errori di questa sezione.
      alert(t('adm.pre.mezzOrePassateRiseleziona'));
      return;
    }
    // ⚠️ LA REGOLA DELLA MEZZ'ORA VIVE ANCHE QUI, nella funzione che
    // SCRIVE. Le guardie sulle porte chiudono le strade note, ma il
    // modulo si raggiunge anche per strade che non sono pulsanti: un
    // elenco rimasto indietro di uno snapshot, la prenotazione accanto
    // annullata da qualcun altro mentre il pop-up era aperto.
    // Prolungando il minimo non si applica: e' un'aggiunta — e
    // `prolungamento` si spegne appena si cambia intestatario.
    if (oreDaPrenotare.length < MINIMO_SLOT_NUOVA_PRENOTAZIONE && !prolungamento) {
      alert(`${t('adm.pre.prenotazioneMinimo', { ore: MINIMO_SLOT_NUOVA_PRENOTAZIONE * 0.5 })} `
        + t('adm.pre.prenotazioneSoloAggiunta'));
      return;
    }
    if (modalitaEsterno && !nomeEsterno.trim()) return;
    if (!modalitaEsterno && !socioScelto) return;
    invioInCorso.current = true;
    setElaborando(true);
    // ⚠️ Fuori dal try: il messaggio d'errore deve poter dire quante
    // mezz'ore sono state comunque scritte.
    let fatte = 0;
    try {
      // Uno scritto per mezz'ora, in sequenza: stesso principio del
      // mobile. Le card si ricompongono poi in un blocco unico.
      // Un solo codice per l'intera operazione: lega le mezz'ore nel
      // registro movimenti.
      const gruppoId = nuovoGruppoId();
      // ⚠️ RETE DI SICUREZZA SUL CODICE DELLA CARD. Senza, una strada
      // che arrivasse qui senza averlo battezzato scriverebbe mezz'ore
      // con `cardId: null` — e con loro l'avviso al socio, che senza
      // quel campo NON E' TOCCABILE e non porta a niente.
      const idCard = cardId ?? nuovoGruppoId();
      // ⚠️ Quante ne sono andate davvero: un blocco interrotto a meta'
      // lasciava scritte le prime mezz'ore senza dirlo, e il "riprova"
      // ripartiva dalla prima sbattendo contro la prenotazione appena
      // fatta dall'Admin stesso.
      for (const ora of oreDaPrenotare) {
        const prezzo = senzaAddebito && !modalitaEsterno
          ? 0
          : calcolaPrezzo(campoSel, giornoSel, ora);
        const base = {
          circoloId: circolo.id, campoId: campoSel.id, campoNome: campoSel.nome,
          data: dataSelIso, dataLabel: dataLeggibile, orario: ora, prezzo,
        };
        // Il flag "prenotazione nuova" apre una card nel registro: va
        // scritto SOLO sulla prima mezz'ora dell'operazione, o ognuna
        // ne aprirebbe una per conto suo.
        const apreCard = nuovaPrenotazione && ora === oreDaPrenotare[0];

        if (modalitaEsterno) {
          await prenotaEsternoDaAdmin({
            ...base, nomeEsterno: nomeEsterno.trim(),
            gruppoId, cardId: idCard,
          });
        } else if (socioScelto && giocatoriEreditati.length > 0) {
          // ⚠️ PROLUNGAMENTO CON COMPAGNI: la mezz'ora nuova nasce con
          // le stesse persone delle altre e con le quote divise sul
          // prezzo di QUESTA mezz'ora, che puo' cadere in una fascia
          // diversa e costare un'altra cifra.
          await prenotaConGiocatori({
            ...base, uid: socioScelto.uid, nuovaPrenotazione: apreCard,
            gruppoId, cardId: idCard,
            utenteNome: socioScelto.nome, utenteCognome: socioScelto.cognome,
            tipoUtente: socioScelto.ruoloTessera === 'ospite' ? 'ospite' : 'socio',
            giocatori: giocatoriEreditati,
            daAdmin: { uid: null, nome: nomeEsecutore || null },
          });
        } else if (socioScelto) {
          await prenotaPerSocioDaAdmin({
            ...base, uid: socioScelto.uid, nuovaPrenotazione: apreCard,
            gruppoId, cardId: idCard,
            utenteNome: socioScelto.nome, utenteCognome: socioScelto.cognome,
            tipoUtente: socioScelto.ruoloTessera === 'ospite' ? 'ospite' : 'socio',
          });
        }
        fatte++;
      }
      // Una sola notifica per l'intero blocco, non una per mezz'ora.
      if (!modalitaEsterno && socioScelto) {
        // ⚠️ QUESTA FRASE RESTA IN ITALIANO DI PROPOSITO. Non la legge
        // l'Admin: e' il dettaglio di un avviso che legge il SOCIO, e
        // l'involucro attorno lo compone gia' `avviso()` nella lingua di
        // chi riceve. Tradurla con `t` vorrebbe dire scrivere «von 18:00
        // bis 19:00» dentro la notifica di un socio italiano solo perche'
        // la dashboard del circolo e' in tedesco. Il giorno che anche
        // questo pezzo dovra' seguire il destinatario, la strada e'
        // `avviso()`, non `t`.
        const daA = oreDaPrenotare.length > 1
          ? `dalle ${oreDaPrenotare[0]} alle ${orarioFineSlot(oreDaPrenotare[oreDaPrenotare.length - 1])}`
          : `alle ${oreDaPrenotare[0]}`;
        // ⚠️ PROLUNGARE NON E' PRENOTARE. Allungando una partita che il
        // socio ha gia', «il circolo ha prenotato per te» annuncia una
        // cosa che lui sa: quello che non sa e' che si e' allungata, e
        // di quanto. E l'avviso porta il `cardId`, altrimenti si tocca
        // e non succede niente.
        await senzaBloccare(() => creaNotifica(
          socioScelto.uid,
          avviso(prolungamento ? 'avv.cir.modificaPrenDett' : 'avv.cir.prenotaPerTeDett', {
            dettaglio: `${dataLeggibile} ${daA} · ${campoSel.nome}`,
            coda: senzaAddebito ? avviso('avv.cir.senzaAddebito') : '',
          }),
          undefined, circolo.id, undefined, undefined,
          prolungamento ? 'modifica' : undefined,
          // Cade sotto «Le mie partite», dove il socio la cerca.
          'prenotazioni',
          undefined,
          idCard,
        ));
        // ⚠️ E un avviso a testa ai compagni, che prima non riceveva
        // nessuno: sono stati addebitati della loro quota su una
        // mezz'ora che non hanno chiesto.
        for (const g of giocatoriEreditati) {
          await senzaBloccare(() => creaNotifica(
            g.uid,
            avviso(prolungamento ? 'avv.cir.compagnoProlungaDett' : 'avv.cir.compagnoModificaDett', {
              dettaglio: `${dataLeggibile} ${daA} · ${campoSel.nome}`,
              coda: senzaAddebito ? avviso('avv.cir.senzaAddebito') : '',
            }),
            undefined, circolo.id, undefined, undefined,
            'modifica', 'prenotazioni', undefined, idCard,
          ));
        }
      }
      chiudiPrenotazioneAdmin();
    } catch (e: any) {
      const inParte = fatte > 0
        ? t('adm.pre.parzialePrenotazioni', { fatte, totale: oreDaPrenotare.length })
        : t('adm.pre.riprovaFrase');
      // ⚠️ I DUE MODI IN CUI FALLISCE UN PROLUNGAMENTO CON COMPAGNI:
      // un compagno non ha piu' la tessera, oppure non e' piu' fra i
      // compagni del socio e le regole rifiutano la mezz'ora nuova —
      // che e' un documento nuovo, quindi il permesso torna a servire.
      // Con il messaggio generico era un vicolo cieco: l'elenco dei
      // compagni e' di sola lettura, quindi non c'era modo di togliere
      // chi bloccava la scrittura.
      const bloccatoDaiCompagni = giocatoriEreditati.length > 0
        && (e?.message === 'UTENTE_NON_TROVATO' || e?.code === 'permission-denied');
      if (bloccatoDaiCompagni && fatte === 0) {
        setConferma({
          titolo: t('adm.pre.giocatoreNonAggiungibile'),
          testo: t('adm.pre.giocatoreNonAggiungibileTesto', { nomi: elencoNomi(giocatoriEreditati) }),
          etichetta: t('adm.pre.togliGiocatori'),
          // ⚠️ `prolungamento` resta acceso: si sta ancora allungando la
          // stessa partita, e il cardId e' quello. Spegnerlo spezzerebbe
          // la card, che e' proprio il ripiego da evitare.
          azione: () => setGiocatoriEreditati([]),
        });
        return;
      }
      alert(`${e?.message === 'SLOT_OCCUPATO'
        ? t('adm.pre.slotOccupato')
        : e?.message === 'UTENTE_NON_TROVATO'
          ? t('adm.pre.giocatoreNonTesserato')
          : t('adm.pre.errorePrenotazione')} ${inParte}`);
    } finally {
      invioInCorso.current = false;
      setElaborando(false);
    }
  };

  const confermaRiserva = async (gia = false) => {
    if (oreDaRiservare.length === 0 || !campoSel || !etichettaRiserva.trim()) return;
    // ⚠️ Gli scaduti si tolgono e SI DICE. Componendo su piu' giorni fra
    // la scelta e la conferma passa del tempo: togliendoli in silenzio,
    // l'Admin confermava «18:00-19:00» e otteneva 18:30-19:00 senza
    // sapere perche'.
    const tuttiIPezzi = [...pezziRiserva, ...pezziDaOre(oreDaRiservare)]
      .filter((x) => !slotNelPassato(x.data, x.orario));
    if (tuttiIPezzi.length === 0) {
      alert(t('adm.pre.mezzOrePassateScegli'));
      return;
    }
    if (tuttiIPezzi.length < pezziRiserva.length + oreDaRiservare.length) {
      setPezziRiserva(pezziRiserva.filter((x) => !slotNelPassato(x.data, x.orario)));
      setOreDaRiservare(oreDaRiservare.filter((o) => !slotNelPassato(dataSelIso, o)));
      alert(t('adm.pre.tolteMezzOrePassateRiserva'));
      return;
    }
    // ⚠️ La regola della mezz'ora applicata a OGNI TRATTO, non al
    // totale: una riserva su tre giorni di cui uno da mezz'ora resta
    // una riserva da mezz'ora su quel giorno.
    const tratti = blocchiDaiPezzi(tuttiIPezzi);
    const corto = tratti.find((g) => g.orari.length < MINIMO_SLOT_NUOVA_PRENOTAZIONE);
    if (corto) {
      alert(`${t('adm.pre.riservaMinimo', { ore: MINIMO_SLOT_NUOVA_PRENOTAZIONE * 0.5 })} `
        + t('adm.pre.trattoTroppoCorto', {
          data: corto.dataLabel, campo: corto.campoNome, ora: corto.orari[0],
        }));
      return;
    }
    // ⚠️ L'avviso arriva PRIMA della scrittura e si puo' annullare: e'
    // l'unico momento in cui l'Admin puo' ancora scegliere senza aver
    // gia' fatto danni. Si avvisa, non si cancella: restituire denaro a
    // tre persone e' una scelta del circolo, e la fa dalla griglia una
    // per una, vedendo chi sono.
    const sotto = prenotazioniSottoLaRiserva();
    if (sotto.length > 0 && !gia) {
      const nomi = Array.from(new Set(sotto.map((x) => `${x.utenteNome} ${x.utenteCognome}`.trim()))).filter(Boolean);
      const quanti = nomi.length > 0 ? nomi.length : sotto.length;
      // ⚠️ Tre frasi intere e non una frase cucita: il singolare, il
      // plurale e il caso «non so i nomi» sono tre chiavi separate,
      // perche' in tedesco cambiano di verbo e di ordine.
      const chi = nomi.length === 0
        ? t('adm.pre.inQuesteOreCiSonoPrenotazioni')
        : quanti === 1
          ? t('adm.pre.inQuesteOreCeGia', { nomi: nomi.join(', ') })
          : t('adm.pre.inQuesteOreCiSonoGia', { nomi: nomi.join(', ') });
      setConferma({
        titolo: quanti === 1
          ? t('adm.pre.giaPrenotazioneTitolo')
          : t('adm.pre.giaPrenotazioniTitolo', { quanti }),
        testo: `${chi} ${t('adm.pre.riservaNonCancella')}`,
        etichetta: t('adm.pre.riservaLoStesso'),
        azione: () => void confermaRiserva(true),
      });
      return;
    }
    // ⚠️ Barriera sincrona contro il doppio invio, come per la
    // prenotazione: `elaborando` e' uno stato React e non chiude il
    // pulsante fra il click e il ridisegno, e qui il ciclo scrive N
    // documenti — due giri sovrapposti li scriverebbero doppi.
    if (invioInCorso.current) return;
    invioInCorso.current = true;
    setElaborando(true);
    // ⚠️ Fuori dal try: il messaggio d'errore deve poter dire quanti
    // tratti sono stati comunque scritti, o riprovando si ritrovano
    // doppi.
    let fattiTratti = 0;
    try {
      // ⚠️ UN DOCUMENTO PER OGNI CAMPO + GIORNO + TRATTO CONTINUO.
      // L'etichetta e la descrizione si scrivono una volta e valgono per
      // tutti i pezzi, ma i pezzi restano documenti separati: una
      // riserva E' un intervallo continuo su un campo in un giorno, e
      // fonderne due lontani vorrebbe dire riservare anche tutto quello
      // che sta in mezzo.
      const etichetta = etichettaRiserva.trim().slice(0, 14);
      const descrizione = descrizioneRiserva.trim() || undefined;
      for (const g of tratti) {
        await aggiungiBlocco(circolo.id, {
          campoId: g.campoId,
          tipo: 'data',
          data: g.data,
          orarioInizio: g.orari[0],
          orarioFine: orarioFineSlot(g.orari[g.orari.length - 1]),
          etichetta,
          descrizione,
        });
        fattiTratti++;
      }
      chiudiRiserva();
    } catch {
      alert(`${t('adm.pre.erroreRiserva')} `
        + (fattiTratti > 0
          ? t('adm.pre.parzialeTratti', { fatti: fattiTratti })
          : t('adm.pre.riprovaFrase')));
    } finally {
      invioInCorso.current = false;
      setElaborando(false);
    }
  };

  const prenotazioneSlot = (ora: string) =>
    prenotazioni.find((p) => p.campoId === selCampoId && p.data === dataSelIso && p.orario === ora);

  const confermaAnnulla = async () => {
    if (!daAnnullare) return;
    setErroreAnnullo('');
    setElaborando(true);
    // ============================================================
    // ⚠️ QUANTE MEZZ'ORE RESTANO, DETTO DAL SERVER.
    //
    // Segnalato da Giorgio il 24 agosto 2026: «anche quando Admin
    // cancella una mezz'ora da una prenotazione più lunga, l'avviso
    // DEVE essere Modificato e non Annullato». Sul web non lo era mai,
    // perche' qui la risposta della cancellazione veniva buttata via.
    //
    // Da qui si toglie sempre UNA mezz'ora — la griglia non permette
    // altro — quindi il caso normale e' proprio quello in cui la
    // partita resta in piedi. Il numero cambia tre cose insieme: la
    // parola, il motivo dell'avviso (che ne decide colore e faccia in
    // Home) e se portare il codice della card.
    //
    // ⚠️ NON SI CONTA QUI: l'elenco che questa schermata tiene in
    // memoria e' indietro di un giro proprio nell'istante dopo la
    // cancellazione.
    // ============================================================
    let restaLaPartita = false;
    let motivoAnnullo: 'annullamento' | 'modifica' = 'annullamento';
    // ⚠️ Non parte vuota: oggi non esiste un percorso che arrivi alle
    // notifiche senza passare da `leggiEsito`, ma un avviso con una riga
    // bianca in mezzo e' il genere di cosa che si scopre in produzione.
    // ⚠️ E NON PASSA DA `t`, come il `daA` della prenotazione: questa
    // riga finisce dentro un avviso che legge il SOCIO, non l'Admin.
    let rigaDettaglio = `${daAnnullare.campoNome} · ${daAnnullare.dataLabel}, ore ${fasciaOraria(daAnnullare.orario)}`;
    const leggiEsito = (restano: number) => {
      restaLaPartita = restano > 0;
      motivoAnnullo = restaLaPartita ? 'modifica' : 'annullamento';
      rigaDettaglio = restaLaPartita
        ? `Tolta la mezz'ora delle ${fasciaOraria(daAnnullare.orario)}.`
        : `${daAnnullare.campoNome} · ${daAnnullare.dataLabel}, ore ${fasciaOraria(daAnnullare.orario)}`;
    };
    // La card c'e' ancora solo se resta qualcosa: mandare qualcuno a
    // cercarne una che non esiste e' peggio che non muovere niente.
    const cardSuperstite = () => (restaLaPartita ? (daAnnullare.cardId ?? undefined) : undefined);
    // ⚠️ «cancellato» e non «annullato»: e' la parola che usa l'app,
    // e sono lo stesso avviso letto dalla stessa persona.
    // ⚠️ E NON PASSA DA `t` per due ragioni, non una: oggi nessuno la
    // chiama — resta qui perche' l'avviso del socio potrebbe tornare a
    // servirsene — e comunque e' testo del SOCIO, come `rigaDettaglio`.
    const parola = () => (restaLaPartita ? 'modificato' : 'cancellato');
    try {
      if (!daAnnullare.utenteId) {
        leggiEsito(await cancellaSenzaRimborso(daAnnullare.id));
      } else if (giocatoriDi(daAnnullare).length > 0) {
        const altri = giocatoriDi(daAnnullare);
        const miaQuota = quotaChiPrenota(daAnnullare).toFixed(2);
        leggiEsito(await cancellaConRimborsoDiviso({
          circoloId: circolo.id,
          utenteId: daAnnullare.utenteId,
          // ⚠️ Ognuno riceve la SUA quota, letta dalla prenotazione:
          // dopo un cambio giocatore non sono piu' per forza uguali.
          compagnoId: daAnnullare.compagnoId ?? altri[0].uid,
          giocatori: altri,
          prenotazioneId: daAnnullare.id,
          prezzoTotale: daAnnullare.prezzo,
          campoNome: daAnnullare.campoNome,
          dataLabel: daAnnullare.dataLabel,
          dataISO: daAnnullare.data,
          campoId: daAnnullare.campoId,
          orario: daAnnullare.orario,
          gruppoId: daAnnullare.gruppoId ?? undefined,
          cardId: daAnnullare.cardId ?? undefined,
          socioNome: `${daAnnullare.utenteNome} ${daAnnullare.utenteCognome}`,
          compagnoNome: `${daAnnullare.compagnoNome ?? ''} ${daAnnullare.compagnoCognome ?? ''}`.trim(),
          eseguitoDaNome: nomeEsecutore,
          eseguitoDaRuolo: 'admin',
          parziale: true,
        }));
        // ⚠️ Il circolo va SEMPRE passato, e l'avviso non deve poter
        // far fallire l'annullamento: la prenotazione a questo punto e'
        // gia' cancellata. Senza circoloId l'avviso finisce nel circolo
        // principale del socio — quello sbagliato, se qui e' Ospite — e
        // per un Ospite la scrittura viene proprio rifiutata, con
        // l'errore che risale e nasconde un'operazione riuscita.
        await senzaBloccare(() => creaNotifica(
          daAnnullare.utenteId,
          avviso(restaLaPartita ? 'avv.cir.tuaModificataDett' : 'avv.cir.tuaCancellataDett', {
            dettaglio: rigaDettaglio,
            coda: avviso('avv.quotaRiaccreditataCifra', { importo: miaQuota }),
          }),
          undefined,
          circolo.id,
          undefined, undefined,
          // ⚠️ Il motivo non sposta la notifica sotto un altro
          // interruttore — resta «Le mie partite» — ma le da' la faccia
          // che si nota nella Home del socio: ambra per un annullamento,
          // prugna per una modifica. Senza, l'avviso che gli dice di non
          // venire sarebbe disegnato identico a quello che lo invita.
          motivoAnnullo,
          'prenotazioni',
          undefined,
          cardSuperstite(),
        ));
        for (const g of altri) {
          await senzaBloccare(() => creaNotifica(
            g.uid,
            avviso(restaLaPartita ? 'avv.cir.compagnoModificataDett' : 'avv.cir.compagnoCancellataDett', {
              dettaglio: rigaDettaglio,
              coda: avviso('avv.quotaRiaccreditataCifra', { importo: g.quota.toFixed(2) }),
            }),
            undefined,
            circolo.id,
            undefined, undefined, motivoAnnullo,
            'prenotazioni',
            undefined,
            cardSuperstite(),
          ));
        }
      } else {
        leggiEsito(await cancellaConRimborso({
          circoloId: circolo.id,
          uid: daAnnullare.utenteId,
          prenotazioneId: daAnnullare.id,
          prezzo: importoDaRimborsare(daAnnullare),
          // Senza questi dati il movimento resta privo di campo e
          // orario, e la card non riconosce la mezz'ora come
          // cancellata: continuerebbe a mostrarla come attiva.
          campoNome: daAnnullare.campoNome,
          dataLabel: daAnnullare.dataLabel,
          dataISO: daAnnullare.data,
          campoId: daAnnullare.campoId,
          orario: daAnnullare.orario,
          gruppoId: daAnnullare.gruppoId ?? undefined,
          cardId: daAnnullare.cardId ?? undefined,
          socioNome: `${daAnnullare.utenteNome} ${daAnnullare.utenteCognome}`,
          eseguitoDaNome: nomeEsecutore,
          eseguitoDaRuolo: 'admin',
          // Dalla griglia si cancella sempre una sola mezz'ora.
          parziale: true,
        }));
        await senzaBloccare(() => creaNotifica(
          daAnnullare.utenteId,
          avviso(restaLaPartita ? 'avv.cir.tuaModificataDett' : 'avv.cir.tuaCancellataDett', {
            dettaglio: rigaDettaglio,
            coda: importoDaRimborsare(daAnnullare) > 0
              ? avviso('avv.cir.creditoRimborsato', { importo: importoDaRimborsare(daAnnullare).toFixed(2) })
              : '',
          }),
          undefined,
          circolo.id,
          undefined, undefined, motivoAnnullo,
          'prenotazioni',
          undefined,
          cardSuperstite(),
        ));
      }
      setDaAnnullare(null);
    } catch (e: any) {
      // ⚠️ Il catch c'e' perche' la cancellazione adesso passa dalla
      // rete. Finche' era una deleteDoc, un guasto praticamente non
      // esisteva — la coda offline di Firestore la assorbiva — e un
      // try/finally senza catch bastava. Adesso e' una chiamata a una
      // Cloud Function: rete assente, token scaduto, permesso negato,
      // e il rifiuto non gestito lasciava il pop-up aperto con lo
      // spinner spento e nessuna spiegazione. Che e' il modo peggiore
      // di fallire: sembra che non sia successo niente, mentre la
      // prenotazione e' ancora li'.
      // ⚠️ `e.message` arriva dal server e resta com'e': e' un messaggio
      // che il dizionario non conosce, non una scritta di questa pagina.
      setErroreAnnullo(
        e?.message?.includes('termine')
          ? e.message
          : t('adm.pre.erroreAnnullo'),
      );
    } finally {
      setElaborando(false);
    }
  };

  return (
    <div className="admin-card">
      <div className="admin-card-title">{t('adm.pre.titolo')}</div>
      {/* ⚠️ Il grassetto e' una chiave a se', e lo spazio che lo segue sta
          nel JSX e non dentro la traduzione: uno spazio in fondo a una
          riga del dizionario e' la prima cosa che qualcuno ripulisce. */}
      <p className="admin-card-hint">
        <strong>{t('adm.pre.hintTieniPremuto')}</strong>{' '}{t('adm.pre.hintSelezione')}{' '}
        {t('adm.pre.hintOccupato')}{' '}{t('adm.pre.hintPassate')}
      </p>

      <div className="pc-row">
        {giorni.map((d, i) => (
          <button
            key={i}
            /* ⚠️ Cambiando giorno o campo la selezione multipla si
               azzera. Restando accesa, l'Admin sceglieva 10:00-11:00 su
               Campo 1, passava a Campo 2 e la barra era ancora lì con
               "Conferma": premeva, e prenotava quelle ore sul campo
               sbagliato. La griglia del socio lo fa già da sempre. */
            onClick={() => { setSelezioneMultipla([]); setSelDay(i); }}
            className={`pc-day ${i === selDay ? 'selected' : ''}`}
          >
            {/* ⚠️ Forma corta dal dizionario comune, la stessa che usa la
                griglia dell'app: in tedesco «Mittwoch» in una colonna
                larga cosi' non ci sta, «Mi» si'. */}
            <div className="pc-day-label">{i === 0 ? t('com.oggi') : t(CHIAVI_GIORNO_BREVE[d.getDay()])}</div>
            <div className="pc-day-num">{d.getDate()}</div>
            {/* ⚠️ Il mese, che su sette giorni non serviva: su quattordici
                si attraversa un cambio di mese e due chip mostrerebbero
                lo stesso numero senza modo di distinguerle. */}
            <div className="pc-day-mese">{t(`com.m.${d.getMonth() + 1}` as 'com.m.1')}</div>
          </button>
        ))}
      </div>

      <div className="pc-row">
        {campi.map((c) => (
          <button
            key={c.id} onClick={() => { setSelezioneMultipla([]); setSelCampoId(c.id); }}
            className={`pc-court ${c.id === selCampoId ? 'selected' : ''}`}
          >
            {c.nome}
          </button>
        ))}
      </div>

      <div className="pc-legend">
        <span className="pc-legend-item"><span className="pc-legend-dot pc-legend-libero" /> {t('adm.pre.statoLibero')}</span>
        <span className="pc-legend-item"><span className="pc-legend-dot pc-legend-occupato" /> {t('adm.pre.statoPrenotato')}</span>
        <span className="pc-legend-item"><span className="pc-legend-dot pc-legend-lezione" /> {t('adm.pre.statoLezione')}</span>
        <span className="pc-legend-item"><span className="pc-legend-dot pc-legend-riservato" /> {t('adm.pre.statoRiservato')}</span>
        <span className="pc-legend-item"><span className="pc-legend-dot pc-legend-passato" /> {t('adm.pre.statoPassato')}</span>
      </div>

      {/* ⚠️ La fascia che ricorda una riserva in composizione: tornando
          in griglia il modulo con l'etichetta sparisce, e senza questa
          riga non c'e' niente che dica che c'e' un'operazione a meta'. */}
      {componendoRiserva && (
        <div className="pc-componendo">
          <div style={{ flex: 1 }}>
            {/* ⚠️ Le virgolette stanno DENTRO la traduzione: sono «…» in
                italiano, “…” in inglese e „…“ in tedesco, e metterle qui
                nel JSX le avrebbe congelate all'italiano ovunque. */}
            <strong>
              {t('adm.pre.staiComponendo', {
                etichetta: etichettaRiserva.trim() || t('adm.pre.orarioRiservatoMinuscolo'),
              })}
            </strong>
            <div className="pc-barra-sub">
              {t('adm.pre.giaMesseDaParte', { ore: pezziRiserva.length * 0.5 })}
            </div>
          </div>
          <button className="admin-btn-piccolo-rosso" onClick={chiudiRiserva}>{t('com.annulla')}</button>
        </div>
      )}

      {selezioneMultipla.length > 0 && (
        <div className="pc-barra-selezione">
          <div style={{ flex: 1 }}>
            <strong>
              {selezioneMultipla[0]} - {orarioFineSlot(selezioneMultipla[selezioneMultipla.length - 1])}
              {/* ⚠️ Lo spazio prima dell'unita' c'e' per il tedesco, dove
                  l'abbreviazione e' «Std.» e attaccata al numero non si
                  legge. In italiano e in inglese resta una «h» staccata. */}
              {'  ·  '}{selezioneMultipla.length * 0.5} {t('com.oreBreve')}
            </strong>
            {/* Sotto il minimo la riga dice cosa manca: con il pulsante
                spento e nessuna spiegazione, l'Admin resta a chiedersi
                cosa ha sbagliato. */}
            <div className="pc-barra-sub">
              {confermaPossibile ? t('adm.pre.cliccaTratteggiati') : t('adm.pre.aggiungiAltraMezzOra')}
            </div>
          </div>
          <button className="admin-modal-btn-cancel" onClick={() => setSelezioneMultipla([])}>{t('com.annulla')}</button>
          <button
            className="admin-modal-btn-confirm"
            disabled={!confermaPossibile}
            onClick={() => apriSceltaAdmin([...selezioneMultipla])}
          >
            {t('com.conferma')}
          </button>
        </div>
      )}

      <div className="pc-grid">
        {ORARI.map((ora) => {
          const blocco = bloccoAttivo(ora);
          const p = !blocco ? prenotazioneSlot(ora) : undefined;
          const eLezione = p?.tipo === 'lezione';
          // ⚠️ Etichette corte: nello slot ci stanno una decina di
          // caratteri, quindi in tedesco si usa la parola breve — la
          // stessa che sta in legenda, cosi' le due si riconoscono.
          let sotto = t('adm.pre.statoLibero');
          if (p?.sfidaId) sotto = t('adm.pre.sfidaInCorso');
          else if (p) sotto = p.utenteCognome ? `${p.utenteNome} ${p.utenteCognome[0]}.` : p.utenteNome;
          else if (blocco) sotto = t('adm.pre.statoRiservato');
          // ⚠️ Gia' messo da parte per la riserva in composizione: in
          // griglia risulta ancora libero — nessun documento e' stato
          // scritto — e senza un segno lo si riselezionava creando un
          // doppione.
          const giaMessoDaParte = componendoRiserva && pezziRiserva.some(
            (x) => x.campoId === selCampoId && x.data === dataSelIso && x.orario === ora,
          );
          if (giaMessoDaParte && !p && !blocco) sotto = t('adm.pre.daRiservare');
          // Stessa regola dell'app: dall'INIZIO dello slot in poi
          // quell'ora non e' piu' gestibile da nessuno.
          const passato = slotNelPassato(dataSelIso, ora);
          const selezionatoOra = selezioneMultipla.includes(ora);
          const idxOra = ORARI.indexOf(ora);
          const idxMinSel = selezioneMultipla.length ? ORARI.indexOf(selezioneMultipla[0]) : -1;
          const idxMaxSel = selezioneMultipla.length ? ORARI.indexOf(selezioneMultipla[selezioneMultipla.length - 1]) : -1;
          const estendibileOra = selezioneMultipla.length > 0 && !selezionatoOra
            && (idxOra === idxMinSel - 1 || idxOra === idxMaxSel + 1)
            && !p && !blocco && !passato;
          return (
            <button
              key={ora}
              // Passato non vuol dire muto: se sullo slot c'e' una
              // prenotazione o un orario riservato il pop-up resta
              // apribile, altrimenti l'Admin non potrebbe piu' sapere chi
              // c'era sul campo un'ora fa ne' annullare chi non si e'
              // presentato. Spenti solo i passati vuoti.
              disabled={passato && !p && !blocco}
              onClick={() => {
                // Dopo una pressione prolungata il browser emette
                // comunque un click: qui lo si ignora, altrimenti la
                // selezione appena avviata verrebbe subito annullata.
                if (pressioneLunga.current) { pressioneLunga.current = false; return; }
                if (selezioneMultipla.length > 0) { clickDuranteSelezione(ora); return; }
                if (p?.sfidaId) setSfidaInfo(sfide.find((sf) => sf.id === p.sfidaId) ?? null);
                else if (p) { setBloccataInMezzo(inMezzoAllaPrenotazione(ora)); setDaAnnullare(p); }
                else if (blocco) setBloccoInfo({ blocco, ora });
                else apriSceltaAdmin([ora]);
              }}
              // La selezione multipla si avvia con la pressione
              // prolungata. Su Safari iOS il menu contestuale non si
              // attiva con quel gesto — il sistema lo intercetta per la
              // selezione del testo — quindi la pressione si rileva a
              // mano con un timer. Il click destro resta valido per chi
              // lavora da PC con il mouse.
              onPointerDown={() => { if (!passato) avviaTimerPressione(ora); }}
              onPointerUp={annullaTimerPressione}
              onPointerLeave={annullaTimerPressione}
              onPointerCancel={annullaTimerPressione}
              onContextMenu={(e) => { e.preventDefault(); if (!passato) iniziaSelezione(ora); }}
              className={`pc-slot ${p ? 'occupato' : ''} ${eLezione ? 'lezione' : ''} ${blocco ? 'riservato' : ''}${passato ? ' passato' : ''}${selezionatoOra ? ' selezionato' : ''}${estendibileOra ? ' estendibile' : ''}${giaMessoDaParte && !selezionatoOra ? ' messo-da-parte' : ''}${selezioneMultipla.length > 0 && !selezionatoOra && !estendibileOra ? ' attenuato' : ''}`}
            >
              {/* Ora passata: rettangolo grigio e nient'altro. Le
                  scritte del passato erano l'unica cosa che competeva
                  con le ore ancora assegnabili. */}
              {(!passato || selezionatoOra) && (
                <>
                  <div className="pc-slot-ora">{ora}</div>
                  <div className="pc-slot-sotto">{sotto}</div>
                </>
              )}
            </button>
          );
        })}
      </div>

      {/* Prolunga o nuova prenotazione: compare quando il blocco
          scelto tocca una prenotazione ancora attiva. */}
      <Modal visible={!!sceltaProlunga} onClose={() => { setSceltaProlunga(null); setSelezioneMultipla([]); }}>
        <div className="admin-modal-title">{t('adm.pre.prenotazioneAccantoTitolo')}</div>
        <p className="admin-modal-sub">{t('adm.pre.prolungareOppure')}</p>

        {sceltaProlunga?.vicine.map((v) => (
          <button
            key={v.id}
            className="pc-scelta-btn"
            onClick={() => prosegui(sceltaProlunga.ore, v)}
          >
            <strong>{t('adm.pre.prolungaQuellaDelle', { ora: v.orario })}</strong>
            <span>
              {v.utenteNome} {v.utenteCognome}
              {giocatoriDi(v).length > 0 ? ` · ${t('adm.pre.conGiocatori', { nomi: elencoNomi(giocatoriDi(v)) })}` : ''}
              {v.maestroNome ? ` · ${t('adm.pre.lezioneCon', { maestro: v.maestroNome })}` : ''}
            </span>
          </button>
        ))}

        {/* ⚠️ LA PORTA DI SERVIZIO, chiusa sotto l'ora: su una mezz'ora
            sola questo pulsante creerebbe la prenotazione da trenta
            minuti che la regola vieta, raggiunta girando intorno alla
            griglia. Sopra l'ora resta: li' e' una scelta legittima. */}
        {(sceltaProlunga?.ore.length ?? 0) >= MINIMO_SLOT_NUOVA_PRENOTAZIONE && (
          <button
            className="pc-scelta-btn nuova"
            onClick={() => sceltaProlunga && prosegui(sceltaProlunga.ore, null)}
          >
            <strong>{t('adm.pre.prenotazioneNuova')}</strong>
            <span>{t('adm.pre.nonUnitaAccanto')}</span>
          </button>
        )}

        {/* ⚠️ Azzera anche la selezione, come ogni altro «Annulla» di
            questa griglia: senza, la barra verde restava accesa con il
            suo «Conferma» su una scelta abbandonata. */}
        <button className="admin-modal-btn-cancel" style={{ marginTop: '.8rem', width: '100%' }} onClick={() => { setSceltaProlunga(null); setSelezioneMultipla([]); }}>
          {t('com.annulla')}
        </button>
      </Modal>

      {/* Scelta: cosa fare degli slot selezionati */}
      {/* ⚠️ Chiude solo se stesso: `chiudiTutto` butterebbe anche i
          pezzi della riserva in composizione, l'etichetta e la
          descrizione. Oggi non e' raggiungibile con pezzi in sospeso —
          mentre si compone, `apriSceltaAdmin` non apre questo pannello —
          ma e' una fragilita' gratuita. */}
      <Modal visible={oreDaAssegnare.length > 0} onClose={() => { setOreDaAssegnare([]); setSelezioneMultipla([]); }}>
        <div className="admin-modal-title">{t('adm.pre.cosaVuoiFare')}</div>
        <p className="admin-modal-sub">
          {oreDaAssegnare.length > 1
            ? `${oreDaAssegnare[0]} - ${orarioFineSlot(oreDaAssegnare[oreDaAssegnare.length - 1])} (${oreDaAssegnare.length * 0.5} ${t('com.oreBreve')})`
            : oreDaAssegnare[0] ? fasciaOraria(oreDaAssegnare[0]) : ''}
        </p>
        <p className="admin-modal-sub">{campoSel?.nome} · {dataMostrata}</p>
        {/* ⚠️ Condizionati tutti e due, e per la stessa ragione: al
            pannello si arriva con una mezz'ora sola solo quando c'e'
            qualcosa di attaccato da allungare, e va offerto solo cio'
            che si puo' davvero allungare. */}
        {(oreDaAssegnare.length >= MINIMO_SLOT_NUOVA_PRENOTAZIONE
          || prenotazioniAdiacenti(oreDaAssegnare).length > 0) && (
          <button className="pc-scelta-btn" onClick={vaiAPrenotazione}>
            <strong>{t('adm.pre.azPrenota')}</strong><span>{t('adm.pre.azPrenotaSub')}</span>
          </button>
        )}
        {(oreDaAssegnare.length >= MINIMO_SLOT_NUOVA_PRENOTAZIONE
          || riserveAdiacenti(oreDaAssegnare).length > 0) && (
          <button className="pc-scelta-btn riserva" onClick={vaiARiserva}>
            <strong>{t('adm.pre.azRiserva')}</strong><span>{t('adm.pre.azRiservaSub')}</span>
          </button>
        )}
        {/* Le condizioni si rivalutano a ogni disegno: se la
            prenotazione accanto viene annullata mentre il pannello e'
            aperto spariscono entrambi, e resterebbe una finestra muta. */}
        {oreDaAssegnare.length < MINIMO_SLOT_NUOVA_PRENOTAZIONE
          && prenotazioniAdiacenti(oreDaAssegnare).length === 0
          && riserveAdiacenti(oreDaAssegnare).length === 0 && (
          <p className="admin-modal-sub">{t('adm.pre.accantoSparito')}</p>
        )}
        <button className="admin-modal-btn-cancel" style={{ marginTop: '.8rem' }} onClick={() => { setOreDaAssegnare([]); setSelezioneMultipla([]); }}>
          {t('com.annulla')}
        </button>
      </Modal>

      {/* Prenotazione creata dall'admin */}
      {/* Stessa ragione del modulo della riserva: qui si sceglie un
          socio e si scrive un nome, e il click fuori chiudeva anche
          mentre la scrittura era in volo. */}
      <Modal visible={oreDaPrenotare.length > 0} onClose={() => {}}>
        <div className="admin-modal-title">{t('adm.pre.prenotaComeCircolo')}</div>
        <p className="admin-modal-sub">
          {oreDaPrenotare.length > 1
            ? `${oreDaPrenotare[0]} - ${orarioFineSlot(oreDaPrenotare[oreDaPrenotare.length - 1])} (${oreDaPrenotare.length * 0.5} ${t('com.oreBreve')})`
            : oreDaPrenotare[0] ? fasciaOraria(oreDaPrenotare[0]) : ''}
        </p>
        <p className="admin-modal-sub">{campoSel?.nome} · {dataMostrata}</p>

        <div className="pc-toggle-row">
          <button
            className={`pc-toggle-btn${!modalitaEsterno ? ' selezionato' : ''}`}
            /* ⚠️ Si stacca SOLO se la modalita' cambia davvero:
               prolungando la prenotazione di un socio il toggle e' gia'
               qui, e cliccare il pulsante gia' selezionato — gesto
               comunissimo — scioglieva il prolungamento senza cambiare
               niente a schermo, spezzando la partita in due card. */
            onClick={() => {
              if (!modalitaEsterno) return;
              staccaDalProlungamento(); setModalitaEsterno(false); setNomeEsterno('');
            }}
          >{t('adm.pre.perUnSocio')}</button>
          <button
            className={`pc-toggle-btn${modalitaEsterno ? ' selezionato' : ''}`}
            onClick={() => {
              if (modalitaEsterno) return;
              staccaDalProlungamento(); setModalitaEsterno(true); setSocioScelto(null); setFiltroSocio('');
            }}
          >{t('adm.pre.perUnEsterno')}</button>
        </div>

        {modalitaEsterno ? (
          <>
            {/* ⚠️ Bloccato durante un prolungamento: il nome arriva gia'
                scritto, e riscriverlo avrebbe prodotto una card sola con
                due intestatari diversi. Per intestarla a un altro si
                annulla e si rifa': e' una prenotazione diversa. */}
            <input
              className="admin-input" value={nomeEsterno}
              onChange={(e) => setNomeEsterno(e.target.value)}
              disabled={prolungamento}
              style={prolungamento ? { opacity: 0.6 } : undefined}
              placeholder={t('adm.pre.phNomeEsterno')}
            />
            <p className="admin-card-hint">{t('adm.pre.esternoNessunAddebito')}</p>
          </>
        ) : socioScelto ? (
          <div className="admin-list-row">
            <div style={{ flex: 1, fontWeight: 700 }}>{socioScelto.nome} {socioScelto.cognome}</div>
            <button className="admin-btn-small" onClick={() => { staccaDalProlungamento(); setSocioScelto(null); setFiltroSocio(''); }}>
              {t('adm.pre.cambia')}
            </button>
          </div>
        ) : (
          <>
            <input
              className="admin-input" value={filtroSocio}
              onChange={(e) => setFiltroSocio(e.target.value)}
              placeholder={t('adm.pre.phCercaSocio')}
            />
            {risultatiSoci.map((so) => (
              <div key={so.uid} className="admin-list-row admin-list-row-clickable" onClick={() => { staccaDalProlungamento(); setSocioScelto(so); }}>
                <div style={{ flex: 1 }}>
                  {so.nome} {so.cognome}
                  {so.ruoloTessera === 'ospite' && <span className="admin-etichetta-ospite"> {t('adm.pre.ospite')}</span>}
                </div>
                {/* Il simbolo dell'euro non si traduce: sta dentro la frase
                    perche' in tedesco va DOPO la cifra. */}
                <div className="admin-list-sub">{t('adm.pre.creditoCifra', { importo: (so.credito ?? 0).toFixed(2) })}</div>
              </div>
            ))}
            <p className="admin-card-hint">{t('adm.pre.costoDalCredito')}</p>
          </>
        )}

        {/* ⚠️ I COMPAGNI, IN SOLA LETTURA. Prolungando la partita di un
            socio che gioca con altri, quelle persone vengono addebitate
            della loro quota anche sulla mezz'ora aggiunta: chi opera
            deve vederlo prima di confermare, non scoprirlo dai reclami.
            Non si toccano da qui: si cambiano dalla Card in Home, dove
            valgono per tutta la prenotazione. */}
        {giocatoriEreditati.length > 0 && (
          <div className="pc-nota-giocatori">
            <strong>{t('adm.pre.inCampoAnche', { nomi: elencoNomi(giocatoriEreditati) })}</strong>
            <p className="admin-card-hint">
              {senzaAddebito
                ? t('adm.pre.nessunAddebitoNessuno')
                : t('adm.pre.quotaDivisa')}
            </p>
          </div>
        )}

        {!modalitaEsterno && (
          <label className="pc-spunta-riga">
            <input type="checkbox" checked={senzaAddebito} onChange={(e) => setSenzaAddebito(e.target.checked)} />
            <span>{t('adm.pre.nonAddebitare')}</span>
          </label>
        )}

        <div className="admin-modal-btn-row">
          <button className="admin-modal-btn-cancel" onClick={chiudiPrenotazioneAdmin} disabled={elaborando}>{t('com.annulla')}</button>
          <button
            className="admin-modal-btn-confirm"
            onClick={confermaPrenotazione}
            disabled={elaborando || (modalitaEsterno ? !nomeEsterno.trim() : !socioScelto)}
          >
            {elaborando ? t('com.attendi') : t('com.conferma')}
          </button>
        </div>
      </Modal>

      {/* Riserva orario */}
      {/* ⚠️ IL BACKDROP NON CHIUDE QUESTO MODULO. Il `Modal` del web si
          chiude a ogni click fuori dal riquadro: qui dentro ci sono
          l'etichetta, la descrizione e i giorni gia' messi da parte, e
          un click distratto a due centimetri buttava via tutta la
          fatica che questa funzione esiste per risparmiare — senza
          chiedere niente e senza modo di tornare indietro. Si esce dai
          pulsanti, come sull'app, dove quel gesto non esiste. */}
      <Modal visible={oreDaRiservare.length > 0} onClose={() => {}}>
        <div className="admin-modal-title">{t('adm.pre.riservaOrarioTitolo')}</div>
        <p className="admin-modal-sub">
          {oreDaRiservare.length > 1
            ? `${oreDaRiservare[0]} - ${orarioFineSlot(oreDaRiservare[oreDaRiservare.length - 1])} (${oreDaRiservare.length * 0.5} ${t('com.oreBreve')})`
            : oreDaRiservare[0] ? fasciaOraria(oreDaRiservare[0]) : ''}
        </p>
        <p className="admin-modal-sub">{campoSel?.nome} · {dataMostrata}</p>

        {/* ⚠️ Gli altri giorni e gli altri campi gia' messi da parte:
            una selezione sparsa non si puo' leggere dalla griglia, che
            ne mostra una pagina alla volta, e senza questo elenco
            l'Admin confermerebbe alla cieca. */}
        {pezziRiserva.length > 0 && (
          <div className="pc-riepilogo-riserva">
            <strong>{t('adm.pre.giaMessiDaParte')}</strong>
            {blocchiDaiPezzi(pezziRiserva).map((g) => (
              <div key={`${g.campoId}|${g.data}|${g.orari[0]}`} className="pc-riepilogo-riga">
                <span style={{ flex: 1 }}>
                  {g.dataLabel} · {g.campoNome} · {g.orari[0]} - {orarioFineSlot(g.orari[g.orari.length - 1])}
                </span>
                <button
                  className="admin-btn-piccolo-rosso"
                  onClick={() => setPezziRiserva((prec) => prec.filter((x) => !(
                    x.campoId === g.campoId && x.data === g.data && g.orari.includes(x.orario)
                  )))}
                >
                  {t('adm.pre.togli')}
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Un'etichetta sola per tutti i giorni: e' esattamente la
            fatica che questa aggiunta esiste per togliere. */}
        <button
          className="pc-aggiungi-orari"
          onClick={aggiungiAltriOrariAllaRiserva}
          disabled={elaborando}
        >
          {t('adm.pre.aggiungiGiorniCampi')}
        </button>

        <label className="admin-label">{t('adm.pre.etichetta')}</label>
        <input
          className="admin-input" value={etichettaRiserva}
          onChange={(e) => setEtichettaRiserva(e.target.value.slice(0, 14))}
          placeholder={t('adm.pre.phEtichetta')} maxLength={14}
        />
        {/* ⚠️ Il tetto dei quattordici caratteri vale in tutte e tre le
            lingue: e' lo spazio dello slot, non una regola di lingua.
            L'etichetta la scrive l'Admin e resta come l'ha scritta. */}
        <p className="admin-card-hint">
          {t('adm.pre.etichettaAiuto', { n: 14 - etichettaRiserva.length })}
        </p>

        <label className="admin-label">{t('adm.pre.descrizione')}</label>
        <textarea
          className="admin-input" value={descrizioneRiserva}
          onChange={(e) => setDescrizioneRiserva(e.target.value)}
          placeholder={t('adm.pre.phDescrizione')} rows={3}
        />
        <p className="admin-card-hint">{t('adm.pre.descrizioneAiuto')}</p>

        <div className="admin-modal-btn-row">
          <button className="admin-modal-btn-cancel" onClick={chiudiRiserva} disabled={elaborando}>{t('com.annulla')}</button>
          <button
            className="admin-modal-btn-confirm"
            /* ⚠️ Avvolto: il parametro `gia` non e' un evento del mouse.
               Passandolo diretto, il click gli avrebbe consegnato
               l'oggetto MouseEvent — che e' «vero» — saltando l'avviso
               sulle prenotazioni sottostanti al primo tentativo. */
            onClick={() => void confermaRiserva()}
            disabled={elaborando || !etichettaRiserva.trim()}
          >
            {elaborando ? t('com.attendi') : t('adm.pre.azRiserva')}
          </button>
        </div>
      </Modal>

      <Modal visible={!!bloccoInfo} onClose={() => setBloccoInfo(null)}>
        {/* ⚠️ Tutto dal blocco VIVO, non dalla fotografia scattata
            all'apertura: con i due mescolati il pop-up arrivava a dire
            due cose diverse insieme, e poi a rifiutare. */}
        <div className="admin-modal-title">{t('adm.pre.orarioRiservatoTitolo')}</div>
        <div className="admin-modal-sub">
          {campi.find((c) => c.id === bloccoVivo?.campoId)?.nome} · {bloccoVivo?.orarioInizio} - {bloccoVivo?.orarioFine}
        </div>
        <p style={{ marginTop: '1rem', fontWeight: 700 }}>{bloccoVivo?.etichetta}</p>
        {!!bloccoVivo?.descrizione && (
          <p className="admin-card-hint" style={{ textAlign: 'center' }}>{bloccoVivo.descrizione}</p>
        )}
        {/* ⚠️ TOGLIERE UNA MEZZ'ORA, dalle sole estremita': una riserva
            e' un intervallo continuo, un documento solo, e togliere una
            mezz'ora centrale vorrebbe dire spezzarla in due documenti
            che nessuna schermata sa raccontare. Le ricorrenti restano
            fuori: sono il sistema vecchio. */}
        {!!bloccoInfo && !!bloccoVivo && bloccoVivo.tipo === 'data' && (
          estremitaDellaRiserva(bloccoVivo, bloccoInfo.ora) ? (
            <button
              className="admin-btn-danger"
              style={{ marginTop: '1rem', width: '100%' }}
              disabled={elaborandoRiserva}
              onClick={() => {
                if (unaSolaMezzOra(bloccoVivo)) {
                  setConferma({
                    titolo: t('adm.pre.rimuovereRiservaTitolo'),
                    testo: t('adm.pre.rimuovereRiservaTesto', { etichetta: bloccoVivo.etichetta }),
                    etichetta: t('adm.pre.rimuovi'),
                    azione: () => void togliMezzOraDallaRiserva(bloccoInfo.blocco, bloccoInfo.ora),
                  });
                  return;
                }
                void togliMezzOraDallaRiserva(bloccoInfo.blocco, bloccoInfo.ora);
              }}
            >
              {unaSolaMezzOra(bloccoVivo)
                ? t('adm.pre.rimuoviOrarioRiservato')
                : t('adm.pre.togliMezzOra', { ora: bloccoInfo.ora })}
            </button>
          ) : (
            <p className="admin-card-hint" style={{ textAlign: 'center' }}>
              {t('adm.pre.perAccorciare')}
            </p>
          )
        )}
        <button className="admin-modal-btn-cancel" onClick={() => setBloccoInfo(null)} style={{ marginTop: '1rem' }}>
          {t('com.chiudi')}
        </button>
      </Modal>

      {/* ============================================================
          PROLUNGA LA RISERVA — gemello dello strato delle prenotazioni.
          Prolungare non apre nessun modulo: la riserva ha gia' la sua
          etichetta e la sua descrizione, ed erano proprio quelle che
          l'Admin non doveva riscrivere ogni volta.
          ============================================================ */}
      <Modal visible={!!sceltaProlungaRiserva} onClose={() => { setSceltaProlungaRiserva(null); setSelezioneMultipla([]); }}>
        <div className="admin-modal-title">{t('adm.pre.riservaAccantoTitolo')}</div>
        <p className="admin-modal-sub">{t('adm.pre.allungareOppure')}</p>
        {sceltaProlungaRiserva?.vicine.map((b) => (
          <button
            key={b.id}
            className="pc-scelta-btn"
            disabled={elaborandoRiserva}
            onClick={() => prolungaRiserva(b, sceltaProlungaRiserva.ore)}
          >
            <strong>{t('adm.pre.allungaEtichetta', { etichetta: b.etichetta })}</strong>
            <span>{b.orarioInizio} - {b.orarioFine}</span>
          </button>
        ))}
        {(sceltaProlungaRiserva?.ore.length ?? 0) >= MINIMO_SLOT_NUOVA_PRENOTAZIONE && (
          <button
            className="pc-scelta-btn nuova"
            disabled={elaborandoRiserva}
            onClick={() => {
              const ore = sceltaProlungaRiserva?.ore ?? [];
              setSceltaProlungaRiserva(null);
              setOreDaRiservare([...ore]);
              setEtichettaRiserva(''); setDescrizioneRiserva('');
            }}
          >
            <strong>{t('adm.pre.riservaNuova')}</strong>
            <span>{t('adm.pre.nonUnitaAccanto')}</span>
          </button>
        )}
        <button
          className="admin-modal-btn-cancel"
          style={{ marginTop: '.8rem', width: '100%' }}
          onClick={() => { setSceltaProlungaRiserva(null); setSelezioneMultipla([]); }}
        >
          {t('com.annulla')}
        </button>
      </Modal>

      {/* La conferma a due pulsanti: vedi la nota sullo stato `conferma`. */}
      <Modal visible={!!conferma} onClose={() => setConferma(null)}>
        <div className="admin-modal-title">{conferma?.titolo}</div>
        <p className="admin-modal-sub">{conferma?.testo}</p>
        <div className="admin-modal-btn-row">
          <button className="admin-modal-btn-cancel" onClick={() => setConferma(null)}>{t('com.annulla')}</button>
          <button
            className="admin-btn-danger"
            onClick={() => { const a = conferma?.azione; setConferma(null); a?.(); }}
          >
            {conferma?.etichetta}
          </button>
        </div>
      </Modal>

      <Modal visible={!!sfidaInfo} onClose={() => setSfidaInfo(null)}>
        <div className="admin-modal-title">{t('adm.pre.sfidaInCorso')}</div>
        <p className="admin-card-hint" style={{ textAlign: 'center' }}>
          {sfidaInfo?.sfidanteNome} {sfidaInfo?.sfidanteCognome} vs {sfidaInfo?.sfidatoNome} {sfidaInfo?.sfidatoCognome}
        </p>

        <div style={{ background: '#F7F4EA', borderRadius: 10, padding: '.8rem', marginTop: '.6rem' }}>
          <div className="admin-list-sub">
            {t('adm.pre.posizioniAlLancio', {
              sfidante: sfidaInfo?.sfidanteNome ?? '',
              posSfidante: sfidaInfo?.posizioneSfidante ?? '',
              sfidato: sfidaInfo?.sfidatoNome ?? '',
              posSfidato: sfidaInfo?.posizioneSfidato ?? '',
            })}
          </div>
          {sfidaInfo?.fase === 'accettata' && sfidaInfo?.matchData && (
            <div className="admin-list-sub" style={{ fontWeight: 700, marginTop: '.3rem' }}>
              {sfidaInfo.matchDataLabel} · {sfidaInfo.matchCampoNome} · {sfidaInfo.matchOrari?.[0]}
            </div>
          )}
          {/* ⚠️ `esito` e' un valore di Firestore — 'vinta' o 'persa' —
              e finora finiva a schermo cosi' com'e'. Non e' testo scritto
              dall'Admin: e' un codice con due soli valori, quindi si
              traduce come si traduce una pastiglia. Il punteggio invece
              e' scritto da chi ha giocato e resta com'e'. */}
          {sfidaInfo?.risultatoSfidante && (
            <div className="admin-list-sub">
              {sfidaInfo.sfidanteNome}: {t(sfidaInfo.risultatoSfidante.esito === 'vinta' ? 'adm.pre.esitoVinta' : 'adm.pre.esitoPersa')} {sfidaInfo.risultatoSfidante.punteggio ? `(${sfidaInfo.risultatoSfidante.punteggio})` : ''}
            </div>
          )}
          {sfidaInfo?.risultatoSfidato && (
            <div className="admin-list-sub">
              {sfidaInfo.sfidatoNome}: {t(sfidaInfo.risultatoSfidato.esito === 'vinta' ? 'adm.pre.esitoVinta' : 'adm.pre.esitoPersa')} {sfidaInfo.risultatoSfidato.punteggio ? `(${sfidaInfo.risultatoSfidato.punteggio})` : ''}
            </div>
          )}
        </div>

        <p className="admin-card-hint" style={{ textAlign: 'center', marginTop: '.8rem' }}>
          {t('adm.pre.sfidaSoloConsultazione')}
        </p>
        <button className="admin-btn-full" style={{ marginTop: '1rem' }} onClick={() => setSfidaInfo(null)}>
          {t('adm.pre.hoCapito')}
        </button>
      </Modal>

      <Modal visible={!!daAnnullare} onClose={() => setDaAnnullare(null)}>
        <div className="admin-modal-title" style={{ textTransform: 'none', fontSize: '1rem' }}>
          {daAnnullare ? intestazionePrenotazione(daAnnullare, t) : ''}
        </div>
        <div className="admin-modal-sub">
          {daAnnullare?.campoNome} · {daAnnullare?.dataLabel} {daAnnullare ? fasciaOraria(daAnnullare.orario) : ''}
          {daAnnullare?.etichetta ? ` · ${daAnnullare.etichetta}` : ''}
        </div>
        {daAnnullare?.tipo === 'lezione' ? (
          <>
            {/* ⚠️ Le informazioni restano tutte: sparisce solo il tasto
                di cancellazione, com'e' gia' per la mezz'ora in mezzo e
                per le Sfide. Una lezione e' un accordo fra due persone,
                non tre mezz'ore di campo: cancellandone una alla volta i
                campi tornavano liberi ma la conversazione fra Maestro e
                allievo restava aperta su una lezione che non esisteva
                piu', e al socio restava in Home la card "lezione
                confermata, campi non occupati" finche' il Maestro non
                chiudeva la chat a mano. */}
            <p className="mov-nota-bloccata">{t('adm.pre.lezioneNonAnnullabile')}</p>
            <div className="admin-modal-btn-row">
              <button className="admin-modal-btn-cancel" onClick={() => setDaAnnullare(null)}>{t('com.chiudi')}</button>
            </div>
          </>
        ) : bloccataInMezzo ? (
          <>
            {/* Le informazioni restano tutte: sparisce solo il pulsante
                di cancellazione, sostituito dalla spiegazione. */}
            <p className="mov-nota-bloccata">{t('adm.pre.mezzOraInMezzo')}</p>
            <div className="admin-modal-btn-row">
              <button className="admin-modal-btn-cancel" onClick={() => setDaAnnullare(null)}>{t('com.chiudi')}</button>
            </div>
          </>
        ) : (
          <>
            <p className="admin-modal-sub" style={{ marginTop: '.8rem', fontWeight: 700 }}>
              {t('adm.pre.vuoiAnnullare')}
            </p>
            {/* Chi viene rimborsato e come: sta SOTTO la domanda perche'
                riguarda la conseguenza della cancellazione.
                ⚠️ Il ramo "e' una lezione" non c'e' piu': da qui le
                lezioni non passano proprio, le intercetta il blocco
                sopra. Tenerlo sarebbe stato codice irraggiungibile che
                racconta una possibilita' che non esiste. */}
            <p className="mov-nota-rimborso">
              {!daAnnullare?.utenteId || importoDaRimborsare(daAnnullare) === 0
                ? t('adm.pre.nessunRimborso')
                : daAnnullare && giocatoriDi(daAnnullare).length > 0
                  ? t('adm.pre.rimborsoDiviso', {
                    titolare: `${daAnnullare.utenteNome} ${daAnnullare.utenteCognome}`,
                    importo: quotaChiPrenota(daAnnullare).toFixed(2),
                    altri: elencoNomi(giocatoriDi(daAnnullare)),
                  })
                  : t('adm.pre.rimborsoSingolo', {
                    nome: `${daAnnullare?.utenteNome} ${daAnnullare?.utenteCognome}`,
                    importo: importoDaRimborsare(daAnnullare).toFixed(2),
                  })}
            </p>
            {erroreAnnullo && <div className="admin-error-text">{erroreAnnullo}</div>}
            <div className="admin-modal-btn-row">
              <button className="admin-modal-btn-cancel" onClick={() => setDaAnnullare(null)}>{t('com.indietro')}</button>
              <button className="admin-modal-btn-confirm danger" onClick={confermaAnnulla} disabled={elaborando}>
                {elaborando ? t('com.attendi') : t('adm.pre.cancellaPrenotazione')}
              </button>
            </div>
          </>
        )}
      </Modal>
    </div>
  );
}
