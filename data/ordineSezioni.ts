// ============================================================
// L'ORDINE DELLE SEZIONI DELLA DASHBOARD.
//
// ⚠️ SI ORDINA SUL TITOLO TRADOTTO, NON SUL CODICE. Riordinare le righe
// nel file darebbe l'ordine giusto in italiano e un ordine casuale
// nelle altre due lingue: «Prezzi delle ore» sta fra P e Q in italiano,
// ma diventa «Hourly prices» sotto la H e «Stundenpreise» sotto la S.
// L'ordine si calcola quindi quando la pagina si disegna, sul titolo
// nella lingua attiva — e cambia quando cambia la lingua, che è
// esattamente quello che deve fare un elenco alfabetico.
//
// ⚠️ E NON SI USA `localeCompare`. Sul telefono il motore JavaScript è
// Hermes, che non ha a bordo i dati di localizzazione: la stessa
// chiamata dà un ordine sul sito e un altro nell'app, e due ordini
// diversi per la stessa dashboard sono peggio di nessun ordine. Qui le
// lettere accentate si riconducono a mano alla loro lettera semplice,
// e il confronto che ne esce è identico ovunque giri.
// ============================================================

// Le lettere accentate delle tre lingue, ricondotte alla lettera
// semplice. La ß tedesca diventa «ss», che è come si ordina.
const SENZA_ACCENTO: Record<string, string> = {
  à: 'a', á: 'a', â: 'a', ä: 'a', ã: 'a', å: 'a',
  è: 'e', é: 'e', ê: 'e', ë: 'e',
  ì: 'i', í: 'i', î: 'i', ï: 'i',
  ò: 'o', ó: 'o', ô: 'o', ö: 'o', õ: 'o',
  ù: 'u', ú: 'u', û: 'u', ü: 'u',
  ç: 'c', ñ: 'n', ý: 'y',
};

/**
 * Il titolo ridotto alla forma con cui si ordina: minuscolo, senza
 * accenti, senza spazi ai lati.
 *
 * ⚠️ Le virgolette basse e gli apostrofi tipografici NON si tolgono: un
 * titolo non comincia mai con quelli, e toglierli vorrebbe dire
 * decidere caso per caso quali segni contano.
 */
function perOrdinare(titolo: string): string {
  const pulito = (titolo ?? '').trim().toLowerCase();
  let fuori = '';
  for (const c of pulito) {
    if (c === 'ß') { fuori += 'ss'; continue; }
    fuori += SENZA_ACCENTO[c] ?? c;
  }
  return fuori;
}

/**
 * Confronta due titoli di sezione. Da passare a `Array.sort`.
 *
 * ⚠️ A parità di forma ridotta si confrontano i titoli originali, non si
 * lascia decidere al caso: due sezioni che si chiamassero «Pero» e
 * «Però» finirebbero in un ordine che cambia a ogni ridisegno, e una
 * sezione che salta di posto da sola sembra un guasto.
 */
export function confrontaTitoli(a: string, b: string): number {
  const ra = perOrdinare(a);
  const rb = perOrdinare(b);
  if (ra < rb) return -1;
  if (ra > rb) return 1;
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}
