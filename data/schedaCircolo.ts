// ============================================================
// SCHEDA CIRCOLO — i numeri che dicono come sta un circolo.
//
// È la pagina che deve bastare a chi il circolo non lo conosce: un
// impiegato nuovo lo apre e in dieci minuti capisce se è vivo, quante
// persone ci sono dentro e quanti soldi ci girano.
//
// ⚠️ I NUMERI ARRIVANO DA DUE POSTI, E LA DIFFERENZA CONTA.
//
// Dal VIVO: persone e denaro in giacenza. Escono dalle tessere del
// circolo — una query limitata dal numero di soci, quindi economica — e
// sono esatti all'istante. Il credito di un socio non può mostrarsi
// vecchio di un giorno: è denaro versato in segreteria stamattina.
//
// Da una FOTOGRAFIA: attività e registro degli ultimi trenta giorni.
// Sono conti su prenotazioni e movimenti, e nessuna delle due
// collezioni viene mai potata: le prenotazioni passate restano, il
// registro è immutabile per costruzione. Contarli qui voleva dire
// leggere decine di migliaia di documenti a ogni apertura della scheda,
// anche solo per correggere una sigla — e crescere ogni anno. Adesso li
// conta una volta al giorno il server (functions/src/scheda.ts) e qui
// si legge un documento solo.
//
// ⚠️ QUINDI LA SCHEDA DEVE DIRE A QUANDO RISALE. Un numero fermo a
// stanotte va benissimo per "quante prenotazioni ha fatto questo
// circolo"; diventa una bugia se chi legge lo crede di adesso. La data
// dello scatto sta a schermo, e c'è un tasto per rifarlo subito.
//
// ⚠️ E NON SI PUÒ RISOLVERE TAGLIANDO LA QUERY: un elenco accorciato
// darebbe totali sbagliati con l'aria di essere giusti, che è il
// difetto peggiore di tutti. O si legge tutto, o si legge una
// fotografia — non una via di mezzo.
// ============================================================

import { doc, onSnapshot } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../lib/firebase';
import { Tessera, StatoTessera } from './tessere';

// ============================================================
// LA FOTOGRAFIA
// ============================================================

// ⚠️ Deve restare uguale a GIORNI_FINESTRA in
// functions/src/scheda.ts, che e' chi la applica davvero. Sta qui
// perche' le schermate scrivevano "30 giorni" a mano in tre punti: il
// giorno in cui la finestra cambiasse, il server conterebbe un periodo
// e l'interfaccia ne annuncerebbe un altro.
export const GIORNI_FINESTRA = 30;

export interface Conteggio { etichetta: string; quante: number }

export interface AttivitaFoto {
  prenotazioni: number;
  prenotazioni30: number;
  oreGiocate: number;
  ultimaPrenotazioneMs: number | null;
  senzaDataDiCreazione: number;
  campiPiuUsati: Conteggio[];
  fascePunta: Conteggio[];
}

export interface RegistroFoto {
  ricariche30: number;
  addebiti30: number;
  movimenti30: number;
}

export interface VoceSocioFoto {
  prenotazioni: number;
  ultimaPrenotazioneMs: number | null;
}

export interface Fotografia {
  circoloId: string;
  giorno: string;
  scattataIlMs: number;
  attivita: AttivitaFoto;
  registro: RegistroFoto;
  perSocio: Record<string, VoceSocioFoto>;
  // ⚠️ Il conteggio dei documenti letti resta SCRITTO nella fotografia
  // (serve ai log, ed e' il numero che dira' quando il lavoro notturno
  // va spezzato) ma NON arriva fin qui: nessuna schermata lo mostra, e
  // un campo che nessuno legge e' peso che viaggia a ogni lettura.
}

export const ATTIVITA_SENZA_FOTO: AttivitaFoto = {
  prenotazioni: 0, prenotazioni30: 0, oreGiocate: 0,
  ultimaPrenotazioneMs: null, senzaDataDiCreazione: 0,
  campiPiuUsati: [], fascePunta: [],
};

export const REGISTRO_SENZA_FOTO: RegistroFoto = {
  ricariche30: 0, addebiti30: 0, movimenti30: 0,
};

function conteggi(v: unknown): Conteggio[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((x) => x && typeof x.etichetta === 'string' && typeof x.quante === 'number')
    .map((x) => ({ etichetta: x.etichetta as string, quante: x.quante as number }));
}

