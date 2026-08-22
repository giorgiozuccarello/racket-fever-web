// ============================================================
// LE LEZIONI VISTE DAL CIRCOLO — e come si annullano.
//
// ⚠️ UNA LEZIONE NON SI CANCELLA A MEZZ'ORE, e questo file esiste per
// impedirlo. Dalla griglia l'Admin cancellava le singole mezz'ore di
// una lezione, e il risultato era una cosa a metà: i campi tornavano
// liberi, ma la richiesta da cui la lezione era nata restava viva. Il
// socio continuava a vedere in Home la card «lezione confermata» su
// campi ormai di altri, il Maestro se la ritrovava nel suo elenco, e
// la conversazione fra i due restava aperta su una cosa che non
// esisteva più — finché il Maestro non la chiudeva a mano, cioè finché
// non se ne accorgeva.
//
// Una lezione è un accordo fra due persone, non tre mezz'ore di campo:
// o si annulla tutta, con la sua conversazione, o non si annulla. Le
// mezz'ore restano cancellabili una per una solo per le prenotazioni
// di campo, dove non c'è nessun accordo da sciogliere.
//
// ⚠️ E la traccia resta: ogni mezz'ora annullata passa dalla Cloud
// Function, che scrive in `lezioni_annullate` — una riga per lezione,
// con chi l'ha annullata e se era oltre il termine. È da lì che
// vengono i conteggi della scheda del Maestro e della Scheda Circolo.
//
// ⚠️ MA È UN VINCOLO DELL'INTERFACCIA, NON DEL SERVER, e va saputo. Le
// regole Firestore lasciano all'Admin la cancellazione di qualunque
// prenotazione, e la Cloud Function `annullaPrenotazione` accetta
// volentieri una singola mezz'ora di lezione: il divieto vive nelle
// due schermate della griglia, non sotto. Sono le stesse persone da
// una parte e dall'altra — chi comanda sul circolo — quindi non è una
// difesa mancante ma una regola di prodotto; però nessuno la applica
// al posto nostro, e ogni nuova strada che cancella prenotazioni deve
// ricordarsene. È già successo una volta: la rimozione di un socio dal
// circolo cancellava le sue lezioni future senza chiudere le
// conversazioni (vedi data/tessere.ts).
// ============================================================

import { PrenotazioneAdmin, cancellaConRimborso } from './prenotazioniRepo';
import { creaNotifica } from './notifiche';
import { creaNotificaMaestro } from './notificheMaestro';
import { chiudiConversazioneLezione, CONVERSAZIONE_NON_CHIUSA } from './conversazioneLezione';

export interface RigaLezione {
  // La card è l'identità della lezione: le sue mezz'ore la condividono.
  cardId: string;
  // Falso per le lezioni nate prima che il cardId esistesse: sono
  // mezz'ore sciolte, senza una conversazione a cui essere collegate.
  // Chi le mostra deve dirlo, e chi le annulla non deve promettere di
  // chiudere una chat che non troverà.
  conCard: boolean;
  circoloId: string;
  allievoUid: string;      // vuoto per un allievo esterno
  allievoNome: string;
  esterno: boolean;
  maestroId: string;
  maestroNome: string;
  campoNome: string;
  data: string;            // 'AAAA-MM-GG'
  dataLabel: string;
  orari: string[];         // ordinati
  slotIds: string[];       // i documenti prenotazione da cancellare
  prezzo: number;          // somma delle mezz'ore, a titolo indicativo
}

