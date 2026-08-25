// ============================================================
// UTENTI — Firebase Auth per l'autenticazione, Firestore
// (collezione "utenti") per il profilo, incluso il credito wallet.
// ============================================================

// ⚠️ Sei nomi sono usciti da qui insieme a `registrati()`:
// `createUserWithEmailAndPassword`, `deleteUser`, `setDoc`,
// `runTransaction`, `registraMovimentoInTransazione` e
// `VERSIONE_DOCUMENTI`. Nessuno era piu' usato, e non e' pulizia
// estetica: lasciati li' erano un invito a riscrivere in questo file
// la funzione appena tolta — cioe' a rifare esattamente il gemello
// divergente che ci e' costato un audit. In piu' l'import di
// `registraMovimentoInTransazione` teneva agganciato un modulo intero
// al grafo di questo file per niente.
import {
  signInWithEmailAndPassword,
  signOut,
  sendEmailVerification,
  sendPasswordResetEmail,
  reload,
  User,
} from 'firebase/auth';
import {
  doc, getDoc, updateDoc, onSnapshot,
  collection, query, where,
} from 'firebase/firestore';
import { auth, db, functions } from '../lib/firebase';
import { httpsCallable } from 'firebase/functions';

export interface ProfiloUtente {
  nome: string;
  cognome: string;
  email: string;
  circoloId: string | null;
  credito: number;
  fotoUrl?: string | null; // se assente, si mostrano le iniziali nel cerchio
  limiteRicaricaSOS?: number; // 0/assente = Fido non ancora concesso a questo socio
  sosUtilizzato?: number; // quanto del Fido è già stato usato dall'ultimo Ripristino
  classificaFitp?: string | null; // dichiarata dal socio stesso, es. "3.4" o "NC" — non verificata
  posizioneClassificaSociale?: number | null; // assente = il socio non è (ancora) in classifica
  preferenzeSfide?: { giorni: number[]; oraInizio: string; oraFine: string } | null; // 3 giorni (0=Dom...6=Sab) + fascia di 6h
  sfideCongelateFino?: string | null;
  // La rinuncia volontaria, distinta dalla penalita' (vedi
  // impostaRinunciaSfide).
  rinunciaSfideFino?: string | null; // 'YYYY-MM-DD' — non sfidabile fino a questa data compresa
  temaAppPersonale?: string | null; // uno degli 8 TEMI_APP scelto dal Socio per sé — assente = usa il Tema del circolo
  vetroBordoAttivo?: boolean; // true/assente = card con bordo sottile, false = senza bordo
  mostraIconaTennis?: boolean; // true/assente = mostra la pallina Tennis nell'header
  mostraIconaPadel?: boolean; // true/assente = mostra la pallina Padel nell'header
  // I due campi della scheda che il socio compila da se' nell'app,
  // sezione Impostazioni. Qui si leggono e basta: sono suoi.
  annoNascita?: number | null;
  racchetta?: string | null; // testo libero, es. "Babolat Pure Aero"
  // ⚠️ ALLINEATI AL GEMELLO DELL'APP. Mancavano, e il commento sopra
  // `registrati()` spiegava proprio perché un gemello che diverge è una
  // mina — poi divergeva l'interfaccia. Compilava lo stesso, perché
  // l'oggetto passato a `setDoc` non è tipizzato: il compilatore non
  // proteggeva proprio dove serviva.
  consensoVersione?: string;
  consensoIlMs?: number;
  eta16Dichiarata?: boolean;
  // ⚠️ 'AAAA-MM-GG', e IMMUTABILE dopo la creazione: le regole
  // Firestore la pretendono alla nascita del profilo, ne verificano
  // l'eta' lato server e poi non lasciano piu' riscriverla — nemmeno
  // all'interessato. Sta dichiarata qui anche se oggi nessuna
  // schermata la legge: l'oggetto passato a `setDoc` in `registrati()`
  // non e' tipizzato, e senza questa riga il giorno che qualcuno la
  // mostrera' il compilatore non avrebbe niente da dire.
  dataNascita?: string;
  torneiInEvidenza?: string[];
  bachecaLettaAlMs?: Record<string, number>;
  bachecaHomeSpentaAlMs?: Record<string, number>;
}

// Eta' ricavata dall'anno di nascita. Si tiene l'ANNO e non l'eta'
// perche' un numero scritto a mano sarebbe sbagliato dal compleanno
// successivo e nessuno tornerebbe a correggerlo.
export function etaDaAnno(anno?: number | null): number | null {
  if (!anno || anno < 1900) return null;
  const eta = new Date().getFullYear() - anno;
  return eta >= 0 && eta < 120 ? eta : null;
}

