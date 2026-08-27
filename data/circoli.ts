// ============================================================
// TIPI CIRCOLO — i dati veri vivono ora su Firestore
// (vedi data/circoliRepo.ts). Qui restano solo le interfacce e
// qualche utility che non dipende dal backend.
// ============================================================

import { allineaLink } from './linkBanner';

export interface Circolo {
  id: string;
  nome: string;
  citta: string;
  sigla: string;
  password: string;
  temaApp: string; // chiave di uno degli 8 TEMI_APP — scelto dall'Admin, vale anche per i Maestri
  limiteOreSettimanali: number; // 0 = nessun limite
  // ⚠️ IL FIDO, E STA QUI PERCHÉ È UNO SOLO PER TUTTO IL CIRCOLO.
  // Fino al 25 agosto 2026 il tetto del Fido era un campo sulla TESSERA,
  // cioè uno per socio, e nessuna schermata lo scriveva più: era rimasto
  // a zero per tutti, e intanto la copertura automatica in prenotazione
  // non aveva nessun tetto affatto. Il Fido era rotto nelle due
  // direzioni opposte insieme.
  // Adesso è un numero solo, deciso dall'Admin, uguale per ogni socio:
  //   0  → Fido spento (è il valore di partenza)
  //  -1  → illimitato
  //  >0  → quanti euro di Fido ha a disposizione CIASCUN socio
  // ⚠️ Si legge sempre con `limiteFidoDi()`, mai direttamente: sui
  // documenti dei circoli che esistevano prima il campo non c'è, e
  // `undefined` in un confronto numerico non è zero — è una risposta
  // sbagliata a ogni domanda.
  limiteFido?: number;
  logoUrl?: string | null; // se assente, si mostra la sigla nel cerchio
  // Immagine dello sponsor, in cima alla Classifica Sfide e in Home
  // sotto le tre caselle. Sempre 3:1 — il ritaglio e' imposto in fase
  // di caricamento, cosi' la fascia non cambia mai altezza.
  //
  // ⚠️ Campo VECCHIO, da quando gli sponsor possono essere piu' d'uno.
  // Resta solo per i circoli che avevano gia' caricato la loro
  // immagine: si legge, non si scrive piu', e alla prima modifica
  // dall'Admin il valore passa da solo in sponsorSfideUrls. Per
  // leggere usare sempre immaginiSponsor(), mai questo campo.
  sponsorSfideUrl?: string | null;
  // Da 1 a MAX_IMMAGINI_SPONSOR immagini, mostrate a rotazione con una
  // dissolvenza nell'app. L'ordine e' quello in cui compaiono.
  sponsorSfideUrls?: string[] | null;
  // ⚠️ Campo STORICO: un tempo unico per tutti i banner. Non si scrive
  // piu'; si legge solo per ereditarne il valore la prima volta che si
  // guardano le durate per singolo banner. Vedi durateSponsor().
  sponsorSfideIntervallo?: number | null;
  // Una durata in secondi per ogni immagine, allineata a
  // sponsorSfideUrls. 0 = quel banner e' l'unico visibile e resta
  // fisso.
  sponsorSfideDurate?: number[] | null;
  // L'indirizzo del sito dello sponsor, uno per immagine e allineato a
  // sponsorSfideUrls come le durate. Stringa vuota o assente = quel
  // banner non si tocca, resta un cartellone.
  //
  // ⚠️ NON SI LEGGE MAI DA QUI. Si passa da linkSponsor(), che allunga
  // l'elenco fino al numero delle immagini e ricontrolla ogni
  // indirizzo: i circoli di prima questo campo non ce l'hanno, e un
  // elenco piu' corto avrebbe mandato il socio che tocca lo sponsor 3
  // sul sito dello sponsor 4.
  sponsorSfideLink?: (string | null)[] | null;
  // Quante ore prima dell'inizio dello slot un socio puo' ancora
  // disdire un CAMPO. 0 o assente = nessun limite, si cancella fino
  // all'ora di gioco. Il massimo e' ORE_LIMITE_CANCELLAZIONE_MAX (vedi
  // data/cancellazione.ts, dove sta tutta la logica).
  // ⚠️ Le LEZIONI non passano di qui: il loro termine e' del Maestro
  // che le tiene (oreLimiteCancellazioneLezioni su /maestri). Questo
  // numero resta il valore che il Maestro eredita finche' non sceglie
  // il suo.
  oreLimiteCancellazione?: number | null;
  // In che regione sta il circolo. Serve ai TORNEI, che sono la prima
  // cosa condivisa fra circoli: e' la regione con cui la bacheca parte
  // filtrata per i suoi soci, ed e' quella che l'Admin si ritrova gia'
  // spuntata quando pubblica. Senza, non c'e' modo di sapere dove sta
  // un circolo — l'indirizzo non e' mai stato chiesto.
  regione?: string | null;
  // ⚠️ Solo per il circolo dimostrativo dei revisori: chi chiede di
  // entrare viene approvato all'istante, senza che nessuno tocchi
  // niente. Lo accende e lo spegne SOLO il Super Admin — sta fra i
  // campi di rete nelle regole — perche' su un circolo vero vorrebbe
  // dire lasciare la porta aperta a chiunque.
  approvazioneAutomatica?: boolean;
  // ⚠️ SERVE AI BANNER DI RETE, oltre che all'anagrafica: uno sponsor
  // venduto su una provincia arriva ai circoli che stanno in quella
  // provincia, e senza questo campo un circolo non ci sta per
  // definizione — resterebbe raggiungibile solo da un banner
  // nazionale o regionale. Elenco chiuso, come per i tornei: scritta a
  // mano, «Messina» e «ME» sarebbero due province diverse.
  provincia?: string | null;
  // Il comune dove sta il circolo. Insieme a regione e provincia forma
  // la geografia dell'anagrafica.
  //
  // ⚠️ QUESTI TRE LI SCRIVE SOLO IL SUPER ADMIN, e le regole lo
  // impongono: sono la base su cui i banner e i tornei vengono
  // consegnati a una zona, e un circolo che si spostasse di regione da
  // solo cambierebbe, senza dirlo a nessuno, quello che abbiamo
  // venduto a uno sponsor. Se un circolo si trasferisce davvero,
  // chiama Racket Fever.
  comune?: string | null;
  limiteSfidaPosizioni?: number; // 0/assente = usa il default (5): quante posizioni sopra si può sfidare

