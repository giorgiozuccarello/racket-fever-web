// ============================================================
// FATTURAZIONE — quanti utenti conta un circolo, e quanto paga.
//
// ⚠️ SI CONTANO LE PERSONE, NON I GIORNI. La prima versione di questo
// conto misurava la MEDIA giornaliera dei tesserati nell'anno: sembrava
// più giusta, ed era il modo più veloce di rendere il numero
// incomprensibile a chi lo riceve. Il criterio è un altro e si dice in
// una riga: **quante persone questo circolo ha accettato — socio,
// tesserato oppure ospite, senza distinzione — e hanno usato l'app
// almeno una volta.**
//
// ⚠️ E CHI E' ENTRATO CONTA ANCHE SE POI E' USCITO. Non è severità: è
// quello che toglie di mezzo la sola manipolazione possibile. Se il
// conto guardasse la fotografia di un istante, basterebbe sospendere
// venti soci il mese del rinnovo. Contando chiunque sia stato dentro
// nel periodo, chiudere una tessera non fa risparmiare niente — e
// quindi non c'è motivo di farlo.
//
// ⚠️ MA DEVE AVER USATO L'APP. Una tessera creata dalla segreteria per
// qualcuno che non ha mai installato niente non è un utente: è una
// riga. Farla pagare al circolo vorrebbe dire fatturare l'anagrafica,
// non il servizio — e sarebbe il primo motivo per cui un circolo
// smetterebbe di inserire i propri soci.
//
// ============================================================
// ⚠️ IL CONTO NON GUARDA `approvataIl`, E NON E' UNA SVISTA.
//
// La prima stesura escludeva chi non aveva una data di approvazione.
// Sembra la definizione stessa di «accettato», ed è invece il buco:
// uscire da un circolo e richiedere di rientrare riscrive la tessera
// con `approvataIl: null` e `chiusaIl: null` — è la strada normale,
// scritta in creaRichiestaTessera, non un abuso. Due gesti che
// qualunque socio può fare dal telefono, e la persona spariva dal
// conto restando dentro il circolo.
//
// La prova di «è stato accettato» è `primoUsoMs` stesso. Le regole
// Firestore lo lasciano scrivere SOLO all'interessato, SOLO su una
// tessera già approvata o sospesa, SOLO se non c'è già e SOLO con
// l'ora del server. Una data che esiste vuol dire quindi, da sola,
// che quella persona è stata accettata da questo circolo e ha aperto
// l'app: le due cose che stiamo contando. Non serve altro, e ogni
// campo in meno è un campo in meno da difendere.
// ============================================================
//
// ⚠️ FILE GEMELLO, identico in racket-fever/data/fatturazione.ts e
// in racket-fever/functions/src/fatturazione.ts. Nessun import: sono
// conti puri su dati già letti. Se si tocca una riga qui, si toccano
// anche le altre due.
// ============================================================

export interface TesseraDaContare {
  uid: string;
  // Millisecondi. `null` = il momento non è mai stato scritto.
  chiusaIlMs?: number | null;
  primoUsoMs?: number | null;
  stato?: string;
}

// ============================================================
// LE FASCE.
// Meno di 100 utenti: 200 euro. Da 100 a 200: 300. Oltre 200: 400.
// ⚠️ Larghe apposta. Fra 100 e 200 la quota non si muove, quindi un
// circolo che fa una buona stagione non viene punito a metà anno — e
// nessuno ha motivo di litigare su un socio in più o in meno. Il costo
// per persona scende al crescere del circolo, ed è l'argomento di
// vendita più forte che abbiamo: 2,50 euro a testa a ottanta utenti,
// 1,25 a trecentoventi.
// ============================================================
export interface Fascia {
  nome: string;
  descrizione: string;
  quota: number;
}

export const FASCE: Fascia[] = [
  { nome: 'Piccola', descrizione: 'meno di 100 utenti', quota: 200 },
  { nome: 'Media', descrizione: 'da 100 a 200 utenti', quota: 300 },
  { nome: 'Grande', descrizione: 'oltre 200 utenti', quota: 400 },
];

