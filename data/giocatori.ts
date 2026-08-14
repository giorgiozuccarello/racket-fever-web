// ============================================================
// I GIOCATORI DI UNA PRENOTAZIONE — chi c'e' in campo e quanto paga.
//
// Fino a ieri il modello era "chi prenota + un compagno", e il conto
// era una divisione a meta' scritta a mano in una ventina di punti fra
// le due applicazioni. Da qui in poi i giocatori sono fino a quattro
// (chi prenota piu' tre) e il conto vive in un posto solo.
//
// ⚠️ LA QUOTA E' SCRITTA SULLA PRENOTAZIONE, NON RICALCOLATA.
// Sembra ridondante — il prezzo e il numero dei giocatori ci sono
// gia' — ma e' cio' che rende possibile la regola che ci siamo dati:
// chi ha gia' accettato una cifra non se la vede cambiare sotto. Se la
// quota si ricalcolasse a ogni lettura, togliere un giocatore
// aumenterebbe automaticamente l'addebito degli altri, che quella cifra
// non l'hanno mai accettata. Congelata, invece, il posto lasciato
// libero se lo prende chi ha prenotato — che e' anche l'unico che puo'
// decidere di lasciarlo libero.
//
// La quota di CHI PRENOTA non e' scritta da nessuna parte: e' il
// prezzo meno la somma delle altre. Cosi' non puo' esistere una
// prenotazione le cui quote non tornano al centesimo, qualunque cosa
// succeda agli arrotondamenti.
// ============================================================

// Quanti se ne possono aggiungere OLTRE a chi prenota. Tre, cioe'
// quattro in campo: un doppio.
export const MAX_GIOCATORI_AGGIUNTI = 3;

export interface Giocatore {
  uid: string;
  nome: string;
  cognome: string;
  // Quanto e' stato addebitato a QUESTO giocatore per QUESTA mezz'ora.
  quota: number;
}

// La forma minima che serve alle funzioni qui sotto: ci sta dentro sia
// la Prenotazione del socio sia la PrenotazioneAdmin.
export interface ConGiocatori {
  prezzo?: number;
  giocatori?: Giocatore[] | null;
  // ---- Il vecchio modello a un compagno solo ----
  // Resta scritto per le prenotazioni gia' in essere e per le Sfide,
  // che sono uno contro uno per definizione.
  compagnoId?: string | null;
  compagnoNome?: string | null;
  compagnoCognome?: string | null;
  costoDiviso?: boolean;
}

function aCentesimi(v: number): number {
  return Math.round(v * 100) / 100;
}

// I giocatori aggiunti, comunque siano scritti sul documento.
// ⚠️ Il ripiego sul vecchio compagno non e' un dettaglio di
// migrazione: le prenotazioni fatte prima di oggi restano in campo per
// giorni, e per tutto quel tempo devono continuare a mostrare la
// persona giusta e la cifra giusta. La sua quota era la meta' esatta.
export function giocatoriDi(p: ConGiocatori | null | undefined): Giocatore[] {
  if (!p) return [];
  if (Array.isArray(p.giocatori) && p.giocatori.length > 0) {
    return p.giocatori.map((g) => ({ ...g, quota: Number(g.quota) || 0 }));
  }
  if (p.compagnoId && p.costoDiviso) {
    return [{
      uid: p.compagnoId,
      nome: p.compagnoNome ?? '',
      cognome: p.compagnoCognome ?? '',
      quota: aCentesimi((p.prezzo ?? 0) / 2),
    }];
  }
  return [];
}

// Quanto paga chi ha prenotato: tutto quello che non pagano gli altri.
export function quotaChiPrenota(p: ConGiocatori | null | undefined): number {
  const prezzo = p?.prezzo ?? 0;
  const altrui = giocatoriDi(p).reduce((tot, g) => tot + g.quota, 0);
  return aCentesimi(prezzo - altrui);
}

// Quanto paga una persona qualunque su questa mezz'ora: zero se non
// c'entra niente.
export function quotaDi(
  p: ConGiocatori & { utenteId?: string }, uid: string,
): number {
  if (p.utenteId === uid) return quotaChiPrenota(p);
  const suo = giocatoriDi(p).find((g) => g.uid === uid);
  return suo ? suo.quota : 0;
}

export function eGiocatore(p: ConGiocatori & { utenteId?: string }, uid: string): boolean {
  if (!uid) return false;
  if (p.utenteId === uid) return true;
  return giocatoriDi(p).some((g) => g.uid === uid);
}

