'use client';

import { useEffect, useRef, useState } from 'react';
import { Campo, Blocco, Circolo, ORARI, fasciaOraria, orarioFineSlot, slotNelPassato,
  circoloOperativo, statoCircolo } from '../../../data/circoli';
import { SocioCircolo } from '../../../data/users';
import { calcolaPrezzo } from '../../../data/prezzi';
import { aggiungiBlocco } from '../../../data/circoliRepo';
import { prenotaPerSocioDaAdmin, prenotaEsternoDaAdmin } from '../../../data/prenotazioniRepo';
import { nuovoGruppoId } from '../../../data/movimenti';
import { stessaCard } from '../../../data/raggruppamento';

const GIORNI_IT_ESTESO = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato'];
const MESI_IT = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];
import { PrenotazioneAdmin, cancellaConRimborso, cancellaConRimborsoDiviso, cancellaSenzaRimborso, importoDaRimborsare } from '../../../data/prenotazioniRepo';
import { giocatoriDi, quotaChiPrenota, elencoNomi } from '../../../data/giocatori';
import { Sfida } from '../../../data/sfide';
import { creaNotifica } from '../../../data/notifiche';

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

const GIORNI_IT_BREVE = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'];

// Titolo prominente del pop-up di una prenotazione: chi gioca, con chi —
// la stessa regola in tutta l'app: le info contano più dell'azione.
function intestazionePrenotazione(p: PrenotazioneAdmin): string {
  if (p.tipo === 'lezione') {
    return p.prenotataDa === 'maestro'
      ? `${p.maestroNome} ${p.maestroCognome} lezione con ${p.utenteNome} ${p.utenteCognome}`
      : `${p.utenteNome} ${p.utenteCognome} lezione con ${p.maestroNome} ${p.maestroCognome}`;
  }
  if (giocatoriDi(p).length > 0) {
    return `${p.utenteNome} ${p.utenteCognome} gioca con ${elencoNomi(giocatoriDi(p))}`;
  }
  return `${p.utenteNome} ${p.utenteCognome}`;
}