  // ============================================================
  // ⚠️ LE SFIDE SI POSSONO SPEGNERE, CIRCOLO PER CIRCOLO.
  //
  // ASSENTE VUOL DIRE ACCESE, e non è una comodità: i circoli che
  // esistono già non hanno questo campo, e leggerlo come «spente»
  // vorrebbe dire far sparire il tabellone a tutti nel momento in cui
  // si pubblica questa versione. Stessa lettura di `stato` più in
  // basso, per la stessa ragione.
  //
  // Serve perché il sistema sfide di oggi applica UN regolamento solo,
  // quello posizionale: chi ha regole diverse non «aspetta la versione
  // modulare», la subisce — e la prima cosa che dice è che l'app fa una
  // cosa sbagliata. Spento, il circolo non lo vede proprio.
  //
  // ⚠️ Spegnere NON è un gesto neutro sull'app del socio, e i tre
  // effetti sono gestiti dove capitano, non qui: la voce della barra
  // diventa «Classifica» (senza, la classifica sociale resterebbe
  // irraggiungibile, perché oggi l'unica porta è dentro Sfide); le
  // prenotazioni nate da una sfida tornano a comparire in Home (lì sono
  // filtrate via apposta, perché normalmente si vedono dentro Sfide); e
  // nella classifica il pulsante «Sfida» resta a schermo ma spento, e
  // i riquadri verdi «questo lo puoi sfidare» diventano tutti rossi.
  // ============================================================
  sfideAttive?: boolean;
  // Solo web: sfumatura scelta dall'admin per la classifica sociale.
  // Non esiste nel mobile, va conservata quando si allineano i file.
  gradienteClassifica?: { da: string; a: string };
  // ============================================================
  // ⚠️ QUANTO DURANO I DUE TIMER DELLE SFIDE, in minuti, deciso dal
  // circolo. Era un sì/no — «24 ore (reale)» oppure «5 minuti (test)» —
  // e il nome del campo lo diceva: `timerSfideVeloce`, uno strumento di
  // prova finito in mano ai presidenti. Ma la domanda che il circolo si
  // pone è un'altra e non è di prova: quanto tempo do a un socio per
  // rispondere a una sfida? Un club di pensionati che gioca la mattina
  // e uno di impiegati che guarda il telefono la sera non hanno la
  // stessa risposta.
  //
  // Assente = 24 ore, cioè quello che facevano tutti prima. I circoli
  // che avevano acceso il vecchio interruttore continuano a leggere 5
  // minuti finché non toccano il nuovo comando: `durataTimerMs` guarda
  // prima questo campo e poi, se manca, il vecchio.
  //
  // ⚠️ Il campo VECCHIO non si cancella e non si rinomina: sta scritto
  // sui documenti dei circoli che l'hanno usato.
  // ============================================================
  minutiTimerSfida?: number;
  timerSfideVeloce?: boolean; // ⚠️ STORICO — vedi minutiTimerSfida qui sopra.

  // ============================================================
  // ANAGRAFICA DI RETE — la scrive e la legge il Super Admin.
  //
  // ⚠️ Sono tutti facoltativi perche' i circoli che esistono gia' non
  // li hanno: sono nati da uno script di seed che non li scriveva. Un
  // campo obbligatorio qui avrebbe fatto sparire dall'elenco proprio i
  // circoli piu' vecchi — quelli che ci interessa di piu' non perdere.
  // ============================================================

