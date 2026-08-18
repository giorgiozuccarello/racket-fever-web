// ============================================================
// SEGNALAZIONI E BLOCCHI — le due cose che gli store pretendono.
//
// ⚠️ PERCHÉ SERVONO ANCHE SENZA CHAT LIBERE. Togliendo il testo libero
// sparisce quasi tutto quello che un socio può scrivere, ma non tutto:
// restano il nome, la foto del profilo, la classifica dichiarata da sé
// e la racchetta. Sono superfici piccole, e una foto sbagliata su una
// scheda che ogni socio del circolo può aprire è esattamente il caso
// per cui Apple chiede un pulsante «segnala» — e uno «blocca».
//
// ⚠️ LA SEGNALAZIONE PORTA CON SÉ UNA COPIA, non un puntatore. Le
// regole negano deliberatamente ad Admin e Super Admin la lettura
// delle chat, e quella scelta non si tocca: se la segnalazione fosse
// un rimando da risolvere leggendo, avremmo aperto proprio la porta
// che quelle regole tengono chiusa. Quindi al momento della
// segnalazione si copia quello che si sta segnalando, e la copia è ciò
// che chi giudica legge.
//
// ⚠️ E ARRIVA A TUTTI E DUE: all'Admin del circolo e a noi. All'Admin
// perché conosce le persone, sta lì, e può agire subito. A noi perché
// gli store vogliono un processo in capo al proprietario dell'app, e
// perché il circolo non può essere giudice in casa propria — se la
// persona segnalata è il figlio del presidente, la segnalazione deve
// poter arrivare anche altrove.
//
// File gemello, identico nei due progetti, senza import.
// ============================================================

export const COLLEZIONE_SEGNALAZIONI = 'segnalazioni';

// ⚠️ Motivo A SCELTA, non scritto. Un campo «spiega il problema»
// sarebbe stato l'unico testo libero rimasto in tutta l'app — e per di
// piu' un testo che parla di un'altra persona, letto da terzi. Le voci
// qui sotto coprono quello che serve per decidere cosa fare; il resto
// si chiede a voce, che è come si risolvono davvero queste cose in un
// circolo.
export interface MotivoSegnalazione {
  codice: string;
  testo: string;
}

export const MOTIVI_SEGNALAZIONE: MotivoSegnalazione[] = [
  { codice: 'foto', testo: 'Foto del profilo inappropriata' },
  { codice: 'nome', testo: 'Nome o testo offensivo nella scheda' },
  { codice: 'identita', testo: 'Non è chi dice di essere' },
  { codice: 'comportamento', testo: 'Comportamento scorretto in campo' },
  { codice: 'molestie', testo: 'Molestie o insistenza' },
  { codice: 'altro', testo: 'Altro' },
];

export const CODICI_MOTIVO: string[] = MOTIVI_SEGNALAZIONE.map((m) => m.codice);

export function testoMotivo(codice: string | null | undefined): string {
  if (!codice) return 'Motivo non indicato';
  return MOTIVI_SEGNALAZIONE.find((m) => m.codice === codice)?.testo ?? 'Motivo non indicato';
}

export type StatoSegnalazione = 'nuova' | 'vista' | 'chiusa';

export interface Segnalazione {
  id: string;
  circoloId: string;
  // Chi è stato segnalato, e la copia della sua scheda com'era in quel
  // momento: se cambia la foto un minuto dopo, chi giudica deve poter
  // vedere di cosa si stava parlando.
  segnalatoUid: string;
  segnalatoNome: string;
  copiaFotoUrl?: string | null;
  copiaRacchetta?: string | null;
  copiaClassifica?: string | null;
  // Chi ha segnalato. Non è anonimo verso l'Admin: in un circolo di
  // duecento persone una segnalazione anonima è un'arma, e chi la fa
  // deve metterci la faccia come la mette di persona.
  daUid: string;
  daNome: string;
  motivo: string;
  stato: StatoSegnalazione;
  creatoIlMs: number;
  // Chi l'ha presa in carico, e quando. Serve a non lavorarci in due.
  vistaDa?: string | null;
  vistaIlMs?: number | null;
}

// ============================================================
// I BLOCCHI.
//
// ⚠️ UNIDIREZIONALE, e il documento è uno per coppia ORDINATA: «io
// blocco te» non è «tu blocchi me». L'identificativo si compone dai due
// uid nell'ordine — chi blocca prima, chi è bloccato dopo — così una
// coppia non può avere due documenti per lo stesso verso, e togliere il
// blocco è cancellare quel documento.
// ============================================================
export const COLLEZIONE_BLOCCHI = 'blocchi_soci';

export interface BloccoSocio {
  id: string;
  da: string;
  verso: string;
  circoloId: string;
  creatoIlMs: number;
}

export function idBlocco(da: string, verso: string): string {
  return `${da}_${verso}`;
}

// ⚠️ Vale in TUTTI E DUE I VERSI. Se io ho bloccato te non voglio più
// vederti; se tu hai bloccato me, non devo poterti raggiungere. Un
// blocco che valesse solo in un verso lascerebbe al molesto la
// possibilità di continuare a scrivere a chi l'ha bloccato — cioè
// esattamente il contrario di quello che serve.
export function bloccatoFra(
  blocchi: { da: string; verso: string }[], unoUid: string, altroUid: string,
): boolean {
  return blocchi.some(
    (b) => (b.da === unoUid && b.verso === altroUid) || (b.da === altroUid && b.verso === unoUid),
  );
}
