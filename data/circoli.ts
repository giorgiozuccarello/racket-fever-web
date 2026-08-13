// ============================================================
// TIPI CIRCOLO — i dati veri vivono ora su Firestore
// (vedi data/circoliRepo.ts). Qui restano solo le interfacce e
// qualche utility che non dipende dal backend.
// ============================================================

export interface Circolo {
  id: string;
  nome: string;
  citta: string;
  sigla: string;
  password: string;
  temaApp: string; // chiave di uno degli 8 TEMI_APP — scelto dall'Admin, vale anche per i Maestri
  limiteOreSettimanali: number; // 0 = nessun limite
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
  limiteSfidaPosizioni?: number; // 0/assente = usa il default (5): quante posizioni sopra si può sfidare
  // Solo web: sfumatura scelta dall'admin per la classifica sociale.
  // Non esiste nel mobile, va conservata quando si allineano i file.
  gradienteClassifica?: { da: string; a: string };
  timerSfideVeloce?: boolean; // true = i 2 timer delle Sfide durano 5 minuti invece di 24 ore (solo per i test)
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
export const MAX_IMMAGINI_SPONSOR = 5;
export const INTERVALLI_SPONSOR = [0, 5, 10, 15, 20, 25, 30];
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
  const ereditata = typeof vecchioUnico === 'number' && vecchioUnico >= DURATA_SPONSOR_MINIMA
    ? vecchioUnico
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
    return Math.max(DURATA_SPONSOR_MINIMA, v);
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

export const TEMI_APP: Record<string, TemaApp> = {
  nero: { nome: 'Full Black', scuro: true, sfondoDa: '#1A1A1A', sfondoA: '#000000', primario: '#1A1A1A', accento: '#D98A2B' },
  verdeScuro: { nome: 'Green', scuro: true, sfondoDa: '#1B4A35', sfondoA: '#0A1F16', primario: '#123324', accento: '#D98A2B' },
  terraBattuta: { nome: 'Clay', scuro: true, sfondoDa: '#8A4420', sfondoA: '#3D1D0D', primario: '#5C2C13', accento: '#D98A2B' },
  campoSintetico: { nome: 'Solid Blue', scuro: true, sfondoDa: '#1B5FA6', sfondoA: '#0B2C4D', primario: '#0B2C4D', accento: '#D98A2B' },
  bianco: { nome: 'White', scuro: false, sfondoDa: '#FFFFFF', sfondoA: '#FAFAF8', primario: '#000000', accento: '#000000' },
  grigio: { nome: 'Pearl Gray', scuro: false, sfondoDa: '#ECECEA', sfondoA: '#DBDBD8', primario: '#0E3B2E', accento: '#14304D' },
  violaChiaro: { nome: 'Pinky', scuro: false, sfondoDa: '#ECECEA', sfondoA: '#DBDBD8', primario: '#8A2670', accento: '#8A2670' },
  azzurroChiaro: { nome: 'Pure Cyan', scuro: false, sfondoDa: '#ECECEA', sfondoA: '#DBDBD8', primario: '#0D6EAB', accento: '#0D6EAB' },
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
