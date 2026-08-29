// ============================================================
// SICUREZZA DEL PROPRIO ACCESSO — cambiare la password e spostare
// l'email dell'account con cui si è entrati.
//
// ⚠️ ESISTE PERCHÉ IL TITOLARE DEVE POTER RUOTARE LE PROPRIE
// CREDENZIALI DA SOLO. Prima di questo file l'unica strada dalle
// interfacce era il pulsante «Reimposta password» della console
// Firebase, che manda un'email — e l'account del Super Admin era stato
// creato su un indirizzo che non esisteva (`team@racketfever.com`,
// nessuna casella dietro). La console non permette di impostare una
// password a mano: offre solo quel pulsante. Quindi la password non si
// poteva cambiare da nessuna schermata, mentre quella in uso era
// finita in chiaro dentro due file di script.
//
// ⚠️ Per precisione: una strada tecnica c'era, `updateUser()`
// dell'Admin SDK. Ma richiede la chiave di servizio, cioè un altro
// script con dentro un segreto — esattamente il meccanismo che aveva
// causato il problema. Un account che per cambiare la propria password
// ha bisogno di uno script con le chiavi dentro è un account che non
// verrà cambiato.
//
// ⚠️ NON SERVE CHE LA VECCHIA CASELLA ESISTA, ed è il punto. Tutte e
// due le operazioni qui sotto partono dalla PASSWORD ATTUALE, non da
// un link ricevuto per posta. E `verifyBeforeUpdateEmail` manda la
// conferma al NUOVO indirizzo, non al vecchio: si esce da una casella
// morta proprio perché il vecchio indirizzo non viene mai interpellato.
//
// ⚠️ E NON SI CANCELLA E RICREA L'UTENTE. Sembra la scorciatoia ovvia
// dalla console, ed è la strada che chiude fuori: il Super Admin non è
// l'email, è l'UID — i poteri vengono dall'esistenza del documento
// `super_admin/{uid}`, e le regole dicono `allow create: if false`, per
// cui nessun client può ricrearlo. Un utente rifatto ha un UID nuovo, e
// il documento resta a puntare a quello vecchio.
//
// ⚠️ QUI DENTRO NON VA SCRITTA NESSUNA PASSWORD, mai, nemmeno come
// esempio o come valore da rifiutare. È esattamente così che quella
// vecchia è finita in chiaro nel progetto. Il controllo «non rimettere
// quella di prima» si fa confrontando i due campi del modulo, che
// vivono in memoria e non vengono scritti da nessuna parte.//
// ⚠️ E' UN FILE GEMELLO app↔web, e le due copie vanno tenute identiche.
// La parte che cambia l'EMAIL e la mappa di frasi italiane servono solo
// al Super Admin, che vive sul sito: nell'app restano inerti. Sono
// rimaste qui lo stesso perche' due copie che divergono «solo un po'»
// sono il modo in cui, in questo progetto, i gemelli si sono gia'
// separati una volta senza che nessuno se ne accorgesse.
// ============================================================

