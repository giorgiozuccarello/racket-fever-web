// ============================================================
// I SISTEMI DI CLASSIFICA — cinque federazioni, un campo solo.
//
// ⚠️ LA CLASSIFICA NON SI TRADUCE, ED È LA REGOLA DI TUTTO IL FILE.
// «2.1», «LK 12», «WTN 14.5» non sono parole italiane, inglesi o
// tedesche: sono codici di una federazione, e un tedesco che gioca in
// Italia con la tessera FITP resta 3.4 anche se l'app è in tedesco.
// Quello che si traduce è l'etichetta attorno — «Classifica», «Scegli
// il sistema» — mai il valore. È la decisione di Giorgio del 26 agosto
// 2026, ed è anche l'unica che regge: tradurre un codice federale
// vorrebbe dire inventarlo.
//
// ⚠️ E NON SEGUE NEMMENO IL PAESE. Non si indovina il sistema dalla
// lingua dell'app: un italiano che gioca in Germania ha una LK, un
// inglese che gioca a Milazzo ha una FITP. Lo dichiara la persona, con
// la tendina, e nessuno lo deduce al posto suo.
//
// ⚠️ DUE SISTEMI VANNO AL CONTRARIO DEGLI ALTRI TRE, e va saputo prima
// di scrivere qualunque confronto: in FITP, LK e WTN **più basso vuol
// dire più forte**; in UTR e NTRP è l'opposto. Oggi nessuno ordina i
// soci per questo campo — la classifica del circolo è un'altra cosa,
// vedi sotto — ma il giorno che servisse, un confronto ingenuo
// metterebbe i più forti in fondo. Di qui il campo `piuBassoEMeglio`.
//
// ============================================================
// ⚠️ DA NON CONFONDERE CON LA CLASSIFICA SOCIALE.
//
// Sono due cose diverse e stanno su due campi diversi:
//
//  · `posizioneClassificaSociale` (sulla TESSERA) è la scaletta interna
//    del circolo, la muovono le sfide, ed è roba nostra;
//  · questo campo è quello della FEDERAZIONE, lo dichiara il socio e
//    non lo verifica nessuno.
//
// Confonderle vorrebbe dire far scalare la classifica del circolo a chi
// si scrive «1.1» nel profilo.
// ============================================================

import { Lingua } from './linguaBase';

export type SistemaClassifica = 'fitp' | 'lk' | 'wtn' | 'utr' | 'ntrp';

export interface SchedaSistema {
  codice: SistemaClassifica;
  // ⚠️ Il nome NON passa dal dizionario: «FITP» e «LK» si chiamano così
  // in tutte e tre le lingue. Quello che cambia è il paese scritto
  // accanto, ed è l'unica cosa tradotta di questa scheda.
  nome: string;
  // La chiave del dizionario per la riga sotto il nome («Italia»,
  // «Germania e Austria»…).
  chiaveDove: string;
  piuBassoEMeglio: boolean;
  // I valori, raggruppati. Il gruppo ha un'etichetta solo dove serve
  // davvero: in FITP le categorie sono un'informazione, in LK sarebbero
  // venticinque gruppi da un elemento.
  gruppi: Array<{ chiaveGruppo?: string; etichetta?: string; valori: string[] }>;
}

// ⚠️ I VALORI SONO SCRITTI A MANO E NON GENERATI, dove l'elenco è
// corto: un elenco generato con un ciclo è un elenco che nessuno rilegge,
// e il giorno che una federazione aggiunge un gradino non se ne accorge
// nessuno. Dove invece i gradini sono venticinque o quaranta tutti
// uguali, generarli è più onesto che copiarli.
function passi(da: number, a: number, passo: number, decimali: number, prefisso = ''): string[] {
  const fuori: string[] = [];
  const giri = Math.round(Math.abs(a - da) / passo);
  for (let i = 0; i <= giri; i += 1) {
    const v = da + (a >= da ? i * passo : -i * passo);
    fuori.push(prefisso + v.toFixed(decimali));
  }
  return fuori;
}