export function fasciaPer(utenti: number): Fascia {
  if (utenti < 100) return FASCE[0];
  if (utenti <= 200) return FASCE[1];
  return FASCE[2];
}

// ============================================================
// IL PERIODO.
//
// ⚠️ DALL'ANNIVERSARIO DELL'ATTIVAZIONE, non dal primo gennaio. Con
// l'anno solare tutti i rinnovi arriverebbero nella stessa settimana di
// dicembre, e con cento circoli quella settimana non la regge nessuno.
// Dall'anniversario si distribuiscono da soli.
//
// ⚠️ E il primo periodo può essere più corto di un anno solo se il
// circolo è nato da meno di un anno: in quel caso il periodo va
// dall'attivazione a oggi, ed è quello che si sta accumulando.
// ============================================================
export interface Periodo {
  inizioMs: number;
  fineMs: number;
  // Quale anno di contratto: 1 è il primo.
  numero: number;
  // ⚠️ FALSO QUANDO IL CIRCOLO NON HA UNA DATA DI ATTIVAZIONE, e chi
  // legge questo oggetto DEVE guardarlo prima di mostrare `fineMs`
  // come data di rinnovo. Senza ancoraggio il periodo è «gli ultimi
  // dodici mesi», quindi finisce oggi — e una scheda che stampasse
  // quella data direbbe che il circolo scade oggi. Ogni giorno, e per
  // tutti i circoli nati prima che il campo esistesse: cioè quasi
  // tutti quelli veri.
  ancorato: boolean;
}

const ANNO_MS = 365 * 24 * 60 * 60 * 1000;

export function periodoCorrente(attivatoIlMs: number | null | undefined, adessoMs: number): Periodo {
  // Senza data di attivazione non si può ancorare niente: si prende
  // l'anno che finisce oggi. È il ripiego onesto — dice «questi ultimi
  // dodici mesi» invece di inventare un anniversario — ma va
  // dichiarato, ed è a questo che serve `ancorato`.
  if (!attivatoIlMs || attivatoIlMs <= 0 || attivatoIlMs > adessoMs) {
    return { inizioMs: adessoMs - ANNO_MS, fineMs: adessoMs, numero: 1, ancorato: false };
  }
  const trascorsi = Math.floor((adessoMs - attivatoIlMs) / ANNO_MS);
  const inizioMs = attivatoIlMs + trascorsi * ANNO_MS;
  return {
    inizioMs,
    fineMs: inizioMs + ANNO_MS,
    numero: trascorsi + 1,
    ancorato: true,
  };
}

// ============================================================
// IL CONTO.
//
// Una persona entra nel conto del periodo se due cose sono vere: ha
// **usato l'app** almeno una volta da tessera accettata (ed è
// `primoUsoMs` a dirlo, vedi il riquadro in cima), ed **è stata
// dentro** durante il periodo — cioè non era già uscita prima che il
// periodo cominciasse.
//
// ⚠️ Per uid e non per tessera: la stessa persona non può avere due
// tessere nello stesso circolo, ma se per un errore di dati ce ne
// fossero due non deve pagarne due.
// ============================================================
export interface RiepilogoFatturazione {
  utenti: number;
  fascia: Fascia;
  periodo: Periodo;
  // Quante persone il circolo ha accettato ma non hanno mai aperto
  // l'app: non si contano, e vederle serve al circolo per capire quanti
  // dei suoi soci non stanno usando quello per cui paga.
  accettatiMaiUsati: number;
  // Quante fra quelle contate sono già uscite dal circolo: spiega la
  // differenza fra questo numero e l'elenco dei soci di oggi.
  usciteNelPeriodo: number;
  costoPerUtente: number;
}

