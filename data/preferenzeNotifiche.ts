// ============================================================
// PREFERENZE DELLE NOTIFICHE — quali push si ricevono, e quando.
//
// ⚠️ ESISTE PERCHE' SENZA DI LUI L'UNICA DIFESA E' DISINSTALLARE.
// Un'app che manda notifiche e non offre un modo di sceglierle mette
// l'utente davanti a due sole opzioni: sopportare tutto, o spegnere
// tutto dalle impostazioni di sistema — e chi spegne tutto non
// riaccende piu' nemmeno il promemoria della partita. Apple e Google
// se lo aspettano, ma il motivo vero e' un altro: le notifiche sono
// l'unica cosa dell'app che entra in casa della gente senza essere
// stata chiamata.
//
// ⚠️ E' UN MODULO PURO: nessuna lettura, nessuna scrittura, nessun
// import di Firebase. Decide soltanto, su dati che gli vengono passati.
// Cosi' la stessa decisione si prende identica sul telefono (per
// disegnare la schermata) e sul server (per non mandare la push), senza
// due copie di regole che prima o poi divergono.
//
// ⚠️ FILE GEMELLO IN TRE COPIE IDENTICHE:
//   · racket-fever/data/preferenzeNotifiche.ts          (app)
//   · racket-fever/functions/src/preferenzeNotifiche.ts (server)
//   · racket-fever-web/data/preferenzeNotifiche.ts      (sito e dashboard)
// Se si tocca una riga in una, si tocca in tutte e tre. Sono tre perche'
// la stessa decisione va presa identica in tre posti — disegnare la
// schermata, decidere se mandare, scrivere l'avviso dal web — e una
// copia sola non si puo' importare da tutti e tre i progetti.
// ============================================================

// ============================================================
// LE CATEGORIE.
//
// ⚠️ Poche e per ARGOMENTO, non per meccanismo. La tentazione e' una
// voce per ogni tipo di avviso — «compagno aggiunto», «compagno
// tolto», «prenotazione annullata» — e sarebbe una schermata con venti
// interruttori che nessuno legge. Chi apre queste impostazioni ha in
// mente una frase sola: «basta con gli avvisi del circolo», oppure
// «i promemoria delle partite tienimeli». Le categorie sono quelle.
// ============================================================
export type CategoriaNotifica =
  // Qualcosa e' successo a una partita che ti riguarda: sei stato
  // aggiunto, sei stato tolto, il circolo l'ha annullata.
  | 'prenotazioni'
  // Le lezioni con il Maestro: conferme, rifiuti, cancellazioni.
  | 'lezioni'
  // I promemoria automatici prima di giocare.
  | 'promemoria'
  // Gli avvisi che il circolo manda a tutti: volantini in bacheca.
  | 'bacheca'
  // Tutto il resto che riguarda la tua posizione nel circolo:
  // ammissione approvata, tessera sospesa, credito ricaricato.
  // ⚠️ E ANCHE LE SFIDE, che non hanno una voce propria. La scelta e'
  // di tenere la schermata corta — sei interruttori si leggono, dodici
  // no — ma ha una conseguenza che va detta nel testo che l'utente
  // legge: spegnendo questa non arrivano piu' nemmeno «sei congelato
  // dalle sfide per 7 giorni» e «hai perso la posizione in classifica»,
  // che sono avvisi con conseguenze. La descrizione qui sotto lo dice;
  // se un giorno le sfide meritassero una voce propria, il posto e'
  // questo elenco.
  | 'circolo'
  // I messaggi delle conversazioni con il Maestro.
  // ⚠️ ACCESA DI PARTENZA COME TUTTE LE ALTRE, dal 23 agosto 2026.
  // Fino a quel giorno era l'unica spenta, con questo ragionamento: una
  // conversazione produce decine di righe, e notificarle tutte e' il
  // modo piu' rapido di far spegnere all'utente OGNI notifica dell'app,
  // comprese quelle che gli servono. Il ragionamento non era sbagliato,
  // ma trascurava il caso che conta di piu': il MAESTRO, per cui un
  // messaggio non e' rumore ma una richiesta a cui deve rispondere — e
  // che con la categoria spenta non sapeva nemmeno di averla ricevuta.
  //
  // ⚠️ IL RISCHIO RESTA, E VA TENUTO D'OCCHIO. Chi si stufa deve
  // trovare facilmente l'interruttore, o spegnera' tutto dalle
  // impostazioni del telefono — che e' il danno peggiore, perche' porta
  // via anche i promemoria delle partite, che nessuno voleva spegnere.
  | 'chat';

export const CATEGORIE: CategoriaNotifica[] = [
  'prenotazioni', 'lezioni', 'promemoria', 'bacheca', 'circolo', 'chat',
];

export const NOME_CATEGORIA: Record<CategoriaNotifica, string> = {
  prenotazioni: 'Le mie partite',
  lezioni: 'Lezioni con il Maestro',
  promemoria: 'Promemoria prima di giocare',
  bacheca: 'Avvisi del circolo',
  circolo: 'Circolo, sfide e classifica',
  chat: 'Messaggi in chat',
};

export const SPIEGA_CATEGORIA: Record<CategoriaNotifica, string> = {
  prenotazioni: 'Quando qualcuno ti aggiunge a una partita, ti toglie, o la partita viene annullata.',
  lezioni: 'Quando il Maestro conferma, rifiuta o annulla una lezione.',
  promemoria: 'Un avviso prima di scendere in campo, per non dimenticare l’ora.',
  bacheca: 'Quando il circolo pubblica un avviso importante in bacheca.',
  circolo: 'Ammissione approvata, tessera sospesa, credito ricaricato — e tutto quello che riguarda le sfide: match fissati, penalità, posizione in classifica.',
  chat: 'Ogni messaggio nella conversazione con il Maestro. Sono tanti: spegnilo se ti disturbano.',
};

