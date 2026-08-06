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
  collection, doc, query, where, onSnapshot, getDocs,
  setDoc, serverTimestamp, Transaction,
} from 'firebase/firestore';
import { db } from '../lib/firebase';

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
  campoNome?: string | null;
  dataLabel?: string | null;
  orario?: string | null;
  orarioFine?: string | null;
  // Vero se la cancellazione ha riguardato solo una parte del blocco
  // prenotato: l'informazione non e' ricavabile a posteriori.
  parziale?: boolean;
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
  campoNome?: string | null;
  dataLabel?: string | null;
  orario?: string | null;
  orarioFine?: string | null;
  // Vero se la cancellazione ha riguardato solo una parte del blocco
  // prenotato: l'informazione non e' ricavabile a posteriori.
  parziale?: boolean;
  descrizione: string;
}

// Da usare DENTRO una runTransaction gia' aperta, cosi' il movimento
// e il saldo vivono o cadono insieme.
// Codice per legare i movimenti di una stessa operazione. Si genera
// una volta sola, prima del ciclo che prenota le singole mezz'ore.
export function nuovoGruppoId(): string {
  return `g_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function registraMovimentoInTransazione(tx: Transaction, dati: DatiMovimento): void {
  const rif = doc(collection(db, 'movimenti'));
  tx.set(rif, {
    ...dati,
    socioNome: dati.socioNome ?? null,
    socioRuolo: dati.socioRuolo ?? 'socio_tesserato',
    eseguitoDaUid: dati.eseguitoDaUid ?? null,
    eseguitoDaNome: dati.eseguitoDaNome ?? null,
    prenotazioneId: dati.prenotazioneId ?? null,
    gruppoId: dati.gruppoId ?? null,
    dataISO: dati.dataISO ?? null,
    campoId: dati.campoId ?? null,
    campoNome: dati.campoNome ?? null,
    dataLabel: dati.dataLabel ?? null,
    orario: dati.orario ?? null,
    orarioFine: dati.orarioFine ?? null,
    parziale: !!dati.parziale,
    quando: serverTimestamp(),
  });
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
    dataISO: (v.dataISO as string | null) ?? null,
    campoId: (v.campoId as string | null) ?? null,
    campoNome: (v.campoNome as string | null) ?? null,
    dataLabel: (v.dataLabel as string | null) ?? null,
    orario: (v.orario as string | null) ?? null,
    orarioFine: (v.orarioFine as string | null) ?? null,
    parziale: !!v.parziale,
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
  sos: 'Ricarica S.O.S.',
  ripristino_sos: 'Ripristino S.O.S.',
  azzeramento: 'Azzeramento credito',
  saldo_chiusura: 'Saldo alla chiusura',
};

// Il rimborso ha due letture diverse: intero se copre tutta la
// prenotazione, parziale se ne riguarda solo una mezz'ora.
export function etichettaMovimento(m: Movimento): string {
  if (m.tipo === 'rimborso') return m.parziale ? 'Rimborso parziale' : 'Rimborso Intero';
  return ETICHETTA_TIPO[m.tipo];
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
    default: return 'Sistema';
  }
}

// Saldo di apertura per tutte le tessere di un circolo: si esegue una
// sola volta, dopo il reset, cosi' la catena saldoPrima → saldoDopo
// parte da una riga esplicita invece che da un buco.
export async function creaAperturePerCircolo(circoloId: string): Promise<number> {
  const q = query(collection(db, 'tessere'), where('circoloId', '==', circoloId));
  const snap = await getDocs(q);
  let create = 0;
  for (const d of snap.docs) {
    const v = d.data();
    const credito = (v.credito as number) ?? 0;
    const debito = (v.sosUtilizzato as number) ?? 0;
    try {
      const rif = doc(collection(db, 'movimenti'));
      await setDoc(rif, {
        circoloId,
        uid: v.uid,
        socioNome: `${v.nome ?? ''} ${v.cognome ?? ''}`.trim(),
        socioRuolo: v.ruolo ?? 'socio_tesserato',
        tipo: 'apertura',
        importo: 0,
        saldoPrima: credito,
        saldoDopo: credito,
        debitoPrima: debito,
        debitoDopo: debito,
        eseguitoDaUid: null,
        eseguitoDaNome: null,
        eseguitoDaRuolo: 'sistema',
        prenotazioneId: null,
        descrizione: 'Apertura del registro movimenti',
        quando: serverTimestamp(),
      });
      create++;
    } catch (e) {
      console.warn('Apertura non creata per la tessera:', d.id, e);
    }
  }
  return create;
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
  movimenti: Movimento[];   // in ordine cronologico: e' la "storia"
}

function fineDelloSlot(orario: string): string {
  const [h, m] = orario.split(':').map(Number);
  const tot = h * 60 + m + 30;
  return `${String(Math.floor(tot / 60)).padStart(2, '0')}:${String(tot % 60).padStart(2, '0')}`;
}

export function raggruppaInCard(movimenti: Movimento[]): CardMovimenti[] {
  // Solo i movimenti legati a una prenotazione: ricariche, S.O.S. e
  // azzeramenti non hanno un campo o un orario, quindi non possono
  // formare una card e restano fuori dalla Vista Card.
  const utili = movimenti.filter((m) => !!m.campoId && !!m.dataISO && !!m.orario);

  // Prima si raccolgono per socio + campo + giorno, poi dentro ogni
  // gruppo si spezza dove gli orari non sono contigui.
  const perGiorno = new Map<string, Movimento[]>();
  utili.forEach((m) => {
    const k = `${m.uid}|${m.campoId}|${m.dataISO}`;
    if (!perGiorno.has(k)) perGiorno.set(k, []);
    perGiorno.get(k)!.push(m);
  });

  const card: CardMovimenti[] = [];
  const adesso = Date.now();

  perGiorno.forEach((elenco, chiaveGiorno) => {
    // Orari distinti coinvolti, in ordine: e' su questi che si valuta
    // la contiguita', non sui singoli movimenti (un orario puo' avere
    // sia un addebito sia un rimborso).
    const orari = [...new Set(elenco.map((m) => m.orario!))].sort();

    let blocco: string[] = [];
    const chiudiBlocco = () => {
      if (blocco.length === 0) return;
      const primo = blocco[0];
      const ultimo = blocco[blocco.length - 1];
      const dentro = elenco
        .filter((m) => blocco.includes(m.orario!))
        .sort((a, b) => (a.quando?.seconds ?? 0) - (b.quando?.seconds ?? 0));
      const rif = dentro[0];
      const fine = fineDelloSlot(ultimo);
      const scadenza = new Date(`${rif.dataISO}T${fine}:00`).getTime();

      card.push({
        chiave: `${chiaveGiorno}|${primo}`,
        socioNome: rif.socioNome ?? '',
        socioRuolo: rif.socioRuolo ?? 'socio_tesserato',
        campoNome: rif.campoNome ?? '',
        dataLabel: rif.dataLabel ?? '',
        dataISO: rif.dataISO ?? '',
        orarioInizio: primo,
        orarioFine: fine,
        importoNetto: dentro.reduce((t, m) => t + m.importo, 0),
        conclusa: Number.isFinite(scadenza) ? adesso >= scadenza : false,
        movimenti: dentro,
      });
      blocco = [];
    };

    orari.forEach((o, i) => {
      if (i > 0 && fineDelloSlot(orari[i - 1]) !== o) chiudiBlocco();
      blocco.push(o);
    });
    chiudiBlocco();
  });

  // Le card piu' recenti in cima, come nell'elenco completo.
  return card.sort((a, b) => {
    const qa = a.movimenti[a.movimenti.length - 1]?.quando?.seconds ?? 0;
    const qb = b.movimenti[b.movimenti.length - 1]?.quando?.seconds ?? 0;
    return qb - qa;
  });
}

// Riga della cronologia nel pop-up: descrive cosa e' successo in
// quell'istante, con parole diverse da quelle del registro completo
// perche' qui il contesto (campo, data) e' gia' nella testata.
export function passoStoria(m: Movimento): string {
  const fine = m.orario ? fineDelloSlot(m.orario) : '';
  switch (m.tipo) {
    case 'addebito':
      return `Prenotata la mezz'ora ${m.orario} - ${fine}`;
    case 'rimborso':
      return m.parziale
        ? `Cancellata la mezz'ora ${m.orario} - ${fine}`
        : `Cancellata l'intera prenotazione (${m.orario} - ${fine})`;
    default:
      return m.descrizione;
  }
}