  // ⚠️ ASSENTE VUOL DIRE ATTIVO. E' l'unica lettura possibile: i
  // circoli scritti prima di oggi non hanno questo campo, e trattarli
  // come sospesi vorrebbe dire spegnere la piattaforma a tutti i soci
  // gia' iscritti nel momento in cui si pubblica questa versione.
  stato?: StatoCircolo;
  // Quando e' entrato in rete. Millisecondi, come tutte le altre date
  // che si confrontano nell'app.
  creatoIlMs?: number;
  // Lo stesso momento scritto dal server (Timestamp). E' quello che fa
  // fede — `creatoIlMs` viene dall'orologio del PC di chi ha creato il
  // circolo — e serve come ripiego: vedi attivazioneCircoloMs().
  creatoIl?: unknown;
  sospesoIlMs?: number | null;
  chiusoIlMs?: number | null;
  // Chi ha chiesto l'adesione e chi ha firmato il contratto: sono due
  // persone diverse piu' spesso di quanto si creda — chiede il
  // segretario, firma il presidente — e sapere QUALE delle due
  // chiamare quando qualcosa non va e' meta' del lavoro di assistenza.
  richiedenteNome?: string | null;
  richiedenteRuolo?: string | null;
  richiedenteEmail?: string | null;
  richiedenteTelefono?: string | null;
  firmatarioNome?: string | null;
  firmatarioRuolo?: string | null;
  firmaIl?: string | null; // 'YYYY-MM-DD'
  // La richiesta arrivata dal sito da cui questo circolo e' nato, se
  // ce n'e' una: e' il filo che lega il contatto commerciale al
  // circolo vero, e senza si perde la storia di come e' arrivato.
  richiestaId?: string | null;
  // Appunti del team. Non li vede nessun altro.
  noteInterne?: string | null;
}

// ---- Lo stato di un circolo nella rete ----
//
// ⚠️ TRE STATI E NON UN INTERRUTTORE, ed e' una scelta presa dopo
// averci ragionato. Un circolo tiene tessere, prenotazioni, movimenti,
// sfide e i portafogli dei soci: cancellarne il documento lascerebbe
// orfano tutto il resto, e il registro movimenti e' immutabile per
// costruzione — non si distrugge nemmeno volendo.
//
// 'sospeso' e' reversibile e serve al caso vero: un circolo che non
// paga, che sparisce, o che chiede una pausa. Esce dalla lista di
// scelta, non accetta nuove tessere ne' nuove prenotazioni, e tutto il
// resto resta leggibile — comprese le prenotazioni gia' fatte, che
// sono impegni presi con delle persone e non si annullano da soli.
//
// 'chiuso' e' definitivo e si mette solo su un circolo gia' sospeso:
// e' il modo di dire "questa storia e' finita" senza cancellare niente.
export type StatoCircolo = 'attivo' | 'sospeso' | 'chiuso';

export function statoCircolo(c?: { stato?: StatoCircolo } | null): StatoCircolo {
  return c?.stato ?? 'attivo';
}

// Il circolo accetta gente nuova e nuove prenotazioni?
export function circoloOperativo(c?: { stato?: StatoCircolo } | null): boolean {
  return statoCircolo(c) === 'attivo';
}

// Il circolo compare nella lista di chi cerca dove iscriversi?
// ⚠️ E' la stessa domanda di sopra, ma tenuta separata apposta: il
// giorno in cui servisse un circolo che resta visibile ma non accetta
// iscrizioni — o il contrario — le due risposte si separano qui e non
// in dieci schermate.
export function circoloSceglibile(c?: { stato?: StatoCircolo } | null): boolean {
  return statoCircolo(c) === 'attivo';
}

export function etichettaStatoCircolo(s: StatoCircolo): string {
  if (s === 'sospeso') return 'Sospeso';
  if (s === 'chiuso') return 'Chiuso';
  return 'Attivo';
}

// Gli 8 Temi App — sostituiscono del tutto il vecchio sistema
// (colore primario/accento personalizzabile liberamente + sfondo
// scelto a parte). Ogni Tema è un pacchetto chiuso e già coordinato:
// sfondo, colore pieno per blocchi/testi in risalto, e un accento
// secondario per bottoni/CTA — pensati apposta in coppia, mai
// componibili a piacere. Le card "vetro" (vedi theme/VetroCard.tsx)
// usano una meccanica unica per tutti e 8: cambia solo se la
// variante chiara o scura del vetro è attiva, non il tema in sé.
export interface TemaApp {
  nome: string;
  scuro: boolean;
  sfondoDa: string;
  sfondoA: string;
  primario: string; // blocchi pieni (es. testata Profilo) e testi/numeri in risalto
  accento: string;  // bottoni, CTA, evidenze secondarie
}

// Arancione comune: accento dei quattro temi scuri e, in tutti i temi
// chiari, colore dell'icona selezionata nella barra di navigazione.
export const ARANCIONE_SELEZIONE = '#D98A2B';