import {
  EmailAuthProvider, reauthenticateWithCredential,
  updatePassword, verifyBeforeUpdateEmail,
} from 'firebase/auth';
import { doc, updateDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { ChiaveTesto } from './testi';

// ⚠️ Dodici e non sei. Il minimo di Firebase è sei caratteri, ed è il
// minimo per un account qualunque; questo apre l'intera rete dei
// circoli, i dati di tutti i soci e il registro del denaro. Non è una
// misura di sicurezza raffinata — la lunghezza è però l'unica cosa che
// conta davvero contro un tentativo automatico.
export const MIN_PASSWORD = 12;

// ============================================================
// ⚠️ IL CONTROLLO TORNA UN CODICE, NON UNA FRASE — e la frase italiana
// qui sotto e' costruita su questo.
//
// Nato per il Super Admin, dove tutto e' in italiano fisso perche' quel
// pannello lo guarda solo il team. Dal 29 agosto 2026 lo stesso
// controllo serve all'Admin di circolo, che l'applicazione la vede
// nella SUA lingua: un presidente tedesco a cui rispondiamo «Le due
// password non coincidono» non capisce cosa ha sbagliato.
//
// Le regole pero' sono le stesse, e duplicarle vorrebbe dire che fra un
// anno una delle due copie chiedera' dodici caratteri e l'altra dieci.
// Quindi: la regola sta in un posto solo e restituisce un codice; chi
// mostra il messaggio lo traduce come sa.
// ============================================================
export type ProblemaPassword = 'corta' | 'lettereECifre' | 'ugualeAttuale' | 'nonCoincidono';

export function problemaPasswordCodice(
  nuova: string, attuale: string, conferma: string,
): ProblemaPassword | null {
  if (nuova.length < MIN_PASSWORD) return 'corta';
  if (!/[a-zA-Z]/.test(nuova) || !/[0-9]/.test(nuova)) return 'lettereECifre';
  if (nuova === attuale) return 'ugualeAttuale';
  if (nuova !== conferma) return 'nonCoincidono';
  return null;
}

// Restituisce il problema da mostrare, oppure null se la password va
// bene. Il messaggio è quello che legge una persona, non un codice.
// ⚠️ Solo per il Super Admin: è l'unica area senza traduzioni.
export function problemaPassword(nuova: string, attuale: string, conferma: string): string | null {
  switch (problemaPasswordCodice(nuova, attuale, conferma)) {
    case 'corta': return `La nuova password deve essere lunga almeno ${MIN_PASSWORD} caratteri.`;
    case 'lettereECifre': return 'La nuova password deve contenere almeno una lettera e almeno una cifra.';
    case 'ugualeAttuale': return 'La nuova password è identica a quella attuale: non cambierebbe niente.';
    case 'nonCoincidono': return 'Le due password non coincidono.';
    default: return null;
  }
}

// ⚠️ I codici di Firebase non si mostrano DA SOLI, e nemmeno si
// lasciano cadere. «Si è verificato un errore» manda a ripremere un
// pulsante che non funzionerà mai; il codice grezzo
// (`auth/invalid-credential`) non dice a chi legge cosa deve fare. Nel
// ramo finale il codice viene stampato lo stesso, ma dentro una frase
// che dice almeno quale delle due operazioni non è riuscita: è il
// ripiego per i casi non previsti, non la regola.
function inItaliano(codice: string, dove: 'password' | 'email'): string {
  switch (codice) {
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'La password attuale non è corretta. Il cambio non è stato fatto.';
    case 'auth/too-many-requests':
      return 'Troppi tentativi ravvicinati: Firebase ha bloccato l’accesso per qualche minuto. Riprova fra un po’ — non è un guasto e non serve cambiare niente.';
    case 'auth/weak-password':
    // ⚠️ Codice diverso, stessa cosa per chi legge. Arriva quando in
    // console è attiva la password policy di Identity Platform — cioè
    // proprio l'impostazione che si va ad attivare quando si irrigidisce
    // la sicurezza di questo account. Senza questo caso, il titolare si
    // vedrebbe stampare il codice grezzo il giorno che fa la cosa giusta.
    case 'auth/password-does-not-meet-requirements':
      return 'Questa password non rispetta i requisiti impostati sul progetto Firebase. Allungala e mescola lettere, cifre e simboli.';
    case 'auth/user-disabled':
      return 'Questo account risulta disabilitato in Firebase Authentication. Va riabilitato dalla console prima di poter cambiare le credenziali.';
    case 'auth/user-token-expired':
      return 'La sessione è scaduta. Esci, rientra e riprova.';
    case 'auth/internal-error':
      return 'Firebase ha risposto con un errore interno. Non è colpa di quello che hai scritto: riprova fra qualche minuto.';
    // ⚠️ Separato da `internal-error`, e non è pignoleria: qui non c'è
    // niente da riprovare. È una quota del progetto esaurita, e chi
    // legge deve andare a guardare la console, non ripremere il tasto.
    case 'auth/quota-exceeded':
      return 'Il progetto Firebase ha esaurito una quota. Non si risolve riprovando: va guardato il piano nella console Firebase.';
    case 'auth/email-already-in-use':
      return 'Questo indirizzo è già usato da un altro account Firebase. Scegline un altro, oppure libera quello esistente dalla console.';
    case 'auth/invalid-email':
      return 'L’indirizzo non è scritto in modo valido.';
    case 'auth/operation-not-allowed':
      return 'Firebase non permette questa operazione sul progetto. Va guardata la configurazione di Authentication.';
    case 'auth/requires-recent-login':
      // Non dovrebbe mai arrivare: ci si riautentica un istante prima.
      // Se arriva, dirlo com'è vale più che nasconderlo.
      return 'La sessione è troppo vecchia per un’operazione delicata. Esci, rientra e riprova subito.';
    case 'auth/network-request-failed':
      return 'Nessuna risposta dalla rete. Controlla la connessione e riprova.';
    default:
      return dove === 'password'
        ? `Il cambio password non è riuscito (${codice || 'errore sconosciuto'}).`
        : `Il cambio indirizzo non è riuscito (${codice || 'errore sconosciuto'}).`;
  }
}

function utenteOraOppureErrore() {
  const utente = auth.currentUser;
  if (!utente || !utente.email) {
    throw new Error('Sessione scaduta: esci e rientra, poi riprova.');
  }
  return utente as typeof utente & { email: string };
}

// ⚠️ SEMPRE RIAUTENTICARE, anche se si è appena entrati. Non è una
// formalità di Firebase: è ciò che impedisce che un computer lasciato
// aperto e sbloccato per due minuti diventi un cambio di credenziali.
// Chi le cambia deve dimostrare di conoscere quelle di adesso.
async function riautentica(passwordAttuale: string) {
  const utente = utenteOraOppureErrore();
  const credenziale = EmailAuthProvider.credential(utente.email, passwordAttuale);
  await reauthenticateWithCredential(utente, credenziale);
  return utente;
}

export async function cambiaPasswordProprio(passwordAttuale: string, nuova: string): Promise<void> {
  try {
    const utente = await riautentica(passwordAttuale);
    await updatePassword(utente, nuova);
  } catch (e: unknown) {
    const codice = String((e as { code?: string })?.code ?? '');
    if (!codice && e instanceof Error) throw e;
    throw new Error(inItaliano(codice, 'password'));
  }
}

// ⚠️ LA STESSA COSA, MA SENZA DECIDERE LE PAROLE. La versione qui sopra
// torna una frase italiana ed e' quella che usa il Super Admin; questa
// torna il CODICE di Firebase (`auth/wrong-password`…) e la lascia
// tradurre a chi la chiama. Serve all'Admin di circolo e al Maestro,
// che leggono l'applicazione nella loro lingua.
// Torna `null` se e' andata bene, il codice se no. Non lancia: un
// cambio password fallito non e' un guasto del programma, e' una
// risposta da mostrare.
export async function cambiaPasswordConEsito(
  passwordAttuale: string, nuova: string,
): Promise<string | null> {
  try {
    const utente = await riautentica(passwordAttuale);
    await updatePassword(utente, nuova);
    return null;
  } catch (e: unknown) {
    const codice = String((e as { code?: string })?.code ?? '');
    return codice || 'sconosciuto';
  }
}

// ⚠️ `verifyBeforeUpdateEmail` E NON `updateEmail`. Il secondo cambia
// l'indirizzo subito, senza verificare che esista: è così che si
// arriva ad avere un account su una casella che non c'è, cioè il
// guasto che questo file esiste per riparare. Questo invece manda un
// link al NUOVO indirizzo e sposta l'account solo quando il link viene
// aperto — se l'indirizzo è sbagliato o non esiste, non succede
// niente e si resta dove si era.
export async function avviaCambioEmailProprio(passwordAttuale: string, nuovaEmail: string): Promise<void> {
  const pulita = nuovaEmail.trim();
  try {
    const utente = await riautentica(passwordAttuale);
    if (pulita.toLowerCase() === utente.email.toLowerCase()) {
      throw new Error('Il nuovo indirizzo è uguale a quello attuale.');
    }
    await verifyBeforeUpdateEmail(utente, pulita);
  } catch (e: unknown) {
    const codice = String((e as { code?: string })?.code ?? '');
    if (!codice && e instanceof Error) throw e;
    throw new Error(inItaliano(codice, 'email'));
  }
}

// ⚠️ IL DOCUMENTO `super_admin` PORTA UNA COPIA DELL'EMAIL, e dopo uno
// spostamento resta indietro.
//
// ⚠️ OGGI QUELLA COPIA NON LA LEGGE NESSUNO, e va detto invece di
// inventarsi un lettore: la dashboard saluta con `nome`, la sezione
// Sicurezza mostra l'indirizzo vero preso da Firebase Auth, e le
// Functions guardano solo se il documento esiste. Si allinea lo stesso
// perché è un campo dichiarato nel tipo `ProfiloSuperAdmin`: una copia
// che diverge in silenzio è una trappola per il primo che, fra un anno,
// la userà in buona fede credendola aggiornata. Costa una scrittura al
// primo accesso dopo un cambio, e mai più.
//
// ⚠️ NON SI PUÒ FARE AL MOMENTO DEL CAMBIO: l'indirizzo si sposta
// quando viene aperto il link, che è dopo, altrove, magari dal
// telefono. L'unico momento in cui si può rimettere in pari è il
// rientro successivo.
//
// Restituisce se ha funzionato: chi chiama non deve mostrare a schermo
// un valore che sul database non è stato scritto.
export async function allineaEmailProfilo(uid: string, emailVera: string): Promise<boolean> {
  try {
    await updateDoc(doc(db, 'super_admin', uid), { email: emailVera });
    return true;
  } catch {
    // Un allineamento mancato non deve impedire di lavorare: si
    // riproverà al prossimo accesso.
    return false;
  }
}

// ============================================================
// DAL CODICE ALLA PAROLA — la tabella che serve a chi traduce.
//
// ⚠️ STA QUI E NON NELLE DUE SCHERMATE. Il modulo di cambio password
// esiste in due posti (dashboard del sito e dashboard dell'app) e ne
// nascera' un terzo; una tabella copiata tre volte e' una tabella che
// fra sei mesi risponde in tre modi diversi allo stesso errore.
// Qui non si traduce niente: si restituisce QUALE frase serve, e la
// frase la sceglie la lingua di chi guarda.
// ============================================================
export function chiaveProblemaPassword(p: ProblemaPassword): ChiaveTesto {
  switch (p) {
    case 'corta': return 'adm.sic.err.corta';
    case 'lettereECifre': return 'adm.sic.err.lettereECifre';
    case 'ugualeAttuale': return 'adm.sic.err.ugualeAttuale';
    default: return 'adm.sic.err.nonCoincidono';
  }
}

// ⚠️ I codici che NON si mappano non spariscono: cadono su
// «adm.sic.err.generico», che stampa il codice dentro la frase. Un
// errore sconosciuto detto com'e' vale piu' di un «riprova» che manda a
// ripremere un pulsante che non funzionera' mai.
export function chiaveErroreCambioPassword(codice: string): ChiaveTesto {
  switch (codice) {
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'adm.sic.err.attualeSbagliata';
    case 'auth/too-many-requests':
      return 'adm.sic.err.troppiTentativi';
    case 'auth/weak-password':
    case 'auth/password-does-not-meet-requirements':
      return 'adm.sic.err.rifiutata';
    case 'auth/requires-recent-login':
    case 'auth/user-token-expired':
      return 'adm.sic.err.sessioneVecchia';
    case 'auth/network-request-failed':
      return 'adm.sic.err.rete';
    default:
      return 'adm.sic.err.generico';
  }
}
