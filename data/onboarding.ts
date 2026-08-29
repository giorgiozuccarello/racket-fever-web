// ============================================================
// ONBOARDING CIRCOLI — crea un nuovo circolo e il suo primo
// Admin Circolo, in sostituzione dello script seed.js.
//
// ⚠️ L'ACCOUNT DEL PRESIDENTE LO FA IL SERVER, dal 29 agosto 2026.
// Prima lo creava questo file, dal browser, su un'istanza Firebase
// SECONDARIA e "usa e getta": serviva perche' createUser sull'istanza
// principale avrebbe sostituito la sessione del Super Admin con quella
// dell'account appena creato — comportamento nativo di Firebase Auth,
// non un difetto nostro.
//
// Funzionava, ma aveva un limite che dal browser non si puo' aggirare:
// non si puo' CERCARE un utente per email. Un presidente che fosse
// gia' socio — del proprio circolo o di un altro — sbatteva contro
// «esiste gia' un account con questa email», e il circolo non si
// riusciva ad attivare. La qualifica non e' l'account: e' un
// documento, e lo stesso indirizzo puo' averne piu' d'uno.
//
// Ora la chiamata e' a `assegnaQualifica` (functions/src/index.ts),
// che l'account lo cerca e lo collega, oppure lo crea. La sessione del
// Super Admin non si muove perche' da qui non si tocca piu' nessun
// account: i documenti Firestore continuano a scriversi con l'istanza
// principale, quindi con i suoi permessi.
// ============================================================

import { doc, addDoc, updateDoc, collection, serverTimestamp } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../lib/firebase';
import { TEMA_APP_DEFAULT } from './circoli';

export interface DatiOnboarding {
  nomeCircolo: string;
  citta: string;
  sigla: string;
  regione: string;
  // ⚠️ Chieste alla NASCITA e non dopo. Da quando la geografia e' di
  // rete, l'Admin non puo' piu' aggiungerle da solo: un circolo che
  // entra senza provincia resta invisibile alla vendita provinciale e
  // pubblica tornei che nessuno trova filtrando per provincia, finche'
  // qualcuno di noi non riapre la sua scheda. Il momento in cui il dato
  // costa zero e' questo.
  provincia: string;
  comune: string;
  passwordCircolo: string;
  nomeAdmin: string;
  cognomeAdmin: string;
  emailAdmin: string;
  passwordAdmin: string;

  // ---- Anagrafica di rete (facoltativa in fase di creazione) ----
  // Chi ha chiesto l'adesione e chi ha firmato: si compilano qui se si
  // sanno già, altrimenti si aggiungono dopo dalla scheda circolo. Non
  // devono bloccare la creazione — un circolo che vuole partire oggi
  // non può aspettare che arrivi il contratto firmato.
  richiedenteNome?: string;
  richiedenteRuolo?: string;
  richiedenteEmail?: string;
  richiedenteTelefono?: string;
  firmatarioNome?: string;
  firmatarioRuolo?: string;
  firmaIl?: string; // 'YYYY-MM-DD'
  richiestaId?: string;
  noteInterne?: string;
}

// Firestore rifiuta il valore undefined (ignoreUndefinedProperties non
// è attivo).
// ⚠️ Ritorna null e non undefined: un campo vuoto va scritto come
// null, non omesso. La modifica dall'anagrafica scrive null, e avere
// due rappresentazioni dello stesso "vuoto" sullo stesso campo —
// assente qui, null la' — e' la divergenza che morde alla prima query
// o al primo confronto con != null.
function testoOpzionale(v?: string | null): string | null {
  const t = (v ?? '').trim();
  return t.length > 0 ? t : null;
}

// Rete di sicurezza contro undefined: oggi nessun campo qui sotto lo
// produce, ma basta un campo nuovo aggiunto in fretta perche' l'intera
// creazione del circolo venga respinta da Firestore con un errore che
// non dice quale campo sia.
function ripulisci<T extends Record<string, any>>(oggetto: T): T {
  const pulito: Record<string, any> = {};
  Object.keys(oggetto).forEach((k) => {
    if (oggetto[k] !== undefined) pulito[k] = oggetto[k];
  });
  return pulito as T;
}

