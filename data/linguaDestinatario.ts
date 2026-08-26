// ============================================================
// LA LINGUA DI CHI RICEVE — non di chi scrive.
//
// ⚠️ GEMELLO DEL FILE DELL'APP. Sul sito serve la sola metà che
// LEGGE: la dashboard scrive avvisi ai soci e ai Maestri, e deve
// comporli nella loro lingua. La metà che SCRIVE la lingua resta
// inutilizzata qui — l'Admin non riceve avvisi personali, e la sua
// preferenza non serve a nessun altro — ma si tiene identica al
// gemello: due file che divergono per una funzione in meno sono due
// file che prima o poi divergono anche per il resto.
//
// ⚠️ È IL CUORE DELLA TORNATA, e vale la pena dirlo in una riga: un
// avviso lo scrive una persona e lo legge un'altra. In tutte le
// schermate «la lingua» è quella del telefono che si ha in mano; qui
// no. Chi tocca «togli dalla prenotazione» è italiano, chi riceve la
// notifica può essere tedesco — e la notifica è sua, non di chi l'ha
// fatta partire.
//
// ⚠️ SI LEGGE DAL PROFILO DEL DESTINATARIO, e si può: le regole
// Firestore lasciano già leggere `utenti/{uid}` a chiunque sia socio
// dello stesso circolo, all'Admin, al Maestro e al Super Admin — è la
// stessa lettura che serve per mostrare il nome di un compagno o per
// controllargli il credito prima di dividere una prenotazione. Non è
// stato aperto niente di nuovo per questa tornata.
//
// ⚠️ E SI RICORDA PER LA DURATA DELLA SESSIONE. Un annullamento avvisa
// tre compagni; una cancellazione del circolo può avvisarne dieci. Senza
// memoria sarebbero dieci letture per una cosa che cambia una volta
// all'anno. La memoria vive quanto l'app resta aperta: chi cambia
// lingua mentre qualcun altro ha l'app aperta si vedrà arrivare il
// primo avviso ancora nella lingua di prima, e da lì in poi in quella
// nuova. È il compromesso giusto — l'alternativa era una lettura di
// rete per ogni destinatario di ogni avviso.
//
// ⚠️ IL RIPIEGO È L'ITALIANO, E NON FALLISCE MAI. Qualunque cosa vada
// storta — permessi, rete, documento assente, campo scritto a mano con
// un valore inventato — si torna all'italiano. Un avviso nella lingua
// sbagliata è un fastidio; un `throw` qui dentro sarebbe una partita
// annullata di cui nessuno viene avvisato, perché questa chiamata sta
// dentro il `try` di chi sta cancellando.
// ============================================================

import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Lingua, LINGUA_DI_SERIE, linguaOItaliano } from './linguaBase';
import { ChiaveTesto, ValoriTesto, traduci } from './testi';

// ============================================================
// IL TESTO DI UN AVVISO — o una frase già fatta, o una chiave.
//
// ⚠️ DUE FORME E NON UNA, ed è quello che ha reso questa tornata
// possibile senza riscrivere quaranta chiamate. `creaNotifica` accetta
// ancora una stringa: chi passa una stringa scrive quella, esattamente
// come prima. Chi passa `avviso('chiave', {...})` fa comporre la frase
// nella lingua del destinatario. I punti non ancora convertiti
// continuano a funzionare, in italiano, invece di rompersi.
// ============================================================
export type ValoriAvviso = Record<string, string | number | TestoAvviso>;

export type TestoAvviso = string | { chiave: ChiaveTesto; valori?: ValoriAvviso };

export function avviso(chiave: ChiaveTesto, valori?: ValoriAvviso): TestoAvviso {
  return { chiave, valori };
}

const ricordate = new Map<string, Lingua>();

async function leggiLingua(percorso: string, id: string): Promise<Lingua> {
  const chiave = `${percorso}/${id}`;
  const gia = ricordate.get(chiave);
  if (gia) return gia;
  try {
    const snap = await getDoc(doc(db, percorso, id));
    const l = linguaOItaliano(snap.exists() ? (snap.data() as any)?.lingua : null);
    ricordate.set(chiave, l);
    return l;
  } catch {
    // ⚠️ Non si mette in memoria il ripiego: un rifiuto di rete non deve
    // condannare quella persona all'italiano per tutta la sessione.
    return LINGUA_DI_SERIE;
  }
}

export function linguaDelSocio(uid: string): Promise<Lingua> {
  return leggiLingua('utenti', uid);
}

