// ============================================================
// LINK DEI BANNER — l'indirizzo del sito dello sponsor.
//
// Un banner che si puo' toccare vale piu' di uno che si guarda, e lo
// sponsor lo sa: e' la differenza fra un cartellone e un annuncio.
// Qui dentro c'e' l'unica cosa delicata di tutta la funzione — decidere
// se un indirizzo scritto a mano da un Admin e' un indirizzo, e non
// qualcos'altro.
//
// ⚠️ QUESTO FILE NON IMPORTA NIENTE, ed e' voluto: e' identico nei due
// progetti (app e sito) e si prova da solo, senza Firebase e senza
// React. La copia web deve restare uguale byte per byte.
//
// ⚠️ E SI CONTROLLA DUE VOLTE. Una quando l'Admin scrive l'indirizzo,
// per dirgli subito che ha sbagliato; e una — obbligatoria — un istante
// prima di aprirlo sul telefono del socio. Il primo controllo e'
// cortesia e sta nel pannello; il secondo e' sicurezza, perche' fra i
// due c'e' un documento su Firestore che l'Admin puo' anche scrivere
// per un'altra strada. Fidarsi solo del pannello vorrebbe dire fidarsi
// di chi il pannello lo puo' scavalcare.
// ============================================================

// Trecento caratteri sono abbondanti per qualunque indirizzo vero,
// comprese le code di tracciamento delle campagne, e sono un freno a
// quello che non lo e'.
export const MAX_LUNGHEZZA_LINK = 300;

// Uno schema e' la parte prima dei due punti: 'https', ma anche
// 'javascript', 'tel', 'intent'. Serve a riconoscerli TUTTI, non solo
// quelli buoni: un indirizzo con uno schema che non conosciamo va
// rifiutato, non completato.
const CON_SCHEMA = /^([a-zA-Z][a-zA-Z0-9+.-]*):/;

// Il nome del sito: lettere, cifre, punti e trattini, piu' l'eventuale
// porta. Niente altro — e le cose che non ci sono contano piu' di
// quelle che ci sono, vedi sotto.
const NOME_SITO = /^[a-zA-Z0-9.-]+(:[0-9]{1,5})?$/;

