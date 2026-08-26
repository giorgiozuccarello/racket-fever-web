// ============================================================
// LA PARTE DELLA LINGUA CHE NON DIPENDE DA NIENTE.
//
// ⚠️ ESISTE PERCHE' ADESSO IL DIZIONARIO SERVE ANCHE AL SERVER. Fino
// alla tornata 104 `data/lingue.ts` era un file solo, e andava bene:
// lo leggevano l'app e il sito, che React Native e il browser ce
// l'hanno per definizione. Poi gli avvisi hanno dovuto arrivare nella
// lingua di chi li legge, e a scriverne una parte e' il SERVER — dove
// non esiste ne' AsyncStorage ne' `navigator`, e dove importare
// `react-native` significa una funzione che non parte.
//
// Qui dentro ci sono solo il tipo, l'elenco e due controlli: nessun
// import, nessuna dipendenza, niente che presupponga di girare su un
// telefono. `data/lingue.ts` lo rimette insieme al resto per l'app;
// `data/testi.ts` importa SOLO da qui, ed e' per questo che il
// dizionario si puo' copiare dentro le Cloud Functions senza portarsi
// dietro mezza applicazione.
//
// ⚠️ Chi tocca questo file si ricordi che ne esistono tre copie —
// app, sito e `functions/src/testi/` — e che la terza la fa un
// programma (`functions/scripts/copiaTesti.js`), non una persona.
// ============================================================

export type Lingua = 'it' | 'en' | 'de';

export type RuoloLingua = 'socio' | 'maestro' | 'admin';

// ⚠️ L'ordine e' quello che si legge nel selettore, e parte
// dall'italiano perche' e' la lingua di casa.
//
// ⚠️ Il nome e' NELLA LINGUA STESSA — «English», non «Inglese». Chi
// cerca la propria lingua in un elenco cerca la parola che conosce, e
// «Inglese» non la conosce proprio chi ne ha bisogno.
export const LINGUE: Array<{ codice: Lingua; bandiera: string; nome: string }> = [
  { codice: 'it', bandiera: '🇮🇹', nome: 'Italiano' },
  { codice: 'en', bandiera: '🇬🇧', nome: 'English' },
  { codice: 'de', bandiera: '🇩🇪', nome: 'Deutsch' },
];

export const LINGUA_DI_SERIE: Lingua = 'it';

export function linguaValida(v: unknown): v is Lingua {
  return v === 'it' || v === 'en' || v === 'de';
}

// ⚠️ Non lancia e non torna mai nulla: qualunque cosa arrivi — un
// campo assente, una stringa storpiata, un numero — diventa italiano.
// E' la funzione che sta fra Firestore e il dizionario, e li' dentro
// un valore inatteso non deve poter spegnere un avviso.
export function linguaOItaliano(v: unknown): Lingua {
  return linguaValida(v) ? v : LINGUA_DI_SERIE;
}

export function schedaLingua(l: Lingua) {
  return LINGUE.find((x) => x.codice === l) ?? LINGUE[0];
}
