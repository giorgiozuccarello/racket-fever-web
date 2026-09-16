// ============================================================
// LE REGOLE SUGLI INDIRIZZI DI `/rfcoach`, in un file che non importa
// niente.
//
// ⚠️ STA DA SOLO PER POTER ESSERE PROVATO. `middleware.ts` importa
// `next/server`, e una prova che lo caricasse tirerebbe dentro mezzo
// Next per controllare due `if`. Qui non c'e' nessun import: la prova
// esegue la funzione VERA, non una sua copia riscritta a mano — ed e'
// l'unico modo perche' una prova su questo valga qualcosa.
// ============================================================

// ⚠️ IL CONFINE. Da `/rfcoach/admin` in giu' comanda l'app Expo
// esportata sul web, che vive nei file statici sotto
// `public/rfcoach/admin/`. Il sito serve quei file e NON tocca i loro
// indirizzi.
//
// ⚠️ LO STESSO PERCORSO E' SCRITTO IN UN ALTRO REPOSITORY: in
// `rf-coach/app.json`, come `experiments.baseUrl`. E' l'export stesso a
// scriverlo dentro ogni riferimento del suo `index.html`. Se i due
// divergono, l'app non trova il proprio codice e la pagina resta
// BIANCA, senza nessun errore. Due prove — una per repository —
// sorvegliano ognuna il proprio lato.
export const CONFINE_APP = '/rfcoach/admin';

// ============================================================
// ⚠️ PERCHE' NON SI MINUSCOLA TUTTO, che era la prima stesura.
//
// La richiesta del 16 settembre era far funzionare `/rfcoach/SuperAdmin`
// e `/rfcoach/Admin`, cioe' la SECONDA tappa dell'indirizzo. Minuscolare
// l'intero percorso sembrava la stessa cosa in piu' generoso. Non lo e',
// e il 16 settembre l'ho visto succedere in un browser vero:
//
//   • SETTE CARATTERI dell'app hanno le maiuscole nel nome —
//     `Outfit_700Bold.….ttf`, `Outfit_400Regular.….ttf` e gli altri.
//     Minuscolati, quei file non esistono; il ripiego su `index.html`
//     restituisce una pagina HTML al posto di un font; `useFonts` non
//     si risolve mai e l'app NON DISEGNA NIENTE. Schermo bianco, zero
//     errori in console, zero 404, niente nei log.
//
//   • E GLI IDENTIFICATIVI DI FIRESTORE HANNO LE MAIUSCOLE. Le rotte
//     dell'app sono `/allievo/[uid]`, `/lezione/[id]`, `/corso/[id]`:
//     un link a `/rfcoach/admin/allievo/AbC123` diventerebbe
//     `/…/abc123`, un documento che non esiste. L'app direbbe «non
//     trovato» a un allievo che c'e'.
//
// Quindi: dal confine in giu' l'indirizzo si lascia esattamente com'e'.
// Sopra il confine, il sito e' padrone a casa sua e minuscola tutto.
// ============================================================
export function minuscolato(percorso: string): string {
  const parti = percorso.split('/');            // ['', 'rfcoach', 'Admin', ...]
  const testa = parti.slice(0, 3).join('/').toLowerCase();

  if (testa === CONFINE_APP) {
    const resto = parti.slice(3);
    return resto.length ? `${CONFINE_APP}/${resto.join('/')}` : CONFINE_APP;
  }

  return percorso.toLowerCase();
}

// Comodo per il middleware e per le prove: dice se c'e' davvero
// qualcosa da fare. Senza, ogni indirizzo gia' minuscolo verrebbe
// rimandato a se stesso — un anello infinito, e il browser direbbe
// soltanto «troppi reindirizzamenti».
export function daReindirizzare(percorso: string): string | null {
  const dove = minuscolato(percorso);
  return dove === percorso ? null : dove;
}