// ============================================================
// NORMALIZZA — prende quello che l'Admin ha scritto e restituisce
// l'indirizzo da salvare, oppure la stringa vuota se non e' un
// indirizzo. Mai un'eccezione: chi chiama deve poter dire «vuoto vuol
// dire nessun link» senza avvolgere niente in un try.
// ============================================================
export function normalizzaLinkBanner(testo: string | null | undefined): string {
  if (typeof testo !== 'string') return '';
  const pulito = testo.trim();
  if (!pulito) return '';
  // ⚠️ Uno spazio in mezzo NON si toglie, si rifiuta. Toglierlo
  // vorrebbe dire indovinare cosa intendeva chi ha scritto, e su un
  // indirizzo indovinare significa mandare i soci da un'altra parte.
  // Vale anche per le andate a capo e le tabulazioni, che arrivano
  // sempre da un incolla.
  if (/\s/.test(pulito)) return '';
  // ⚠️ Questo e' un primo freno sull'ingresso, ma NON basta: il vero
  // controllo di lunghezza sta in fondo, sul risultato. Vedi il
  // commento li'.
  if (pulito.length > MAX_LUNGHEZZA_LINK) return '';

  let completo = pulito;
  const schema = CON_SCHEMA.exec(pulito);
  if (schema) {
    const nome = schema[1].toLowerCase();
    // ⚠️ SOLO http e https, e qui sta il motivo di tutto il file. Un
    // 'javascript:' o un 'intent:' finiscono in un campo di testo con
    // la stessa facilita' di un indirizzo, e dall'altra parte non c'e'
    // un browser che li ignora: c'e' Linking.openURL su un telefono,
    // che li consegna al sistema. Un elenco chiuso di due voci e' la
    // sola difesa che non invecchia.
    if (nome !== 'http' && nome !== 'https') return '';
    // Lo schema si riscrive minuscolo: 'HTTPS://' e' legittimo ma
    // rende diversi due indirizzi uguali, e i confronti piu' avanti —
    // «e' cambiato il link?» — direbbero di si' a vuoto.
    completo = nome + pulito.slice(nome.length);
    if (!completo.startsWith(nome + '://')) return '';
  } else {
    // ⚠️ Senza schema si completa con https, e non e' pigrizia: nove
    // Admin su dieci scrivono «www.sponsordelcircolo.it», e rifiutarlo
    // vorrebbe dire far comparire un errore a chi ha scritto la cosa
    // giusta. Si sceglie https e non http perche' un sito che oggi non
    // lo regge e' l'eccezione, e perche' su Android il traffico in
    // chiaro e' bloccato di suo.
    completo = 'https://' + pulito;
  }

  const senzaSchema = completo.slice(completo.indexOf('://') + 3);
  if (!senzaSchema) return '';
  // Il nome del sito finisce dove comincia il percorso, la domanda o
  // l'ancora.
  const fine = senzaSchema.search(/[/?#]/);
  const sito = fine >= 0 ? senzaSchema.slice(0, fine) : senzaSchema;

  // ⚠️ LA CHIOCCIOLA E' IL TRUCCO PIU' VECCHIO che ci sia, ed e'
  // esattamente il caso che un pannello pubblicitario invita a
  // provare: «https://circolo-di-milazzo.it@sito-che-ruba.com» si
  // legge come il sito del circolo e apre l'altro, perche' tutto
  // quello che sta prima della chiocciola e' nome utente e password,
  // non indirizzo. Il controllo qui sotto lo esclude — nel nome del
  // sito la chiocciola non e' un carattere ammesso — ma va detto,
  // perche' senza saperlo qualcuno un giorno «allarghera' la regex».
  if (!NOME_SITO.test(sito)) return '';
  // Un punto ci vuole: 'sponsor' non e' un sito, 'sponsor.it' si'.
  if (!sito.includes('.')) return '';
  if (sito.startsWith('.') || sito.endsWith('.')) return '';
  if (sito.startsWith('-') || sito.includes('..')) return '';
  // L'ultimo pezzo e' il dominio di primo livello: almeno due lettere,
  // e lettere soltanto. Ferma gli indirizzi numerici scritti per caso
  // e le storpiature tipo 'sponsor.i'.
  const ultimo = sito.split(':')[0].split('.').pop() ?? '';
  if (!/^[a-zA-Z]{2,}$/.test(ultimo)) return '';

  // Il nome del sito si riscrive minuscolo — e' la parte che non
  // distingue le maiuscole — mentre il percorso si lascia com'e',
  // perche' li' invece le distingue eccome.
  const inizio = completo.indexOf('://') + 3;
  const finito = completo.slice(0, inizio) + sito.toLowerCase() + senzaSchema.slice(sito.length);

  // ⚠️ LA LUNGHEZZA SI MISURA QUI, SUL RISULTATO, e non solo su quello
  // che e' stato scritto. Misurandola solo in ingresso questa funzione
  // NON ERA IDEMPOTENTE, e la differenza sono gli otto caratteri di
  // «https://» aggiunti a chi scrive solo il nome del sito: un
  // indirizzo di 295 caratteri passava il controllo, veniva salvato
  // lungo 303, e alla rilettura — che ripassa di qui — tornava vuoto.
  // Cioe' il link spariva da solo, senza un errore da nessuna parte,
  // e l'Admin lo riscriveva all'infinito. Sui banner di rete andava
  // anche peggio: le regole misurano la stringa GIA' normalizzata, e
  // la pubblicazione veniva respinta con un errore incomprensibile.
  //
  // Misurando il risultato, normalizzare due volte da' sempre lo
  // stesso valore — che e' la proprieta' su cui si regge tutto il
  // resto, perche' questa funzione gira sia in scrittura sia in
  // lettura.
  if (finito.length > MAX_LUNGHEZZA_LINK) return '';
  return finito;
}

// Comodita' per il pannello: «quello che ho scritto va bene?».
export function linkValido(testo: string | null | undefined): boolean {
  return normalizzaLinkBanner(testo) !== '';
}

// ============================================================
// IL MESSAGGIO DA MOSTRARE QUANDO NON VA BENE. Stringa vuota = va
// bene (o e' vuoto, che e' legittimo: vuol dire «nessun link»).
//
// ⚠️ STA QUI E NON NEI TRE PANNELLI, e non e' per risparmiare righe:
// il testo era scritto tre volte — app, sito, Super Admin — e tre
// copie di un messaggio divergono al primo ritocco. Da qui lo dicono
// tutti e tre allo stesso modo.
//
// ⚠️ E DISTINGUE «TROPPO LUNGO» DA «SCRITTO MALE». Sembra un
// dettaglio: non lo e'. Chi incolla un indirizzo di campagna con
// mezzo tracciamento dietro sfora i trecento caratteri appena si
// aggiunge «https://» davanti, e sentirsi dire «non e' valido» lo
// manda a caccia di un errore di battitura che non c'e'. Gli si dice
// invece cosa togliere.
// ============================================================
export function erroreLink(testo: string | null | undefined): string {
  const pulito = (testo ?? '').trim();
  if (!pulito) return '';
  if (normalizzaLinkBanner(pulito)) return '';
  const conSchema = /^https?:\/\//i.test(pulito) ? pulito : 'https://' + pulito;
  // Si dice «troppo lungo» solo se accorciandolo diventerebbe buono:
  // se anche accorciato resta storto, il problema e' un altro e il
  // messaggio sulla lunghezza avrebbe mandato fuori strada.
  if (conSchema.length > MAX_LUNGHEZZA_LINK
    && normalizzaLinkBanner(conSchema.slice(0, MAX_LUNGHEZZA_LINK))) {
    return `L’indirizzo è troppo lungo: il massimo è ${MAX_LUNGHEZZA_LINK} caratteri, contando anche «https://». Di solito basta togliere la parte dopo il punto interrogativo, che è solo tracciamento.`;
  }
  return 'L’indirizzo non è valido. Scrivilo per esteso, per esempio sponsordelcircolo.it — se il sito ha lettere accentate, copialo dalla barra degli indirizzi del browser.';
}

// ============================================================
// L'ETICHETTA DA MOSTRARE NEL POPUP.
//
// ⚠️ SI MOSTRA IL NOME DEL SITO, NON L'INDIRIZZO INTERO, e la ragione
// e' che il popup serve a far capire DOVE si sta andando. Un indirizzo
// lungo tre righe con dentro le code di tracciamento non lo legge
// nessuno, e quello che non si legge non protegge: 'sponsordelcircolo.it'
// si legge in un colpo d'occhio.
// ============================================================
export function nomeSitoLink(url: string | null | undefined): string {
  const buono = normalizzaLinkBanner(url);
  if (!buono) return '';
  const senzaSchema = buono.slice(buono.indexOf('://') + 3);
  const fine = senzaSchema.search(/[/?#]/);
  const sito = (fine >= 0 ? senzaSchema.slice(0, fine) : senzaSchema).split(':')[0];
  // Il 'www.' si toglie: non dice niente a nessuno e ruba spazio alla
  // parte che invece conta.
  return sito.startsWith('www.') ? sito.slice(4) : sito;
}

// ============================================================
// L'ELENCO DEI LINK DI UN CIRCOLO, allineato alle immagini.
//
// ⚠️ ALLINEATO PER POSIZIONE, ed e' la stessa scelta gia' fatta per le
// durate: il link dello sponsor 1 sta nella casella 1. Un elenco piu'
// corto — i circoli di prima non hanno il campo, e i banner caricati
// prima di oggi non ce l'hanno — si riempie di stringhe vuote fino
// alla lunghezza giusta. Senza questa riga, il primo banner senza link
// avrebbe fatto scalare tutti gli altri di uno: il socio che tocca lo
// sponsor 3 sarebbe finito sul sito dello sponsor 4.
// ============================================================
export function allineaLink(link: unknown, quante: number): string[] {
  const dentro = Array.isArray(link) ? link : [];
  const fuori: string[] = [];
  for (let i = 0; i < quante; i++) {
    // ⚠️ Si ripassa dalla normalizzazione anche in LETTURA, non solo in
    // scrittura. Sul documento puo' esserci qualunque cosa — un campo
    // scritto da una versione vecchia, o da un Admin che ha chiamato
    // l'API a mano — e questa e' la funzione che tutta l'app usa per
    // sapere se un banner e' toccabile.
    fuori.push(normalizzaLinkBanner(typeof dentro[i] === 'string' ? (dentro[i] as string) : ''));
  }
  return fuori;
}
