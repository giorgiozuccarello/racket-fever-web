// ============================================================
// DOVE SI RICORDA IL TEMA DELLA DASHBOARD.
//
// Due posti diversi, perché rispondono a due domande diverse:
//
// • il circolo — `circoli/{id}/impostazioni/dashboard` — vale per
//   TUTTI quelli che entrano in quella dashboard, responsabile e
//   collaboratore. È la scelta del circolo, non di chi ha in mano il
//   mouse quel giorno.
//
// • il Super Admin — `super_admin/{uid}` — vale per l'account. Il
//   pannello della rete è uno solo, quindi non c'è nessun «per tutti»
//   di cui parlare.
//
// ⚠️ NON SUL DOCUMENTO `circoli/{id}`, e questa è la regola che questo
// progetto ha già pagato una volta. Ogni app aperta tiene un ascolto
// sull'INTERA collezione `circoli`: toccare un campo qualsiasi di un
// circolo fa arrivare una lettura fatturata su ogni telefono acceso in
// Italia. Un cursore che si muove sono decine di scritture. In una
// sottocollezione nessuno sta ascoltando, e il costo è quello vero.
//
// ⚠️ E SI SCRIVE SOLO SU «SALVA», mai mentre il cursore si muove. Lo
// stesso motivo, dal lato opposto: trascinare un cursore genera un
// evento ogni pochi millesimi, e ognuno sarebbe una scrittura.
// ============================================================

import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { TemaDashboard, temaSeValido } from './temaDashboard';

function riferimentoCircolo(circoloId: string) {
  return doc(db, 'circoli', circoloId, 'impostazioni', 'dashboard');
}

/**
 * Torna `null` quando non c'è ancora niente di salvato — o quando la
 * lettura non è passata. Chi chiama in quel caso resta sui colori di
 * partenza, che è il comportamento giusto in entrambi i casi: una
 * dashboard che non si apre perché manca un colore sarebbe assurda.
 */
export async function leggiTemaCircolo(circoloId: string): Promise<TemaDashboard | null> {
  try {
    const snap = await getDoc(riferimentoCircolo(circoloId));
    if (!snap.exists()) return null;
    return temaSeValido(snap.data());
  } catch {
    return null;
  }
}

export async function salvaTemaCircolo(circoloId: string, tema: TemaDashboard): Promise<boolean> {
  try {
    await setDoc(riferimentoCircolo(circoloId), {
      testata: tema.testata,
      sfondo: tema.sfondo,
      aggiornatoIlMs: Date.now(),
    });
    return true;
  } catch {
    return false;
  }
}

export async function leggiTemaSuperAdmin(uid: string): Promise<TemaDashboard | null> {
  try {
    const snap = await getDoc(doc(db, 'super_admin', uid));
    if (!snap.exists()) return null;
    const dati = snap.data() as { temaDashboard?: unknown };
    if (!dati.temaDashboard) return null;
    return temaSeValido(dati.temaDashboard);
  } catch {
    return null;
  }
}

export async function salvaTemaSuperAdmin(uid: string, tema: TemaDashboard): Promise<boolean> {
  try {
    // ⚠️ `merge`, non una scrittura piena: in quel documento ci sono
    // nome, cognome ed email del Super Admin. Senza `merge` scegliere
    // un colore cancellerebbe il profilo, e il rientro successivo
    // finirebbe al login perché `leggiSuperAdmin` non troverebbe più
    // niente.
    await setDoc(doc(db, 'super_admin', uid), { temaDashboard: tema }, { merge: true });
    return true;
  } catch {
    return false;
  }
}

// ------------------------------------------------------------
// LA RETE DI SICUREZZA NEL BROWSER
//
// ⚠️ Non sostituisce il salvataggio: serve perché fra il momento in cui
// si sceglie un colore e il momento in cui il database lo accetta può
// esserci di mezzo una connessione che non va — o, alla prima
// pubblicazione, delle regole non ancora aggiornate. Senza, si
// ricaricherebbe la pagina e la scelta sarebbe sparita senza una
// parola. Con, si riapre come si era lasciata su questo computer e il
// messaggio dice chiaramente che altrove non si vede ancora.
// ------------------------------------------------------------

export function leggiTemaLocale(chiave: string): TemaDashboard | null {
  try {
    const grezzo = localStorage.getItem(`rf.temaDashboard.${chiave}`);
    if (!grezzo) return null;
    return temaSeValido(JSON.parse(grezzo));
  } catch {
    return null;
  }
}

export function salvaTemaLocale(chiave: string, tema: TemaDashboard): void {
  try {
    localStorage.setItem(`rf.temaDashboard.${chiave}`, JSON.stringify(tema));
  } catch {
    // browser che non lo permette: si perde solo la comodità
  }
}