export interface SocioCircolo extends ProfiloUtente {
  uid: string;
  // Provenienti dalla tessera del circolo in cui è elencato.
  ruoloTessera?: 'socio_tesserato' | 'ospite';
  statoTessera?: 'in_attesa' | 'approvata' | 'sospesa' | 'chiusa' | 'rifiutata';
}

// ============================================================
// ⚠️ `registrati()` E' STATA TOLTA DA QUI, ed e' la seconda volta in
// due tornate che un gemello morto di questo file si rivela una mina.
//
// Portava ancora la firma vecchia — `etaDichiarata: boolean`, la
// casella da spuntare — e scriveva il profilo SENZA `dataNascita`. Da
// questa tornata le regole Firestore pretendono quel campo alla
// nascita di un profilo e ne verificano l'eta' lato server: la prima
// pagina del sito che avesse chiamato questa funzione avrebbe creato
// l'utenza su Firebase Auth e poi si sarebbe vista respingere il
// profilo. La pulizia nel `catch` (`deleteUser`) qui non riesce quasi
// mai, perche' gira sull'istanza principale e vuole un accesso
// recentissimo: sarebbe rimasta un'utenza senza profilo, cioe' una
// persona che non puo' entrare, non puo' registrarsi di nuovo
// («email gia' in uso») e non puo' nemmeno cancellarsi.
//
// Il commento che stava qui sopra diceva «tenuta allineata riga per
// riga»: non lo era. Ci si registra dall'app, ed e' giusto cosi'; se
// un domani servira' dal sito, si copia quella dell'app — che e'
// l'unica mantenuta, e l'unica su cui il compilatore ferma chi la
// chiama con i parametri sbagliati.
// ============================================================

export async function accedi(email: string, password: string): Promise<User> {
  const cred = await signInWithEmailAndPassword(auth, email.trim(), password.trim());
  await reload(cred.user);

  if (!cred.user.emailVerified) {
    await sendEmailVerification(cred.user);
    await signOut(auth);
    throw new Error('EMAIL_NON_VERIFICATA');
  }

  return cred.user;
}

export async function esciDaAccount(): Promise<void> {
  // Sul web non ci sono token push da rimuovere: quella parte esiste
  // solo nell'app mobile.
  await signOut(auth);
}

// Invia l'email di reset password di Firebase — l'unico modo per
// cambiare la password di un socio: Firebase non permette di
// impostarne una direttamente, né dalla console né da codice, per
// motivi di sicurezza. Il socio riceve un link e la sceglie lui.
export async function richiediResetPassword(email: string): Promise<void> {
  await sendPasswordResetEmail(auth, email.trim());
}

function suUnsub(errore: any) {
  console.warn('Ascolto Firestore interrotto (probabile logout):', errore?.message ?? errore);
}

export async function leggiProfilo(uid: string): Promise<ProfiloUtente | null> {
  const snap = await getDoc(doc(db, 'utenti', uid));
  if (!snap.exists()) return null;
  const v = snap.data() as any;
  return { ...v, credito: v.credito ?? 0 } as ProfiloUtente;
}

// Versione in tempo reale: usata dal context, così il credito si
// aggiorna da solo appena cambia (prenotazione, cancellazione,
// ricarica dalla segreteria), senza bisogno di ricaricare la pagina.
export function ascoltaProfilo(uid: string, callback: (p: ProfiloUtente | null) => void) {
  return onSnapshot(
    doc(db, 'utenti', uid),
    (snap) => {
      if (!snap.exists()) { callback(null); return; }
      const v = snap.data() as any;
      callback({ ...v, credito: v.credito ?? 0 } as ProfiloUtente);
    },
    suUnsub
  );
}

export async function impostaCircoloUtente(uid: string, circoloId: string): Promise<void> {
  await updateDoc(doc(db, 'utenti', uid), { circoloId });
}

