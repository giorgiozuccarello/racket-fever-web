// ============================================================
// MESSAGGI RAPIDI — le uniche frasi che un socio può mandare.
//
// ⚠️ QUESTO FILE ESISTE PERCHÉ IL TESTO LIBERO È STATO TOLTO, e non è
// una semplificazione dell'interfaccia: è la scelta che rende l'app
// difendibile davanti agli store senza doverci dare il potere di
// leggere le conversazioni di tutti.
//
// Il ragionamento, per chi lo trova fra un anno. Google e Apple
// pretendono, da chi ospita contenuti scritti dagli utenti, un filtro
// prima della pubblicazione, una segnalazione con risposta rapida e un
// modo di bloccare le persone moleste. Il filtro e la cancellazione di
// un messaggio segnalato avrebbero voluto dire una cosa sola: che
// qualcuno di noi può leggere le chat private di due soci. Possibile,
// ma è il ramo peggiore — va dichiarato nell'informativa, e va
// difeso. Togliendo il posto dove si scrive, il problema non si
// gestisce: non esiste.
//
// ⚠️ E IL CODICE VIAGGIA AL POSTO DEL TESTO. Sul messaggio si scrive
// solo `codice`, mai la frase: se si scrivesse anche il testo, chi
// chiama l'API a mano manderebbe il codice giusto e la frase che vuole,
// e avremmo rimesso il testo libero da un'altra porta. Le regole
// accettano solo i codici di questo elenco; la frase la mette l'app in
// lettura. Cambiare una formulazione qui la cambia anche nei messaggi
// già mandati, ed è voluto.
//
// ⚠️ FILE GEMELLO, identico byte per byte nei due progetti, e senza
// import: si prova da solo.
// ============================================================

export interface FraseRapida {
  codice: string;
  testo: string;
}

// ---- Lezioni: dal socio al maestro
export const FRASI_LEZIONE_SOCIO: FraseRapida[] = [
  { codice: 'lz_confermo', testo: 'Confermo, a dopo' },
  { codice: 'lz_ritardo', testo: 'Arrivo con dieci minuti di ritardo' },
  { codice: 'lz_spostare', testo: 'Possiamo spostare?' },
  { codice: 'lz_annullo', testo: 'Devo annullare, ti chiamo' },
  { codice: 'lz_grazie', testo: 'Va bene, grazie' },
];

// ---- Lezioni: dal maestro al socio
export const FRASI_LEZIONE_MAESTRO: FraseRapida[] = [
  { codice: 'lz_m_confermo', testo: 'Confermo la lezione' },
  { codice: 'lz_m_ritardo', testo: 'Arrivo con dieci minuti di ritardo' },
  { codice: 'lz_m_spostare', testo: 'Devo spostare, ti chiamo' },
  { codice: 'lz_m_campo', testo: 'Ci vediamo in campo' },
  { codice: 'lz_m_grazie', testo: 'Va bene, grazie' },
];

// ---- Sfide: le stesse per tutti e due
//
// ⚠️ Servono anche qui, e non era scontato: la sfida si accorda con la
// proposta di orari, ma fra una proposta e l'altra due persone hanno
// bisogno di dire «per me va bene» o «quel giorno no». Senza, l'unico
// modo di rispondere a una proposta sarebbe rilanciarne un'altra — e
// chi non può in nessuno di quei giorni non avrebbe nulla da toccare.
export const FRASI_SFIDA: FraseRapida[] = [
  { codice: 'sf_ok', testo: 'Per me va bene' },
  { codice: 'sf_no_giorni', testo: 'In quei giorni non posso' },
  { codice: 'sf_proponi_tu', testo: 'Proponi tu un orario' },
  { codice: 'sf_ci_sono', testo: 'Ci sono, a presto' },
  { codice: 'sf_ritardo', testo: 'Arrivo con dieci minuti di ritardo' },
];

// Tutte insieme: serve a ritrovare la frase da un codice, e a tenere
// l'elenco dei codici ammessi in un punto solo.
const TUTTE: FraseRapida[] = [
  ...FRASI_LEZIONE_SOCIO,
  ...FRASI_LEZIONE_MAESTRO,
  ...FRASI_SFIDA,
];

export const CODICI_RAPIDI: string[] = TUTTE.map((f) => f.codice);

// ⚠️ Ritorna stringa vuota su un codice sconosciuto, non «undefined» e
// non il codice stesso. Un messaggio scritto da una versione più nuova
// dell'app — o da qualcuno che ha provato a inventarsi un codice —
// deve semplicemente non dire niente, non mostrare una sigla tecnica
// dentro una bolla di chat.
export function testoDiCodice(codice: string | null | undefined): string {
  if (!codice) return '';
  return TUTTE.find((f) => f.codice === codice)?.testo ?? '';
}

export function codiceValido(codice: string | null | undefined): boolean {
  return !!codice && CODICI_RAPIDI.includes(codice);
}

// ============================================================
// COSA MOSTRARE IN UNA BOLLA.
//
// I messaggi scritti prima di questa tornata hanno il testo dentro e
// nessun codice: continuano a leggersi, perché cancellarli avrebbe
// tolto a due persone la loro conversazione per una decisione che non
// hanno preso. Quelli nuovi hanno solo il codice.
// ============================================================
export function testoDaMostrare(
  m: { codice?: string | null; testo?: string | null },
): string {
  if (m.codice) return testoDiCodice(m.codice);
  return (m.testo ?? '').trim();
}
