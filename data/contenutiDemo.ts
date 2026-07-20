// ============================================================
// CONTENUTI DEMO — tornei, classifica, chat.
// Ancora locali, non su Firestore: la loro migrazione è un passo
// successivo (dopo Layer 2). Tenerli separati dal documento
// "circoli" evita di mischiare configurazione reale (che l'Admin
// Circolo modifica) con contenuti ancora finti.
// ============================================================

export interface Torneo {
  nome: string;
  meta: string;
  stato: 'open' | 'live';
}

export interface RigaClassifica {
  pos: number;
  nome: string;
  pts: number;
  me?: boolean;
}

export interface Messaggio {
  da: string;
  testo: string;
  mia: boolean;
}

interface ContenutoCircolo {
  tornei: Torneo[];
  classifica: RigaClassifica[];
  chat: Messaggio[];
}

export const CONTENUTI_DEMO: Record<string, ContenutoCircolo> = {
  milazzo: {
    tornei: [
      { nome: 'Torneo di Ferragosto', meta: 'Singolare maschile · dal 10 agosto', stato: 'open' },
      { nome: 'Coppa del Capo', meta: 'Doppio misto · in corso, quarti di finale', stato: 'live' },
    ],
    classifica: [
      { pos: 1, nome: 'Giulia Ferrara', pts: 1240 },
      { pos: 2, nome: 'Antonio Ruggeri', pts: 1180 },
      { pos: 3, nome: 'Marco Costa', pts: 1105, me: true },
      { pos: 4, nome: 'Sara Lombardo', pts: 1030 },
      { pos: 5, nome: 'Peppe Calderone', pts: 980 },
    ],
    chat: [
      { da: 'Giulia F.', testo: 'Qualcuno per un doppio domani alle 18?', mia: false },
      { da: 'Antonio R.', testo: 'Io ci sono! Serve un quarto 🎾', mia: false },
    ],
  },
  etna: {
    tornei: [
      { nome: 'Etna Open', meta: 'Singolare open · iscrizioni fino al 30 luglio', stato: 'open' },
    ],
    classifica: [
      { pos: 1, nome: 'Rosario Sciuto', pts: 1310 },
      { pos: 2, nome: 'Marco Costa', pts: 1220, me: true },
      { pos: 3, nome: 'Carmen Nicolosi', pts: 1150 },
    ],
    chat: [
      { da: 'Rosario S.', testo: 'Campo Vulcano appena rifatto, una meraviglia!', mia: false },
    ],
  },
};

export const CONTENUTO_VUOTO: ContenutoCircolo = { tornei: [], classifica: [], chat: [] };