// Solo web: sfumature selezionabili dall'admin per la classifica
// sociale mostrata sul sito. Non esistono nell'app mobile.
export const GRADIENTI_CLASSIFICA = [
  { nome: 'Verde Pino', da: '#0E3B2E', a: '#1F7A45' },
  { nome: 'Terra Rossa', da: '#8A4420', a: '#C9702E' },
  { nome: 'Blu Notte', da: '#0B2C4D', a: '#1B5FA6' },
  { nome: 'Oro', da: '#8A6200', a: '#D4A017' },
  { nome: 'Grafite', da: '#1A1A1A', a: '#4A4A4A' },
];

// Fondo del box socio nei TEMI CHIARI: la testata li' e' color
// accento, e queste sono versioni molto scurite di quello stesso
// colore — scelte a mano, una per tema, cosi' restano nella stessa
// famiglia cromatica e reggono il testo bianco.
// I temi scuri non compaiono qui: usano sfondoA, il colore piu' scuro
// della loro sfumatura di sfondo.
export const FONDO_BOX_SOCIO_CHIARI: Record<string, string> = {
  bianco: '#1A1A1A',        // testata bianca: qui serve un nero neutro
  grigio: '#0B1C2E',        // da accento #14304D — blu notte
  violaChiaro: '#4A1339',   // da accento #8A2670 — viola scuro
  azzurroChiaro: '#063A5C', // da accento #0D6EAB — blu profondo
};



// ---- Sponsor ----
// Quante immagini puo' caricare un circolo, e i tempi ammessi sul
// cursore. Lo zero non e' un tempo: vuol dire "questo banner e'
// l'unico visibile, e resta fisso". Vedi durateSponsor().
// ⚠️ DA 5 A 10. Il circolo carica i suoi banner uno alla volta con
// «aggiungi immagine», come sempre: nessun numero da scegliere prima.
// A questi si aggiungono i banner di rete del Super Admin, che il
// circolo non vede e non gestisce — quindi la fascia puo' arrivare a
// venti in tutto. Vedi data/bannerRete.ts.
export const MAX_IMMAGINI_SPONSOR = 10;
// ⚠️ IL MASSIMO SCENDE A 20 SECONDI. Con i banner di rete che si
// intercalano a quelli del circolo la fascia si e' allungata, e
// mezzo minuto fermi sullo stesso sponsor voleva dire che gli ultimi
// della fila non li vedeva quasi nessuno. Lo zero resta e non e' un
// tempo: vuol dire «questo si prende la scena», e vale solo fra i
// banner del circolo.
export const INTERVALLI_SPONSOR = [0, 5, 10, 15, 20];
// L'elenco vero delle immagini sponsor di un circolo. Unico punto in
// cui si guarda il campo vecchio a immagine singola: tutto il resto
// dell'app passa da qui e non deve sapere che esiste.
export function immaginiSponsor(circolo?: {
  sponsorSfideUrls?: string[] | null;
  sponsorSfideUrl?: string | null;
} | null): string[] {
  if (!circolo) return [];
  const elenco = circolo.sponsorSfideUrls;
  if (Array.isArray(elenco) && elenco.length > 0) {
    return elenco.filter((u) => typeof u === 'string' && u.length > 0).slice(0, MAX_IMMAGINI_SPONSOR);
  }
  return circolo.sponsorSfideUrl ? [circolo.sponsorSfideUrl] : [];
}


// ⚠️ LA DURATA E' PER SINGOLO BANNER, non piu' una sola per tutti.
// Serve perche' gli sponsor non pagano tutti uguale: un Main Sponsor
// chiede piu' visibilita' di uno piccolo, e con un tempo unico non si
// poteva dargliela. `sponsorSfideDurate[i]` e' la durata dell'immagine
// in posizione i, in secondi.
//
// Lo ZERO ha un significato speciale: quel banner resta l'UNICO
// visibile, fisso, e gli altri non compaiono. E' il modo per dare a
// uno sponsor la scena intera per un periodo.
export const DURATA_SPONSOR_MINIMA = 5;
export const DURATA_SPONSOR_PREDEFINITA = 5;