// ⚠️ La fotografia si legge con un ascolto e non con una lettura secca:
// premendo "Aggiorna adesso" il documento viene riscritto dal server, e
// senza ascolto la schermata resterebbe ferma sui numeri di prima —
// con chi guarda che ripreme convinto che non funzioni.
//
// ⚠️ "manca" e "respinta" sono due esiti diversi. Un circolo appena
// creato non ha ancora nessuna fotografia (si preme il tasto e c'è);
// una lettura respinta non tornerà mai, e chiamarla "manca" farebbe
// premere quel tasto all'infinito.
export function ascoltaFotografia(
  circoloId: string,
  callback: (f: Fotografia | null) => void,
  onErrore?: () => void,
) {
  return onSnapshot(
    doc(db, 'circoli', circoloId, 'fotografie', 'ultima'),
    (snap) => {
      if (!snap.exists()) { callback(null); return; }
      const v = snap.data() as any;
      const a = v.attivita ?? {};
      callback({
        circoloId: v.circoloId ?? circoloId,
        giorno: v.giorno ?? '',
        scattataIlMs: typeof v.scattataIlMs === 'number' ? v.scattataIlMs : 0,
        attivita: {
          prenotazioni: a.prenotazioni ?? 0,
          prenotazioni30: a.prenotazioni30 ?? 0,
          oreGiocate: a.oreGiocate ?? 0,
          ultimaPrenotazioneMs: typeof a.ultimaPrenotazioneMs === 'number' ? a.ultimaPrenotazioneMs : null,
          senzaDataDiCreazione: a.senzaDataDiCreazione ?? 0,
          campiPiuUsati: conteggi(a.campiPiuUsati),
          fascePunta: conteggi(a.fascePunta),
        },
        registro: {
          ricariche30: v.registro?.ricariche30 ?? 0,
          addebiti30: v.registro?.addebiti30 ?? 0,
          movimenti30: v.registro?.movimenti30 ?? 0,
        },
        perSocio: (v.perSocio ?? {}) as Record<string, VoceSocioFoto>,
      });
    },
    (errore) => {
      console.warn('Ascolto della fotografia interrotto:', errore?.message ?? errore);
      onErrore?.();
    },
  );
}

// Rifà lo scatto adesso, per questo circolo. La lettura pesante resta
// sul server: qui si aspetta e basta.
export async function aggiornaFotografia(circoloId: string): Promise<void> {
  const chiama = httpsCallable(functions, 'fotografiaCircolo');
  await chiama({ circoloId });
}

// ============================================================
// PERSONE — dal vivo, dalle tessere
// ============================================================

export interface RiepilogoPersone {
  soci: number;        // tesserati qui, approvati
  ospiti: number;      // tesserati altrove, approvati qui
  inAttesa: number;
  sospese: number;
  chiuse: number;
  rifiutate: number;
  maestri: number;
  // Da quanto aspetta la richiesta più vecchia ancora in attesa.
  // ⚠️ È il numero che dice se un circolo sta ignorando le persone che
  // bussano: "3 in attesa" non allarma nessuno, "3 in attesa, la più
  // vecchia da 24 giorni" sì.
  attesaPiuLungaMs: number | null;
}

function msDi(valore: unknown): number | null {
  const v = valore as { seconds?: number } | undefined;
  return typeof v?.seconds === 'number' ? v.seconds * 1000 : null;
}

export function riepilogoPersone(
  tessere: Tessera[],
  numeroMaestri: number,
  adessoMs: number = Date.now(),
): RiepilogoPersone {
  let soci = 0, ospiti = 0, inAttesa = 0, sospese = 0, chiuse = 0, rifiutate = 0;
  let piuVecchiaMs: number | null = null;

  for (const t of tessere) {
    switch (t.stato) {
      case 'approvata':
        if (t.ruolo === 'ospite') ospiti += 1; else soci += 1;
        break;
      case 'in_attesa': {
        inAttesa += 1;
        const quando = msDi(t.richiestaIl);
        // ⚠️ Una richiesta senza data non azzera l'attesa: viene
        // ignorata nel calcolo, non trattata come "arrivata adesso".
        // Trattarla come adesso avrebbe fatto sparire un ritardo vero.
        if (quando !== null && (piuVecchiaMs === null || quando < piuVecchiaMs)) {
          piuVecchiaMs = quando;
        }
        break;
      }
      case 'sospesa': sospese += 1; break;
      case 'chiusa': chiuse += 1; break;
      case 'rifiutata': rifiutate += 1; break;
    }
  }

  return {
    soci, ospiti, inAttesa, sospese, chiuse, rifiutate,
    maestri: numeroMaestri,
    attesaPiuLungaMs: piuVecchiaMs === null ? null : Math.max(0, adessoMs - piuVecchiaMs),
  };
}

