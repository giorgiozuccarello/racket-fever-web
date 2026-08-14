// ============================================================
// TORNEI — la bacheca della rete.
//
// ⚠️ E' LA PRIMA COSA DI QUEST'APP CHE ESCE DAL CIRCOLO. Tutto il
// resto — prenotazioni, chat, classifiche, avvisi — vive dentro un
// circolo e non ne esce: un socio del Milazzo non vede niente di
// Sant'Agata, e le regole lo impediscono a monte. Un torneo no: e' un
// cartellone, un'informazione pubblica per natura, e il senso di una
// rete di circoli e' che un socio possa vedere che a quaranta
// chilometri il mese prossimo c'e' un open.
//
// Chi pubblica decide fin dove arriva: una o piu' regioni, oppure
// tutta Italia. Il torneo compare nella pagina Tornei di ogni circolo
// che ricade in quella copertura, e SEMPRE in quella del circolo che
// l'ha pubblicato — anche se l'Admin non ha spuntato la propria
// regione, che e' una dimenticanza facile e senza conseguenze buone.
// ============================================================

import {
  MESI, giornoDi, soloGiorno, oggiIso, isoDi, fraGiorni,
  dataScrittaBene, giornoBreve, dataNumerica, linkNavigabile,
} from './giorni';

// ⚠️ Ri-esportate cosi' com'erano: le date e il link vivono adesso in
// `giorni.ts`, perche' anche la Bacheca deve calcolarli allo stesso
// identico modo. Chi le importava da qui non ha dovuto cambiare niente.
export {
  giornoDi, oggiIso, isoDi, fraGiorni, dataScrittaBene,
  giornoBreve, dataNumerica, linkNavigabile,
};

// ---- Tipologie ----
// Elenco chiuso e non testo libero: la tipologia e' l'etichetta in cima
// alla card, quella con cui si riconosce un torneo a colpo d'occhio
// scorrendo. Con il testo libero sarebbero diventate venti diciture
// diverse per sei cose, e l'etichetta avrebbe smesso di dire qualcosa.
export const TIPOLOGIE_TORNEO = [
  'Torneo FITP',
  'Open',
  'Rodeo',
  'Sociale',
  'Doppio',
  'Giovanile',
  'Veterani',
] as const;
export type TipologiaTorneo = (typeof TIPOLOGIE_TORNEO)[number];

export type SportTorneo = 'tennis' | 'padel';

export function sportDi(t?: { sport?: string | null } | null): SportTorneo {
  return t?.sport === 'padel' ? 'padel' : 'tennis';
}

// ---- Regioni ----
// Le venti regioni italiane. Sono l'unita' con cui si sceglie la
// copertura e con cui il socio cerca.
export const REGIONI_ITALIA = [
  'Abruzzo', 'Basilicata', 'Calabria', 'Campania', 'Emilia-Romagna',
  'Friuli-Venezia Giulia', 'Lazio', 'Liguria', 'Lombardia', 'Marche',
  'Molise', 'Piemonte', 'Puglia', 'Sardegna', 'Sicilia',
  'Toscana', 'Trentino-Alto Adige', 'Umbria', "Valle d'Aosta", 'Veneto',
] as const;
export type Regione = (typeof REGIONI_ITALIA)[number];

// ⚠️ Il segnaposto della copertura nazionale sta DENTRO lo stesso
// elenco delle regioni, non in un campo a parte. Cosi' la domanda "chi
// lo vede?" resta una sola interrogazione — "l'elenco contiene la mia
// regione oppure il segnaposto?" — invece di due da unire a mano.
export const TUTTA_ITALIA = 'ITALIA';

// Scorciatoie per selezionare mezza penisola con un tocco: senza,
// pubblicare al Sud voleva dire spuntare otto caselle una per una.
export const MACROAREE: { nome: string; regioni: Regione[] }[] = [
  { nome: 'Nord', regioni: ['Emilia-Romagna', 'Friuli-Venezia Giulia', 'Liguria', 'Lombardia', 'Piemonte', 'Trentino-Alto Adige', "Valle d'Aosta", 'Veneto'] },
  { nome: 'Centro', regioni: ['Lazio', 'Marche', 'Toscana', 'Umbria', 'Abruzzo'] },
  { nome: 'Sud', regioni: ['Basilicata', 'Calabria', 'Campania', 'Molise', 'Puglia'] },
  { nome: 'Isole', regioni: ['Sardegna', 'Sicilia'] },
];