// ⚠️ Raggruppa per cardId, e sull'identificativo del documento solo
// come ripiego: le lezioni nate prima che il cardId esistesse non ne
// hanno uno, e senza ripiego sparirebbero dall'elenco invece di
// comparire come mezz'ore separate. Meglio una lezione vecchia
// spezzata in righe che una lezione invisibile.
// ⚠️ Il circolo arriva da fuori e non si ricava dalla prenotazione:
// PrenotazioneAdmin non lo porta. Si potrebbe leggerlo scomponendo
// l'identificativo dello slot — e' fatto di circolo, campo, giorno e
// ora — ma sarebbe un'invariante nascosta che si rompe in silenzio il
// giorno in cui quel formato cambia. Chi mostra l'elenco il proprio
// circolo lo sa gia'.
export function raggruppaLezioni(
  prenotazioni: PrenotazioneAdmin[],
  daGiorno: string,
  circoloId: string,
): RigaLezione[] {
  const per = new Map<string, RigaLezione>();

  for (const p of prenotazioni) {
    if (p.tipo !== 'lezione') continue;
    if (!p.data || p.data < daGiorno) continue;
    const chiave = p.cardId || p.id;
    const voce = per.get(chiave);
    if (!voce) {
      per.set(chiave, {
        cardId: chiave,
        conCard: !!p.cardId,
        circoloId,
        allievoUid: p.utenteId ?? '',
        allievoNome: `${p.utenteNome ?? ''} ${p.utenteCognome ?? ''}`.trim() || 'Allievo',
        esterno: p.tipoUtente === 'esterno' || !p.utenteId,
        maestroId: p.maestroId ?? '',
        maestroNome: `${p.maestroNome ?? ''} ${p.maestroCognome ?? ''}`.trim(),
        campoNome: p.campoNome ?? '',
        data: p.data,
        dataLabel: p.dataLabel || p.data,
        orari: [p.orario],
        slotIds: [p.id],
        prezzo: p.prezzo ?? 0,
      });
    } else {
      voce.orari.push(p.orario);
      voce.slotIds.push(p.id);
      voce.prezzo += p.prezzo ?? 0;
    }
  }

  const righe = [...per.values()];
  for (const r of righe) {
    // ⚠️ Si riordinano INSIEME, orario e documento, perché stanno in
    // due elenchi paralleli: ordinando solo gli orari, la mezz'ora
    // delle 10:00 finirebbe accanto all'identificativo di quella delle
    // 10:30. Oggi l'ingresso arriva già ordinato e il giro non sposta
    // niente, ma una corrispondenza per indice che regge solo perché
    // qualcun altro ordina prima non è una corrispondenza: è fortuna.
    const insieme = r.orari.map((orario, i) => ({ orario, id: r.slotIds[i] }));
    insieme.sort((a, b) => a.orario.localeCompare(b.orario));
    r.orari = insieme.map((x) => x.orario);
    r.slotIds = insieme.map((x) => x.id);
  }
  return righe.sort((a, b) => (a.data + a.orari[0]).localeCompare(b.data + b.orari[0]));
}

// Le mezz'ore non sono andate tutte: la lezione è ancora lì, in parte.
export const LEZIONE_ANNULLATA_A_META = 'LEZIONE_ANNULLATA_A_META';
// Le mezz'ore sono andate tutte, la conversazione no. È uno stato
// diverso e va detto diversamente: i campi sono liberi davvero, e
// riprovare da qui invece FUNZIONA — le mezz'ore già cancellate
// rispondono «già fatto» e la chiusura si ritenta. (Questa riga diceva
// il contrario, «riprovare non serve perché la riga non c'è più»: la
// riga sparisce dall'elenco, ma il popup resta aperto ed è da lì che si
// ritenta.) Il codice lo alza data/conversazioneLezione.ts; qui si
// ri-esporta perché le schermate importano da questo file.
export { CONVERSAZIONE_NON_CHIUSA };

