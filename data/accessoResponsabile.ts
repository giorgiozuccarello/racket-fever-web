// ============================================================
// L'ACCESSO DEL PRESIDENTE, VISTO DAL TEAM.
//
// ⚠️ ESISTE PER UN CASO SOLO: il presidente che non riesce piu' a
// entrare e a cui il «password dimenticata» non serve, perche' la
// casella su cui arriverebbe il link non e' piu' raggiungibile — un
// indirizzo sbagliato scritto in fase di attivazione, un segretario che
// se n'e' andato portandosi via la posta, un dominio dismesso.
//
// ⚠️ NON E' UNA SCORCIATOIA PER NOI. Dalla Tornata 133 la password del
// presidente non la sappiamo piu': la sceglie lui al primo accesso. Qui
// non la si legge — non si puo', non e' scritta da nessuna parte — la
// si SOSTITUISCE con una provvisoria, e il primo accesso torna
// obbligatorio. Quello che facciamo resta scritto nel registro delle
// Cloud Functions.
//
// ⚠️ IL LAVORO LO FA IL SERVER. Cambiare le credenziali di un altro
// utente richiede l'Admin SDK: dal browser non si potrebbe fare nemmeno
// volendo, e volerlo vorrebbe dire una chiave di servizio dentro un
// file del progetto.
// ============================================================

import { collection, query, where, getDocs } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../lib/firebase';

export interface AccessoResponsabile {
  uid: string;
  nome: string;
  cognome: string;
  email: string;
  // Acceso quando la password in uso è quella data dal team: il
  // presidente è costretto a cambiarla al primo accesso.
  passwordDaCambiare: boolean;
}

export async function leggiResponsabiliDelCircolo(circoloId: string): Promise<AccessoResponsabile[]> {
  const istantanea = await getDocs(query(collection(db, 'responsabili'), where('circoloId', '==', circoloId)));
  return istantanea.docs.map((d) => {
    const v = d.data() as Partial<AccessoResponsabile>;
    return {
      uid: d.id,
      nome: v.nome ?? '',
      cognome: v.cognome ?? '',
      email: v.email ?? '',
      passwordDaCambiare: v.passwordDaCambiare === true,
    };
  });
}

export async function reimpostaAccessoResponsabile(
  uid: string, nuovaEmail: string, nuovaPassword: string,
): Promise<{ email: string; emailCambiata: boolean; passwordCambiata: boolean }> {
  const chiama = httpsCallable(functions, 'reimpostaAccessoResponsabile', { timeout: 120000 });
  const esito = await chiama({ uid, nuovaEmail, nuovaPassword });
  return esito.data as { email: string; emailCambiata: boolean; passwordCambiata: boolean };
}

// ============================================================
// LA PASSWORD PROVVISORIA GENERATA — facoltativa, e si vede.
//
// ⚠️ NIENTE CARATTERI CHE SI CONFONDONO AL TELEFONO. Fuori l'O e lo
// zero, la I e la elle e l'uno: questa password viene DETTATA, e una
// password che si sbaglia a trascrivere costa una seconda telefonata.
// Fuori anche i simboli, per lo stesso motivo.
//
// ⚠️ SI GARANTISCONO UNA LETTERA E UNA CIFRA per costruzione, non
// sperando: il caso in cui il sorteggio produce dodici lettere e nessun
// numero e' raro, ma quando capita la password viene rifiutata e chi
// guarda non capisce perche'.
// ============================================================
const LETTERE = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz';
const CIFRE = '23456789';

export function passwordProvvisoria(lunghezza = 10): string {
  const casuali = new Uint32Array(lunghezza);
  crypto.getRandomValues(casuali);
  const alfabeto = LETTERE + CIFRE;
  const pezzi = Array.from(casuali, (n) => alfabeto[n % alfabeto.length]);
  // Una lettera e una cifra messe in due posizioni sorteggiate.
  const posizioni = new Uint32Array(2);
  crypto.getRandomValues(posizioni);
  pezzi[posizioni[0] % lunghezza] = LETTERE[posizioni[0] % LETTERE.length];
  let secondaPosizione = posizioni[1] % lunghezza;
  if (secondaPosizione === posizioni[0] % lunghezza) secondaPosizione = (secondaPosizione + 1) % lunghezza;
  pezzi[secondaPosizione] = CIFRE[posizioni[1] % CIFRE.length];
  return pezzi.join('');
}