// Le durate allineate all'elenco delle immagini, una per una.
// Fa anche da ponte per i circoli che hanno ancora il vecchio tempo
// unico: quello diventa il punto di partenza di tutti i banner, cosi'
// chi aveva impostato 30 secondi non se li vede diventare 5 di colpo.
export function durateSponsor(circolo?: {
  sponsorSfideUrls?: string[] | null;
  sponsorSfideUrl?: string | null;
  sponsorSfideDurate?: number[] | null;
  sponsorSfideIntervallo?: number | null;
} | null): number[] {
  const quante = immaginiSponsor(circolo).length;
  const salvate = circolo?.sponsorSfideDurate;
  const vecchioUnico = circolo?.sponsorSfideIntervallo;
  // ⚠️ Nel vecchio sistema lo zero voleva dire "fisso: si vede solo la
  // PRIMA". Trattandolo come "nessun valore" e mettendo tutti al
  // predefinito, un circolo che aveva dato l'esclusiva al suo Main
  // Sponsor si sarebbe visto girare tutti i banner ogni cinque
  // secondi, senza che nessuno avesse toccato niente. Quindi lo zero
  // di prima diventa lo zero di adesso, sul primo banner.
  const eraFisso = vecchioUnico === 0;
  // ⚠️ Anche il valore EREDITATO va riportato nella scala: un circolo
  // fermo al vecchio tempo unico di 30 secondi non ha nessuna durata
  // scritta per banner, quindi il tetto messo sul ramo qui sotto non lo
  // toccava — e il cursore del pannello si ritrovava lo stesso un
  // valore fuori scala. Se ne accorge solo una prova che parte dal
  // campo vecchio, ed e' esattamente quella che l'ha trovato.
  const massimoDurata = INTERVALLI_SPONSOR[INTERVALLI_SPONSOR.length - 1];
  const ereditata = typeof vecchioUnico === 'number' && vecchioUnico >= DURATA_SPONSOR_MINIMA
    ? Math.min(massimoDurata, vecchioUnico)
    : DURATA_SPONSOR_PREDEFINITA;
  return Array.from({ length: quante }, (_, i) => {
    const v = Array.isArray(salvate) ? salvate[i] : undefined;
    if (typeof v !== 'number') {
      if (eraFisso) return i === 0 ? 0 : DURATA_SPONSOR_PREDEFINITA;
      return ereditata;
    }
    // Fra zero e il minimo non c'e' niente: un banner che gira dopo
    // due secondi non lo legge nessuno.
    if (v <= 0) return 0;
    // ⚠️ E ANCHE UN TETTO, da quando il massimo e' sceso da 30 a 20.
    // I circoli che avevano scelto 25 o 30 quel numero ce l'hanno
    // ancora scritto: senza questo limite il cursore non lo trovava
    // nella scala, `indexOf` rispondeva -1, e il pannello mostrava
    // quel banner come «Fisso» — cioe' l'esatto contrario di quello
    // che fa. Riportarlo dentro la scala e' anche l'unico modo perche'
    // il primo salvataggio successivo lo sistemi davvero.
    return Math.min(massimoDurata, Math.max(DURATA_SPONSOR_MINIMA, v));
  });
}

// L'indice del banner che si e' preso la scena, se c'e' (-1 se
// nessuno). Con piu' di uno a zero vince il primo: l'ordine
// dell'elenco e' quello che l'Admin cambia con le frecce, quindi e'
// anche il modo per decidere quale.
export function sponsorFisso(circolo?: {
  sponsorSfideUrls?: string[] | null;
  sponsorSfideUrl?: string | null;
  sponsorSfideDurate?: number[] | null;
  sponsorSfideIntervallo?: number | null;
} | null): number {
  return durateSponsor(circolo).findIndex((d) => d === 0);
}

// ============================================================
// I LINK DEGLI SPONSOR — uno per immagine, nello stesso ordine.
//
// Unico punto da cui si leggono, esattamente come immaginiSponsor() e
// durateSponsor(): la lunghezza torna sempre uguale al numero delle
// immagini, e ogni indirizzo e' gia' passato dal controllo. Una casella
// vuota vuol dire «questo banner non si tocca».
// ============================================================
export function linkSponsor(circolo?: {
  sponsorSfideUrls?: string[] | null;
  sponsorSfideUrl?: string | null;
  sponsorSfideLink?: (string | null)[] | null;
} | null): string[] {
  return allineaLink(circolo?.sponsorSfideLink, immaginiSponsor(circolo).length);
}

