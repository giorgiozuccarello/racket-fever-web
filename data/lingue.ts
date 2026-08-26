// ============================================================
// LE TRE LINGUE — gemello del file dell'app (racket-fever/data/lingue.ts).
//
// ⚠️ STESSA API, MAGAZZINO DIVERSO, e non poteva essere altrimenti:
// sul telefono la memoria e' AsyncStorage e risponde con una promessa,
// nel browser e' `localStorage` e risponde subito. Le firme restano
// asincrone anche qui — `leggiLinguaSalvata` risponde con una promessa
// gia' risolta — perche' cosi' le due schermate gemelle si scrivono
// nello stesso modo, e il giorno che una riga si sposta da un progetto
// all'altro non va riadattata.
//
// ⚠️ TRE ATTORI, TRE SCELTE SEPARATE. Sul sito ne serve una sola —
// l'Admin — ma la chiave e' la stessa dell'app (`rf.lingua.admin`)
// perche' e' lo stesso concetto, e due nomi diversi per la stessa cosa
// sono l'inizio di una divergenza.
//
// ⚠️ IN LOCALE, NON SU FIRESTORE. La lingua e' una preferenza del
// dispositivo, non della persona: il computer della segreteria puo'
// stare in italiano mentre chi presiede legge in tedesco dal proprio.
// Nessun campo nuovo, nessuna regola da mandare in produzione.
// ============================================================

// ⚠️ IL TIPO, L'ELENCO E I CONTROLLI STANNO IN `linguaBase.ts`, e da
// li' si riesportano. Non e' una divisione per eleganza: quel file non
// importa niente — nemmeno react-native — ed e' l'unico modo perche'
// il dizionario possa essere copiato dentro le Cloud Functions, dove
// AsyncStorage non esiste. Qui resta cio' che ha bisogno di un
// telefono: la memoria e la lingua di sistema.
export type { Lingua, RuoloLingua } from './linguaBase';
export { LINGUE, LINGUA_DI_SERIE, linguaValida, linguaOItaliano, schedaLingua } from './linguaBase';

import { Lingua, LINGUA_DI_SERIE, RuoloLingua, linguaValida } from './linguaBase';

// ============================================================
// LA LINGUA DEL BROWSER — solo al primo ingresso.
//
// ⚠️ VALE UNA VOLTA SOLA: dal momento in cui si tocca il selettore
// comanda la scelta a mano, e il browser non viene piu' consultato.
//
// ⚠️ `navigator` NON ESISTE mentre Next.js disegna la pagina sul
// server, e leggerlo li' e' un errore in fase di build, non a schermo.
// Di qui il controllo su `typeof`.
// ============================================================
function codiceSistema(): string {
  try {
    if (typeof navigator !== 'undefined') {
      const n: any = navigator;
      const v = Array.isArray(n.languages) && n.languages.length ? n.languages[0] : n.language;
      if (typeof v === 'string' && v.length >= 2) return v;
    }
  } catch { /* si prova la strada dopo */ }
  try {
    const v = new Intl.DateTimeFormat().resolvedOptions().locale;
    if (typeof v === 'string' && v.length >= 2) return v;
  } catch { /* si resta all'italiano */ }
  return '';
}

export function linguaDelTelefono(): Lingua {
  const codice = codiceSistema().toLowerCase().replace('_', '-').split('-')[0];
  if (codice === 'en') return 'en';
  // ⚠️ Il tedesco della Svizzera si dichiara «gsw» e non «de».
  if (codice === 'de' || codice === 'gsw') return 'de';
  return LINGUA_DI_SERIE;
}

export function chiaveLingua(ruolo: RuoloLingua): string {
  return `rf.lingua.${ruolo}`;
}

// ⚠️ `localStorage` puo' LANCIARE, non solo essere vuoto: in
// navigazione privata su Safari, e con i cookie di terze parti
// bloccati dentro un iframe, il solo accedervi solleva un errore. Senza
// questo avvolgimento sarebbe una pagina bianca invece di una lingua
// non ricordata.
function magazzino(): Storage | null {
  try {
    if (typeof window === 'undefined') return null;
    return window.localStorage;
  } catch {
    return null;
  }
}

export async function leggiLinguaSalvata(ruolo: RuoloLingua): Promise<Lingua | null> {
  try {
    const v = magazzino()?.getItem(chiaveLingua(ruolo));
    return linguaValida(v) ? v : null;
  } catch {
    return null;
  }
}

export async function salvaLingua(ruolo: RuoloLingua, lingua: Lingua): Promise<void> {
  try {
    magazzino()?.setItem(chiaveLingua(ruolo), lingua);
  } catch {
    // In silenzio: la lingua e' gia' cambiata a schermo, quello che si
    // perde e' il ricordo al prossimo ingresso.
  }
}

export async function linguaIniziale(ruolo: RuoloLingua): Promise<Lingua> {
  const salvata = await leggiLinguaSalvata(ruolo);
  return salvata ?? linguaDelTelefono();
}

export async function dimenticaLingua(ruolo: RuoloLingua): Promise<void> {
  try {
    magazzino()?.removeItem(chiaveLingua(ruolo));
  } catch { /* niente da fare */ }
}
