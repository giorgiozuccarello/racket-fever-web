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
  // Secondi fra un cambio e l'altro: 0 = fisso, si vede la prima e
  // basta. Vedi INTERVALLI_SPONSOR per i valori ammessi.
  sponsorSfideIntervallo?: number | null;
  // Quante ore prima dell'inizio dello slot un socio puo' ancora
  // disdire. 0 o assente = nessun limite, si cancella fino all'ora di
  // gioco. Il massimo e' ORE_LIMITE_CANCELLAZIONE_MAX (vedi
  // data/cancellazione.ts, dove sta tutta la logica).
  oreLimiteCancellazione?: number | null;
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
// Quante immagini puo' caricare un circolo, e i tempi di cambio
// ammessi. Lo zero e' "fisso": si vede solo la prima.
export const MAX_IMMAGINI_SPONSOR = 5;
export const INTERVALLI_SPONSOR = [0, 5, 10, 15, 20, 25, 30];
// Tempo che si applica da solo quando l'Admin carica la seconda
// immagine avendo lasciato il cambio su "fisso": senza, il secondo
// sponsor — che magari ha pagato — non comparirebbe mai.
export const INTERVALLO_SPONSOR_MINIMO = 5;

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

// Il tempo di cambio da usare davvero. Con una sola immagine non c'e'
// nulla da alternare, quindi vale zero qualunque cosa dica il campo.
export function intervalloSponsor(circolo?: {
  sponsorSfideUrls?: string[] | null;
  sponsorSfideUrl?: string | null;
  sponsorSfideIntervallo?: number | null;
} | null): number {
  if (immaginiSponsor(circolo).length < 2) return 0;
  const valore = circolo?.sponsorSfideIntervallo;
  return typeof valore === 'number' && valore > 0 ? valore : 0;
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
  superficie: string;
  ordine: number;
  prezzoOraDefault: number | null; // null = non ancora impostato dall'admin
  tariffaSpeciale?: TariffaSpeciale | null;
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

// Fascia oraria completa (es. "18:00 - 18:30"), da usare ovunque
// TRANNE che nelle celle della griglia (lì resta solo "18:00", per
// non affollarle): popup, avvisi/notifiche, storico prenotazioni.
export function fasciaOraria(orario: string): string {
  return `${orario} - ${orarioFineSlot(orario)}`;
}