export const SISTEMI: SchedaSistema[] = [
  {
    codice: 'fitp',
    nome: 'FITP',
    chiaveDove: 'cla.dove.fitp',
    piuBassoEMeglio: true,
    // ⚠️ L'elenco viene dal «Metodo per la compilazione delle
    // classifiche federali 2026» della FITP. Rispetto alla versione
    // scritta a mano che c'era in profilo.tsx mancano `1.3` e `3.6`,
    // che nel metodo federale non esistono: la terza categoria arriva a
    // 3.5, la quarta a 4.6 più il non classificato.
    // ⚠️ Chi aveva salvato un valore che qui non c'è se lo tiene e lo
    // vede lo stesso: vedi `valoreFuoriElenco`. Cancellarglielo per una
    // correzione nostra sarebbe peggio del valore sbagliato.
    gruppi: [
      { chiaveGruppo: 'cla.fitp.prima', valori: ['1.1', '1.2'] },
      { chiaveGruppo: 'cla.fitp.seconda', valori: ['2.1', '2.2', '2.3', '2.4', '2.5', '2.6', '2.7', '2.8'] },
      { chiaveGruppo: 'cla.fitp.terza', valori: ['3.1', '3.2', '3.3', '3.4', '3.5'] },
      { chiaveGruppo: 'cla.fitp.quarta', valori: ['4.1', '4.2', '4.3', '4.4', '4.5', '4.6'] },
      { chiaveGruppo: 'cla.fitp.nc', valori: ['4.NC'] },
    ],
  },
  {
    codice: 'lk',
    nome: 'LK',
    chiaveDove: 'cla.dove.lk',
    piuBassoEMeglio: true,
    // ⚠️ LA LK VERA HA UN DECIMALE (LK 12,3) e va da 1,0 a 25,0: sono
    // duecentoquarantuno valori, cioè una tendina che non si scorre. Qui
    // si offrono i venticinque gradini interi, che sono anche il modo in
    // cui un tedesco la dice a voce — «ich spiele LK 12». È un campo
    // autodichiarato, non un certificato: la precisione al decimo non
    // serve a nessuna funzione dell'app.
    gruppi: [{ valori: passi(1, 25, 1, 0, 'LK ') }],
  },
  {
    codice: 'wtn',
    nome: 'WTN',
    chiaveDove: 'cla.dove.wtn',
    piuBassoEMeglio: true,
    // World Tennis Number dell'ITF: 40 (chi inizia) → 1 (élite). È il
    // sistema che LTA e USTA hanno adottato, quindi copre Regno Unito e
    // Stati Uniti senza aggiungere una riga.
    gruppi: [{ valori: passi(40, 1, 1, 0, 'WTN ') }],
  },
  {
    codice: 'utr',
    nome: 'UTR',
    chiaveDove: 'cla.dove.utr',
    // ⚠️ Al contrario: qui più alto è più forte.
    piuBassoEMeglio: false,
    gruppi: [{ valori: passi(1, 16.5, 0.5, 1, 'UTR ') }],
  },
  {
    codice: 'ntrp',
    nome: 'NTRP',
    chiaveDove: 'cla.dove.ntrp',
    // ⚠️ Anche questo al contrario.
    piuBassoEMeglio: false,
    gruppi: [{ valori: passi(1.5, 7, 0.5, 1, 'NTRP ') }],
  },
];

export const SISTEMA_DI_SERIE: SistemaClassifica = 'fitp';

export function sistemaValido(v: unknown): v is SistemaClassifica {
  return v === 'fitp' || v === 'lk' || v === 'wtn' || v === 'utr' || v === 'ntrp';
}

// ============================================================
// COME SI LEGGE IL CAMPO SUL PROFILO — e perché si chiama ancora
// `classificaFitp`.
//
// ⚠️ IL NOME DEL CAMPO NON SI TOCCA, ed è la stessa decisione presa per
// `sosUtilizzato` quando il S.O.S. è diventato Fido: rinominarlo
// vorrebbe dire che ogni socio che oggi ha una classifica scritta se la
// ritrova vuota il giorno dell'aggiornamento, per una questione di
// eleganza del nome. Il campo continua a contenere IL VALORE; accanto
// nasce `classificaSistema`, che dice a quale federazione appartiene.
//
// ⚠️ E CHI NON CE L'HA È FITP. Un profilo scritto prima di oggi ha il
// valore e non ha il sistema: era la classifica FITP, perché altre non
// se ne potevano scrivere. Il ripiego non è una supposizione, è la
// storia del campo.
// ============================================================
export interface ClassificaDichiarata {
  sistema: SistemaClassifica;
  valore: string;
}