// Usata dalla dashboard Admin Circolo per l'elenco soci + wallet.
// Elenco unico dei tesserati di un circolo: SOCI TESSERATI e OSPITI
// insieme. Per prenotazioni, classifica e sfide sono la stessa cosa —
// il ruolo serve solo a distinguerli visivamente e per il costo di
// attivazione.
//
// I dati arrivano da due fonti che vengono unite:
//   - la TESSERA porta ciò che è legato a QUESTO circolo (credito,
//     debito, limiti, posizione in classifica, ruolo);
//   - il PROFILO porta l'identità comune a tutti i circoli (foto,
//     classifica FITP, preferenze e congelamento sfide).
//
// La tessera vince sempre sui campi che le competono: se il profilo
// contenesse ancora un vecchio credito (residuo pre-migrazione), non
// deve mai sovrascrivere quello del circolo.
export function ascoltaSociCircolo(circoloId: string, callback: (soci: SocioCircolo[]) => void) {
  let tessere: Record<string, any> = {};
  let profili: Record<string, any> = {};
  let prontoTessere = false;
  // ⚠️ SI ASPETTANO TUTTE E DUE LE LETTURE. Le tessere e i profili
  // arrivano da due ascolti diversi, e prima si emetteva appena
  // rispondevano le tessere: in quella prima consegna nessun socio
  // aveva la foto — la foto sta sul profilo — e a schermo compariva
  // ovunque il segnaposto, sostituito un istante dopo dalla foto vera.
  let prontoProfili = false;

  const emetti = () => {
    if (!prontoTessere || !prontoProfili) return;
    const elenco = Object.entries(tessere).map(([uid, t]) => {
      const p = profili[uid] ?? {};
      return {
        ...p,
        uid,
        nome: t.nome ?? p.nome ?? '',
        cognome: t.cognome ?? p.cognome ?? '',
        email: t.email ?? p.email ?? '',
        circoloId,
        credito: t.credito ?? 0,
        sosUtilizzato: t.sosUtilizzato ?? 0,
        limiteRicaricaSOS: t.limiteRicaricaSOS ?? 0,
        posizioneClassificaSociale: t.posizioneClassificaSociale ?? null,
        ruoloTessera: t.ruolo ?? 'socio_tesserato',
        statoTessera: t.stato ?? 'approvata',
      } as SocioCircolo;
    });
    callback(elenco);
  };

  const qT = query(collection(db, 'tessere'), where('circoloId', '==', circoloId));
  const unsubT = onSnapshot(qT, (snap) => {
    tessere = {};
    snap.docs.forEach((d) => {
      const v = d.data() as any;
      // Le tessere chiuse escono dall'elenco operativo: restano
      // visibili solo nella schermata "Tessere da saldare".
      // Nell'elenco operativo entrano solo le tessere attive: le
      // richieste ancora da valutare stanno nella sezione dedicata,
      // le chiuse in "Tessere da saldare", le rifiutate da nessuna parte.
      if (v.stato !== 'chiusa' && v.stato !== 'rifiutata' && v.stato !== 'in_attesa' && v.uid) tessere[v.uid] = v;
    });
    prontoTessere = true;
    emetti();
  }, suUnsub);

  // I profili servono per foto, classifica FITP e stato sfide: dati
  // che restano comuni a tutti i circoli dell'utente.
  const qP = query(collection(db, 'utenti'), where('circoloId', '==', circoloId));
  const unsubP = onSnapshot(qP, (snap) => {
    profili = {};
    snap.docs.forEach((d) => { profili[d.id] = d.data(); });
    prontoProfili = true;
    emetti();
  }, (e) => {
    // ⚠️ Se i profili non arrivano proprio — permesso negato, rete —
    // NON si resta muti per sempre: si sblocca lo stesso e si consegna
    // quello che c'e'. Un elenco senza foto e' una pagina piu' povera;
    // un elenco che non arriva mai e' una pagina che non funziona.
    prontoProfili = true;
    emetti();
    suUnsub(e);
  });

  return () => { unsubT(); unsubP(); };
}

// Imposta il Fido che il socio può applicarsi da
// solo in caso di emergenza. 0 = funzione disattivata per quel socio.
export async function aggiornaLimiteSOS(uid: string, circoloId: string, limite: number) {
  await updateDoc(doc(db, 'tessere', `${uid}_${circoloId}`), { limiteRicaricaSOS: limite });
}

// ⚠️ QUI STAVA `aggiornaLimitePersonale`, che scriveva sulla tessera un
// limite settimanale valido solo per quel socio. Tolta il 25 agosto
// 2026 per decisione di Giorgio: il limite e' UNO SOLO ed e' quello del
// circolo. Avere due limiti sovrapposti voleva dire che la stessa
// domanda — «quante ore posso prenotare?» — aveva due risposte a
// seconda di dove la si leggeva, e il socio non aveva modo di sapere
// quale delle due lo stesse fermando.
// Il campo puo' essere rimasto scritto su qualche tessera vecchia: non
// lo legge piu' nessuno.