export default function SezionePrenotazioni({ campi, blocchi, prenotazioni, sfide, circolo, soci, nomeEsecutore }: {
  campi: Campo[]; blocchi: Blocco[]; prenotazioni: PrenotazioneAdmin[]; sfide: Sfida[]; circolo: Circolo; soci: SocioCircolo[];
  // Chi sta operando: finisce nel registro movimenti.
  nomeEsecutore: string;
}) {
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
  const [bloccoInfo, setBloccoInfo] = useState<Blocco | null>(null);
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

  useEffect(() => {
    if ((!selCampoId || !campi.some((c) => c.id === selCampoId)) && campi[0]) {
      setSelCampoId(campi[0].id);
    }
  }, [campi]);

  const giorni = Array.from({ length: 7 }, (_, i) => {
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
  const MASSIMO_SLOT_MULTIPLI = 8;

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
  const timerPressione = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pressioneLunga = useRef(false);

  const avviaTimerPressione = (ora: string) => {
    pressioneLunga.current = false;
    if (timerPressione.current) clearTimeout(timerPressione.current);
    timerPressione.current = setTimeout(() => {
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
    if (selezioneMultipla.length >= MASSIMO_SLOT_MULTIPLI) return;
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
  const vaiAPrenotazione = (ore: string[], daProlungare: PrenotazioneAdmin | null) => {
    setSceltaProlunga(null);
    setNuovaPrenotazione(daProlungare === null);
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
    } else {
      setModalitaEsterno(false);
      setSocioScelto(null);
      setNomeEsterno('');
    }
    setOreDaPrenotare(ore);
    setOreDaAssegnare([]);
  };

  const chiudiTutto = () => {
    setOreDaAssegnare([]); setOreDaPrenotare([]); setOreDaRiservare([]);
    setSelezioneMultipla([]); setModalitaEsterno(false); setNomeEsterno('');
    setFiltroSocio(''); setSocioScelto(null); setSenzaAddebito(false);
    setEtichettaRiserva(''); setDescrizioneRiserva('');
  };

  const risultatiSoci = filtroSocio.trim().length < 2 ? [] : soci
    .filter((so) => `${so.nome} ${so.cognome}`.toLowerCase().includes(filtroSocio.trim().toLowerCase()))
    .slice(0, 6);

  const dataLeggibile = `${GIORNI_IT_ESTESO[giornoSel.getDay()]} ${giornoSel.getDate()} ${MESI_IT[giornoSel.getMonth()]}`;

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
      alert(
        (statoCircolo(circolo) === 'chiuso'
          ? 'Il circolo non fa più parte della rete Racket Fever'
          : 'Il circolo è momentaneamente sospeso dalla rete Racket Fever')
        + ': non è possibile creare nuove prenotazioni. Le prenotazioni già confermate '
        + 'restano valide. Per informazioni contatta il team Racket Fever.'
      );
      return;
    }
    if (invioInCorso.current) return;
    if (oreDaPrenotare.length === 0 || !campoSel) return;
    // Ultima barriera prima della scrittura: fra la selezione e la
    // conferma puo' essere scoccata la mezz'ora, e il pannello resta
    // aperto anche a lungo. Il controllo sullo slot non basta.
    if (oreDaPrenotare.some((o) => slotNelPassato(dataSelIso, o))) {
      // Stesso canale degli altri errori di questa sezione.
      alert('Una o più mezz\u2019ore sono nel frattempo passate: chiudi e riseleziona.');
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
            gruppoId, cardId: cardId ?? undefined,
          });
        } else if (socioScelto) {
          await prenotaPerSocioDaAdmin({
            ...base, uid: socioScelto.uid, nuovaPrenotazione: apreCard,
            gruppoId, cardId: cardId ?? undefined,
            utenteNome: socioScelto.nome, utenteCognome: socioScelto.cognome,
            tipoUtente: socioScelto.ruoloTessera === 'ospite' ? 'ospite' : 'socio',
          });
        }
        fatte++;
      }
      // Una sola notifica per l'intero blocco, non una per mezz'ora.
      if (!modalitaEsterno && socioScelto) {
        const daA = oreDaPrenotare.length > 1
          ? `dalle ${oreDaPrenotare[0]} alle ${orarioFineSlot(oreDaPrenotare[oreDaPrenotare.length - 1])}`
          : `alle ${oreDaPrenotare[0]}`;
        await creaNotifica(
          socioScelto.uid,
          `Il circolo ha prenotato per te ${campoSel.nome} il ${dataLeggibile} ${daA}.`
            + (senzaAddebito ? ' Nessun addebito sul tuo credito.' : ''),
          undefined, circolo.id
        );
      }
      chiudiTutto();
    } catch (e: any) {
      const inParte = fatte > 0
        ? ` Le prime ${fatte} di ${oreDaPrenotare.length} mezz'ore sono state prenotate: aggiorna la griglia prima di riprovare, o le ritroverai come già occupate.`
        : ' Riprova.';
      alert((e?.message === 'SLOT_OCCUPATO'
        ? 'Una di quelle mezz\'ore è stata appena prenotata da qualcun altro.'
        : 'Non è stato possibile completare la prenotazione.') + inParte);
    } finally {
      invioInCorso.current = false;
      setElaborando(false);
    }
  };

  const confermaRiserva = async () => {
    if (oreDaRiservare.length === 0 || !campoSel || !etichettaRiserva.trim()) return;
    // Stessa barriera della prenotazione: non si riserva nel passato.
    if (oreDaRiservare.some((o) => slotNelPassato(dataSelIso, o))) {
      // Stesso canale degli altri errori di questa sezione.
      alert('Una o più mezz\u2019ore sono nel frattempo passate: chiudi e riseleziona.');
      return;
    }
    setElaborando(true);
    try {
      // Un solo blocco per l'intero intervallo: gli orari riservati
      // sono continui per natura, non serve spezzarli.
      await aggiungiBlocco(circolo.id, {
        campoId: campoSel.id,
        tipo: 'data',
        data: dataSelIso,
        orarioInizio: oreDaRiservare[0],
        orarioFine: orarioFineSlot(oreDaRiservare[oreDaRiservare.length - 1]),
        etichetta: etichettaRiserva.trim().slice(0, 14),
        descrizione: descrizioneRiserva.trim() || undefined,
      });
      chiudiTutto();
    } catch {
      alert("Non è stato possibile riservare l'orario. Riprova.");
    } finally {
      setElaborando(false);
    }
  };

  const prenotazioneSlot = (ora: string) =>
    prenotazioni.find((p) => p.campoId === selCampoId && p.data === dataSelIso && p.orario === ora);

  const confermaAnnulla = async () => {
    if (!daAnnullare) return;
    setErroreAnnullo('');
    setElaborando(true);
    try {
      if (!daAnnullare.utenteId) {
        await cancellaSenzaRimborso(daAnnullare.id);
      } else if (giocatoriDi(daAnnullare).length > 0) {
        const altri = giocatoriDi(daAnnullare);
        const miaQuota = quotaChiPrenota(daAnnullare).toFixed(2);
        await cancellaConRimborsoDiviso({
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
        });
        // ⚠️ Il circolo va SEMPRE passato, e l'avviso non deve poter
        // far fallire l'annullamento: la prenotazione a questo punto e'
        // gia' cancellata. Senza circoloId l'avviso finisce nel circolo
        // principale del socio — quello sbagliato, se qui e' Ospite — e
        // per un Ospite la scrittura viene proprio rifiutata, con
        // l'errore che risale e nasconde un'operazione riuscita.
        await senzaBloccare(() => creaNotifica(
          daAnnullare.utenteId,
          `Il circolo ha annullato la tua prenotazione: ${daAnnullare.campoNome}, ${daAnnullare.dataLabel} ore ${fasciaOraria(daAnnullare.orario)}. Ti è stata rimborsata la tua quota: € ${miaQuota}.`,
          undefined,
          circolo.id,
        ));
        for (const g of altri) {
          await senzaBloccare(() => creaNotifica(
            g.uid,
            `Il circolo ha annullato la prenotazione con ${daAnnullare.utenteNome} ${daAnnullare.utenteCognome}: ${daAnnullare.campoNome}, ${daAnnullare.dataLabel} ore ${fasciaOraria(daAnnullare.orario)}. Ti è stata rimborsata la tua quota: € ${g.quota.toFixed(2)}.`,
            undefined,
            circolo.id,
          ));
        }
      } else {
        await cancellaConRimborso({
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
        });
        await senzaBloccare(() => creaNotifica(
          daAnnullare.utenteId,
          `Il circolo ha annullato la tua prenotazione: ${daAnnullare.campoNome}, ${daAnnullare.dataLabel} ore ${fasciaOraria(daAnnullare.orario)}.`
            + (importoDaRimborsare(daAnnullare) > 0 ? ` Credito rimborsato: € ${importoDaRimborsare(daAnnullare).toFixed(2)}.` : ''),
          undefined,
          circolo.id,
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
      setErroreAnnullo(
        e?.message?.includes('termine')
          ? e.message
          : 'Annullamento non riuscito: la prenotazione è ancora attiva. Riprova.',
      );
    } finally {
      setElaborando(false);
    }
  };

  return (
    <div className="admin-card">
      <div className="admin-card-title">Prenotazione Campi</div>
      <p className="admin-card-hint">
        Clicca su uno slot occupato per vedere chi ha prenotato ed eventualmente annullare.
        Le mezz&apos;ore già cominciate diventano grigie: non si possono più assegnare né riservare,
        ma restano cliccabili se hanno qualcosa sopra.
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
            <div className="pc-day-label">{i === 0 ? 'Oggi' : GIORNI_IT_BREVE[d.getDay()]}</div>
            <div className="pc-day-num">{d.getDate()}</div>
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
        <span className="pc-legend-item"><span className="pc-legend-dot pc-legend-libero" /> Libero</span>
        <span className="pc-legend-item"><span className="pc-legend-dot pc-legend-occupato" /> Prenotato</span>
        <span className="pc-legend-item"><span className="pc-legend-dot pc-legend-lezione" /> Lezione</span>
        <span className="pc-legend-item"><span className="pc-legend-dot pc-legend-riservato" /> Riservato</span>
        <span className="pc-legend-item"><span className="pc-legend-dot pc-legend-passato" /> Ora passata</span>
      </div>

      {selezioneMultipla.length > 0 && (
        <div className="pc-barra-selezione">
          <div style={{ flex: 1 }}>
            <strong>
              {selezioneMultipla[0]} - {orarioFineSlot(selezioneMultipla[selezioneMultipla.length - 1])}
              {'  ·  '}{selezioneMultipla.length * 0.5}h
            </strong>
            <div className="pc-barra-sub">Clicca gli slot tratteggiati per estendere</div>
          </div>
          <button className="admin-modal-btn-cancel" onClick={() => setSelezioneMultipla([])}>Annulla</button>
          <button className="admin-modal-btn-confirm" onClick={() => setOreDaAssegnare([...selezioneMultipla])}>
            Conferma
          </button>
        </div>
      )}

      <div className="pc-grid">
        {ORARI.map((ora) => {
          const blocco = bloccoAttivo(ora);
          const p = !blocco ? prenotazioneSlot(ora) : undefined;
          const eLezione = p?.tipo === 'lezione';
          let sotto = 'Libero';
          if (p?.sfidaId) sotto = 'Sfida in corso';
          else if (p) sotto = p.utenteCognome ? `${p.utenteNome} ${p.utenteCognome[0]}.` : p.utenteNome;
          else if (blocco) sotto = 'Riservato';
          // Stessa regola dell'app: dall'INIZIO dello slot in poi
          // quell'ora non e' piu' gestibile da nessuno.
          const passato = slotNelPassato(dataSelIso, ora);
          const selezionatoOra = selezioneMultipla.includes(ora);
          const idxOra = ORARI.indexOf(ora);
          const idxMinSel = selezioneMultipla.length ? ORARI.indexOf(selezioneMultipla[0]) : -1;
          const idxMaxSel = selezioneMultipla.length ? ORARI.indexOf(selezioneMultipla[selezioneMultipla.length - 1]) : -1;
          const estendibileOra = selezioneMultipla.length > 0 && !selezionatoOra
            && (idxOra === idxMinSel - 1 || idxOra === idxMaxSel + 1)
            && selezioneMultipla.length < MASSIMO_SLOT_MULTIPLI && !p && !blocco && !passato;
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
                else if (blocco) setBloccoInfo(blocco);
                else setOreDaAssegnare([ora]);
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
              className={`pc-slot ${p ? 'occupato' : ''} ${eLezione ? 'lezione' : ''} ${blocco ? 'riservato' : ''}${passato ? ' passato' : ''}${selezionatoOra ? ' selezionato' : ''}${estendibileOra ? ' estendibile' : ''}${selezioneMultipla.length > 0 && !selezionatoOra && !estendibileOra ? ' attenuato' : ''}`}
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
      <Modal visible={!!sceltaProlunga} onClose={() => setSceltaProlunga(null)}>
        <div className="admin-modal-title">C&apos;è già una prenotazione qui accanto</div>
        <p className="admin-modal-sub">Vuoi prolungarla, oppure è una partita a sé?</p>

        {sceltaProlunga?.vicine.map((v) => (
          <button
            key={v.id}
            className="pc-scelta-btn"
            onClick={() => vaiAPrenotazione(sceltaProlunga.ore, v)}
          >
            <strong>Prolunga quella delle {v.orario}</strong>
            <span>
              {v.utenteNome} {v.utenteCognome}
              {giocatoriDi(v).length > 0 ? ` · con ${elencoNomi(giocatoriDi(v))}` : ''}
              {v.maestroNome ? ` · Lezione con ${v.maestroNome}` : ''}
            </span>
          </button>
        ))}

        <button
          className="pc-scelta-btn nuova"
          onClick={() => sceltaProlunga && vaiAPrenotazione(sceltaProlunga.ore, null)}
        >
          <strong>È una prenotazione nuova</strong>
          <span>Non verrà unita a quella accanto</span>
        </button>

        <button className="admin-modal-btn-cancel" style={{ marginTop: '.8rem', width: '100%' }} onClick={() => setSceltaProlunga(null)}>
          Annulla
        </button>
      </Modal>

      {/* Scelta: cosa fare degli slot selezionati */}
      <Modal visible={oreDaAssegnare.length > 0} onClose={chiudiTutto}>
        <div className="admin-modal-title">Cosa vuoi fare?</div>
        <p className="admin-modal-sub">
          {oreDaAssegnare.length > 1
            ? `${oreDaAssegnare[0]} - ${orarioFineSlot(oreDaAssegnare[oreDaAssegnare.length - 1])} (${oreDaAssegnare.length * 0.5}h)`
            : oreDaAssegnare[0] ? fasciaOraria(oreDaAssegnare[0]) : ''}
        </p>
        <p className="admin-modal-sub">{campoSel?.nome} · {dataLeggibile}</p>
        <button
          className="pc-scelta-btn"
          onClick={() => {
            // La scelta si fa una volta per l'intero blocco.
            const vicine = prenotazioniAdiacenti(oreDaAssegnare);
            if (vicine.length > 0) {
              setSceltaProlunga({ ore: [...oreDaAssegnare], vicine });
              setOreDaAssegnare([]);
            } else {
              vaiAPrenotazione([...oreDaAssegnare], null);
            }
          }}
        >
          <strong>Prenota</strong><span>Per un socio o per un esterno</span>
        </button>
        <button
          className="pc-scelta-btn riserva"
          onClick={() => { setOreDaRiservare([...oreDaAssegnare]); setOreDaAssegnare([]); }}
        >
          <strong>Riserva</strong><span>Orario non prenotabile dai soci</span>
        </button>
        <button className="admin-modal-btn-cancel" style={{ marginTop: '.8rem' }} onClick={chiudiTutto}>
          Annulla
        </button>
      </Modal>

      {/* Prenotazione creata dall'admin */}
      <Modal visible={oreDaPrenotare.length > 0} onClose={chiudiTutto}>
        <div className="admin-modal-title">Prenota come Circolo</div>
        <p className="admin-modal-sub">
          {oreDaPrenotare.length > 1
            ? `${oreDaPrenotare[0]} - ${orarioFineSlot(oreDaPrenotare[oreDaPrenotare.length - 1])} (${oreDaPrenotare.length * 0.5}h)`
            : oreDaPrenotare[0] ? fasciaOraria(oreDaPrenotare[0]) : ''}
        </p>
        <p className="admin-modal-sub">{campoSel?.nome} · {dataLeggibile}</p>

        <div className="pc-toggle-row">
          <button
            className={`pc-toggle-btn${!modalitaEsterno ? ' selezionato' : ''}`}
            onClick={() => { setModalitaEsterno(false); setNomeEsterno(''); }}
          >Per un socio</button>
          <button
            className={`pc-toggle-btn${modalitaEsterno ? ' selezionato' : ''}`}
            onClick={() => { setModalitaEsterno(true); setSocioScelto(null); setFiltroSocio(''); }}
          >Per un esterno</button>
        </div>

        {modalitaEsterno ? (
          <>
            <input
              className="admin-input" value={nomeEsterno}
              onChange={(e) => setNomeEsterno(e.target.value)}
              placeholder="Nome e cognome dell'esterno"
            />
            <p className="admin-card-hint">
              L&apos;esterno non ha un account: la prenotazione non genera alcun addebito.
            </p>
          </>
        ) : socioScelto ? (
          <div className="admin-list-row">
            <div style={{ flex: 1, fontWeight: 700 }}>{socioScelto.nome} {socioScelto.cognome}</div>
            <button className="admin-btn-small" onClick={() => { setSocioScelto(null); setFiltroSocio(''); }}>
              Cambia
            </button>
          </div>
        ) : (
          <>
            <input
              className="admin-input" value={filtroSocio}
              onChange={(e) => setFiltroSocio(e.target.value)}
              placeholder="Cerca Socio/Tesserato o Ospite…"
            />
            {risultatiSoci.map((so) => (
              <div key={so.uid} className="admin-list-row admin-list-row-clickable" onClick={() => setSocioScelto(so)}>
                <div style={{ flex: 1 }}>
                  {so.nome} {so.cognome}
                  {so.ruoloTessera === 'ospite' && <span className="admin-etichetta-ospite"> (ospite)</span>}
                </div>
                <div className="admin-list-sub">credito € {(so.credito ?? 0).toFixed(2)}</div>
              </div>
            ))}
            <p className="admin-card-hint">
              Il costo verrà scalato dal credito del socio, come per una sua prenotazione.
            </p>
          </>
        )}

        {!modalitaEsterno && (
          <label className="pc-spunta-riga">
            <input type="checkbox" checked={senzaAddebito} onChange={(e) => setSenzaAddebito(e.target.checked)} />
            <span>Non addebitare il costo al socio</span>
          </label>
        )}

        <div className="admin-modal-btn-row">
          <button className="admin-modal-btn-cancel" onClick={chiudiTutto} disabled={elaborando}>Annulla</button>
          <button
            className="admin-modal-btn-confirm"
            onClick={confermaPrenotazione}
            disabled={elaborando || (modalitaEsterno ? !nomeEsterno.trim() : !socioScelto)}
          >
            {elaborando ? 'Attendere…' : 'Conferma'}
          </button>
        </div>
      </Modal>

      {/* Riserva orario */}
      <Modal visible={oreDaRiservare.length > 0} onClose={chiudiTutto}>
        <div className="admin-modal-title">Riserva orario</div>
        <p className="admin-modal-sub">
          {oreDaRiservare.length > 1
            ? `${oreDaRiservare[0]} - ${orarioFineSlot(oreDaRiservare[oreDaRiservare.length - 1])} (${oreDaRiservare.length * 0.5}h)`
            : oreDaRiservare[0] ? fasciaOraria(oreDaRiservare[0]) : ''}
        </p>
        <p className="admin-modal-sub">{campoSel?.nome} · {dataLeggibile}</p>

        <label className="admin-label">Etichetta</label>
        <input
          className="admin-input" value={etichettaRiserva}
          onChange={(e) => setEtichettaRiserva(e.target.value.slice(0, 14))}
          placeholder="Es. Scuola Tennis" maxLength={14}
        />
        <p className="admin-card-hint">
          Compare sotto &quot;Riservato&quot; nello slot — {14 - etichettaRiserva.length} caratteri rimasti
        </p>

        <label className="admin-label">Descrizione</label>
        <textarea
          className="admin-input" value={descrizioneRiserva}
          onChange={(e) => setDescrizioneRiserva(e.target.value)}
          placeholder="Di cosa si tratta, per chi tocca lo slot…" rows={3}
        />
        <p className="admin-card-hint">
          La vedranno soci, maestri e admin toccando lo slot riservato.
        </p>

        <div className="admin-modal-btn-row">
          <button className="admin-modal-btn-cancel" onClick={chiudiTutto} disabled={elaborando}>Annulla</button>
          <button
            className="admin-modal-btn-confirm"
            onClick={confermaRiserva}
            disabled={elaborando || !etichettaRiserva.trim()}
          >
            {elaborando ? 'Attendere…' : 'Riserva'}
          </button>
        </div>
      </Modal>

      <Modal visible={!!bloccoInfo} onClose={() => setBloccoInfo(null)}>
        <div className="admin-modal-title">Orario riservato</div>
        <div className="admin-modal-sub">
          {campi.find((c) => c.id === bloccoInfo?.campoId)?.nome} · {bloccoInfo?.orarioInizio} - {bloccoInfo?.orarioFine}
        </div>
        <p style={{ marginTop: '1rem', fontWeight: 700 }}>{bloccoInfo?.etichetta}</p>
        <button className="admin-modal-btn-cancel" onClick={() => setBloccoInfo(null)} style={{ marginTop: '1rem' }}>
          Chiudi
        </button>
      </Modal>

      <Modal visible={!!sfidaInfo} onClose={() => setSfidaInfo(null)}>
        <div className="admin-modal-title">Sfida in corso</div>
        <p className="admin-card-hint" style={{ textAlign: 'center' }}>
          {sfidaInfo?.sfidanteNome} {sfidaInfo?.sfidanteCognome} vs {sfidaInfo?.sfidatoNome} {sfidaInfo?.sfidatoCognome}
        </p>

        <div style={{ background: '#F7F4EA', borderRadius: 10, padding: '.8rem', marginTop: '.6rem' }}>
          <div className="admin-list-sub">
            Posizioni al lancio: {sfidaInfo?.sfidanteNome} #{sfidaInfo?.posizioneSfidante} · {sfidaInfo?.sfidatoNome} #{sfidaInfo?.posizioneSfidato}
          </div>
          {sfidaInfo?.fase === 'accettata' && sfidaInfo?.matchData && (
            <div className="admin-list-sub" style={{ fontWeight: 700, marginTop: '.3rem' }}>
              {sfidaInfo.matchDataLabel} · {sfidaInfo.matchCampoNome} · {sfidaInfo.matchOrari?.[0]}
            </div>
          )}
          {sfidaInfo?.risultatoSfidante && (
            <div className="admin-list-sub">
              {sfidaInfo.sfidanteNome}: {sfidaInfo.risultatoSfidante.esito} {sfidaInfo.risultatoSfidante.punteggio ? `(${sfidaInfo.risultatoSfidante.punteggio})` : ''}
            </div>
          )}
          {sfidaInfo?.risultatoSfidato && (
            <div className="admin-list-sub">
              {sfidaInfo.sfidatoNome}: {sfidaInfo.risultatoSfidato.esito} {sfidaInfo.risultatoSfidato.punteggio ? `(${sfidaInfo.risultatoSfidato.punteggio})` : ''}
            </div>
          )}
        </div>

        <p className="admin-card-hint" style={{ textAlign: 'center', marginTop: '.8rem' }}>
          Per annullarla, vai nella sezione &quot;Sfide in Corso&quot; e usa &quot;Annulla Sfida Corrente&quot;
          — da qui puoi solo consultarla.
        </p>
        <button className="admin-btn-full" style={{ marginTop: '1rem' }} onClick={() => setSfidaInfo(null)}>
          Ho capito
        </button>
      </Modal>

      <Modal visible={!!daAnnullare} onClose={() => setDaAnnullare(null)}>
        <div className="admin-modal-title" style={{ textTransform: 'none', fontSize: '1rem' }}>
          {daAnnullare ? intestazionePrenotazione(daAnnullare) : ''}
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
            <p className="mov-nota-bloccata">
              Le lezioni non si annullano dalla griglia, mezz&apos;ora per mezz&apos;ora: vai
              nella sezione &quot;Lezioni Prenotate&quot; e annullala per intero. Da lì si
              chiude anche la conversazione fra Maestro e allievo, che altrimenti resterebbe
              aperta su una lezione che non c&apos;è più.
            </p>
            <div className="admin-modal-btn-row">
              <button className="admin-modal-btn-cancel" onClick={() => setDaAnnullare(null)}>Chiudi</button>
            </div>
          </>
        ) : bloccataInMezzo ? (
          <>
            {/* Le informazioni restano tutte: sparisce solo il pulsante
                di cancellazione, sostituito dalla spiegazione. */}
            <p className="mov-nota-bloccata">
              Non puoi cancellare questa mezz&apos;ora: sta in mezzo alla prenotazione
              e resterebbero due spezzoni separati. Cancella dalle estremità — la
              prima o l&apos;ultima mezz&apos;ora.
            </p>
            <div className="admin-modal-btn-row">
              <button className="admin-modal-btn-cancel" onClick={() => setDaAnnullare(null)}>Chiudi</button>
            </div>
          </>
        ) : (
          <>
            <p className="admin-modal-sub" style={{ marginTop: '.8rem', fontWeight: 700 }}>
              Vuoi annullare questa prenotazione?
            </p>
            {/* Chi viene rimborsato e come: sta SOTTO la domanda perche'
                riguarda la conseguenza della cancellazione.
                ⚠️ Il ramo "e' una lezione" non c'e' piu': da qui le
                lezioni non passano proprio, le intercetta il blocco
                sopra. Tenerlo sarebbe stato codice irraggiungibile che
                racconta una possibilita' che non esiste. */}
            <p className="mov-nota-rimborso">
              {!daAnnullare?.utenteId || importoDaRimborsare(daAnnullare) === 0
                ? 'Non è previsto rimborso per questa cancellazione.'
                : daAnnullare && giocatoriDi(daAnnullare).length > 0
                  ? `Saranno rimborsati ${daAnnullare.utenteNome} ${daAnnullare.utenteCognome} (€ ${quotaChiPrenota(daAnnullare).toFixed(2)}) e ${elencoNomi(giocatoriDi(daAnnullare))}, ognuno per la sua quota.`
                  : `Il credito sarà rimborsato a ${daAnnullare?.utenteNome} ${daAnnullare?.utenteCognome}: € ${importoDaRimborsare(daAnnullare).toFixed(2)}.`}
            </p>
            {erroreAnnullo && <div className="admin-error-text">{erroreAnnullo}</div>}
            <div className="admin-modal-btn-row">
              <button className="admin-modal-btn-cancel" onClick={() => setDaAnnullare(null)}>Indietro</button>
              <button className="admin-modal-btn-confirm danger" onClick={confermaAnnulla} disabled={elaborando}>
                {elaborando ? 'Attendere…' : 'Cancella prenotazione'}
              </button>
            </div>
          </>
        )}
      </Modal>
    </div>
  );
}