export const TEMI_APP: Record<string, TemaApp> = {
  nero: { nome: 'Full Black', scuro: true, sfondoDa: '#1A1A1A', sfondoA: '#000000', primario: '#1A1A1A', accento: '#D98A2B' },
  verdeScuro: { nome: 'Green', scuro: true, sfondoDa: '#1B4A35', sfondoA: '#0A1F16', primario: '#123324', accento: '#D98A2B' },
  terraBattuta: { nome: 'Clay', scuro: true, sfondoDa: '#8A4420', sfondoA: '#3D1D0D', primario: '#5C2C13', accento: '#D98A2B' },
  campoSintetico: { nome: 'Solid Blue', scuro: true, sfondoDa: '#1B5FA6', sfondoA: '#0B2C4D', primario: '#0B2C4D', accento: '#D98A2B' },
  bianco: { nome: 'White', scuro: false, sfondoDa: '#FFFFFF', sfondoA: '#FAFAF8', primario: '#000000', accento: '#000000' },
  // ⚠️ I TRE TEMI CHIARI CONDIVIDONO IL FONDO, e va saputo prima di
  // ritoccarne uno: «Pearl Gray», «Pinky» e «Pure Cyan» cambiano solo
  // primario e accento — la sfumatura dietro è la stessa. Cambiarla in
  // uno solo vorrebbe dire tre grigi leggermente diversi che nessuno
  // ha deciso.
  //
  // ⚠️ GRIGIO NEUTRO, NON PIÙ FREDDO. Ci si è passati per tre valori,
  // e vale la pena sapere perché: il primo (#ECECEA → #DBDBD8) era
  // troppo scuro e virava al caldo; il secondo lo ha corretto tirando
  // il blu sopra il rosso, e la correzione era giusta ma esagerata —
  // su uno schermo acceso l'azzurrino si vedeva. Questo è la terza
  // misura, scelta da Giorgio: rosso, verde e blu allo stesso valore,
  // cioè nessuna dominante affatto, e più chiaro di tutti e due i
  // precedenti.
  //
  // ⚠️ E VA LETTO INSIEME AL FONDO DELLE CARD, in `theme/forme.ts`:
  // le due sfumature sono quasi lo stesso grigio e si distinguono per
  // come sono fatte, non per che colore sono — questa è lineare e
  // scende, quella è radiale e si spegne ai bordi. Cambiare questa
  // senza guardare quella vuol dire far sparire le card dentro la
  // pagina.
  grigio: { nome: 'Pearl Gray', scuro: false, sfondoDa: '#FCFCFC', sfondoA: '#EDEDED', primario: '#0E3B2E', accento: '#14304D' },
  violaChiaro: { nome: 'Pinky', scuro: false, sfondoDa: '#FCFCFC', sfondoA: '#EDEDED', primario: '#8A2670', accento: '#8A2670' },
  azzurroChiaro: { nome: 'Pure Cyan', scuro: false, sfondoDa: '#FCFCFC', sfondoA: '#EDEDED', primario: '#0D6EAB', accento: '#0D6EAB' },
};

export const TEMA_APP_DEFAULT = 'bianco';

// Al massimo UNA tariffa speciale per campo: una fascia oraria con
// un prezzo diverso dal prezzo base (es. "Con illuminazione").
export interface TariffaSpeciale {
  orarioInizio: string; // 'HH:MM'
  orarioFine: string;   // 'HH:MM'
  prezzo: number;
  etichetta: string;
  giorni: number[];     // 0=Domenica...6=Sabato; vuoto = tutti i giorni
}

export interface Campo {
  id: string;
  nome: string;
  // La riga sotto il nome, sul bottone del campo e negli elenchi.
  // ⚠️ Era "superficie" e voleva dire "terra rossa, sintetico, erba".
  // Adesso e' la DISCIPLINA — tennis, padel, beach — perche' un circolo
  // con piu' discipline ha bisogno di distinguerle prima ancora di
  // sapere su cosa si gioca. Resta un testo libero: chi ci vuole
  // scrivere "Tennis - Terra Rossa" puo' farlo.
  //
  // ⚠️ Il vecchio campo resta LEGGIBILE ma non si scrive piu'. I campi
  // creati prima non hanno "disciplina", e senza questa ricaduta si
  // ritroverebbero la riga vuota fino a quando qualcuno non li riapre
  // uno per uno.
  disciplina?: string;
  superficie?: string;
  ordine: number;
  prezzoOraDefault: number | null; // null = non ancora impostato dall'admin
  tariffaSpeciale?: TariffaSpeciale | null;
}

// La riga sotto il nome del campo, comunque sia scritta sul documento.
// Sta qui e non nelle schermate perche' la leggono in quattro punti
// diversi fra app e sito, e quattro ricadute scritte a mano sarebbero
// divergute alla prima disattenzione.
export function disciplinaDi(campo?: { disciplina?: string; superficie?: string } | null): string {
  return (campo?.disciplina ?? campo?.superficie ?? '').trim();
}

export interface Blocco {
  id: string;
  campoId: string;
  tipo: 'ricorrente' | 'data';
  giorniSettimana?: number[]; // 0=Domenica...6=Sabato, solo se tipo==='ricorrente'
  data?: string;              // 'YYYY-MM-DD', solo se tipo==='data'
  orarioInizio: string;
  orarioFine: string;
  etichetta: string;      // max 14 caratteri: compare sotto "Riservato" nello slot
  descrizione?: string;   // testo esteso, mostrato nel pop-up quando si tocca lo slot
  nascondiInfo?: boolean; // se true, i soci vedono solo "Riservato", non il motivo
}

// Genera le fasce orarie a mezz'ora tra due orari (inclusi).
function generaOrari(inizio: string, fine: string): string[] {
  const risultato: string[] = [];
  let [h, m] = inizio.split(':').map(Number);
  const [hf, mf] = fine.split(':').map(Number);
  while (h < hf || (h === hf && m <= mf)) {
    risultato.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
    m += 30;
    if (m >= 60) { m = 0; h += 1; }
  }
  return risultato;
}

export const ORARI = generaOrari('08:00', '23:00');

// Usato SOLO nei menu a tendina dell'Admin (orario di fine di una
// tariffa speciale o di un blocco): arriva a 23:30 così si può
// coprire per intero anche l'ultimo slot prenotabile (23:00-23:30).
export const ORARI_ESTESI = [...ORARI, '23:30'];

