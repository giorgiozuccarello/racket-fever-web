// ============================================================
// SEGNALAZIONI E BLOCCHI — lettura e scrittura.
//
// Due collezioni in cima all'albero, non sotto il circolo: una
// segnalazione la legge l'Admin di quel circolo E il Super Admin, e un
// blocco lo legge solo chi lo ha messo. Sotto il circolo avrebbero
// ereditato i permessi del circolo, che sono un'altra cosa.
// ============================================================

import {
  collection, doc, addDoc, setDoc, deleteDoc, updateDoc, onSnapshot, query, where, getDocs,
  orderBy, limit,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import {
  COLLEZIONE_SEGNALAZIONI, COLLEZIONE_BLOCCHI, Segnalazione, BloccoSocio, idBlocco,
} from './segnalazioni';
import { MAX_COPIA_MESSAGGI } from './moderazioneTesto';

// ---------------- Segnalazioni ----------------

export async function segnalaSocio(dati: {
  circoloId: string;
  segnalatoUid: string;
  segnalatoNome: string;
  copiaFotoUrl?: string | null;
  copiaRacchetta?: string | null;
  copiaClassifica?: string | null;
  // Gli ultimi messaggi della chat, quando si segnala una frase e non
  // un profilo. Vedi il riquadro in data/segnalazioni.ts.
  copiaMessaggi?: string | null;
  daUid: string;
  daNome: string;
  motivo: string;
}): Promise<void> {
  await addDoc(collection(db, COLLEZIONE_SEGNALAZIONI), {
    circoloId: dati.circoloId,
    segnalatoUid: dati.segnalatoUid,
    segnalatoNome: dati.segnalatoNome,
    // ⚠️ STRINGA VUOTA, NON `null`, ed è la differenza fra funzionare e
    // no. Le regole controllano la lunghezza di questi campi con
    // `.get(campo, '')`, che restituisce il valore di ripiego SOLO se
    // la chiave manca: con la chiave presente e il valore a `null`
    // restituisce `null`, e `null.size()` è un errore di valutazione,
    // cioè scrittura RESPINTA. Siccome quasi nessuno compila racchetta
    // e ranking, la segnalazione sarebbe stata rifiutata sulla
    // maggioranza dei profili — cioè la funzione che esiste per
    // soddisfare Apple e Google non avrebbe funzionato quasi mai.
    // È la stessa trappola già annotata sei volte in firestore.rules,
    // in una variante nuova: non manca la chiave, manca il valore.
    copiaFotoUrl: dati.copiaFotoUrl ?? '',
    copiaRacchetta: dati.copiaRacchetta ?? '',
    copiaClassifica: dati.copiaClassifica ?? '',
    // ⚠️ Stringa vuota e non `null`, per la stessa ragione dei tre campi
    // qui sopra — e con lo stesso tetto che controllano le regole.
    copiaMessaggi: (dati.copiaMessaggi ?? '').slice(0, MAX_COPIA_MESSAGGI),
    daUid: dati.daUid,
    daNome: dati.daNome,
    motivo: dati.motivo,
    stato: 'nuova',
    creatoIlMs: Date.now(),
    vistaDa: null,
    vistaIlMs: null,
  });
}

export function ascoltaSegnalazioniCircolo(
  circoloId: string, callback: (s: Segnalazione[]) => void,
): () => void {
  const q = query(collection(db, COLLEZIONE_SEGNALAZIONI), where('circoloId', '==', circoloId));
  return onSnapshot(
    q,
    (snap) => callback(
      snap.docs
        .map((d) => ({ id: d.id, ...(d.data() as any) }) as Segnalazione)
        .sort((a, b) => (b.creatoIlMs ?? 0) - (a.creatoIlMs ?? 0)),
    ),
    (e) => console.warn('Segnalazioni non lette:', e?.message ?? e),
  );
}

// ⚠️ LE ULTIME DUECENTO, non tutte. Il pannello di rete legge la
// collezione intera a ogni apertura, e su una rete di mille circoli
// quella diventa una pagina che non si apre piu' — è lo stesso
// problema già scritto nero su bianco per le richieste di attivazione.
// Duecento coprono mesi di segnalazioni vere; se un giorno servisse
// scendere più indietro, si aggiunge un filtro per circolo o per data.
export const MAX_SEGNALAZIONI_RETE = 200;

export function ascoltaTutteLeSegnalazioni(
  callback: (s: Segnalazione[]) => void,
): () => void {
  return onSnapshot(
    query(
      collection(db, COLLEZIONE_SEGNALAZIONI),
      orderBy('creatoIlMs', 'desc'),
      limit(MAX_SEGNALAZIONI_RETE),
    ),
    (snap) => callback(
      snap.docs
        .map((d) => ({ id: d.id, ...(d.data() as any) }) as Segnalazione)
        .sort((a, b) => (b.creatoIlMs ?? 0) - (a.creatoIlMs ?? 0)),
    ),
    (e) => console.warn('Segnalazioni non lette:', e?.message ?? e),
  );
}

export async function segnaSegnalazione(
  id: string, stato: 'vista' | 'chiusa', daUid: string,
): Promise<void> {
  await updateDoc(doc(db, COLLEZIONE_SEGNALAZIONI, id), {
    stato,
    vistaDa: daUid,
    vistaIlMs: Date.now(),
  });
}

// ---------------- Blocchi ----------------

export async function bloccaSocio(
  da: string, verso: string, circoloId: string,
): Promise<void> {
  await setDoc(doc(db, COLLEZIONE_BLOCCHI, idBlocco(da, verso)), {
    da, verso, circoloId, creatoIlMs: Date.now(),
  });
}

export async function sbloccaSocio(da: string, verso: string): Promise<void> {
  await deleteDoc(doc(db, COLLEZIONE_BLOCCHI, idBlocco(da, verso)));
}

// ============================================================
// ⚠️ SI ASCOLTANO TUTTI E DUE I VERSI, e servono davvero entrambi.
// Quello che ho messo io mi dice chi non voglio più vedere. Quello che
// mi hanno messo mi serve per non provarci: senza, il telefono
// lascerebbe lanciare la sfida e sarebbe il server a rifiutarla, con un
// «permesso negato» in inglese addosso a una persona che non ha fatto
// niente di male.
//
// Chi è bloccato può accorgersene? Sì, indirettamente: non riesce a
// sfidare. L'app non glielo dice — nessun messaggio nomina il blocco —
// ma nasconderlo del tutto avrebbe voluto dire non poter spiegare
// perché un pulsante non funziona.
// ============================================================
export function ascoltaBlocchiDelSocio(
  uid: string, callback: (b: BloccoSocio[]) => void,
): () => void {
  let miei: BloccoSocio[] = [];
  let subiti: BloccoSocio[] = [];
  const manda = () => callback([...miei, ...subiti]);

  const mappa = (snap: any): BloccoSocio[] =>
    snap.docs.map((d: any) => ({ id: d.id, ...(d.data() as any) }) as BloccoSocio);

  const unsubMiei = onSnapshot(
    query(collection(db, COLLEZIONE_BLOCCHI), where('da', '==', uid)),
    (snap) => { miei = mappa(snap); manda(); },
    (e) => console.warn('Blocchi non letti:', e?.message ?? e),
  );
  const unsubSubiti = onSnapshot(
    query(collection(db, COLLEZIONE_BLOCCHI), where('verso', '==', uid)),
    (snap) => { subiti = mappa(snap); manda(); },
    (e) => console.warn('Blocchi non letti:', e?.message ?? e),
  );

  return () => { unsubMiei(); unsubSubiti(); };
}

// Serve alla scheda del socio, che si apre su una persona alla volta e
// non ha bisogno di tenere aperto un ascolto.
export async function leggiBloccoVerso(da: string, verso: string): Promise<boolean> {
  const snap = await getDocs(query(
    collection(db, COLLEZIONE_BLOCCHI), where('da', '==', da), where('verso', '==', verso),
  ));
  return !snap.empty;
}