// La divisione in parti uguali, con il resto a carico di chi prenota.
// ⚠️ Il resto NON si distribuisce: su 10 euro in tre verrebbero 3,33 a
// testa e un centesimo orfano. Darlo a chi prenota e' l'unica scelta
// che non sorprende nessuno — gli altri vedono la cifra tonda che
// hanno accettato, e chi organizza paga il centesimo.
export function dividiInParti(prezzo: number, quantiAggiunti: number): {
  quotaCiascuno: number; quotaChiPrenota: number;
} {
  const persone = quantiAggiunti + 1;
  // Math.floor e non Math.round: arrotondando per eccesso la somma
  // delle quote poteva SUPERARE il prezzo, e chi prenota si sarebbe
  // ritrovato una quota negativa — cioe' un accredito.
  const quotaCiascuno = Math.floor((prezzo / persone) * 100) / 100;
  return {
    quotaCiascuno,
    quotaChiPrenota: aCentesimi(prezzo - quotaCiascuno * quantiAggiunti),
  };
}

// ---- Le tre modifiche possibili a partita gia' prenotata ----
//
// ⚠️ Solo queste tre, e ognuna con una regola sua sul denaro. Non e'
// pignoleria: e' la differenza fra un'operazione che l'utente capisce
// e un addebito a sorpresa sul portafoglio di un terzo.
//
// ⚠️ Chi si tocca si indica con l'IDENTIFICATIVO, mai con la posizione
// nell'elenco. Con la posizione bastava che un secondo dispositivo
// avesse tolto qualcuno un attimo prima: la transazione rilegge
// l'elenco fresco, applica l'indice vecchio, e finisce per buttare
// fuori una persona diversa da quella che si vedeva a schermo — con
// tanto di avviso che nomina quella sbagliata.
export type ModificaGiocatori =
  // Il posto resta, cambia chi lo occupa: il nuovo paga ESATTAMENTE
  // quello che pagava il vecchio, e a nessun altro cambia niente.
  | { tipo: 'sostituisci'; uid: string; nuovo: { uid: string; nome: string; cognome: string } }
  // Il posto sparisce e la sua quota torna a chi ha prenotato. NON si
  // ridivide fra i restanti: sarebbe un addebito che loro non hanno
  // accettato, deciso da qualcun altro.
  | { tipo: 'togli'; uid: string }
  // Un posto in piu': si ridivide, ma con un pavimento — la quota di
  // chi c'e' gia' puo' solo scendere, mai salire.
  | { tipo: 'aggiungi'; nuovo: { uid: string; nome: string; cognome: string } };

// Sollevato quando la persona da cambiare non e' piu' in elenco.
export const ELENCO_CAMBIATO = 'ELENCO_CAMBIATO';

// Applica la modifica a UNA mezz'ora e restituisce il nuovo elenco.
// Pura: nessuna scrittura, nessuna rete. La transazione la chiama una
// volta per ogni mezz'ora della partita, con il prezzo di quella.
export function applicaModifica(
  attuali: Giocatore[], prezzo: number, m: ModificaGiocatori,
): Giocatore[] {
  if (m.tipo === 'sostituisci' || m.tipo === 'togli') {
    const posto = attuali.findIndex((g) => g.uid === m.uid);
    // ⚠️ Si SOLLEVA, non si restituisce l'elenco com'era. Restituirlo
    // faceva scrivere alla transazione gli stessi identici dati: nessun
    // movimento, nessun addebito, e a schermo il segno di spunta di
    // un'operazione riuscita che non era mai avvenuta.
    if (posto < 0) throw new Error(ELENCO_CAMBIATO);
    if (m.tipo === 'togli') return attuali.filter((_, i) => i !== posto);
    return attuali.map((g, i) => (i === posto ? { ...m.nuovo, quota: g.quota } : g));
  }
  if (attuali.some((g) => g.uid === m.nuovo.uid)) throw new Error(ELENCO_CAMBIATO);
  const { quotaCiascuno } = dividiInParti(prezzo, attuali.length + 1);
  // ⚠️ Math.min e non la quota nuova secca. Dopo una rimozione le quote
  // non sono piu' uguali — chi ha prenotato si e' preso il posto
  // liberato — e ridividere alla cieca poteva far SALIRE la quota di
  // chi era rimasto, che e' esattamente la cosa che questa
  // applicazione promette di non fare mai. Con il pavimento, chi c'e'
  // gia' o scende o resta dov'e', e la differenza la assorbe chi ha
  // prenotato: e' lui che ha deciso di aggiungere qualcuno.
  const dopo = attuali.map((g) => ({ ...g, quota: Math.min(g.quota, quotaCiascuno) }));
  return [...dopo, { ...m.nuovo, quota: quotaCiascuno }];
}