// L'Admin usa questo quando il socio è passato fisicamente in
// segreteria a saldare quanto usato di Fido: azzera il contatore,
// restituendogli tutto il plafond da usare di nuovo in emergenza.
export async function ripristinaSOS(
  uid: string, circoloId: string, eseguitoDa?: { uid: string; nome: string }, socioNome?: string
) {
  // ⚠️ Azzerare il debito e' denaro che rientra, esattamente come una
  // ricarica: le regole non lo concedono piu' a nessun client, nemmeno
  // all'Admin. Passa dalla Cloud Function, che scrive la riga di
  // registro nella stessa transazione e la firma con chi l'ha fatto.
  const chiama = httpsCallable(functions, 'movimentoCredito');
  await chiama({ tipo: 'saldoDebito', uid, circoloId });
}
// ============================================================
// CLASSIFICA — FITP (dichiarata dal socio) e Sociale (gestita
// dall'Admin, posizione numerica intera e univoca all'interno del
// circolo — le sfide future si baseranno su queste posizioni per
// riordinare la classifica, quindi devono restare sempre coerenti).
// ============================================================

// Il socio dichiara da sé la propria classifica FITP — nessuna
// verifica automatica, è un dato "sulla parola".
export async function impostaClassificaFitp(uid: string, valore: string) {
  await updateDoc(doc(db, 'utenti', uid), { classificaFitp: valore });
}

// L'Admin assegna o modifica la posizione di un socio in Classifica
// Sociale. Il controllo "la posizione è già occupata?" va fatto PRIMA
// di chiamare questa funzione (lato chiamante, con l'elenco soci già
// caricato) — qui scriviamo soltanto.
export async function impostaPosizioneClassificaSociale(uid: string, circoloId: string, posizione: number) {
  await updateDoc(doc(db, 'tessere', `${uid}_${circoloId}`), { posizioneClassificaSociale: posizione });
}

// Toglie un socio dalla Classifica Sociale (resta comunque socio del
// circolo, semplicemente non compare più in classifica).
export async function rimuoviDaClassificaSociale(uid: string, circoloId: string) {
  await updateDoc(doc(db, 'tessere', `${uid}_${circoloId}`), { posizioneClassificaSociale: null });
}

// Il socio sceglie 3 giorni + una fascia di 6 ore in cui preferisce
// giocare le sfide — usato dal sistema per generare le proposte
// automatiche di orario quando riceve una sfida.
export async function impostaPreferenzeSfide(
  uid: string, preferenze: { giorni: number[]; oraInizio: string; oraFine: string }
) {
  await updateDoc(doc(db, 'utenti', uid), { preferenzeSfide: preferenze });
}

// "Congela" la propria posizione in Classifica Sociale fino a una
// data inclusa: nessuno può sfidare il socio fino ad allora (una
// volta l'anno, per un massimo di 15 giorni, come da regolamento —
// il limite lo controlla l'interfaccia, non questa funzione).
// ⚠️ DUE CAMPI, PERCHE' SONO DUE COSE DIVERSE.
//
// `sfideCongelateFino` e' la PENALITA': sette giorni senza poter
// lanciare sfide, applicata a chi non ha risposto in tempo. Non se la
// puo' togliere chi la subisce — sarebbe come cancellarsi una multa —
// quindi la scrive solo la Cloud Function che la applica, e le regole
// la vietano al titolare del profilo.
//
// `rinunciaSfideFino` e' la RINUNCIA del regolamento: il socio dichiara
// che per un periodo non vuole essere sfidato. E' una scelta sua, e
// deve restare sua.
//
// Stavano nello stesso campo, e quando la penalita' e' stata chiusa al
// client si e' portata dietro anche la rinuncia: il socio non poteva
// piu' ne' congelarsi ne' scongelarsi, e la schermata non diceva
// niente perche' nessuno intercettava l'errore.
export async function impostaRinunciaSfide(uid: string, dataFino: string | null) {
  await updateDoc(doc(db, 'utenti', uid), { rinunciaSfideFino: dataFino });
}

// Il tema personale vive sulla TESSERA, non sul profilo: un socio
// puo' preferire un tema in un circolo e un altro altrove, e il
// "Ripristina il Tema del circolo" deve valere solo per quel circolo.
export async function impostaTemaAppPersonale(uid: string, circoloId: string, temaKey: string | null) {
  await updateDoc(doc(db, 'tessere', `${uid}_${circoloId}`), { temaAppPersonale: temaKey });
}

export async function impostaVetroBordo(uid: string, attivo: boolean) {
  await updateDoc(doc(db, 'utenti', uid), { vetroBordoAttivo: attivo });
}

export async function impostaIconeSport(uid: string, tennis: boolean, padel: boolean) {
  await updateDoc(doc(db, 'utenti', uid), { mostraIconaTennis: tennis, mostraIconaPadel: padel });
}
