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
// riprovare da qui non serve perché la riga non c'è più. Il codice lo
// alza data/conversazioneLezione.ts; qui si ri-esporta perché le
// schermate importano da questo file.
export { CONVERSAZIONE_NON_CHIUSA };

// Annulla una lezione intera: tutte le sue mezz'ore, poi la
// conversazione, poi gli avvisi.
//
// ⚠️ L'ORDINE NON È INTERCAMBIABILE. La conversazione si chiude SOLO
// se tutte le mezz'ore sono andate: chiudendola prima, o dopo un
// annullamento riuscito a metà, si otterrebbe il contrario esatto del
// difetto che questo file corregge — campi ancora occupati e nessun
// posto dove parlarne.
export async function annullaLezioneIntera(
  lezione: RigaLezione,
  eseguitoDaNome: string,
): Promise<void> {
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
    // ⚠️ Il termine di disdetta e gli altri rifiuti del server vanno
    // riportati com'erano: sono frasi scritte per essere lette, e
    // sostituirle con un codice interno le butterebbe via.
    const messaggio = (primoErrore as Error)?.message;
    if (messaggio && messaggio.includes('termine')) throw primoErrore;
    throw new Error(`${LEZIONE_ANNULLATA_A_META}:${fatte}:${lezione.slotIds.length}`);
  }

  // ⚠️ Solo se c'è una card: una lezione senza (quelle nate prima che
  // il cardId esistesse) non ha nessuna conversazione collegata, e
  // cercarla per identificativo di prenotazione non troverebbe mai
  // niente. Chiamarla lo stesso avrebbe fatto credere di aver chiuso
  // qualcosa.
  if (lezione.conCard) await chiudiConversazioneLezione(lezione.cardId);

  // Gli avvisi sono un di più: se falliscono non deve mai sembrare che
  // l'annullamento sia fallito — a quel punto la lezione è già sparita.
  const orario = lezione.orari.length > 0 ? lezione.orari[0] : '';
  const testo = `Il circolo ha annullato la lezione: ${lezione.campoNome}, ${lezione.dataLabel}`
    + (orario ? ` alle ${orario}` : '') + '.';
  if (lezione.allievoUid) {
    try { await creaNotifica(lezione.allievoUid, testo, 'lezione', lezione.circoloId); }
    catch (e) { console.warn('Avviso al socio non inviato:', e); }
  }
  if (lezione.maestroId) {
    try {
      await creaNotificaMaestro(
        lezione.maestroId,
        `${testo} Annullata da ${eseguitoDaNome}.`,
        lezione.circoloId,
      );
    } catch (e) { console.warn('Avviso al Maestro non inviato:', e); }
  }
}
