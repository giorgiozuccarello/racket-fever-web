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
// vivono in memoria e non vengono scritti da nessuna parte.
// ============================================================

import {
  EmailAuthProvider, reauthenticateWithCredential,
  updatePassword, verifyBeforeUpdateEmail,
} from 'firebase/auth';
import { doc, updateDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';

// ⚠️ Dodici e non sei. Il minimo di Firebase è sei caratteri, ed è il
// minimo per un account qualunque; questo apre l'intera rete dei
// circoli, i dati di tutti i soci e il registro del denaro. Non è una
// misura di sicurezza raffinata — la lunghezza è però l'unica cosa che
// conta davvero contro un tentativo automatico.
export const MIN_PASSWORD = 12;

// Restituisce il problema da mostrare, oppure null se la password va
// bene. Il messaggio è quello che legge una persona, non un codice.
export function problemaPassword(nuova: string, attuale: string, conferma: string): string | null {
  if (nuova.length < MIN_PASSWORD) {
    return `La nuova password deve essere lunga almeno ${MIN_PASSWORD} caratteri.`;
  }
  if (!/[a-zA-Z]/.test(nuova) || !/[0-9]/.test(nuova)) {
    return 'La nuova password deve contenere almeno una lettera e almeno una cifra.';
  }
  if (nuova === attuale) {
    return 'La nuova password è identica a quella attuale: non cambierebbe niente.';
  }
  if (nuova !== conferma) {
    return 'Le due password non coincidono.';
  }
  return null;
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