export interface Torneo {
  id: string;
  // Chi l'ha pubblicato. Non si scrive a mano: e' il circolo
  // dell'Admin, ed e' quello che compare in fondo alla card.
  circoloId: string;
  circoloNome: string;
  // Dove si gioca, per esteso ("Mistretta (ME)"). Serve al socio di un
  // altro circolo, che del circolo organizzatore non sa niente.
  luogo?: string;
  nome: string;
  tipologia: string;
  // Tennis o padel. E' una scelta secca fra due, non un elenco: sono
  // due sport diversi, con due racchette diverse, e un torneo e' o
  // dell'uno o dell'altro. Sulla card diventa l'icona della racchetta
  // giusta accanto alla tipologia — si riconosce prima di leggere.
  // ⚠️ Assente vuol dire TENNIS: i tornei pubblicati prima di questo
  // campo sono tutti di tennis, e lasciarli senza racchetta avrebbe
  // fatto sembrare rotta la card invece che vecchia.
  sport?: SportTorneo;
  // 'YYYY-MM-DD'. La fine e' facoltativa: senza, il torneo dura un
  // giorno solo e le due date coincidono.
  dataInizio: string;
  dataFine?: string;
  // Ultimo giorno utile per iscriversi. Facoltativa: ci sono tornei
  // annunciati prima che le iscrizioni aprano.
  scadenzaIscrizioni?: string;
  // La pagina vera dove ci si iscrive. ⚠️ Dentro l'app non ci si
  // iscrive e non ci si iscrivera': il regolamento FITP non lo
  // consente. Qui si annuncia e si rimanda, punto.
  linkIscrizione?: string;
  // Le regioni in cui il torneo si vede, piu' eventualmente il
  // segnaposto della copertura nazionale.
  regioni: string[];
  note?: string;
  // L'ultimo giorno in cui la card si vede: fine del torneo piu' i
  // quindici di coda. E' scritto sul documento e non ricavato ogni
  // volta perche' e' il campo su cui Firestore filtra: senza, ogni
  // socio si sarebbe portato a casa TUTTI i tornei mai pubblicati
  // nella sua regione per mostrarne dieci.
  visibileFinoA?: string;
  creatoIlMs?: number;
}

// Quanti giorni la card resta visibile DOPO la fine del torneo. Non
// sparisce il giorno stesso: chi ha giocato torna a guardarla, e chi
// non c'era vuole sapere com'e' andata.
export const CODA_TORNEO_GIORNI = 15;

export function fineTorneo(t: { dataInizio: string; dataFine?: string }): string {
  return t.dataFine && t.dataFine >= t.dataInizio ? t.dataFine : t.dataInizio;
}

export type StatoTorneo = 'iscrizioni' | 'chiuse' | 'in_corso' | 'concluso';

// Lo stato non si scrive da nessuna parte: si ricava dalle date, ogni
// volta. Scritto sul documento avrebbe avuto bisogno di qualcuno che
// lo aggiorna a mezzanotte — cioe' di un server — e nel frattempo
// avrebbe detto "iscrizioni aperte" su un torneo gia' giocato.
export function statoTorneo(t: {
  dataInizio: string; dataFine?: string; scadenzaIscrizioni?: string;
}, adesso: Date = new Date()): StatoTorneo {
  const oggi = soloGiorno(adesso).getTime();
  const inizio = giornoDi(t.dataInizio).getTime();
  const fine = giornoDi(fineTorneo(t)).getTime();
  if (oggi > fine) return 'concluso';
  if (oggi >= inizio) return 'in_corso';
  // Prima dell'inizio: dipende dalla scadenza delle iscrizioni. Senza
  // scadenza si considerano aperte fino al giorno prima del via.
  if (!t.scadenzaIscrizioni) return 'iscrizioni';
  return oggi <= giornoDi(t.scadenzaIscrizioni).getTime() ? 'iscrizioni' : 'chiuse';
}

export function etichettaStato(s: StatoTorneo): string {
  if (s === 'iscrizioni') return 'Iscrizioni aperte';
  if (s === 'chiuse') return 'Iscrizioni chiuse';
  if (s === 'in_corso') return 'In corso';
  return 'Concluso';
}