// Di quanto cambia il portafoglio di ciascuno passando da un elenco
// all'altro. Positivo = da addebitare, negativo = da rimborsare.
// Ci sta dentro anche chi prenota, con la chiave del suo uid.
export function differenzeQuote(
  prima: Giocatore[], dopo: Giocatore[], prezzo: number, uidChiPrenota: string,
): Map<string, number> {
  const delta = new Map<string, number>();
  const somma = (uid: string, v: number) => {
    if (!v) return;
    delta.set(uid, aCentesimi((delta.get(uid) ?? 0) + v));
  };
  const quotePrima = new Map(prima.map((g) => [g.uid, g.quota]));
  const quoteDopo = new Map(dopo.map((g) => [g.uid, g.quota]));
  for (const uid of new Set([...quotePrima.keys(), ...quoteDopo.keys()])) {
    somma(uid, aCentesimi((quoteDopo.get(uid) ?? 0) - (quotePrima.get(uid) ?? 0)));
  }
  const primaChiPrenota = aCentesimi(prezzo - prima.reduce((t, g) => t + g.quota, 0));
  const dopoChiPrenota = aCentesimi(prezzo - dopo.reduce((t, g) => t + g.quota, 0));
  somma(uidChiPrenota, aCentesimi(dopoChiPrenota - primaChiPrenota));
  // Chi non cambia di un centesimo non deve comparire: ogni voce qui
  // dentro diventa una scrittura sul portafoglio e una riga nello
  // storico movimenti di qualcuno.
  for (const [uid, v] of [...delta.entries()]) if (v === 0) delta.delete(uid);
  return delta;
}

// Come chiamare la partita in una frase, dal punto di vista di chi
// guarda. Sta qui perche' la usano tre schermate diverse e con tre
// versioni leggermente diverse si sarebbe letto "gioco con Mario" in
// una e "con Mario e altri 2" nell'altra sulla stessa prenotazione.
export function elencoNomi(giocatori: { nome: string; cognome: string }[]): string {
  const nomi = giocatori.map((g) => `${g.nome} ${g.cognome}`.trim()).filter(Boolean);
  if (nomi.length === 0) return '';
  if (nomi.length === 1) return nomi[0];
  return `${nomi.slice(0, -1).join(', ')} e ${nomi[nomi.length - 1]}`;
}

// ⚠️ COME SI DICE, A CHI E' STATO AGGIUNTO, CHI C'E' IN CAMPO.
// Chi non ha prenotato apre la scheda della partita e la prima cosa
// che vuole sapere e' due cose: chi mi ci ha messo, e con chi gioco.
// Prima si leggeva solo la prima — «Ti ha invitato Mario» — e su una
// partita in tre o in quattro gli altri non comparivano da nessuna
// parte: si arrivava al campo scoprendo la formazione.
//
// «Invitato» e' diventato «aggiunto» perche' e' quello che succede
// davvero: non e' un invito che si puo' declinare, e' un posto in
// campo con addebito della quota. Chiamarlo invito addolciva una cosa
// che tocca il portafoglio.
//
// Torna una coppia e non una frase sola perche' le due righe si
// scrivono diverse: la prima e' il fatto, la seconda e' contorno.
// Gli altri arrivano gia' scritti in fila (`elencoNomi`) e non come
// elenco di persone: le due schermate che chiamano questa funzione li
// hanno in due forme diverse — una ha gli oggetti, l'altra solo la
// stringa gia' composta — e farle convergere qui e' l'unico modo
// perche' dicano la stessa identica frase.
export function chiTiHaAggiunto(
  chiHaPrenotato: string,
  nomiDegliAltri: string,
): { principale: string; altri: string } {
  const nome = (chiHaPrenotato ?? '').trim();
  const altri = (nomiDegliAltri ?? '').trim();
  return {
    principale: nome ? `Ti ha aggiunto ${nome}` : 'Sei stato aggiunto a questa partita',
    altri: altri ? `In campo anche ${altri}` : '',
  };
}
