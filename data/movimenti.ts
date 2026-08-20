// ============================================================
// REGISTRO MOVIMENTI — la storia di ogni euro.
//
// Prima di questo modulo credito e debito erano due numeri
// sovrascritti a ogni operazione: se un socio contestava "avevo 30
// euro", non esisteva alcun modo di verificarlo, nemmeno per l'admin.
//
// Ogni movimento viene scritto NELLA STESSA TRANSAZIONE che modifica
// il saldo: o passano entrambi, o nessuno dei due. Se la scrittura
// del movimento fallisse dopo, si avrebbe un saldo cambiato senza
// traccia del perche' — proprio il caso che questo registro esiste
// per coprire.
//
// Il registro e' IMMUTABILE: le regole Firestore consentono solo la
// creazione. Un errore non si corregge cancellando, si rettifica con
// un nuovo movimento. Un registro modificabile non prova nulla.
// ============================================================

import {
  collection, doc, query, where, onSnapshot,
  setDoc, serverTimestamp, Transaction,
} from 'firebase/firestore';
import { auth, db } from '../lib/firebase';

export type TipoMovimento =
  | 'apertura'         // prima riga: saldo di partenza della tessera
  | 'ricarica'         // versamento in segreteria
  | 'addebito'         // prenotazione
  | 'rimborso'         // cancellazione
  | 'sos'              // il socio si autoricarica in emergenza
  | 'ripristino_sos'   // l'admin azzera il debito dopo il saldo
  | 'azzeramento'      // l'admin azzera il credito
  | 'saldo_chiusura';  // tessera chiusa e posizione regolata

// Chi ha materialmente eseguito l'operazione. Serve in caso di
// contestazione: il socio deve sapere a chi rivolgersi.
export type RuoloEsecutore = 'socio' | 'compagno' | 'admin' | 'maestro' | 'sistema';

export interface Movimento {
  id: string;
  circoloId: string;
  uid: string;                 // il socio a cui appartiene il portafoglio
  // Nome e ruolo duplicati qui apposta: il registro deve restare
  // leggibile anche se il socio cambia nome o esce dal circolo. Un
  // estratto conto che rimanda a un profilo cancellato non prova nulla.
  socioNome?: string;
  socioRuolo?: 'socio_tesserato' | 'ospite';
  tipo: TipoMovimento;
  importo: number;             // positivo = entra, negativo = esce
  saldoPrima: number;
  saldoDopo: number;
  debitoPrima: number;
  debitoDopo: number;
  eseguitoDaUid?: string | null;
  eseguitoDaNome?: string | null;
  eseguitoDaRuolo: RuoloEsecutore;
  prenotazioneId?: string | null;
  // Lega fra loro i movimenti nati dalla STESSA operazione: prenotando
  // un'ora e mezza si creano tre documenti (uno per mezz'ora) e quindi
  // tre movimenti, che senza questo codice sembrerebbero scollegati.
  // Il rimborso EREDITA il gruppo della prenotazione originale, cosi'
  // da una cancellazione parziale si risale alla prenotazione di
  // partenza.
  gruppoId?: string | null;
  // Identificativo della PRENOTAZIONE LOGICA a cui questo movimento si
  // riferisce — lo stesso che sta sul documento prenotazione. E' cio'
  // che permette al registro di riportare un rimborso sulla card
  // giusta: senza, la card veniva dedotta dalla sola contiguita' degli
  // orari, e un rimborso arrivato dopo che quella card era stata
  // chiusa finiva su quella aperta in quel momento — cioe' su
  // un'altra partita.
  cardId?: string | null;
  // Dati della prenotazione, scritti come campi strutturati invece
  // che dentro la descrizione: leggere una stringa sarebbe fragile e
  // si romperebbe al primo cambio di formulazione. Cosi' si possono
  // anche filtrare o ordinare in futuro.
  // Data in formato confrontabile e identificativo del campo: senza
  // questi due, raggruppare le card e capire se una prenotazione e'
  // conclusa richiederebbe di interpretare l'etichetta testuale
  // ("Giovedì 7 agosto"), cosa fragile e imprecisa.
  dataISO?: string | null;
  campoId?: string | null;
  // Nome del maestro, quando il movimento nasce da una lezione.
  // Alimenta i filtri dinamici del registro: cosi' un maestro che ha
  // smesso resta comunque cercabile finche' esistono sue lezioni.
  maestroNome?: string | null;
  // Con chi si condivide la prenotazione, e se questo portafoglio e'
  // di chi ha deciso o di chi e' stato invitato. Senza, la card
  // dovrebbe dedurlo dal testo della descrizione — fragile.
  compagnoNome?: string | null;
  sonoCompagno?: boolean;
  campoNome?: string | null;
  dataLabel?: string | null;
  orario?: string | null;
  orarioFine?: string | null;
  // Vero se la cancellazione ha riguardato solo una parte del blocco
  // prenotato: l'informazione non e' ricavabile a posteriori.
  parziale?: boolean;
  // Scelta esplicita dell'utente: pur essendo adiacente a una
  // prenotazione attiva, questa e' una partita distinta e non un
  // prolungamento. Senza, l'adiacenza le fonderebbe da sola.
  nuovaPrenotazione?: boolean;
  descrizione: string;
  quando?: { seconds: number };
}

