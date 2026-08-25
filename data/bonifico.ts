// ============================================================
// DATI PER IL BONIFICO — come il socio ricarica il proprio credito.
//
// Racket Fever non tratta pagamenti: il socio versa al circolo con un
// bonifico dalla sua banca, e il circolo gli carica il credito quando
// vede l'accredito. Qui dentro c'è solo quello che serve a compilare
// quel bonifico: chi è l'intestatario del conto e su quale IBAN.
//
// ⚠️ NON STANNO SUL DOCUMENTO DEL CIRCOLO, e non è una sottigliezza.
// `circoli/{id}` lo può leggere CHIUNQUE sia autenticato — deve, perché
// la lista dei circoli si vede prima ancora di scegliere il proprio, e
// perché le sessioni Collaboratore sono accessi anonimi. Mettere lì
// l'IBAN vorrebbe dire pubblicare l'IBAN di ogni circolo d'Italia a
// chiunque abbia scaricato l'app. Un IBAN non è una password e non
// permette di prelevare niente, ma è un dato di un'associazione vera e
// non c'è ragione di regalarlo a chi non ne ha bisogno.
//
// Sta quindi in una sottocollezione con le sue regole: la leggono i
// membri del circolo, la scrive l'Admin.
// ============================================================

import { doc, getDoc, onSnapshot, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';

export interface DatiBonifico {
  intestatario: string;
  iban: string;
}

// Un documento solo, con un nome fisso: non c'è nessun caso in cui un
// circolo ne abbia due.
export function rifBonifico(circoloId: string) {
  return doc(db, 'circoli', circoloId, 'riservato', 'bonifico');
}

// ⚠️ Vero solo se ci sono TUTTI E DUE i campi. È questo che decide se il
// socio vede il pulsante «Ricarica»: un pop-up con l'intestatario e
// senza IBAN non serve a fare un bonifico, serve solo a far credere che
// si possa.
export function bonificoCompleto(d: DatiBonifico | null | undefined): boolean {
  return !!d && !!d.intestatario.trim() && !!d.iban.trim();
}

function daFirestore(v: any): DatiBonifico | null {
  if (!v) return null;
  return {
    intestatario: (v.intestatario as string) ?? '',
    iban: (v.iban as string) ?? '',
  };
}

export async function leggiBonifico(circoloId: string): Promise<DatiBonifico | null> {
  const snap = await getDoc(rifBonifico(circoloId));
  return snap.exists() ? daFirestore(snap.data()) : null;
}

export function ascoltaBonifico(
  circoloId: string,
  callback: (dati: DatiBonifico | null) => void,
) {
  return onSnapshot(
    rifBonifico(circoloId),
    (snap) => callback(snap.exists() ? daFirestore(snap.data()) : null),
    // ⚠️ Un errore qui non deve rompere la schermata che lo ascolta: il
    // caso normale in cui succede è un circolo che non ha mai compilato
    // niente, e la risposta giusta è «non c'è», non un'eccezione.
    () => callback(null),
  );
}

export async function salvaBonifico(circoloId: string, dati: DatiBonifico): Promise<void> {
  await setDoc(rifBonifico(circoloId), {
    intestatario: dati.intestatario.trim(),
    iban: ibanNormalizzato(dati.iban),
    aggiornatoIl: serverTimestamp(),
  });
}

// Toglie del tutto i dati: il pulsante «Ricarica» sparisce dall'app dei
// soci. Serve quando un circolo cambia conto e non vuole lasciare in
// giro il vecchio nel frattempo.
export async function cancellaBonifico(circoloId: string): Promise<void> {
  await deleteDoc(rifBonifico(circoloId));
}

// ============================================================
// L'IBAN — scritto come si scrive, e controllato come si controlla.
// ============================================================

// Senza spazi e in maiuscolo: è la forma in cui va copiato dentro l'app
// della banca, ed è quella su cui si fa il controllo.
export function ibanNormalizzato(iban: string): string {
  return (iban || '').replace(/[\s -]/g, '').toUpperCase();
}

// A gruppi di quattro: è come lo si legge su un estratto conto, ed è
// l'unico modo in cui un numero di ventisette cifre si ricontrolla a
// occhio senza perdere il segno.
export function ibanLeggibile(iban: string): string {
  const pulito = ibanNormalizzato(iban);
  return pulito.replace(/(.{4})/g, '$1 ').trim();
}

// ⚠️ IL CONTROLLO VERO, non solo la lunghezza. Un IBAN porta due cifre
// di controllo calcolate su tutto il resto (lo standard ISO 7064, resto
// 97 uguale a 1): una cifra sbagliata o due invertite le fanno saltare.
// Vale la pena farlo qui perché questo numero l'Admin lo digita una
// volta sola e poi non lo guarda più — e l'errore lo scoprirebbe un
// socio, settimane dopo, con un bonifico rifiutato dalla banca.
//
// ⚠️ Il resto si calcola a pezzi e non su un numero solo: un IBAN
// convertito in cifre diventa un intero di trenta e passa cifre, e in
// JavaScript un intero così perde precisione molto prima della fine.
export function ibanValido(iban: string): boolean {
  const s = ibanNormalizzato(iban);
  if (!/^[A-Z]{2}[0-9]{2}[A-Z0-9]{10,30}$/.test(s)) return false;
  const riordinato = s.slice(4) + s.slice(0, 4);
  let resto = 0;
  for (const carattere of riordinato) {
    const valore = carattere >= 'A' && carattere <= 'Z'
      ? String(carattere.charCodeAt(0) - 55)
      : carattere;
    for (const cifra of valore) {
      resto = (resto * 10 + Number(cifra)) % 97;
    }
  }
  return resto === 1;
}

// ⚠️ La causale la costruiamo noi e non la scrive il socio. Serve al
// circolo per capire CHI ha pagato: un bonifico con causale «ricarica»
// e il nome del titolare del conto — che può essere il padre, o la
// moglie — è un bonifico che qualcuno in segreteria deve rincorrere.
export function causaleRicarica(nome: string, cognome: string, sigla: string): string {
  const chi = `${nome} ${cognome}`.trim();
  const dove = (sigla || '').trim().toUpperCase();
  return `RF credito${chi ? ` · ${chi}` : ''}${dove ? ` · ${dove}` : ''}`;
}
