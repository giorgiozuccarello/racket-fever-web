// ============================================================
// LE SEZIONI DEL MENU — un elenco di dati, non righe di JSX.
//
// ⚠️ E' LO STESSO MECCANISMO DI `data/sezioniAdmin.ts` nell'app, e nasce
// dallo stesso difetto di Racket Fever scritto nella RICOGNIZIONE: «non
// esiste un elenco dati delle sezioni». Le ventisei sezioni dell'Admin
// dei circoli sono blocchi scritti a mano dentro un file di 8.760 righe,
// e per sapere chi vede cosa bisogna leggerle tutte.
//
// ⚠️ E QUI SERVE ANCHE PER DISEGNARE. Il menu di sinistra — la richiesta
// di Giorgio del 16 settembre, «15% a sinistra in verticale spazio
// bottoni e 85% contenuto» — E' questo elenco: i bottoni non sono
// scritti da nessuna parte, sono queste righe. Aggiungere una sezione
// vuol dire aggiungere una riga qui e una cartella sotto `app/`.
//
// ⚠️ LA TRAPPOLA: un elenco che decide cosa si vede e' anche un elenco
// da cui una cosa puo' SPARIRE, senza nessun errore. La difesa e'
// `npm run prove`, che confronta questo elenco con le cartelle vere di
// `app/superadmin/`: una sezione dichiarata e non scritta — o scritta e
// non dichiarata — rompe le prove. E' la regola di
// `claude/TRAPPOLE_INTERFACCIA.md`: un elenco esaustivo che produce
// silenzio va eliminato, uno che produce un rifiuto e' una difesa.
//
// ⚠️ NIENTE IMPORT IN QUESTO FILE, come in `data/chiavi.ts` dell'app: le
// prove girano con Node e devono poterlo leggere senza tirarsi dietro
// React o Firebase.
// ============================================================

export type SezioneWeb = {
  // La cartella sotto `app/superadmin/`. ⚠️ E' anche l'indirizzo: la
  // rotta e' `/rfcoach/superadmin/{chiave}`, e non c'e' una seconda stringa da
  // tenere allineata a mano.
  chiave: string;
  titolo: string;
  // La riga piccola sotto il titolo. Non e' decorazione: e' cio' che
  // distingue «Spazi» da «Nuovo spazio» a colpo d'occhio.
  sotto: string;
  // ⚠️ LE FAMIGLIE RAGGRUPPANO I BOTTONI, e servono da subito anche con
  // tre sezioni: il menu di un pannello cresce sempre, e un elenco
  // piatto di quindici bottoni e' il punto in cui qualcuno decide di
  // rifarlo. L'ordine delle famiglie e' quello in cui compaiono qui.
  famiglia: string;
  // ⚠️ L'ICONA DELLA VOCE, come nel menu del gestionale (12 ottobre 2026).
  // E' un nome di `_pezzi/Icona.tsx`: la prova controlla che esista.
  icona: string;
  // ⚠️ I LIVELLI CHE NON LA VEDONO — 12 ottobre 2026. Assente, la vedono
  // tutti. E' cio' che si DISEGNA: il rifiuto vero lo da' il server
  // (`azionePermessa` in `rf-coach/functions/src/superadminRegole.ts`).
  nascostaA?: ('A' | 'B')[];
};

