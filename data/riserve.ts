// ============================================================
// LE ORE LIBERATE CON RISERVA.
//
// Un socio che disdice OLTRE il termine non può più cancellare
// normalmente: quello che può fare è liberare l'ora tenendosi
// l'addebito. L'ora torna disponibile a tutti; se qualcun altro la
// prende, l'addebito sparisce e il credito rientra. Se non la prende
// nessuno, resta addebitata — è la penale per il ritardo.
//
// ⚠️ QUESTO FILE NON SCRIVE NIENTE, E NON PUÒ. I documenti `riserve`
// nascono da `annullaPrenotazione` e muoiono da `estinguiRiserva`, tutte
// e due Cloud Functions, e le regole vietano la scrittura a ogni client.
// Il motivo è che quel documento decide chi si riprende dei soldi:
// potendolo creare da un telefono ci si regalerebbe il rimborso di
// un'ora mai prenotata, potendolo aggiornare si riaprirebbe una riserva
// già estinta per farsi rimborsare due volte.
//
// ⚠️ FILE GEMELLO IN DUE COPIE IDENTICHE:
//   · racket-fever/data/riserve.ts      (app)
//   · racket-fever-web/data/riserve.ts  (sito e dashboard)
// Se si tocca una riga in una, si tocca anche nell'altra.
// ============================================================

import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../lib/firebase';

// ⚠️ TRE STATI, E IL TERZO È NUOVO (2 settembre 2026). Prima erano
// due, e una riserva che nessuno riprendeva restava «aperta» PER
// SEMPRE: il documento non si chiudeva mai, la card in Home spariva
// solo perché il telefono la nascondeva al momento di disegnare, e la
// collezione cresceva senza fine. `scaduta` la scrive
// `riconciliaRiserve` sul server quando il termine passa senza che
// nessuno abbia ripreso l'ora.
export type StatoRiserva = 'aperta' | 'estinta' | 'scaduta';

export interface BeneficiarioRiserva {
  uid: string;
  nome: string | null;
  // Quanto torna a QUESTA persona il giorno che l'ora viene ripresa.
  // ⚠️ Sono le quote vere della prenotazione originale, non il totale
  // diviso per il numero di teste: dopo un cambio giocatore possono
  // essere diseguali, e ognuno deve riavere esattamente quello che
  // aveva pagato.
  quota: number;
}

export interface Riserva {
  id: string;
  circoloId: string;
  campoId: string | null;
  campoNome: string | null;
  data: string | null;        // 'YYYY-MM-DD'
  dataLabel: string | null;
  orario: string | null;      // 'HH:MM'
  orarioFine: string | null;
  gruppoId: string | null;
  cardId: string | null;
  prezzo: number;
  // Chi ha premuto «Cancella con Riserva». È l'unico che vede la card
  // «Cancellata con Riserva», ed è l'unico che NON riceve la notifica
  // dell'ora liberata: l'ha liberata lui.
  liberataDa: string;
  utenteId: string | null;
  utenteNome: string | null;
  beneficiari: BeneficiarioRiserva[];
  stato: StatoRiserva;
  liberataIlMs: number;
  // ⚠️ Cinque minuti prima dell'inizio, deciso da Giorgio: oltre quel
  // momento la mezz'ora non è più rivendibile davvero, e prenderla
  // servirebbe solo a cancellare la penale di qualcun altro.
  scadeIlMs: number;
  estintaIlMs?: number;
  // L'istante in cui la riserva si è chiusa, comunque si sia chiusa:
  // ripresa da qualcuno o scaduta. Lo scrive il server, e il
  // riconciliatore lo usa per la pulizia.
  chiusaIlMs?: number;
  estintaDa?: string | null;
  estintaDaNome?: string | null;
}

function daDocumento(id: string, d: any): Riserva {
  return {
    id,
    circoloId: String(d?.circoloId ?? ''),
    campoId: d?.campoId ?? null,
    campoNome: d?.campoNome ?? null,
    data: d?.data ?? null,
    dataLabel: d?.dataLabel ?? null,
    orario: d?.orario ?? null,
    orarioFine: d?.orarioFine ?? null,
    gruppoId: d?.gruppoId ?? null,
    cardId: d?.cardId ?? null,
    prezzo: Number(d?.prezzo ?? 0),
    liberataDa: String(d?.liberataDa ?? ''),
    utenteId: d?.utenteId ?? null,
    utenteNome: d?.utenteNome ?? null,
    beneficiari: Array.isArray(d?.beneficiari) ? d.beneficiari : [],
    stato: d?.stato === 'estinta' ? 'estinta'
      : d?.stato === 'scaduta' ? 'scaduta'
        : 'aperta',
    liberataIlMs: Number(d?.liberataIlMs ?? 0),
    scadeIlMs: Number(d?.scadeIlMs ?? 0),
    estintaIlMs: d?.estintaIlMs,
    chiusaIlMs: d?.chiusaIlMs,
    estintaDa: d?.estintaDa ?? null,
    estintaDaNome: d?.estintaDaNome ?? null,
  };
}

// ⚠️ SCADUTA SI CALCOLA E SI SCRIVE, TUTTE E DUE. Sul server
// `riconciliaRiserve` marca `stato: 'scaduta'` entro un minuto dal
// termine; qui lo si calcola comunque dall'orario, perché fra il
// termine e il passaggio del riconciliatore c'è un minuto in cui il
// documento dice ancora «aperta» e la verità è un'altra. Chi legge
// deve vedere subito il fatto giusto, e chi scrive deve lasciarne
// traccia: le due cose non si escludono.
export function riservaScaduta(r: Riserva, adessoMs: number = Date.now()): boolean {
  return r.scadeIlMs > 0 && adessoMs > r.scadeIlMs;
}

