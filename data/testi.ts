// ============================================================
// I TESTI NELLE TRE LINGUE — dove si prendono e come si tengono onesti.
//
// ⚠️ L'ITALIANO E' LA FONTE, LE ALTRE DUE SI CONTROLLANO DA SOLE.
// Ogni blocco di traduzioni si costruisce con `blocco(it, en, de)`, e
// quella funzione chiede a TypeScript che inglese e tedesco abbiano
// ESATTAMENTE le stesse chiavi dell'italiano. Una traduzione
// dimenticata non e' una schermata con una frase in italiano in mezzo
// alle altre: e' un errore di compilazione, cioe' una cosa che si vede
// PRIMA di impacchettare. E' l'unica difesa che funziona davvero,
// perche' nessuno riapre tre schermate in tre lingue a ogni modifica.
//
// ⚠️ CHIAVI PARLANTI E CON IL PREFISSO DELLA SCHERMATA. `imp.titolo`,
// non `titolo1`. Le chiavi finiscono dentro il codice delle schermate:
// una chiave che non si legge costringe a tenere aperto questo file per
// capire cosa disegna una riga.
//
// ⚠️ I TESTI SCRITTI DAL SERVER RESTANO IN ITALIANO, ed e' una scelta,
// non una dimenticanza. Gli avvisi in bacheca, le notifiche push, le
// righe del registro movimenti e le card di sistema nelle chat NON
// passano di qui: sono frasi che il server compone e SCRIVE su
// Firestore nel momento in cui il fatto succede, e restano scritte.
// Tradurle vorrebbe dire o scriverne tre copie a ogni evento, o
// tradurle al volo alla lettura — cioe' rileggere e reinterpretare
// frasi gia' salvate, che e' il modo piu' rapido per far dire a un
// avviso vecchio una cosa che non diceva. Si affronta quando serve, e
// si affronta dal server. Qui si traduce cio' che l'app DISEGNA.
//
// ⚠️ IL TEDESCO ABBREVIA DOVE LO SPAZIO E' STRETTO. Non e' pigrizia:
// «Mittwoch» al posto di «mer» in una colonna della griglia larga
// quaranta punti non ci sta, e il testo o va a capo storto o viene
// tagliato a meta'. Nelle pastiglie, nelle intestazioni della griglia e
// nelle etichette dei numeri si usa la forma corta che un tedesco legge
// tutti i giorni (Mo Di Mi Do Fr Sa So, Std., Min.); nelle frasi
// distese si scrive per esteso.
// ============================================================

// ⚠️ DA `linguaBase` E NON DA `lingue`, e la differenza e' tutta qui:
// `lingue.ts` importa AsyncStorage e react-native, e questo file viene
// copiato dentro le Cloud Functions, dove quella riga sarebbe una
// funzione che non parte.
import { Lingua, LINGUA_DI_SERIE } from './linguaBase';
import { admin } from './traduzioni/admin';
import { avvisi } from './traduzioni/avvisi';
import { comune } from './traduzioni/comune';
import { panoramica } from './traduzioni/panoramica';

// ⚠️ QUESTA FUNZIONE E' TUTTA LA RETE DI SICUREZZA. `Record<keyof T,
// string>` sui due parametri dopo l'italiano vuol dire: stesse chiavi,
// nessuna in meno e nessuna in piu'. Toglierne una, o scriverne una
// storpiata, e' un errore rosso in compilazione.
export function blocco<T extends Record<string, string>>(
  it: T,
  en: Record<keyof T, string>,
  de: Record<keyof T, string>,
): { it: T; en: Record<keyof T, string>; de: Record<keyof T, string> } {
  return { it, en, de };
}