// Orario di fine di uno slot da mezz'ora (es. "18:00" → "18:30").
export function orarioFineSlot(orario: string): string {
  const [h, m] = orario.split(':').map(Number);
  let nm = m + 30;
  let nh = h;
  if (nm >= 60) { nm -= 60; nh += 1; }
  return `${String(nh).padStart(2, '0')}:${String(nm).padStart(2, '0')}`;
}

// Regola UNICA del passato per tutte le griglie — Socio, Admin,
// Maestro e pannello web. Uno slot appartiene al passato appena il suo
// orario di INIZIO e' trascorso: da quel momento non e' piu' gestibile
// da nessuno. Non si prenota, non si riserva, non si assegna, non si
// cancella toccandolo.
//
// Si guarda l'inizio e non la fine perche' una mezz'ora gia' cominciata
// non e' piu' vendibile: non si puo' dare a un socio un campo su cui si
// sta gia' giocando, e non si puo' nemmeno prenderselo per meta'. Prima
// le tre griglie non erano d'accordo — il Socio guardava l'inizio,
// Admin e Maestro la fine — e alle 10:15 la stessa mezz'ora risultava
// morta da una parte e viva dall'altra.
//
// ⚠️ Da non confondere con la regola delle CARD in Home, che invece
// guarda la FINE dell'ultimo slot: una partita in corso e' ancora una
// partita, e la sua card deve restare al suo posto fino al fischio.
export function slotNelPassato(data: string, orario: string, adesso: Date = new Date()): boolean {
  const [h, m] = orario.split(':').map(Number);
  const inizio = new Date(`${data}T00:00:00`);
  inizio.setHours(h, m, 0, 0);
  return adesso.getTime() >= inizio.getTime();
}

// Fascia oraria completa (es. "18:00 - 18:30"), da usare ovunque
// TRANNE che nelle celle della griglia (lì resta solo "18:00", per
// non affollarle): popup, avvisi/notifiche, storico prenotazioni.
export function fasciaOraria(orario: string): string {
  return `${orario} - ${orarioFineSlot(orario)}`;
}

// ============================================================
// QUANDO IL CIRCOLO E' ENTRATO IN RETE — la data su cui si ancora
// l'anno di fatturazione.
//
// ⚠️ SI GUARDA ANCHE `creatoIl`, e non e' pignoleria. Il periodo di
// fatturazione parte dall'anniversario dell'attivazione: senza data non
// si puo' ancorare niente, e il conto ripiega su «gli ultimi dodici
// mesi», che finiscono oggi. Il pannello leggeva quella fine come una
// scadenza e dichiarava scaduto, ogni giorno, ogni circolo a cui
// mancasse il campo. Bastava che ne mancasse UNO dei due: `creatoIlMs`
// e' scritto dal browser di chi crea il circolo, `creatoIl` dal server.
// Sono lo stesso istante, e chiederli tutti e due costa una riga.
// ============================================================
// ⚠️ PRIMA `creatoIl`, POI `creatoIlMs`, e l'ordine e' il punto. Sono
// lo stesso istante scritto due volte: `creatoIlMs` dall'orologio del
// PC di chi ha fatto l'onboarding, `creatoIl` dal server. Lo dice
// onboarding.ts, dove sono scritti: «creatoIl e' quello che fa fede,
// immune all'orologio sballato del PC di chi crea il circolo». Su
// questa data si ancora la scadenza di un contratto annuale: leggere
// per primo il numero del portatile e il timestamp del server solo come
// ripiego era fare l'esatto contrario di quello che il commento
// prometteva. `creatoIlMs` resta come ripiego perche' si legge subito,
// anche mentre la scrittura del server e' ancora in volo.
// ⚠️ CHIAMATA DA TUTTI E TRE I PUNTI CHE MONTANO LA SCHEDA, e la nota
// di prima diceva il contrario. Fino al 20 agosto 2026 il progetto
// mobile non la usava — il riquadro «Quota annuale» era stato tolto
// dalla Panoramica dentro l'app, e con lui l'unico chiamante — e il
// commento lo scriveva. Dal 21 agosto il riquadro e' tornato senza gli
// euro, come «Chi usa l'app», e i chiamanti sono tre:
// racket-fever/app/admin/dashboard.tsx nel mobile,
// racket-fever-web/app/admin/dashboard/page.tsx e
// racket-fever-web/app/superadmin/dashboard/SezioneCircoli.tsx sul
// sito. Un commento che dice «nessun chiamante» e' peggio di nessun
// commento: e' un invito a cancellare la funzione, ed e' la prima cosa
// che fa chi passa a fare pulizia.
export function attivazioneCircoloMs(
  circolo: { creatoIlMs?: number | null; creatoIl?: unknown } | null | undefined,
): number | null {
  if (!circolo) return null;
  const t = circolo.creatoIl as { toMillis?: () => number; seconds?: number } | undefined;
  if (t && typeof t.toMillis === 'function') return t.toMillis();
  if (t && typeof t.seconds === 'number') return t.seconds * 1000;
  const ms = circolo.creatoIlMs;
  if (typeof ms === 'number' && Number.isFinite(ms) && ms > 0) return ms;
  return null;
}

