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
  tema: { primario: string; accento: string };
  limiteOreSettimanali: number; // 0 = nessun limite
  logoUrl?: string | null; // se assente, si mostra la sigla nel cerchio
  gradienteClassifica?: { da: string; a: string } | null; // sfondo della schermata Classifica Sociale
  limiteSfidaPosizioni?: number; // 0/assente = usa il default (5): quante posizioni sopra si può sfidare
  timerSfideVeloce?: boolean; // true = i 2 timer delle Sfide durano 5 minuti invece di 24 ore (solo per i test)
  sfondoApp?: string; // chiave di uno dei temi in TEMI_SFONDO_APP — assente = tema di default (Bianco)
}

// 6 temi per lo sfondo generale dell'app (Strada A: solo lo sfondo
// "dietro" le card cambia — le card restano bianche con testo nero,
// sempre leggibili qualunque tema sia attivo). I primi 3 sono chiari
// (i titoli fuori dalle card restano neri), gli ultimi 3 sono scuri
// (i titoli fuori dalle card diventano bianchi).
export interface TemaSfondoApp { nome: string; da: string; a: string; scuro: boolean }

export const TEMI_SFONDO_APP: Record<string, TemaSfondoApp> = {
  bianco: { nome: 'Bianco', da: '#FFFFFF', a: '#F5F4F2', scuro: false },
  latte: { nome: 'Latte', da: '#FFF9F0', a: '#F2E8D8', scuro: false },
  avorio: { nome: 'Avorio', da: '#FFFFF2', a: '#F3EFD9', scuro: false },
  nero: { nome: 'Nero', da: '#2A2A2A', a: '#0D0D0D', scuro: true },
  bluScuro: { nome: 'Blu scuro', da: '#1B2A47', a: '#0B1424', scuro: true },
  violaScuro: { nome: 'Viola scuro', da: '#33203F', a: '#160D1C', scuro: true },
};

// 5 gradienti scuri predefiniti per lo sfondo della Classifica Sociale —
// stessa filosofia dei Temi colori: nessun colore libero, solo scelte
// pensate in anticipo per restare leggibili.
export const GRADIENTI_CLASSIFICA: { nome: string; da: string; a: string }[] = [
  { nome: 'Notte', da: '#0B1F3A', a: '#1E5C8A' },
  { nome: 'Abisso', da: '#0A0E27', a: '#2C3E66' },
  { nome: 'Oceano', da: '#0C2340', a: '#155263' },
  { nome: 'Indaco', da: '#1A1B4B', a: '#4A5FA5' },
  { nome: 'Ardesia', da: '#101822', a: '#2E4057' },
];

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
  etichetta: string;
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