// ⚠️ TRE BLOCCHI E NON SEI, ed e' l'unica differenza col gemello
// dell'app. «Impostazioni», «Maestro» e «Griglia» sono schermate che
// sul sito non esistono: portarne qui il dizionario vorrebbe dire
// spedire al browser qualche decina di chilobyte di frasi che nessuna
// pagina disegnera' mai. I due blocchi che restano — le parole comuni
// e la Panoramica — sono copia esatta di quelli dell'app, e devono
// restarlo: e' la stessa scheda vista da due parti.
const DIZIONARIO = {
  it: { ...admin.it, ...avvisi.it, ...comune.it, ...panoramica.it },
  en: { ...admin.en, ...avvisi.en, ...comune.en, ...panoramica.en },
  de: { ...admin.de, ...avvisi.de, ...comune.de, ...panoramica.de },
};

export type ChiaveTesto = keyof typeof DIZIONARIO.it;

// ============================================================
// I BUCHI NELLE FRASI — `{nome}`, `{n}`, `{quando}`.
//
// ⚠️ Un segnaposto e non un pezzo di frase concatenato, e la
// differenza si vede solo traducendo: «Esci da {circolo}?» in tedesco
// diventa «{circolo} verlassen?», con il nome PRIMA del verbo.
// Componendo la frase a pezzi nel codice — 'Esci da ' + nome + '?' —
// quell'ordine non si puo' cambiare, e la traduzione tedesca sarebbe
// costretta a seguire la grammatica italiana.
//
// ⚠️ Un valore mancante lascia il segnaposto a vista invece di
// scrivere «undefined»: brutto, ma leggibile e riconoscibile a colpo
// d'occhio in prova.
// ============================================================
export type ValoriTesto = Record<string, string | number>;

function riempi(frase: string, valori?: ValoriTesto): string {
  if (!valori) return frase;
  return frase.replace(/\{(\w+)\}/g, (intero, nome) => {
    const v = valori[nome];
    return v === undefined || v === null ? intero : String(v);
  });
}

// ⚠️ IL RIPIEGO E' L'ITALIANO, NON LA CHIAVE. Se un giorno una chiave
// arrivasse qui senza traduzione — succede solo aggirando i controlli,
// ma succede — a schermo si legge la frase italiana e non
// «pre.pastiglia.limite». La prima e' una lingua sbagliata, la seconda
// e' un'app rotta.
export function traduci(lingua: Lingua, chiave: ChiaveTesto, valori?: ValoriTesto): string {
  const tavola = DIZIONARIO[lingua] ?? DIZIONARIO[LINGUA_DI_SERIE];
  const frase = (tavola as Record<string, string>)[chiave as string]
    ?? (DIZIONARIO[LINGUA_DI_SERIE] as Record<string, string>)[chiave as string]
    ?? String(chiave);
  return riempi(frase, valori);
}

// Comoda quando una schermata traduce venti frasi: si lega la lingua
// una volta e si scrive `t('...')`.
export type Traduttore = (chiave: ChiaveTesto, valori?: ValoriTesto) => string;

export function traduttore(lingua: Lingua): Traduttore {
  return (chiave, valori) => traduci(lingua, chiave, valori);
}

// ============================================================
// IL TRADUTTORE CON LA PORTA LARGA.
//
// ⚠️ SERVE A CHI COMPONE LA CHIAVE MENTRE GIRA. `traduci` accetta solo
// chiavi che esistono, e in compilazione è la difesa migliore che
// abbiamo: una chiave storpiata è un errore rosso, non una schermata
// con scritto «adm.tor.stato». Ma `com.m.${mese + 1}` è una chiave che
// nasce durante l'esecuzione, e TypeScript non può saperne niente.
//
// ⚠️ E SERVE AI FILE CHE NON POSSONO IMPORTARE QUESTO. `data/giorni.ts`
// e `data/tornei.ts` vengono copiati dentro le Cloud Functions e non
// importano il dizionario: dichiarano una loro firma larga
// `(chiave: string) => string` e chi li chiama gli passa questo.
//
// ⚠️ NON SI USA PER COMODITÀ. Ogni chiamata con la porta larga è un
// controllo in meno: si adopera dove la chiave è davvero composta a
// mano, mai per evitare di scrivere il tipo giusto.
// ============================================================
export function libero(t: Traduttore): (chiave: string) => string {
  return (chiave: string) => t(chiave as ChiaveTesto);
}