export function linguaDelMaestro(uid: string): Promise<Lingua> {
  return leggiLingua('maestri', uid);
}

// ⚠️ Da chiamare quando la propria lingua cambia: senza, l'app che ha
// già letto il proprio profilo continuerebbe a comporre nella lingua di
// prima gli avvisi che manda a sé stessa («hai confermato la lezione»).
export function dimenticaLinguaRicordata(uid?: string): void {
  if (!uid) { ricordate.clear(); return; }
  ricordate.delete(`utenti/${uid}`);
  ricordate.delete(`maestri/${uid}`);
}

// ============================================================
// I PEZZI DENTRO I PEZZI.
//
// ⚠️ SERVE PERCHÉ MOLTI AVVISI HANNO UNA CODA FACOLTATIVA: «…il
// circolo ha prenotato per te» a volte finisce con «Nessun addebito
// sul tuo credito», a volte no. La coda è una frase, quindi va
// tradotta anche lei — ma chi scrive l'avviso non sa in che lingua,
// perché la lingua la si scopre qui dentro, un istante dopo.
//
// L'alternativa era una chiave per ogni combinazione: «prenotato per
// te», «prenotato per te senza addebito», «modificata», «modificata
// senza addebito»… quattro frasi quasi identiche da tenere allineate
// in tre lingue, e sei mesi dopo una delle quattro dice una cosa
// diversa dalle altre tre. Così invece la coda è un valore come gli
// altri: `{ coda: senzaAddebito ? avviso('avv.cir.senzaAddebito') : '' }`,
// e si risolve nella STESSA lingua della frase che la ospita.
// ============================================================
function risolviValori(valori: ValoriAvviso | undefined, lingua: Lingua): ValoriTesto | undefined {
  if (!valori) return undefined;
  const fuori: ValoriTesto = {};
  for (const [nome, valore] of Object.entries(valori)) {
    fuori[nome] = (valore && typeof valore === 'object' && 'chiave' in valore)
      ? traduci(lingua, valore.chiave, risolviValori(valore.valori, lingua))
      : (valore as string | number);
  }
  return fuori;
}

async function componi(testo: TestoAvviso, lingua: () => Promise<Lingua>): Promise<string> {
  if (typeof testo === 'string') return testo;
  const l = await lingua();
  return traduci(l, testo.chiave, risolviValori(testo.valori, l));
}

export function componiPerSocio(uid: string, testo: TestoAvviso): Promise<string> {
  return componi(testo, () => linguaDelSocio(uid));
}

export function componiPerMaestro(uid: string, testo: TestoAvviso): Promise<string> {
  return componi(testo, () => linguaDelMaestro(uid));
}

// ============================================================
// LA COPIA SU FIRESTORE — l'unica ragione per cui esiste.
//
// ⚠️ LA PREFERENZA VERA RESTA SUL TELEFONO. Questa è una copia, e
// serve a una cosa sola: far sapere a CHI MI SCRIVE in che lingua
// compormi un avviso. Il selettore continua a leggere e scrivere la
// memoria locale — è quella a decidere cosa vedo io — e questa riga
// parte dietro, in silenzio.
//
// ⚠️ IN SILENZIO DAVVERO, ed è voluto. Se la scrittura non riesce —
// rete assente, sessione scaduta, un socio uscito dal circolo — la
// lingua a schermo è già cambiata sotto gli occhi di chi ha toccato il
// selettore: quello che si perde è che gli altri lo sappiano, e si
// riprova al prossimo avvio (vedi `AllineaLingua`). Un avviso di
// errore qui direbbe «non ha funzionato» davanti a una schermata che è
// appena cambiata.
//
// ⚠️ `updateDoc` e non `setDoc`: il profilo esiste già, e un `setDoc`
// con un campo solo lo svuoterebbe. Se il documento non c'è ancora —
// Maestro appena creato, socio in fase di registrazione — la scrittura
// fallisce, e va bene così: al prossimo avvio ci riprova.
// ============================================================
export async function scriviLinguaSocio(uid: string, lingua: Lingua): Promise<void> {
  try {
    await updateDoc(doc(db, 'utenti', uid), { lingua });
    ricordate.set(`utenti/${uid}`, lingua);
  } catch { /* si riprova al prossimo avvio */ }
}

export async function scriviLinguaMaestro(uid: string, lingua: Lingua): Promise<void> {
  try {
    await updateDoc(doc(db, 'maestri', uid), { lingua });
    ricordate.set(`maestri/${uid}`, lingua);
  } catch { /* si riprova al prossimo avvio */ }
}