// ============================================================
// SE IN QUESTO CIRCOLO LE SFIDE SONO ACCESE.
//
// ⚠️ Una funzione e non `circolo.sfideAttive` scritto in giro: la
// lettura giusta è «assente vuol dire acceso», e ricopiarla a mano in
// otto punti vuol dire che al nono qualcuno scriverà
// `if (circolo.sfideAttive)` — che su un circolo senza il campo è
// falso, cioè spegne le sfide a tutti i circoli che esistono già.
// ============================================================
export function sfideAccese(circolo?: { sfideAttive?: boolean } | null): boolean {
  return circolo?.sfideAttive !== false;
}


// ============================================================
// IL FIDO — le regole di lettura di quel numero, in un posto solo.
//
// Il Fido è il prestito che il circolo fa al socio quando il credito
// non basta a pagare una prenotazione: non è denaro inventato, è un
// debito verso il circolo che si salda in segreteria. Per questo il
// tetto lo decide il circolo e non il socio, ed è uguale per tutti.
//
// ⚠️ Tre valori e non due, e il terzo è quello che si dimentica:
// «spento» e «illimitato» sono agli estremi opposti e sono TUTTI E DUE
// casi limite. Scritti a mano ogni volta che servono, prima o poi uno
// dei due viene trattato come l'altro — ed è la differenza fra «non
// puoi prenotare» e «prenota quanto vuoi».
// ============================================================

export const FIDO_SPENTO = 0;
export const FIDO_ILLIMITATO = -1;
// Il massimo impostabile con lo slider, in euro. Oltre c'è solo lo
// scatto «Illimitato», che vale -1 e non 55.
export const FIDO_MASSIMO = 50;
export const FIDO_PASSO = 5;
// L'ultimo scatto dello slider: uno in più del massimo in euro, ed è
// quello che significa «Illimitato».
export const FIDO_SLIDER_MAX = FIDO_MASSIMO + FIDO_PASSO;

// Il limite del circolo, con il ripiego giusto: i circoli che
// esistevano prima di questo campo non ce l'hanno, e per loro il Fido
// è spento finché l'Admin non decide altrimenti.
export function limiteFidoDi(circolo: { limiteFido?: number } | null | undefined): number {
  const v = circolo?.limiteFido;
  if (typeof v !== 'number' || Number.isNaN(v)) return FIDO_SPENTO;
  return v < 0 ? FIDO_ILLIMITATO : v;
}

// Quanto Fido resta a un socio. ⚠️ Restituisce Infinity quando il Fido
// è illimitato: chi lo mostra a schermo deve chiedere prima
// `fidoIllimitato()`, o scriverà «€ Infinity».
export function fidoResiduo(limite: number, usato: number): number {
  if (limite === FIDO_ILLIMITATO) return Number.POSITIVE_INFINITY;
  if (limite <= 0) return 0;
  return Math.max(0, Math.round((limite - (usato || 0)) * 100) / 100);
}

export function fidoIllimitato(limite: number): boolean {
  return limite === FIDO_ILLIMITATO;
}

// La domanda vera: con questo Fido e questo debito, ci stanno ancora
// `servono` euro di scoperto?
// ⚠️ Il confronto è con una tolleranza di mezzo centesimo. Le quote
// divise in tre o in quattro non tornano mai esatte, e senza tolleranza
// una prenotazione da 10,00 divisa per tre veniva rifiutata per un
// millesimo di euro — con un messaggio che parlava di Fido esaurito
// mentre a schermo i due numeri erano identici.
export function fidoCopre(limite: number, usato: number, servono: number): boolean {
  if (servono <= 0.005) return true;
  if (limite === FIDO_ILLIMITATO) return true;
  if (limite <= 0) return false;
  return servono <= fidoResiduo(limite, usato) + 0.005;
}

// Come si scrive quel numero a schermo. Una sola frase, usata sia
// dall'Admin che dal socio, così le due schermate non possono dire due
// cose diverse dello stesso valore.
export function etichettaFido(limite: number): string {
  if (limite === FIDO_ILLIMITATO) return 'Illimitato';
  if (limite <= 0) return 'Fido spento';
  return `€ ${limite} per socio`;
}

// Slider ⇄ valore salvato. Lo slider non conosce il -1: corre da 0 a
// FIDO_SLIDER_MAX a scatti di FIDO_PASSO, e l'ultimo scatto è
// «Illimitato».
export function fidoDaSlider(posizione: number): number {
  return posizione > FIDO_MASSIMO ? FIDO_ILLIMITATO : Math.max(0, Math.round(posizione));
}

export function fidoASlider(limite: number): number {
  if (limite === FIDO_ILLIMITATO) return FIDO_SLIDER_MAX;
  if (limite <= 0) return 0;
  return Math.min(FIDO_MASSIMO, limite);
}