// ⚠️ L'ONBOARDING NON E' ATOMICO, e non puo' esserlo: l'account Auth
// e i documenti Firestore stanno su due servizi diversi, e dal browser
// non c'e' modo di legarli in un'unica transazione. Se si rompe in
// mezzo, chi sta creando il circolo deve sapere ESATTAMENTE a che
// punto si e' fermato — altrimenti riprova da capo, si sente dire che
// l'email e' gia' in uso, e non capisce perche'.
export const ONBOARDING_ACCOUNT_ORFANO = 'ONBOARDING_ACCOUNT_ORFANO';
export const ONBOARDING_CIRCOLO_SENZA_ADMIN = 'ONBOARDING_CIRCOLO_SENZA_ADMIN';

// ⚠️ RESTITUISCE ANCHE `passwordCreata`, dal 29 agosto 2026: dice se
// l'account del presidente e' nato adesso oppure se ne e' stato
// collegato uno che esisteva gia'. Nel secondo caso il riepilogo non
// deve mostrare nessuna password — quella e' sua, non la sappiamo.
export async function creaCircoloConAdmin(
  dati: DatiOnboarding,
): Promise<{ circoloId: string; passwordCreata: boolean }> {
  // ---- 1. Prima il circolo, e l'account DOPO ----
  //
  // ⚠️ L'ORDINE E' STATO ROVESCIATO, e ha tolto di mezzo un guasto
  // intero. Prima si creava l'account e poi il circolo: se il secondo
  // passo falliva restava un account Auth intestato al presidente e
  // agganciato a niente — l'`ONBOARDING_ACCOUNT_ORFANO` qui sopra — e
  // riprovando da capo ci si sentiva rispondere «email gia' in uso»
  // senza capire perche'. Con il circolo per primo quel caso non esiste
  // piu': un circolo senza Admin si vede, si racconta e si ripara.
  //
  // ⚠️ E L'ACCOUNT LO FA IL SERVER. Dal browser non si puo' cercare un
  // utente per email, quindi un presidente che fosse gia' socio di un
  // altro circolo — o del proprio — non si poteva collegare: si finiva
  // contro «esiste gia' un account con questa email», che e' lo stesso
  // muro che bloccava i Maestri. La qualifica non e' l'account: e' un
  // documento, e lo stesso indirizzo puo' averne piu' d'uno.

  // ---- 2. Si scrive con l'istanza principale (db),
  //         quindi con i permessi del Super Admin loggato ----
  //
  // ⚠️ temaApp, NON tema. "tema" era il campo di due versioni fa (una
  // coppia di colori liberi); oggi l'app legge una chiave fra gli otto
  // TEMI_APP. Un circolo creato con il campo vecchio nasceva senza
  // tema e ricadeva sul default a ogni avvio.
  //
  // ⚠️ stato e creatoIlMs si scrivono QUI, alla nascita: sono gli unici
  // due momenti in cui la data d'ingresso in rete è nota con certezza.
  // Ricostruirla dopo, per un circolo già attivo, non si può.
  let circoloRef;
  try {
  circoloRef = await addDoc(collection(db, 'circoli'), ripulisci({
    nome: dati.nomeCircolo.trim(),
    citta: dati.citta.trim(),
    sigla: dati.sigla.trim().toUpperCase(),
    password: dati.passwordCircolo.trim(),
    temaApp: TEMA_APP_DEFAULT,
    limiteOreSettimanali: 0,
    regione: testoOpzionale(dati.regione) ?? null,
    provincia: testoOpzionale(dati.provincia) ?? null,
    comune: testoOpzionale(dati.comune) ?? null,

    // ---- Anagrafica di rete ----
    stato: 'attivo',
    creatoIlMs: Date.now(),
    // Il doppio orario è voluto: creatoIlMs si legge subito, anche
    // mentre la scrittura è ancora in volo (latency compensation);
    // creatoIl è quello che fa fede, scritto dal server e immune
    // all'orologio sballato del PC di chi crea il circolo.
    creatoIl: serverTimestamp(),
    sospesoIlMs: null,
    chiusoIlMs: null,

    richiedenteNome: testoOpzionale(dati.richiedenteNome),
    richiedenteRuolo: testoOpzionale(dati.richiedenteRuolo),
    richiedenteEmail: testoOpzionale(dati.richiedenteEmail),
    richiedenteTelefono: testoOpzionale(dati.richiedenteTelefono),
    firmatarioNome: testoOpzionale(dati.firmatarioNome),
    firmatarioRuolo: testoOpzionale(dati.firmatarioRuolo),
    firmaIl: testoOpzionale(dati.firmaIl),
    richiestaId: testoOpzionale(dati.richiestaId),
    noteInterne: testoOpzionale(dati.noteInterne),
  }));
  } catch (errore) {
    // ⚠️ NON C'E' PIU' NESSUN ACCOUNT ORFANO DA SPIEGARE: adesso il
    // circolo si crea per primo, quindi se questo passo fallisce non e'
    // rimasto niente in giro e si puo' semplicemente riprovare. La
    // costante `ONBOARDING_ACCOUNT_ORFANO` resta esportata perche' il
    // pannello la nomina ancora nei suoi messaggi, ma da qui non viene
    // piu' lanciata.
    console.warn('Circolo non creato:', errore);
    throw new Error(ONBOARDING_CIRCOLO_SENZA_ADMIN);
  }

  // ============================================================
  // ⚠️ L'ACCOUNT E LA QUALIFICA IN UN COLPO SOLO, SUL SERVER.
  //
  // `assegnaQualifica` cerca l'indirizzo: se esiste gia' un account —
  // il presidente che e' anche socio, che e' il caso normale — lo
  // COLLEGA, e la password scritta nel modulo la ignora, perche' e'
  // sua. Se non esiste lo crea con quella password e accende
  // `passwordDaCambiare`, il segno che obbliga a sceglierne una propria
  // al primo accesso.
  //
  // ⚠️ Il segno si accende SOLO sugli account nuovi, e lo decide il
  // server: su uno che esisteva gia' la password non l'abbiamo mai
  // saputa, quindi obbligarlo a cambiarla sarebbe una pretesa senza
  // motivo — oltre che una bugia scritta su un documento.
  // ============================================================
  let passwordCreata = false;
  try {
    const chiama = httpsCallable(functions, 'assegnaQualifica', { timeout: 120000 });
    const esito = await chiama({
      circoloId: circoloRef.id,
      qualifica: 'responsabile',
      nome: dati.nomeAdmin.trim(),
      cognome: dati.cognomeAdmin.trim(),
      email: dati.emailAdmin.trim(),
      password: dati.passwordAdmin,
    });
    passwordCreata = (esito.data as { creato?: boolean })?.creato === true;
  } catch (errore: any) {
    // Il circolo esiste ma nessuno puo' amministrarlo: comparirebbe
    // nell'elenco dei soci senza campi, senza orari e senza nessuno
    // che possa configurarlo.
    //
    // ⚠️ Il MOTIVO del server viaggia insieme al codice, in `motivo`.
    // Quasi sempre non e' un guasto ma una regola — «questo indirizzo e'
    // gia' Admin di un altro circolo» — e chi sta creando il circolo deve
    // leggerla, non sentirsi dire genericamente che qualcosa e' andato
    // storto su un circolo che intanto esiste davvero.
    console.warn('Admin non collegato al circolo appena creato:', errore);
    const guasto: any = new Error(ONBOARDING_CIRCOLO_SENZA_ADMIN);
    guasto.motivo = typeof errore?.message === 'string' ? errore.message : '';
    guasto.circoloId = circoloRef.id;
    throw guasto;
  }

  // ---- 3. Se il circolo nasce da una richiesta arrivata dal sito,
  //         quella richiesta si chiude da sola e resta legata al
  //         circolo creato. Se questo passaggio fallisce il circolo
  //         esiste comunque: è una cucitura, non una condizione.
  const idRichiesta = testoOpzionale(dati.richiestaId);
  if (idRichiesta) {
    try {
      await updateDoc(doc(db, 'richieste_attivazione', idRichiesta), {
        stato: 'attivata',
        circoloId: circoloRef.id,
      });
    } catch (errore: any) {
      console.warn('Richiesta non aggiornata:', errore?.message ?? errore);
    }
  }

  return { circoloId: circoloRef.id, passwordCreata };
}