export const SEZIONI_SUPERADMIN: SezioneWeb[] = [
  {
    chiave: 'spazi',
    titolo: 'Spazi',
    sotto: 'Chi c’e’, e com’e’ messo',
    famiglia: 'Clienti',
    icona: 'spazi',
  },
  // ⚠️ CONTRATTI E RICHIESTE, DAL 12 OTTOBRE 2026. I contratti sono il
  // modello di business — il maestro paga un importo annuale — e fino a oggi
  // non stavano da nessuna parte. Le richieste sono i maestri che chiedono
  // l'attivazione da `/rfcoach/attiva`.
  {
    chiave: 'contratti',
    titolo: 'Contratti',
    sotto: 'Chi paga, quanto, fino a quando',
    famiglia: 'Clienti',
    icona: 'contratti',
    nascostaA: ['B'],
  },
  {
    chiave: 'richieste',
    titolo: 'Richieste',
    sotto: 'Maestri che chiedono di entrare',
    famiglia: 'Clienti',
    icona: 'richieste',
  },
  {
    chiave: 'nuovo',
    titolo: 'Nuovo spazio',
    sotto: 'Mettere in attivita’ un maestro o una scuola',
    famiglia: 'Clienti',
    icona: 'nuovo',
  },
  // ⚠️ VIDEO ANALYSIS E COLLABORATORI, DAL 12 OTTOBRE 2026.
  {
    chiave: 'analisi',
    titolo: 'Video Analysis',
    sotto: 'I video mandati al software, e come sono messi',
    famiglia: 'Attivita’',
    icona: 'video',
  },
  {
    chiave: 'collaboratori',
    titolo: 'Collaboratori',
    sotto: 'Chi entra nel pannello, e con che livello',
    famiglia: 'Team',
    icona: 'collaboratori',
    nascostaA: ['A', 'B'],
  },
  {
    chiave: 'sicurezza',
    titolo: 'Il mio accesso',
    sotto: 'L’account con cui sei entrato',
    famiglia: 'Io',
    icona: 'sicurezza',
  },
];

// ============================================================
// ⚠️ LE PAGINE CHE NON SONO BOTTONI — e vanno dichiarate lo stesso.
//
// La scheda di un singolo spazio e' una pagina vera sotto
// `app/superadmin/`, ma nel menu non ci va: non e' un posto dove si
// decide di andare, e' dove si finisce toccando una riga dell'elenco.
//
// Dichiararla qui invece di insegnare alle prove a «ignorare le cartelle
// che non conosce» e' la differenza fra un elenco esaustivo e un elenco
// che ha un'eccezione: con l'eccezione, la prima sezione dimenticata
// sparirebbe in silenzio insieme a questa.
// ============================================================
// ⚠️ DAL 12 OTTOBRE 2026 `spazio` RIMANDA A `spazi?id=…`: la scheda si apre
// accanto all'elenco, come nel gestionale. La cartella resta perche' gli
// indirizzi gia' mandati a qualcuno continuino ad arrivare.
export const ROTTE_SENZA_BOTTONE = ['spazio'];

// ⚠️ LA PRIMA SEZIONE E' DOVE SI ATTERRA. Scritta cosi' invece che come
// una costante a parte, il giorno che si riordina l'elenco la pagina
// d'ingresso segue da sola invece di restare indietro.
export const SEZIONE_DI_PARTENZA = SEZIONI_SUPERADMIN[0].chiave;

export function famiglie(sezioni: SezioneWeb[]): { nome: string; sezioni: SezioneWeb[] }[] {
  const fuori: { nome: string; sezioni: SezioneWeb[] }[] = [];
  sezioni.forEach((s) => {
    const gia = fuori.find((f) => f.nome === s.famiglia);
    if (gia) { gia.sezioni.push(s); return; }
    fuori.push({ nome: s.famiglia, sezioni: [s] });
  });
  return fuori;
}

// ============================================================
// LE SEZIONI DI UN LIVELLO — 12 ottobre 2026.
//
// «A» non vede i collaboratori, «B» nemmeno i contratti. Il titolare (chi non
// ha livello) vede tutto. Un livello che non si conosce vede il meno possibile.
// ============================================================
export type LivelloPannello = 'titolare' | 'A' | 'B';

export function sezioniPer(livello: LivelloPannello): SezioneWeb[] {
  if (livello === 'titolare') return SEZIONI_SUPERADMIN;
  return SEZIONI_SUPERADMIN.filter((s) => !(s.nascostaA ?? []).includes(livello));
}

export function vedeSezione(livello: LivelloPannello, chiave: string): boolean {
  return sezioniPer(livello).some((s) => s.chiave === chiave);
}
