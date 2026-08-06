// ============================================================
// UTENTI — Firebase Auth per l'autenticazione, Firestore
// (collezione "utenti") per il profilo, incluso il credito wallet.
// ============================================================

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  sendEmailVerification,
  sendPasswordResetEmail,
  reload,
  User,
} from 'firebase/auth';
import {
  doc, setDoc, getDoc, updateDoc, onSnapshot,
  collection, query, where, runTransaction,
} from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { registraMovimentoInTransazione } from './movimenti';

export interface ProfiloUtente {
  nome: string;
  cognome: string;
  email: string;
  circoloId: string | null;
  credito: number;
  fotoUrl?: string | null; // se assente, si mostrano le iniziali nel cerchio
  limiteRicaricaSOS?: number; // 0/assente = S.O.S. non ancora attivato per questo socio
  sosUtilizzato?: number; // quanto del plafond S.O.S. è già stato usato dall'ultimo Ripristina
  limitePrenotazioniPersonale?: number; // 0/assente = usa il limite generale del circolo
  classificaFitp?: string | null; // dichiarata dal socio stesso, es. "3.4" o "NC" — non verificata
  posizioneClassificaSociale?: number | null; // assente = il socio non è (ancora) in classifica
  preferenzeSfide?: { giorni: number[]; oraInizio: string; oraFine: string } | null; // 3 giorni (0=Dom...6=Sab) + fascia di 6h
  sfideCongelateFino?: string | null; // 'YYYY-MM-DD' — non sfidabile fino a questa data compresa
  temaAppPersonale?: string | null; // uno degli 8 TEMI_APP scelto dal Socio per sé — assente = usa il Tema del circolo
  vetroBordoAttivo?: boolean; // true/assente = card con bordo sottile, false = senza bordo
  mostraIconaTennis?: boolean; // true/assente = mostra la pallina Tennis nell'header
  mostraIconaPadel?: boolean; // true/assente = mostra la pallina Padel nell'header
}

export interface SocioCircolo extends ProfiloUtente {
  uid: string;
  // Provenienti dalla tessera del circolo in cui è elencato.
  ruoloTessera?: 'socio_tesserato' | 'ospite';
  statoTessera?: 'in_attesa' | 'approvata' | 'sospesa' | 'chiusa' | 'rifiutata';
}

/**
 * Crea l'account su Firebase Auth, il documento profilo su Firestore
 * (con credito iniziale a 0) e invia la vera email di conferma.
 * L'utente viene poi disconnesso: dovrà accedere esplicitamente
 * dopo aver confermato l'email.
 */
export async function registrati(
  nome: string,
  cognome: string,
  email: string,
  password: string
): Promise<void> {
  const cred = await createUserWithEmailAndPassword(auth, email.trim(), password.trim());

  await setDoc(doc(db, 'utenti', cred.user.uid), {
    nome: nome.trim(),
    cognome: cognome.trim(),
    email: email.trim(),
    circoloId: null,
    credito: 0,
  });

  await sendEmailVerification(cred.user);
  await signOut(auth);
}

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

  const emetti = () => {
    if (!prontoTessere) return;
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
        limitePrenotazioniPersonale: t.limitePrenotazioniPersonale ?? 0,
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
    emetti();
  }, suUnsub);

  return () => { unsubT(); unsubP(); };
}

// Imposta il limite di ricarica S.O.S. che il socio può applicarsi da
// solo in caso di emergenza. 0 = funzione disattivata per quel socio.
export async function aggiornaLimiteSOS(uid: string, circoloId: string, limite: number) {
  await updateDoc(doc(db, 'tessere', `${uid}_${circoloId}`), { limiteRicaricaSOS: limite });
}

// Limite di prenotazioni settimanali specifico per un socio — se
// impostato (> 0), sostituisce quello generale del circolo solo per
// lui. 0 = usa il limite del circolo.
export async function aggiornaLimitePersonale(uid: string, circoloId: string, limite: number) {
  await updateDoc(doc(db, 'tessere', `${uid}_${circoloId}`), { limitePrenotazioniPersonale: limite });
}

// L'Admin usa questo quando il socio è passato fisicamente in
// segreteria a saldare quanto usato in S.O.S.: azzera il contatore,
// restituendogli tutto il plafond da usare di nuovo in emergenza.
export async function ripristinaSOS(
  uid: string, circoloId: string, eseguitoDa?: { uid: string; nome: string }, socioNome?: string
) {
  const rif = doc(db, 'tessere', `${uid}_${circoloId}`);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(rif);
    const credito = snap.exists() ? ((snap.data().credito as number) ?? 0) : 0;
    const debito = snap.exists() ? ((snap.data().sosUtilizzato as number) ?? 0) : 0;
    tx.update(rif, { sosUtilizzato: 0 });
    registraMovimentoInTransazione(tx, {
      circoloId, uid,
      socioNome: socioNome ?? null,
      tipo: 'ripristino_sos',
      importo: 0,
      saldoPrima: credito, saldoDopo: credito,
      debitoPrima: debito, debitoDopo: 0,
      eseguitoDaUid: eseguitoDa?.uid ?? null,
      eseguitoDaNome: eseguitoDa?.nome ?? null,
      eseguitoDaRuolo: 'admin',
      descrizione: 'Debito S.O.S. saldato in segreteria',
    });
  });
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
export async function impostaCongelamentoSfide(uid: string, dataFino: string | null) {
  await updateDoc(doc(db, 'utenti', uid), { sfideCongelateFino: dataFino });
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
