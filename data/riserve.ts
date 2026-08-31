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

export type StatoRiserva = 'aperta' | 'estinta';

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
    stato: d?.stato === 'estinta' ? 'estinta' : 'aperta',
    liberataIlMs: Number(d?.liberataIlMs ?? 0),
    scadeIlMs: Number(d?.scadeIlMs ?? 0),
    estintaIlMs: d?.estintaIlMs,
    estintaDa: d?.estintaDa ?? null,
    estintaDaNome: d?.estintaDaNome ?? null,
  };
}

// ⚠️ UNA RISERVA È SCADUTA QUANDO L'ORA È COMINCIATA, e lo si calcola
// invece di scriverlo. Nessun lavoro notturno la chiude: non serve,
// perché il denaro non si muove alla scadenza — è già stato preso alla
// prenotazione, e «resta addebitato» vuol dire soltanto «non si
// rimborsa». Un giro notturno che passasse a marcarle sarebbe lavoro
// per non cambiare niente, con l'unico effetto di poter saltare.
export function riservaScaduta(r: Riserva, adessoMs: number = Date.now()): boolean {
  return r.scadeIlMs > 0 && adessoMs > r.scadeIlMs;
}

// Ancora prendibile da un altro socio: aperta e dentro il termine.
export function riservaViva(r: Riserva, adessoMs: number = Date.now()): boolean {
  return r.stato === 'aperta' && !riservaScaduta(r, adessoMs);
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