export function classificaDi(p: {
  classificaFitp?: string | null;
  classificaSistema?: string | null;
} | null | undefined): ClassificaDichiarata | null {
  const valore = (p?.classificaFitp ?? '').trim();
  if (!valore) return null;
  return {
    sistema: sistemaValido(p?.classificaSistema) ? p!.classificaSistema as SistemaClassifica : SISTEMA_DI_SERIE,
    valore,
  };
}

export function schedaSistema(s: SistemaClassifica): SchedaSistema {
  return SISTEMI.find((x) => x.codice === s) ?? SISTEMI[0];
}

export function valoriDi(s: SistemaClassifica): string[] {
  return schedaSistema(s).gruppi.flatMap((g) => g.valori);
}

// ⚠️ Vero quando il valore salvato non è fra quelli offerti: succede a
// chi ha scritto la classifica prima che diventasse un elenco, e a chi
// aveva un `3.6` prima che l'elenco venisse corretto sul metodo
// federale. Serve a dirglielo invece di cancellarglielo — è lo stesso
// trattamento della marca di racchetta scritta a mano.
export function valoreFuoriElenco(c: ClassificaDichiarata | null): boolean {
  if (!c) return false;
  return !valoriDi(c.sistema).includes(c.valore);
}

// ============================================================
// COME SI SCRIVE A SCHERMO.
//
// ⚠️ IL PREFISSO STA GIÀ DENTRO IL VALORE per LK, WTN, UTR e NTRP, e
// NON per la FITP: un italiano dice «sono 3.4», non «sono FITP 3.4»,
// mentre un tedesco dice «LK 12» e basta — la sigla è parte del nome
// della cosa. Tenerlo dentro il valore salvato vuol dire che la stessa
// stringa si legge giusta ovunque compaia, senza che ogni schermata si
// ricordi di aggiungere qualcosa.
// ============================================================
export function etichettaClassifica(c: ClassificaDichiarata | null): string {
  return c ? c.valore : '—';
}

// ⚠️ IL VALORE SENZA LA SIGLA, e serve dove la sigla è già scritta
// accanto. Il riquadro della Home, la riga della scheda socio e la
// pillola della Classifica Sociale scrivono la sigla per conto loro:
// se il valore se la portasse dietro, un tedesco leggerebbe «LK LK 12»
// in tutti e tre i posti. Toglie solo le lettere in testa — «LK 12» →
// «12» — e non tocca «4.NC», che di lettere in testa non ne ha.
export function valoreNudo(c: ClassificaDichiarata | null): string {
  if (!c) return '—';
  return c.valore.replace(/^[A-Za-z]+\s*/, '') || c.valore;
}

// La sigla da mettere sotto il numero nel riquadro della Home: è il
// nome della federazione, non una parola da tradurre.
export function siglaSistema(c: ClassificaDichiarata | null): string {
  return c ? schedaSistema(c.sistema).nome : SISTEMI[0].nome;
}

// ⚠️ Non serve a nessuna schermata di oggi: serve al giorno che si
// vorrà ordinare o accoppiare per forza. È scritto adesso perché la
// regola («due sistemi vanno al contrario») si perde, e chi la
// riscoprirà a mano lo farà dopo aver sbagliato un tabellone.
export function piuForteDi(a: ClassificaDichiarata, b: ClassificaDichiarata): boolean | null {
  if (a.sistema !== b.sistema) return null;
  const numero = (v: string) => Number(v.replace(/[^0-9.]/g, ''));
  const na = numero(a.valore); const nb = numero(b.valore);
  if (!Number.isFinite(na) || !Number.isFinite(nb) || na === nb) return null;
  return schedaSistema(a.sistema).piuBassoEMeglio ? na < nb : na > nb;
}

// Serve solo a tenere `Lingua` importata dove il gemello del sito la
// usa: le due copie devono restare identiche riga per riga.
export type LinguaDellaScheda = Lingua;
