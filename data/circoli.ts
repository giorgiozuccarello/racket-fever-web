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
}

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

export const ORARI = [...generaOrari('08:00', '12:00'), ...generaOrari('16:00', '22:00')];

// Usato SOLO nei menu a tendina dell'Admin (orario di fine di una
// tariffa speciale o di un blocco): arriva a 23:00 così si può
// coprire per intero anche l'ultimo slot prenotabile (22:00-22:30).
export const ORARI_ESTESI = [...ORARI, '22:30', '23:00'];