export interface DatiMovimento {
  circoloId: string;
  uid: string;
  socioNome?: string | null;
  socioRuolo?: 'socio_tesserato' | 'ospite';
  tipo: TipoMovimento;
  importo: number;
  saldoPrima: number;
  saldoDopo: number;
  debitoPrima: number;
  debitoDopo: number;
  eseguitoDaUid?: string | null;
  eseguitoDaNome?: string | null;
  eseguitoDaRuolo: RuoloEsecutore;
  prenotazioneId?: string | null;
  gruppoId?: string | null;
  // Identificativo della PRENOTAZIONE LOGICA a cui questo movimento si
  // riferisce — lo stesso che sta sul documento prenotazione. E' cio'
  // che permette al registro di riportare un rimborso sulla card
  // giusta: senza, la card veniva dedotta dalla sola contiguita' degli
  // orari, e un rimborso arrivato dopo che quella card era stata
  // chiusa finiva su quella aperta in quel momento — cioe' su
  // un'altra partita.
  cardId?: string | null;
  // Dati della prenotazione, scritti come campi strutturati invece
  // che dentro la descrizione: leggere una stringa sarebbe fragile e
  // si romperebbe al primo cambio di formulazione. Cosi' si possono
  // anche filtrare o ordinare in futuro.
  // Data in formato confrontabile e identificativo del campo: senza
  // questi due, raggruppare le card e capire se una prenotazione e'
  // conclusa richiederebbe di interpretare l'etichetta testuale
  // ("Giovedì 7 agosto"), cosa fragile e imprecisa.
  dataISO?: string | null;
  campoId?: string | null;
  // Nome del maestro, quando il movimento nasce da una lezione.
  // Alimenta i filtri dinamici del registro: cosi' un maestro che ha
  // smesso resta comunque cercabile finche' esistono sue lezioni.
  maestroNome?: string | null;
  // Con chi si condivide la prenotazione, e se questo portafoglio e'
  // di chi ha deciso o di chi e' stato invitato. Senza, la card
  // dovrebbe dedurlo dal testo della descrizione — fragile.
  compagnoNome?: string | null;
  sonoCompagno?: boolean;
  campoNome?: string | null;
  dataLabel?: string | null;
  orario?: string | null;
  orarioFine?: string | null;
  // Vero se la cancellazione ha riguardato solo una parte del blocco
  // prenotato: l'informazione non e' ricavabile a posteriori.
  parziale?: boolean;
  // Scelta esplicita dell'utente: pur essendo adiacente a una
  // prenotazione attiva, questa e' una partita distinta e non un
  // prolungamento. Senza, l'adiacenza le fonderebbe da sola.
  nuovaPrenotazione?: boolean;
  descrizione: string;
}