export interface PreferenzeNotifiche {
  // Un interruttore per categoria. Assente = acceso, TUTTE comprese.
  // ⚠️ ASSENTE VUOL DIRE ACCESO, e non e' pigrizia: chi installa l'app
  // oggi non ha nessun documento di preferenze, e con il valore di
  // ripiego a «spento» non riceverebbe niente finche' non entra in una
  // schermata che non sa che esiste. Il silenzio va scelto, non
  // ereditato da una svista.
  categorie?: Partial<Record<CategoriaNotifica, boolean>>;
  // Le ore in cui non si viene disturbati. Assente = acceso.
  silenzioNotturno?: boolean;
}

// ⚠️ TUTTE ACCESE DI PARTENZA, NESSUNA ESCLUSA. Decisione di Giorgio
// del 23 agosto 2026: prima 'chat' faceva eccezione, e l'eccezione
// aveva l'effetto di rendere irraggiungibili le push del Maestro —
// codice scritto, eseguito, e scartato in silenzio all'ultimo
// passaggio. Chi non le vuole le spegne; il silenzio si sceglie, non si
// eredita.
//
// ⚠️ SOLO `true` E `false` CONTANO. Un campo scritto male, o un valore
// che non e' un booleano, vale «acceso»: un dato sporco non deve poter
// zittire un telefono senza che nessuno l'abbia deciso.
export function categoriaAccesa(
  pref: PreferenzeNotifiche | null | undefined, cat: CategoriaNotifica,
): boolean {
  const scelta = pref?.categorie?.[cat];
  return typeof scelta === 'boolean' ? scelta : true;
}

export function silenzioNotturnoAcceso(pref: PreferenzeNotifiche | null | undefined): boolean {
  return pref?.silenzioNotturno !== false;
}

// ============================================================
// LE ORE DI SILENZIO — dalle 22:00 alle 08:00.
//
// ⚠️ UN VOLANTINO PUBBLICATO A MEZZANOTTE SVEGLIA DUECENTO PERSONE, e
// nessuno di loro ha fatto niente per meritarselo. E' il caso che
// questa fascia esiste per impedire: non un capriccio di stile, ma la
// differenza fra un'app che si tiene e una che si disinstalla la
// mattina dopo.
//
// ⚠️ I PROMEMORIA NON RISPETTANO IL SILENZIO, ed e' voluto: sono legati
// a un'ora precisa e in ritardo non servono a niente. Ma il giro dei
// promemoria non manda mai niente di notte per conto suo — avvisa
// prima di una partita, e di partite alle tre del mattino non ce ne
// sono. La regola sta scritta lo stesso, perche' il giorno che qualcuno
// aggiungesse un promemoria notturno deve trovare la decisione gia'
// presa e non doverla indovinare.
//
// ⚠️ UNA PUSH ZITTITA DAL SILENZIO E' PERSA, NON RIMANDATA, e va detto
// perche' e' facile raccontarselo diversamente. Non c'e' nessuna coda
// che la ritira fuori alle otto: quello che resta e' l'avviso in Home,
// che l'utente trova al risveglio come trova tutti gli altri. E' una
// scelta, non una mancanza — un volantino della sera prima recapitato
// in massa alle 08:00 sarebbe la stessa sveglia, spostata — ma nessun
// testo dell'app deve promettere che «arriva la mattina dopo».
// ============================================================
export const ORA_INIZIO_SILENZIO = 22;
export const ORA_FINE_SILENZIO = 8;

export function nelSilenzioNotturno(ora: number): boolean {
  // ⚠️ La fascia scavalca la mezzanotte, quindi non e' un intervallo
  // semplice: 23 e' dentro, 7 e' dentro, 12 e' fuori. Scritto con un OR
  // e non con un AND, che e' l'errore che rende la fascia sempre vuota.
  return ora >= ORA_INIZIO_SILENZIO || ora < ORA_FINE_SILENZIO;
}

export function rispettaIlSilenzio(cat: CategoriaNotifica): boolean {
  return cat !== 'promemoria';
}

// ============================================================
// LA DECISIONE, in una funzione sola.
//
// ⚠️ CHI HA FATTO L'AZIONE NON RICEVE L'AVVISO. Se aggiungo Marco alla
// mia partita, la notifica va a Marco. Sembra ovvio, ed e' la svista
// piu' comune di tutte: le notifiche nascono da un'azione, e chi
// scrive il codice ha in testa quella, non chi la subisce.
// ============================================================
export function siPuoMandare(params: {
  pref: PreferenzeNotifiche | null | undefined;
  categoria: CategoriaNotifica;
  destinatarioUid: string;
  // Chi ha provocato l'avviso, se si sa.
  origineUid?: string | null;
  // L'ora locale italiana, 0-23.
  oraLocale: number;
}): { ok: boolean; motivo?: string } {
  if (params.origineUid && params.origineUid === params.destinatarioUid) {
    return { ok: false, motivo: 'e la stessa persona che ha fatto l’azione' };
  }
  if (!categoriaAccesa(params.pref, params.categoria)) {
    return { ok: false, motivo: 'categoria spenta dall’utente' };
  }
  if (silenzioNotturnoAcceso(params.pref)
    && rispettaIlSilenzio(params.categoria)
    && nelSilenzioNotturno(params.oraLocale)) {
    return { ok: false, motivo: 'ore di silenzio' };
  }
  return { ok: true };
}
