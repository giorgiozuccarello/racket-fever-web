// ============================================================
// FATTURAZIONE — quante persone di un circolo hanno scaricato e
// aperto l'app.
//
// ⚠️ QUI NON CI SONO PREZZI, E DAL 21 AGOSTO 2026 NON CI DEVONO
// TORNARE. Le fasce e le quote in euro sono state tolte da questo
// file, dalle schermate dell'app, dal sito e dalla dashboard Super
// Admin: quanto costa il servizio si scrive nel contratto fra Racket
// Fever e il circolo, e vive solo lì. Il software fa una cosa sola e
// la fa bene: **conta le persone**. Chi ha bisogno del prezzo lo
// legge dal contratto.
//
// Il motivo non è solo commerciale. Un listino scritto nel codice
// diventa un listino pubblicato: cambia di trattativa in trattativa,
// e ogni versione dell'app in circolazione ne mostrerebbe una diversa
// a chi la apre. Un numero in euro davanti a un revisore di App Store
// o Play, poi, apre una domanda che non abbiamo motivo di far nascere
// («che cos'è questo pagamento e perché non passa dallo store?»)
// quando quel pagamento non riguarda l'utente dell'app, ma un
// rapporto fra due aziende.
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
// ⚠️ QUI C'ERANO LE FASCE — `Fascia`, `FASCE`, `fasciaPer()` — con i
// tre scaglioni in euro e il costo per persona. Tolte il 21 agosto
// 2026, e non per semplificare: il prezzo sta nel contratto (vedi il
// riquadro in cima). Chi in futuro avesse bisogno di uno scaglione
// per un preventivo lo ricavi da `utenti`, che è l'unico numero che
// questo file promette di sapere.
// ============================================================

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
// fossero due non deve contare per due.
// ============================================================
export interface RiepilogoFatturazione {
  utenti: number;
  periodo: Periodo;
  // Quante persone il circolo ha accettato ma non hanno mai aperto
  // l'app: non si contano, e vederle serve al circolo per capire quanti
  // dei suoi soci non stanno usando quello che gli è stato messo in
  // mano. È il numero da cui parte una telefonata utile.
  accettatiMaiUsati: number;
  // Quante fra quelle contate sono già uscite dal circolo: spiega la
  // differenza fra questo numero e l'elenco dei soci di oggi.
  usciteNelPeriodo: number;
}

export function contaFatturabili(
  tessere: TesseraDaContare[], periodo: Periodo,
): { utenti: number; accettatiMaiUsati: number; usciteNelPeriodo: number } {
  const contati = new Set<string>();
  const usciti = new Set<string>();
  const senzaUso = new Set<string>();
  // Chi ha almeno una tessera ANCORA APERTA in questo circolo, contata
  // o no. Serve solo a ripulire `usciti` alla fine: vedi il riquadro
  // dopo il giro.
  const dentro = new Set<string>();

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
      // ⚠️ ANCHE DA QUI, e non solo dal fondo del giro. Una tessera
      // aperta è la prova che la persona è dentro, che abbia aperto
      // l'app o no: se il segnale lo raccogliessimo solo fra le tessere
      // contate, qualcuno con una tessera vecchia chiusa e una nuova
      // ancora mai usata resterebbe scritto fra gli «usciti».
      if (chiusa === null) dentro.add(t.uid);
      continue;
    }

    // Già uscito prima che il periodo cominciasse: appartiene a quello
    // di prima, dove è stato contato.
    // ⚠️ Prima di uscire si segna comunque `dentro` se la tessera è
    // aperta — ma una tessera aperta non ha una data di chiusura, e
    // quindi questa riga non la vede mai. È qui solo per dire che ci
    // si è pensato.
    if (chiusa !== null && chiusa < periodo.inizioMs) continue;

    contati.add(t.uid);
    if (chiusa !== null) usciti.add(t.uid);
    else dentro.add(t.uid);
  }

  // ⚠️ CHI HA UNA TESSERA APERTA NON È «USCITO», ed è una difesa contro
  // i dati sporchi, non contro il rientro normale. Va detto con
  // precisione, perché la prima stesura di questo riquadro raccontava
  // il contrario e sarebbe diventata il modello dei dati di chi legge:
  // il rientro nel circolo NON crea una seconda tessera. L'id del
  // documento è `uid + '_' + circoloId` (data/tessere.ts), il rientro
  // riscrive quello stesso documento con `chiusaIl: null`, e le regole
  // (`idTesseraCoerente`, firestore.rules) impediscono che ne esista un
  // altro con lo stesso uid nello stesso circolo. Per la strada normale
  // qui non passa mai nessuno.
  //
  // Resta perché la funzione riceve un elenco già letto e non può
  // verificare quell'invariante: il giorno che due documenti della
  // stessa persona esistessero davvero — un errore di importazione, una
  // migrazione andata storta — senza questa riga la scheda annuncerebbe
  // al circolo la partenza di qualcuno che sta giocando sul campo 2. Il
  // conto delle persone è già protetto dallo stesso caso poco sopra
  // (`contati` è un insieme di uid), questo chiude l'altra metà.
  //
  // ⚠️ E SI FA DOPO IL GIRO, non dentro. Il primo tentativo era un
  // `else usciti.delete(uid)` attaccato alla riga qui sopra:
  // funzionava solo se la tessera aperta arrivava DOPO quella chiusa,
  // cioè a seconda dell'ordine in cui Firestore restituisce i
  // documenti. Una prova con le due tessere invertite lo ha preso; una
  // schermata no.
  for (const uid of dentro) usciti.delete(uid);

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
  return {
    utenti: conto.utenti,
    periodo,
    accettatiMaiUsati: conto.accettatiMaiUsati,
    usciteNelPeriodo: conto.usciteNelPeriodo,
  };
}

// ============================================================
// L'IMPORTO SCRITTO ALL'ITALIANA — «1.234,50 €».
//
// ⚠️ RESTA, ANCHE SE LE QUOTE SE NE SONO ANDATE. Non serviva solo a
// loro: l'app scrive in euro il credito del socio, i debiti verso il
// circolo e il fido. Quelli sono soldi fra socio e circolo, e nel
// software ci stanno di diritto — è il listino di Racket Fever che non
// ci sta.
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
// usarla non componevano un nome, componevano una frase intera che deve
// concordare anche nel verbo — «Altre 1 persona è stata accettata ma
// non ha mai aperto l'app» — e con un pezzetto di nome preconfezionato
// il verbo restava comunque da accordare a mano.
// ⚠️ Dal 21 agosto 2026 quella frase esiste in TRE schermate, e vanno
// tenute allineate a mano: la Panoramica dentro l'app
// (theme/PanoramicaCircolo.tsx), la scheda del circolo sul sito
// (superadmin/dashboard/SchedaCircoloVista.tsx) e i totali di rete
// (superadmin/dashboard/SezioneFatturazione.tsx). Tutte e tre dicono
// una cosa diversa da prima: non più «quanto paghi», solo «quante
// persone usano l'app».
//
// ⚠️ E la terza è nata sbagliata — «1 circoli attivi», «Altre 1 sono
// state accettate» — proprio mentre questo commento sosteneva che
// erano due e che si tenevano d'occhio. Il ragionamento resta valido
// (una funzione comune che restituisce un pezzetto di nome lascia
// comunque il verbo da accordare, e fa sembrare coperto un caso che
// non lo è) ma la conclusione operativa è un'altra: chi aggiunge una
// quarta frase di questo tipo la provi con 0, 1 e 2.