// Il torneo e' ancora da mostrare? Vero fino a CODA_TORNEO_GIORNI dopo
// la fine. Passati quelli sparisce dalla pagina dei soci — ma il
// documento resta, ed e' l'archivio da cui l'Admin lo ripesca l'anno
// dopo invece di riscriverlo.
export function torneoDaMostrare(
  t: { dataInizio: string; dataFine?: string }, adesso: Date = new Date(),
): boolean {
  return soloGiorno(adesso).getTime() <= giornoDi(ultimoGiornoVisibile(t)).getTime();
}

// L'ultimo giorno in cui la card si vede, scritto come data.
// ⚠️ Si aggiunge ai GIORNI, non ai millisecondi. Sommare quindici volte
// ventiquattro ore sembra la stessa cosa e non lo e': la notte in cui
// torna l'ora solare dura venticinque ore, e un torneo finito a ottobre
// spariva un giorno prima del dovuto. Una volta l'anno, e impossibile
// da spiegare a chi lo vede.
// Serve anche a Firestore: scritto sul documento, e' il campo su cui
// si filtra senza doversi portare a casa tutto l'archivio.
export function ultimoGiornoVisibile(t: { dataInizio: string; dataFine?: string }): string {
  return fraGiorni(fineTorneo(t), CODA_TORNEO_GIORNI);
}

// Si vede in questa regione?
export function visibileInRegione(t: { regioni?: string[] }, regione?: string | null): boolean {
  const dove = t.regioni ?? [];
  if (dove.includes(TUTTA_ITALIA)) return true;
  if (!regione) return false;
  return dove.includes(regione);
}

// ---- Ordinamento ----
// ⚠️ I tornei messi in evidenza stanno SEMPRE sopra, ed e' una scelta
// del singolo socio: due persone vedono ordini diversi sulla stessa
// bacheca. Per questo l'elenco degli evidenziati sta sul profilo di
// chi guarda e non sul torneo — che altrimenti sarebbe "in evidenza"
// per tutti quanti.
//
// Sotto agli evidenziati: prima quelli ancora da giocare, dal piu'
// vicino; in fondo i conclusi, dal piu' recente. Un torneo di domani
// interessa piu' di uno fra due mesi, e uno finito ieri piu' di uno
// finito due settimane fa.
export function ordinaTornei<T extends { id: string; dataInizio: string; dataFine?: string }>(
  tornei: T[], inEvidenza: string[] = [], adesso: Date = new Date(),
): T[] {
  const oggi = soloGiorno(adesso).getTime();
  const concluso = (t: T) => giornoDi(fineTorneo(t)).getTime() < oggi;
  return [...tornei].sort((a, b) => {
    const ea = inEvidenza.includes(a.id) ? 0 : 1;
    const eb = inEvidenza.includes(b.id) ? 0 : 1;
    if (ea !== eb) return ea - eb;
    const ca = concluso(a) ? 1 : 0;
    const cb = concluso(b) ? 1 : 0;
    if (ca !== cb) return ca - cb;
    if (ca === 1) return b.dataInizio.localeCompare(a.dataInizio);
    return a.dataInizio.localeCompare(b.dataInizio);
  });
}

// Le due date per esteso, con il giorno, il mese e l'ANNO.
// ⚠️ Convivono con periodoTorneo e non lo sostituiscono: quella e' la
// riga che si legge scorrendo ("Dal 16 al 30 agosto"), questa e' il
// dato preciso — un torneo si prenota, ci si organizza il fine
// settimana, e "30 agosto" senza anno su una bacheca che tiene anche
// l'edizione dell'anno prima non basta.
export function dateEstese(t: { dataInizio: string; dataFine?: string }): string {
  const fine = fineTorneo(t);
  if (fine === t.dataInizio) return dataNumerica(t.dataInizio);
  return `Dal ${dataNumerica(t.dataInizio)} al ${dataNumerica(fine)}`;
}

export function periodoTorneo(t: { dataInizio: string; dataFine?: string }): string {
  const fine = fineTorneo(t);
  if (fine === t.dataInizio) return giornoBreve(t.dataInizio);
  const a = giornoDi(t.dataInizio);
  const b = giornoDi(fine);
  // Stesso mese: "dal 16 al 30 agosto", non "dal 16 agosto al 30
  // agosto". E' la forma in cui lo direbbe una persona.
  if (a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear()) {
    return `Dal ${a.getDate()} al ${b.getDate()} ${MESI[b.getMonth()]}`;
  }
  return `Dal ${giornoBreve(t.dataInizio)} al ${giornoBreve(fine)}`;
}