// Da usare DENTRO una runTransaction gia' aperta, cosi' il movimento
// e il saldo vivono o cadono insieme.
// Codice per legare i movimenti di una stessa operazione. Si genera
// una volta sola, prima del ciclo che prenota le singole mezz'ore.
export function nuovoGruppoId(): string {
  return `g_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

// ⚠️ LA FIRMA LA METTE IL REGISTRO, NON CHI CHIAMA.
// `eseguitoDaUid` deve essere l'identificativo di chi ha
// materialmente premuto il tasto, e finora lo passava ogni singolo
// chiamante — con il risultato che era sbagliato in mezzo posto: una
// lezione prenotata dal Maestro risultava firmata dal SOCIO, una
// Sfida chiusa dallo Sfidato risultava firmata dallo Sfidante, e in
// un punto della Dashboard ci finiva perfino l'identificativo del
// circolo. Non se n'era accorto nessuno perche' nessuno lo legge: a
// schermo compaiono `eseguitoDaNome` e `eseguitoDaRuolo`.
//
// Adesso conta: le regole Firestore pretendono che la firma sia
// quella di chi scrive, ed e' cio' che impedisce di registrare una
// ricarica da 500 euro a nome di un operatore di segreteria vero. Con
// la firma presa da qui il vincolo e' soddisfatto per costruzione, e
// soprattutto il registro dice la verita'.
//
// ⚠️ Non e' "per conto di chi": quello resta il campo `uid`. Qui c'e'
// chi ha agito.
function firmaDiChiScrive(): string | null {
  return auth.currentUser?.uid ?? null;
}

export function registraMovimentoInTransazione(tx: Transaction, dati: DatiMovimento): void {
  const rif = doc(collection(db, 'movimenti'));
  tx.set(rif, {
    ...dati,
    socioNome: dati.socioNome ?? null,
    socioRuolo: dati.socioRuolo ?? 'socio_tesserato',
    eseguitoDaUid: firmaDiChiScrive(),
    eseguitoDaNome: dati.eseguitoDaNome ?? null,
    prenotazioneId: dati.prenotazioneId ?? null,
    gruppoId: dati.gruppoId ?? null,
    cardId: dati.cardId ?? null,
    dataISO: dati.dataISO ?? null,
    campoId: dati.campoId ?? null,
    maestroNome: dati.maestroNome ?? null,
    compagnoNome: dati.compagnoNome ?? null,
    sonoCompagno: !!dati.sonoCompagno,
    campoNome: dati.campoNome ?? null,
    dataLabel: dati.dataLabel ?? null,
    orario: dati.orario ?? null,
    orarioFine: dati.orarioFine ?? null,
    parziale: !!dati.parziale,
    nuovaPrenotazione: !!dati.nuovaPrenotazione,
    quando: serverTimestamp(),
  });
}

// Per chi NON ha un portafoglio (gli esterni): non c'e' alcun saldo
// da muovere, quindi non serve una transazione. Il movimento si
// registra comunque, perche' l'occupazione del campo va documentata
// anche quando non comporta denaro.
export async function registraMovimentoSemplice(dati: DatiMovimento): Promise<void> {
  try {
    await setDoc(doc(collection(db, 'movimenti')), {
      ...dati,
      socioNome: dati.socioNome ?? null,
      socioRuolo: dati.socioRuolo ?? 'socio_tesserato',
      eseguitoDaUid: firmaDiChiScrive(),
      eseguitoDaNome: dati.eseguitoDaNome ?? null,
      prenotazioneId: dati.prenotazioneId ?? null,
      gruppoId: dati.gruppoId ?? null,
      cardId: dati.cardId ?? null,
      maestroNome: dati.maestroNome ?? null,
    compagnoNome: dati.compagnoNome ?? null,
    sonoCompagno: !!dati.sonoCompagno,
      campoNome: dati.campoNome ?? null,
      dataISO: dati.dataISO ?? null,
      campoId: dati.campoId ?? null,
      dataLabel: dati.dataLabel ?? null,
      orario: dati.orario ?? null,
      orarioFine: dati.orarioFine ?? null,
      parziale: !!dati.parziale,
    nuovaPrenotazione: !!dati.nuovaPrenotazione,
      quando: serverTimestamp(),
    });
  } catch (e) {
    // Non deve mai impedire la prenotazione: un movimento mancante e'
    // meno grave di un campo che resta libero per errore.
    console.warn('Movimento non registrato:', e);
  }
}

function normalizza(id: string, v: Record<string, unknown>): Movimento {
  return {
    id,
    circoloId: (v.circoloId as string) ?? '',
    uid: (v.uid as string) ?? '',
    socioNome: (v.socioNome as string) ?? '',
    socioRuolo: (v.socioRuolo as 'socio_tesserato' | 'ospite') ?? 'socio_tesserato',
    tipo: (v.tipo as TipoMovimento) ?? 'addebito',
    importo: (v.importo as number) ?? 0,
    saldoPrima: (v.saldoPrima as number) ?? 0,
    saldoDopo: (v.saldoDopo as number) ?? 0,
    debitoPrima: (v.debitoPrima as number) ?? 0,
    debitoDopo: (v.debitoDopo as number) ?? 0,
    eseguitoDaUid: (v.eseguitoDaUid as string | null) ?? null,
    eseguitoDaNome: (v.eseguitoDaNome as string | null) ?? null,
    eseguitoDaRuolo: (v.eseguitoDaRuolo as RuoloEsecutore) ?? 'sistema',
    prenotazioneId: (v.prenotazioneId as string | null) ?? null,
    gruppoId: (v.gruppoId as string | null) ?? null,
    cardId: (v.cardId as string | null) ?? null,
    dataISO: (v.dataISO as string | null) ?? null,
    campoId: (v.campoId as string | null) ?? null,
    maestroNome: (v.maestroNome as string | null) ?? null,
    compagnoNome: (v.compagnoNome as string | null) ?? null,
    sonoCompagno: !!v.sonoCompagno,
    campoNome: (v.campoNome as string | null) ?? null,
    dataLabel: (v.dataLabel as string | null) ?? null,
    orario: (v.orario as string | null) ?? null,
    orarioFine: (v.orarioFine as string | null) ?? null,
    parziale: !!v.parziale,
    nuovaPrenotazione: !!v.nuovaPrenotazione,
    descrizione: (v.descrizione as string) ?? '',
    quando: v.quando as { seconds: number } | undefined,
  };
}

// I movimenti di UN socio presso UN circolo: alimenta sia la sezione
// in Home sia la scheda lato admin.
export function ascoltaMovimentiSocio(
  uid: string,
  circoloId: string,
  callback: (m: Movimento[]) => void,
  quanti = 20
) {
  const q = query(
    collection(db, 'movimenti'),
    where('uid', '==', uid),
    where('circoloId', '==', circoloId)
  );
  return onSnapshot(q, (snap) => {
    const elenco = snap.docs
      .map((d) => normalizza(d.id, d.data()))
      // Ordinamento in memoria: evita di dover creare un indice
      // composto su Firestore per una query cosi' piccola.
      .sort((a, b) => (b.quando?.seconds ?? 0) - (a.quando?.seconds ?? 0))
      .slice(0, quanti);
    callback(elenco);
  }, (e) => console.warn('Ascolto movimenti interrotto:', e?.message ?? e));
}

// Tutti i movimenti di un circolo, per la pagina di consultazione
// dell'admin. Il filtro per socio, periodo e tipo si applica poi in
// memoria: sono volumi che un circolo gestisce senza problemi.
export function ascoltaMovimentiCircolo(
  circoloId: string,
  callback: (m: Movimento[]) => void
) {
  const q = query(collection(db, 'movimenti'), where('circoloId', '==', circoloId));
  return onSnapshot(q, (snap) => {
    const elenco = snap.docs
      .map((d) => normalizza(d.id, d.data()))
      .sort((a, b) => (b.quando?.seconds ?? 0) - (a.quando?.seconds ?? 0));
    callback(elenco);
  }, (e) => console.warn('Ascolto movimenti circolo interrotto:', e?.message ?? e));
}

// Etichette leggibili, usate in tutte e tre le interfacce.
export const ETICHETTA_TIPO: Record<TipoMovimento, string> = {
  apertura: 'Apertura',
  ricarica: 'Ricarica',
  addebito: 'Addebito',
  rimborso: 'Rimborso',
  sos: 'Ricarica con il Fido',
  ripristino_sos: 'Ripristino del Fido',
  azzeramento: 'Azzeramento credito',
  saldo_chiusura: 'Saldo alla chiusura',
};

// Il rimborso ha due letture diverse: intero se copre tutta la
// prenotazione, parziale se ne riguarda solo una mezz'ora.
export function etichettaMovimento(m: Movimento): string {
  if (m.tipo === 'rimborso') {
    // Con importo zero (una lezione, o una prenotazione senza addebito)
    // non c'e' nulla da rimborsare: chiamarlo "rimborso" e mostrarlo in
    // verde con +0,00 e' fuorviante.
    if (m.importo === 0) return m.parziale ? 'Cancellata mezz\'ora' : 'Cancellata';
    return m.parziale ? 'Rimborso parziale' : 'Rimborso Intero';
  }
  return ETICHETTA_TIPO[m.tipo];
}

// Vero quando la cifra non va mostrata: un movimento a importo zero
// non racconta nulla, e in verde sembrerebbe un accredito.
export function importoDaMostrare(importo: number): boolean {
  return importo !== 0;
}

// Riga leggibile con campo, data e intervallo orario. Usata da tutte
// e tre le viste, cosi' la formulazione resta unica.
export function dettaglioPrenotazione(m: Movimento): string {
  const pezzi: string[] = [];
  if (m.campoNome) pezzi.push(m.campoNome);
  if (m.dataLabel) {
    const ore = m.orario
      ? `, ${m.orario}${m.orarioFine ? ` - ${m.orarioFine}` : ''}`
      : '';
    pezzi.push(`Prenotazione del ${m.dataLabel}${ore}`);
  }
  return pezzi.join(' · ');
}

// Il socio non deve vedere il nome dell'operatore di segreteria: per
// lui basta sapere che e' stato il circolo. Admin e Super Admin
// vedono invece nome e cognome, che servono in caso di contestazione.
export function esecutorePerSocio(m: Movimento): string {
  switch (m.eseguitoDaRuolo) {
    case 'admin': return 'Segreteria';
    case 'maestro': return 'Maestro';
    case 'compagno': return `${m.eseguitoDaNome ?? 'Compagno'} (compagno di gioco)`;
    case 'socio': return 'Tu';
    default: return 'Sistema';
  }
}

export function esecutorePerAdmin(m: Movimento): string {
  const nome = m.eseguitoDaNome ?? '—';
  switch (m.eseguitoDaRuolo) {
    case 'admin': return `${nome} (segreteria)`;
    case 'maestro': return `${nome} (maestro)`;
    case 'compagno': return `${nome} (compagno di gioco)`;
    case 'socio': return `${nome} (socio)`;
    // ⚠️ 'sistema' con un nome scritto lo mostra, e non e' un dettaglio:
    // le righe di apertura scritte dal server dopo un reset del circolo
    // sono firmate «Racket Fever», e finivano tutte sotto un anonimo
    // «Sistema» — cioe' il registro non diceva chi le aveva create.
    case 'sistema': return m.eseguitoDaNome ? `${m.eseguitoDaNome} (sistema)` : 'Sistema';
    default: return 'Sistema';
  }
}


// ============================================================
// VISTA CARD — raggruppa i movimenti in "prenotazioni".
//
// Una prenotazione non e' un'operazione singola: e' un blocco di
// tempo che puo' essere costruito in piu' momenti. Prenotando
// un'ora oggi e aggiungendo mezz'ora domani, per il socio resta
// UNA partita — e le card in Home lo mostrano gia' cosi'.
//
// Qui si applica lo stesso criterio ai movimenti: stesso socio,
// stesso campo, stessa data di GIOCO, orari contigui. Con una
// differenza necessaria: una mezz'ora cancellata non sparisce dalla
// card, perche' fa parte della storia da raccontare.
// ============================================================

// Un passo della storia: puo' raccogliere piu' movimenti nati dalla
// STESSA operazione. Prenotando tre mezz'ore insieme si generano tre
// movimenti con lo stesso istante di registrazione, e mostrarli come
// tre box separati sarebbe illeggibile — oltre che in ordine casuale,
// visto che condividono lo stesso orario.
export interface PassoStoria {
  chiave: string;
  movimenti: Movimento[];
  quandoSec: number;
  tipo: TipoMovimento;
  importo: number;
  saldoPrima: number;
  saldoDopo: number;
  orari: string[];
  // Intervallo della prenotazione COME RISULTA DOPO questo passo: e'
  // cio' che permette di seguire una partita che cambia orario nel
  // tempo (nata 17:00-18:30, diventata 19:00-20:30).
  intervalloDopo: { inizio: string; fine: string } | null;
  esecutore: Movimento;
}

export interface CardMovimenti {
  chiave: string;
  socioNome: string;
  socioRuolo: 'socio_tesserato' | 'ospite';
  campoNome: string;
  dataLabel: string;
  dataISO: string;
  orarioInizio: string;
  orarioFine: string;
  importoNetto: number;
  conclusa: boolean;
  // Vero quando ogni mezz'ora e' stata rimborsata: la prenotazione non
  // esiste piu', ma la sua storia resta.
  cancellata: boolean;
  movimenti: Movimento[];   // in ordine cronologico: e' la "storia"
  passi: PassoStoria[];     // la storia raggruppata per operazione
}

function fineDelloSlot(orario: string): string {
  const [h, m] = orario.split(':').map(Number);
  const tot = h * 60 + m + 30;
  return `${String(Math.floor(tot / 60)).padStart(2, '0')}:${String(tot % 60).padStart(2, '0')}`;
}

// Ricostruisce lo stato della prenotazione MOVIMENTO PER MOVIMENTO,
// cosi' ogni passo della storia sa com'era l'orario in quel momento.
//
// Una mezz'ora e' attiva se gli addebiti superano i rimborsi. Si
// contano le operazioni, non gli importi: una prenotazione gratuita
// ha importo zero ma e' comunque attiva.
function intervalloAttivo(attive: Set<string>): { inizio: string; fine: string } | null {
  if (attive.size === 0) return null;
  const ordinati = [...attive].sort();
  return { inizio: ordinati[0], fine: fineDelloSlot(ordinati[ordinati.length - 1]) };
}

export function raggruppaInCard(movimenti: Movimento[]): CardMovimenti[] {
  // Solo i movimenti legati a una prenotazione: ricariche, Fido e
  // azzeramenti non hanno un campo o un orario, quindi non possono
  // formare una card e restano fuori dalla Vista Card.
  const utili = movimenti.filter((m) => !!m.campoId && !!m.dataISO && !!m.orario);

  // Il cardId entra nella chiave: i movimenti di due partite diverse,
  // pur nello stesso giorno e sullo stesso campo, non si mescolano mai.
  //
  // Senza, la card veniva ricostruita dalla sola contiguita' degli
  // orari, e bastava l'ordine con cui erano state prenotate per
  // sbagliare: prenotato 19:00-20:30 con Antonio, poi 18:00-19:00 con
  // Alessandra, cancellando quella con Antonio i tre rimborsi
  // finivano sulla card di Alessandra — l'unica ancora aperta in quel
  // momento — mentre la card di Antonio restava intatta e non
  // risultava cancellata.
  //
  // I movimenti nati prima che il cardId esistesse hanno chiave vuota:
  // finiscono tutti insieme e continuano a essere ricostruiti col
  // criterio di prima, che per loro resta l'unico possibile.
  const perCard = new Map<string, Movimento[]>();
  utili.forEach((m) => {
    const k = `${m.uid}|${m.campoId}|${m.dataISO}|${m.cardId ?? ''}`;
    if (!perCard.has(k)) perCard.set(k, []);
    perCard.get(k)!.push(m);
  });

  const card: CardMovimenti[] = [];
  const adesso = Date.now();

  perCard.forEach((elenco, chiaveGiorno) => {
    // ORDINE CRONOLOGICO, non per orario: la vita di una prenotazione
    // si segue nel tempo. Una card si chiude quando gli slot attivi
    // tornano a zero, e la prenotazione successiva — anche sugli
    // stessi orari — ne apre una nuova con la propria storia.
    const cronologico = [...elenco].sort(
      (a, b) => (a.quando?.seconds ?? 0) - (b.quando?.seconds ?? 0)
    );

    let attive = new Set<string>();
    let passi: PassoStoria[] = [];
    let dentro: Movimento[] = [];
    let vissute = new Set<string>();   // tutti gli orari toccati da questa card

    const chiudiCard = () => {
      if (passi.length === 0) return;
      // ⚠️ UNA CARD SENZA NEMMENO UN ADDEBITO NON E' UNA CARD, e senza
      // questa riga faceva cadere l'INTERA pagina Movimenti del
      // circolo. `vissute` si riempie solo sugli addebiti: se in
      // memoria arriva un rimborso senza il suo addebito — un dato
      // vecchio, o una prenotazione cancellata mentre il registro
      // veniva svuotato — l'elenco resta vuoto, e due righe piu' sotto
      // si legge l'ultimo elemento di un array vuoto e gli si chiede
      // uno `split`. Il registro e' immutabile: una riga cosi' non si
      // puo' togliere, quindi la pagina sarebbe rimasta rotta per
      // sempre. Meglio non disegnare quella card.
      if (vissute.size === 0) {
        attive = new Set(); passi = []; dentro = []; vissute = new Set();
        return;
      }
      const rif = dentro[0];
      const finale = passi[passi.length - 1].intervalloDopo;
      const cancellata = finale === null;
      // Di una card cancellata si mostra l'intervallo COMPLETO che era
      // stato prenotato, non quello che restava un attimo prima
      // dell'ultimo rimborso. Cancellando tre mezz'ore una dopo
      // l'altra, l'ultimo passo non vuoto e' la sola mezz'ora rimasta:
      // leggere "20:00 - 20:30" su una prenotazione che era 19:00 -
      // 20:30 e' fuorviante. Non essendoci piu' nulla di attivo, la
      // domanda "fino a quando" non ha una risposta: si torna a
      // raccontare cosa era stato prenotato.
      const mostrato = cancellata ? null : finale;
      const scadenza = mostrato
        ? new Date(`${rif.dataISO}T${mostrato.fine}:00`).getTime()
        : NaN;
      const ordinateVissute = [...vissute].sort();

      card.push({
        // La chiave include l'istante del primo movimento: due
        // prenotazioni distinte sugli stessi orari devono avere
        // identificativi diversi, altrimenti la vista le confonde.
        chiave: `${chiaveGiorno}|${ordinateVissute[0]}|${rif.quando?.seconds ?? 0}`,
        socioNome: rif.socioNome ?? '',
        socioRuolo: rif.socioRuolo ?? 'socio_tesserato',
        campoNome: rif.campoNome ?? '',
        dataLabel: rif.dataLabel ?? '',
        dataISO: rif.dataISO ?? '',
        orarioInizio: mostrato?.inizio ?? ordinateVissute[0],
        orarioFine: mostrato?.fine ?? fineDelloSlot(ordinateVissute[ordinateVissute.length - 1]),
        importoNetto: dentro.reduce((t, m) => t + m.importo, 0),
        conclusa: !cancellata && Number.isFinite(scadenza) ? adesso >= scadenza : false,
        cancellata,
        movimenti: dentro,
        passi,
      });

      attive = new Set();
      passi = [];
      dentro = [];
      vissute = new Set();
    };

    // Vero se l'orario tocca il blocco attivo: dentro, subito prima o
    // subito dopo. Serve a capire se un addebito PROLUNGA la card in
    // corso o ne inaugura una nuova.
    const attaccaAlBlocco = (ora: string): boolean => {
      if (attive.size === 0) return false;
      if (attive.has(ora)) return true;
      const ordinati = [...attive].sort();
      const primo = ordinati[0];
      const dopoUltimo = fineDelloSlot(ordinati[ordinati.length - 1]);
      return fineDelloSlot(ora) === primo || ora === dopoUltimo;
    };

    cronologico.forEach((m) => {
      if (m.tipo === 'addebito' && passi.length > 0) {
        // Si apre una card nuova in due casi:
        //  - non resta nulla di attivo: la precedente e' conclusa;
        //  - l'orario e' staccato dal blocco attivo: e' un'altra
        //    partita, non un prolungamento;
        //  - l'utente ha scelto esplicitamente "prenotazione nuova"
        //    pur essendo adiacente.
        if (attive.size === 0 || !attaccaAlBlocco(m.orario!) || m.nuovaPrenotazione) chiudiCard();
      }

      if (m.tipo === 'addebito') { attive.add(m.orario!); vissute.add(m.orario!); }
      else if (m.tipo === 'rimborso') attive.delete(m.orario!);

      dentro.push(m);

      const sec = m.quando?.seconds ?? 0;
      const ultimo = passi[passi.length - 1];
      const stessaOperazione = ultimo
        && ultimo.tipo === m.tipo
        && Math.abs(ultimo.quandoSec - sec) <= 5
        && (m.gruppoId ? ultimo.movimenti[0].gruppoId === m.gruppoId : true);

      if (stessaOperazione) {
        ultimo.movimenti.push(m);
        ultimo.importo += m.importo;
        ultimo.saldoDopo = m.saldoDopo;
        ultimo.orari.push(m.orario!);
        ultimo.intervalloDopo = intervalloAttivo(attive);
      } else {
        passi.push({
          chiave: m.id,
          movimenti: [m],
          quandoSec: sec,
          tipo: m.tipo,
          importo: m.importo,
          saldoPrima: m.saldoPrima,
          saldoDopo: m.saldoDopo,
          orari: [m.orario!],
          intervalloDopo: intervalloAttivo(attive),
          esecutore: m,
        });
      }
    });

    chiudiCard();
  });

  return card.sort((a, b) => {
    const qa = a.movimenti[a.movimenti.length - 1]?.quando?.seconds ?? 0;
    const qb = b.movimenti[b.movimenti.length - 1]?.quando?.seconds ?? 0;
    return qb - qa;
  });
}

// Descrizione di un passo della storia. Il passo puo' raccogliere piu'
// mezz'ore prenotate insieme, quindi il testo lo dice al plurale.
export function testoPasso(p: PassoStoria): string {
  const ordinati = [...p.orari].sort();
  const da = ordinati[0];
  const a = fineDelloSlot(ordinati[ordinati.length - 1]);
  const quante = p.orari.length;

  if (p.tipo === 'addebito') {
    return quante === 1
      ? `Prenotata la mezz'ora ${da} - ${a}`
      : `Prenotate ${quante} mezz'ore, dalle ${da} alle ${a}`;
  }
  if (p.tipo === 'rimborso') {
    return quante === 1
      ? `Cancellata la mezz'ora ${da} - ${a}`
      : `Cancellate ${quante} mezz'ore, dalle ${da} alle ${a}`;
  }
  return p.movimenti[0].descrizione;
}

// Riga in fondo a ogni box: com'era la prenotazione DOPO quel passo.
// L'ultimo box coincide sempre con l'orario mostrato nella card.
export function intervalloDelPasso(p: PassoStoria): string {
  if (!p.intervalloDopo) return 'Prenotazione cancellata';
  return `Prenotazione dalle ${p.intervalloDopo.inizio} alle ${p.intervalloDopo.fine}`;
}

// ⚠️ IL SERVER ADESSO SA COSE CHE IL TELEFONO NON SA — quanto Fido
// resta davvero, se il termine di disdetta e' passato, se il circolo
// e' sospeso — e le dice in italiano. Ingoiarle tutte dentro un
// "Riprova" generico vuol dire lasciare l'utente a riprovare
// all'infinito una cosa che non riuscira' mai.
export function messaggioDalServer(e: any, ripiego: string): string {
  const codice = String(e?.code ?? '');
  const testo = String(e?.message ?? '').trim();
  const utile = codice.includes('failed-precondition')
    || codice.includes('invalid-argument')
    || codice.includes('permission-denied')
    || codice.includes('not-found');
  if (utile && testo && !testo.toLowerCase().startsWith('internal')) return testo;
  return ripiego;
}