// ============================================================
// DENARO IN GIACENZA — dal vivo, dalle tessere
//
// ⚠️ "Fido utilizzato" NON esiste come voce separata, ed è una scelta:
// sarebbe stato la somma di sosUtilizzato, cioè identica a "debiti".
// Due caselle con lo stesso numero e due nomi diversi fanno cercare la
// differenza a chi legge, e la differenza non c'è.
// ============================================================

export interface RiepilogoDenaro {
  creditoInGiacenza: number;
  debiti: number;
  fidoConcesso: number;
}

// Arrotonda al centesimo: sommando decimali in virgola mobile si arriva
// a 41.900000000000006, e su una schermata di soldi un numero così è un
// difetto anche quando è giusto.
function centesimi(n: number): number {
  return Math.round(n * 100) / 100;
}

export function riepilogoDenaro(tessere: Tessera[]): RiepilogoDenaro {
  let credito = 0, debiti = 0, fido = 0;
  for (const t of tessere) {
    // ⚠️ Le tessere CHIUSE restano nel conto del debito e del credito.
    // Sono soldi che il circolo deve ancora restituire, o che deve
    // ancora incassare: toglierle dal totale farebbe sparire dal
    // bilancio proprio le posizioni aperte con chi se n'è andato.
    credito += t.credito ?? 0;
    debiti += t.sosUtilizzato ?? 0;
    fido += t.limiteRicaricaSOS ?? 0;
  }
  return {
    creditoInGiacenza: centesimi(credito),
    debiti: centesimi(debiti),
    fidoConcesso: centesimi(fido),
  };
}

// ============================================================
// ELENCO PER SOCIO — anagrafica dal vivo, conteggi dalla fotografia
// ============================================================

export interface RigaSocio {
  uid: string;
  nome: string;
  email: string;
  ruolo: 'socio_tesserato' | 'ospite';
  stato: StatoTessera;
  prenotazioni: number;
  credito: number;
  debito: number;
  posizione: number | null;
  // Quando questa persona ha prenotato l'ultima volta. Null se non ha
  // mai prenotato, se le sue prenotazioni sono più vecchie del campo che
  // registra la data di creazione, o se la fotografia non c'è ancora.
  ultimaPrenotazioneMs: number | null;
}

// ⚠️ L'anagrafica viene dal vivo e i conteggi dalla fotografia, quindi
// le due parti raccontano momenti diversi: un socio tesserato stamattina
// compare in elenco con zero prenotazioni finché la fotografia non viene
// rifatta. È il verso giusto in cui sbagliare — una persona presente
// senza numeri si spiega da sé, una persona assente no.
export function righeSocio(
  tessere: Tessera[],
  perSocio: Record<string, VoceSocioFoto>,
): RigaSocio[] {
  return tessere
    .map((t) => {
      const voce = perSocio[t.uid];
      return {
        uid: t.uid,
        nome: `${t.nome ?? ''} ${t.cognome ?? ''}`.trim() || '(senza nome)',
        email: t.email ?? '',
        ruolo: t.ruolo,
        stato: t.stato,
        prenotazioni: voce?.prenotazioni ?? 0,
        credito: centesimi(t.credito ?? 0),
        debito: centesimi(t.sosUtilizzato ?? 0),
        posizione: t.posizioneClassificaSociale ?? null,
        ultimaPrenotazioneMs: typeof voce?.ultimaPrenotazioneMs === 'number'
          ? voce.ultimaPrenotazioneMs
          : null,
      };
    })
    // Prima chi gioca di più: è l'ordine con cui si guarda un elenco che
    // serve a capire chi tiene in piedi il circolo.
    .sort((a, b) => (b.prenotazioni - a.prenotazioni) || a.nome.localeCompare(b.nome));
}