// Annulla una lezione intera: tutte le sue mezz'ore, poi gli avvisi, e
// PER ULTIMA la conversazione.
//
// ⚠️ Questo commento diceva l'ordine opposto — «poi la conversazione,
// poi gli avvisi» — ed era quello vero, ed e' quello che ha causato un
// guasto in produzione: la chiusura della chat falliva per un permesso
// mancante, e socio e Maestro non sapevano di una lezione gia'
// annullata. E' rimasto scritto qui per tre righe anche dopo che il
// codice era stato ribaltato: in un progetto dove il commento e' il
// presidio principale, e' esattamente la riga che il prossimo lettore
// userebbe per "rimettere a posto" il codice.
//
// ⚠️ L'ORDINE NON È INTERCAMBIABILE. La conversazione si chiude SOLO
// se tutte le mezz'ore sono andate: chiudendola prima, o dopo un
// annullamento riuscito a metà, si otterrebbe il contrario esatto del
// difetto che questo file corregge — campi ancora occupati e nessun
// posto dove parlarne.
// Restituisce l'elenco di chi NON e' stato avvisato. Vuoto = tutto a
// posto.
// ⚠️ Non e' un dettaglio da log: da quando gli avvisi sono stati
// spostati prima della chat, sono l'unico canale con cui socio e
// Maestro scoprono che la lezione non c'e' piu'. Se non partono, chi ha
// annullato deve saperlo — altrimenti vede "fatto" e i due interessati
// scoprono il campo libero per caso.
export async function annullaLezioneIntera(
  lezione: RigaLezione,
  eseguitoDaNome: string,
): Promise<{ nonAvvisati: string[] }> {
  // ⚠️ IL try STA DENTRO IL CICLO, e non è una finezza. Con il solo
  // await, la prima mezz'ora che falliva faceva uscire dalla funzione:
  // il controllo "ne ho fatte quante ne dovevo" scritto dopo il ciclo
  // non veniva mai raggiunto, e all'Admin arrivava il messaggio
  // generico — "annullamento non riuscito", cioè "non è successo
  // niente" — mentre un campo era già libero e la chat ancora aperta.
  // Contandole, la differenza fra "tutto" e "in parte" si può dire.
  let fatte = 0;
  let primoErrore: unknown = null;
  for (const id of lezione.slotIds) {
    try {
      await cancellaConRimborso({
        uid: lezione.allievoUid,
        circoloId: lezione.circoloId,
        prenotazioneId: id,
        // Una lezione in app non ha addebito: non c'è niente da
        // restituire, e il server lo sa già — questo numero non lo
        // guarda nessuno.
        prezzo: 0,
        // parziale: false perché è una lezione intera. È l'informazione
        // che il registro usa per chiudere la card.
        parziale: false,
        descrizione: 'Lezione annullata dal circolo',
      });
      fatte += 1;
    } catch (e) {
      // Ci si ferma alla prima che non va: proseguire alla cieca
      // libererebbe campi sparsi senza chiudere niente.
      primoErrore = e;
      break;
    }
  }

  if (fatte !== lezione.slotIds.length || lezione.slotIds.length === 0) {
    // ⚠️ LA CAUSA VERA NON SI BUTTA VIA. La prima versione la
    // sostituiva con un codice interno e basta: quando NON si annullava
    // niente, all'Admin arrivava «annullate 0 di 2, riprova per
    // completare» — un invito a ripremere all'infinito, senza nessun
    // indizio. Lo scenario non e' teorico: una sessione Collaboratore
    // scaduta dopo dodici ore fa rispondere al server «non puoi
    // annullare questa prenotazione», e bastava ridigitare la password.
    console.warn('Lezione non annullata del tutto:', primoErrore);

    // I rifiuti motivati del server sono frasi scritte per essere
    // lette: si riportano com'erano invece di coprirle.
    const codice = String((primoErrore as { code?: string })?.code ?? '');
    if (codice.includes('failed-precondition')) throw primoErrore;

    throw new Error(
      `${LEZIONE_ANNULLATA_A_META}:${fatte}:${lezione.slotIds.length}:${codice}`,
    );
  }

  // ⚠️ GLI AVVISI PARTONO PRIMA DELLA CHAT, e l'ordine è stato
  // corretto dopo un caso vero. Stavano in fondo, dopo la chiusura
  // della conversazione: quando quella è fallita — un permesso che
  // mancava — la lezione era già annullata, i campi già liberi, e né il
  // socio né il Maestro hanno saputo niente. La lezione è annullata nel
  // momento in cui l'ultima mezz'ora se ne va: da lì in poi avvisare
  // non dipende più da nient'altro.
  //
  // Restano non bloccanti: un avviso che non parte non deve far
  // sembrare fallito un annullamento riuscito.
  const orario = lezione.orari.length > 0 ? lezione.orari[0] : '';
  const testo = `Il circolo ha annullato la lezione: ${lezione.campoNome}, ${lezione.dataLabel}`
    + (orario ? ` alle ${orario}` : '') + '.';
  const nonAvvisati: string[] = [];
  if (lezione.allievoUid) {
    try {
      await creaNotifica(
        lezione.allievoUid, testo, 'lezione', lezione.circoloId,
        undefined, undefined, undefined, 'lezioni',
      );
    }
    catch (e) {
      console.warn('Avviso al socio non inviato:', e);
      nonAvvisati.push(lezione.allievoNome);
    }
  }
  if (lezione.maestroId) {
    try {
      await creaNotificaMaestro(
        lezione.maestroId,
        `${testo} Annullata da ${eseguitoDaNome}.`,
        lezione.circoloId,
      );
    } catch (e) {
      console.warn('Avviso al Maestro non inviato:', e);
      nonAvvisati.push(`il Maestro ${lezione.maestroNome}`.trim());
    }
  }

  // ⚠️ Solo se c'è una card: una lezione senza (quelle nate prima che
  // il cardId esistesse) non ha nessuna conversazione collegata, e
  // cercarla per identificativo di prenotazione non troverebbe mai
  // niente. Chiamarla lo stesso avrebbe fatto credere di aver chiuso
  // qualcosa.
  //
  // ⚠️ E sta per ULTIMA. Se fallisce, quello che è già successo resta
  // fatto e detto: campi liberi, socio e Maestro avvisati. L'unica cosa
  // che manca è la conversazione, ed è l'unica cosa che il messaggio
  // d'errore deve nominare.
  //
  // ⚠️ Ritentare da capo FUNZIONA: le mezz'ore già cancellate rispondono
  // «già fatto» senza errore e senza secondo movimento di credito, e la
  // chiusura si ritenta. Costa però una seconda coppia di avvisi a socio
  // e Maestro: chi mostra l'errore lo deve dire.
  if (lezione.conCard) {
    try {
      await chiudiConversazioneLezione(lezione.cardId, lezione.circoloId);
    } catch (e) {
      // ⚠️ Chi non e' stato avvisato viaggia INSIEME all'errore. Senza,
      // se cadeva la rete un avviso e la chiusura della chat cadevano
      // spesso insieme — stessa causa — e l'Admin leggeva solo «la
      // conversazione non si e' chiusa», restando convinto che socio e
      // Maestro sapessero. Non lo sapevano.
      if (nonAvvisati.length > 0 && e instanceof Error) {
        (e as Error & { nonAvvisati?: string[] }).nonAvvisati = nonAvvisati;
      }
      throw e;
    }
  }

  return { nonAvvisati };
}