export function contaFatturabili(
  tessere: TesseraDaContare[], periodo: Periodo,
): { utenti: number; accettatiMaiUsati: number; usciteNelPeriodo: number } {
  const contati = new Set<string>();
  const usciti = new Set<string>();
  const senzaUso = new Set<string>();

  for (const t of tessere) {
    if (!t.uid) continue;
    const chiusa = t.chiusaIlMs ?? null;
    const uso = t.primoUsoMs ?? null;

    if (uso === null || uso > periodo.fineMs) {
      // Accettato ma mai entrato nell'app: non si conta, ma si dice.
      // ⚠️ Ci sta anche chi è uscito senza aver mai aperto l'app, se è
      // uscito dentro questo periodo: è la stessa persona di ieri, e
      // farla sparire dal riquadro il giorno in cui la tessera viene
      // chiusa faceva sembrare che il numero fosse calato da solo.
      const dentroOra = t.stato === 'approvata' || t.stato === 'sospesa';
      const uscitoNelPeriodo = chiusa !== null && chiusa >= periodo.inizioMs && chiusa <= periodo.fineMs;
      if (dentroOra || uscitoNelPeriodo) senzaUso.add(t.uid);
      continue;
    }

    // Già uscito prima che il periodo cominciasse: appartiene a quello
    // di prima, dove è stato contato.
    if (chiusa !== null && chiusa < periodo.inizioMs) continue;

    contati.add(t.uid);
    if (chiusa !== null) usciti.add(t.uid);
  }

  // ⚠️ Chi è stato contato non sta anche fra i «mai usati»: le due
  // liste si costruiscono nello stesso giro su tessere diverse, e una
  // persona con due tessere nello stesso circolo (una vecchia chiusa e
  // mai usata, una nuova usata) finirebbe in tutte e due.
  for (const uid of contati) senzaUso.delete(uid);

  return {
    utenti: contati.size,
    accettatiMaiUsati: senzaUso.size,
    usciteNelPeriodo: usciti.size,
  };
}

export function riepilogoFatturazione(
  tessere: TesseraDaContare[],
  attivatoIlMs: number | null | undefined,
  adessoMs: number,
): RiepilogoFatturazione {
  const periodo = periodoCorrente(attivatoIlMs, adessoMs);
  const conto = contaFatturabili(tessere, periodo);
  const fascia = fasciaPer(conto.utenti);
  return {
    utenti: conto.utenti,
    fascia,
    periodo,
    accettatiMaiUsati: conto.accettatiMaiUsati,
    usciteNelPeriodo: conto.usciteNelPeriodo,
    // Arrotondato al centesimo: è il numero che si usa in trattativa
    // («meno di un caffè all'anno»), e va detto giusto.
    costoPerUtente: conto.utenti > 0 ? Math.round((fascia.quota / conto.utenti) * 100) / 100 : 0,
  };
}

// ============================================================
// L'IMPORTO SCRITTO ALL'ITALIANA — «1.234,50 €».
//
// ⚠️ Sta qui e non in tre schermate diverse perché ci era già finito
// in tre schermate diverse, tutte e tre con `toFixed(2)`: che è il
// punto decimale inglese. «200.00 €» su un numero che si manda a un
// presidente di circolo è il genere di dettaglio che fa dubitare di
// tutto il resto.
//
// ⚠️ E non `toLocaleString('it-IT')`: su Hermes, il motore JavaScript
// dell'app, il supporto alle localizzazioni non c'è, e quella chiamata
// restituisce il formato inglese senza dire niente.
// ============================================================
export function euro(importo: number): string {
  const segno = importo < 0 ? '-' : '';
  const centesimi = Math.round(Math.abs(importo) * 100);
  const intera = Math.floor(centesimi / 100);
  const resto = centesimi % 100;
  const migliaia = String(intera).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${segno}${migliaia},${String(resto).padStart(2, '0')} €`;
}

// ⚠️ QUI C'ERA UNA `persone(n)` che restituiva «1 persona» / «2
// persone». E' stata tolta: le due schermate che avrebbero dovuto
// usarla non compongono un nome, compongono una frase intera che deve
// concordare anche nel verbo — «Altre 1 persona è stata accettata ma
// non ha mai aperto l'app» — e con un pezzetto di nome preconfezionato
// il verbo restava comunque da accordare a mano. Una funzione comune
// che nessuno usa e' peggio di nessuna funzione: sembra che il caso sia
// coperto.