// ============================================================
// COM'È FINITA, IN UNA PAROLA SOLA.
//
// ⚠️ SERVE PERCHÉ UNA CARD NON DEVE SPARIRE IN SILENZIO. Prima la Home
// mostrava solo le riserve vive: passato il termine la card svaniva
// senza dire niente, e chi aveva liberato l'ora restava con l'addebito
// e nessuna spiegazione. Adesso la card resta e cambia frase: «nessuno
// l'ha ripresa, l'addebito resta». È un fatto concluso, non una
// promessa appesa.
//
// `estinta` invece non si mostra: il credito è tornato e la partita non
// esiste più: una card che dice «tutto a posto» è rumore.
// ============================================================
export type EsitoRiserva = 'viva' | 'scaduta' | 'estinta';

export function esitoRiserva(r: Riserva, adessoMs: number = Date.now()): EsitoRiserva {
  if (r.stato === 'estinta') return 'estinta';
  if (r.stato === 'scaduta' || riservaScaduta(r, adessoMs)) return 'scaduta';
  return 'viva';
}

// ============================================================
// UNA PARTITA, UNA CARD.
//
// ⚠️ ESISTE PERCHÉ IN HOME NE COMPARIVANO DUE. Ogni mezz'ora liberata è
// un documento suo — ed è giusto così, è quello che permette a due metà
// di estinguersi in modo indipendente — ma quello che l'utente vede non
// è la mezz'ora: è la partita. Disegnando una card per documento,
// un'ora liberata produceva due riquadri arancioni identici uno sopra
// l'altro.
//
// È la stessa regola per cui i promemoria raggruppano le mezz'ore in
// blocchi, per cui la Home usa `raggruppaConsecutive` e per cui esiste
// `cardId`. Qui si raggruppa allo stesso modo: per `cardId` quando c'è,
// altrimenti per `gruppoId`, e come ultimo ripiego per campo e giorno.
//
// ⚠️ IL RIPIEGO NON SCENDE MAI FINO ALL'ORARIO. Era il difetto del
// lucchetto lato server: una chiave che cade sull'orario diventa
// diversa per ogni mezz'ora, cioè non raggruppa più niente proprio nel
// caso in cui serve.
// ============================================================
export interface PartitaLiberata {
  chiave: string;
  campoNome: string | null;
  dataLabel: string | null;
  // Il primo orario e la fine dell'ultima mezz'ora: l'intervallo intero.
  oraInizio: string | null;
  oraFine: string | null;
  mezzore: number;
  riserve: Riserva[];
}

export function raggruppaRiserve(lista: Riserva[]): PartitaLiberata[] {
  const per = new Map<string, Riserva[]>();
  for (const r of lista) {
    const chiave = r.cardId || r.gruppoId || `${r.campoId ?? '-'}|${r.data ?? '-'}`;
    const gia = per.get(chiave);
    if (gia) gia.push(r); else per.set(chiave, [r]);
  }
  const partite: PartitaLiberata[] = [];
  per.forEach((riserveDelGruppo, chiave) => {
    const ordinate = [...riserveDelGruppo].sort(
      (a, b) => (a.orario ?? '').localeCompare(b.orario ?? ''),
    );
    const primo = ordinate[0];
    const ultimo = ordinate[ordinate.length - 1];
    partite.push({
      chiave,
      campoNome: primo.campoNome,
      dataLabel: primo.dataLabel,
      oraInizio: primo.orario,
      // `orarioFine` lo scrive il server sulla riserva: qui non si
      // ricalcola, o due punti del progetto direbbero la stessa cosa in
      // due modi che prima o poi divergono.
      oraFine: ultimo.orarioFine,
      mezzore: ordinate.length,
      riserve: ordinate,
    });
  });
  // Le più recenti in cima, come già faceva l'elenco piatto.
  partite.sort((a, b) => (b.riserve[0]?.liberataIlMs ?? 0) - (a.riserve[0]?.liberataIlMs ?? 0));
  return partite;
}

// ============================================================
// LE MIE RISERVE — quelle che mi hanno lasciato un addebito aperto.
//
// ⚠️ SI FILTRA SU `liberataDa` E NON SU `beneficiari`. Firestore non sa
// interrogare dentro un array di oggetti, e chi deve vedere la card è
// comunque uno solo: quello che ha premuto il pulsante. I compagni di
// una partita divisa il rimborso lo ricevono lo stesso — lo decide il
// server, non questa schermata — ma la card «Cancellata con Riserva» è
// di chi ha disdetto.
// ============================================================
export function ascoltaMieRiserve(
  uid: string,
  circoloId: string,
  quando: (lista: Riserva[]) => void,
): () => void {
  if (!uid || !circoloId) { quando([]); return () => {}; }
  const q = query(
    collection(db, 'riserve'),
    where('circoloId', '==', circoloId),
    where('liberataDa', '==', uid),
  );
  return onSnapshot(
    q,
    (istantanea) => {
      const lista = istantanea.docs.map((d) => daDocumento(d.id, d.data()));
      // Le più recenti in cima. L'ordinamento sta qui e non nella query
      // perché un `orderBy` su un campo diverso da quelli filtrati
      // pretenderebbe un indice composito, e la lista è di pochi
      // elementi: ordinarla sul telefono costa niente.
      lista.sort((a, b) => b.liberataIlMs - a.liberataIlMs);
      quando(lista);
    },
    // ⚠️ In caso di errore si risponde con l'elenco vuoto e non si
    // lascia la schermata in attesa per sempre: una card in meno è un
    // fastidio, una schermata che non finisce mai di caricare è un
    // guasto.
    () => quando([]),
  );
}
