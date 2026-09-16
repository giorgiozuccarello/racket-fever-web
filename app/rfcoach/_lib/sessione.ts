'use client';

// ============================================================
// CHI E' ENTRATO — e se comanda qui dentro.
//
// ⚠️ IL RUOLO E' UN DOCUMENTO, NON UN CLAIM: `superadmin/{uid}`. E' la
// stessa scelta di Racket Fever, dove il Super Admin e' chi ha un
// documento in `super_admin/{uid}`, e il vantaggio e' tutto pratico —
// si da' e si toglie il ruolo scrivendo o cancellando un documento,
// senza rigenerare nessun token e senza distribuire niente.
//
// ⚠️ E QUESTA LETTURA NON E' LA SICUREZZA. Serve a sapere se disegnare
// il pannello: un browser riscritto puo' saltarla e disegnarselo lo
// stesso. Cio' che protegge davvero sta altrove, e in due posti — le
// regole di Firestore, e il controllo `soloSuperAdmin` dentro ogni
// Cloud Function di questo pannello, che e' l'unica strada per cui i
// dati cambiano davvero.
//
// ⚠️ TRE STATI, NON DUE, e il terzo e' il motivo di questo file.
// «Sto guardando», «non e' entrato nessuno» e «e' entrato qualcuno che
// non e' un Super Admin» sono tre cose diverse, e la terza e' quella
// che, confusa con la seconda, produce la schermata peggiore: il modulo
// d'accesso riproposto a chi ha appena fatto l'accesso, senza dire
// perche'. E' il guasto che `claude/TRAPPOLE_INTERFACCIA.md` chiama «un
// rifiuto che non parla».
// ============================================================

import { useEffect, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from './firebase';

export type Sessione =
  | { stato: 'guardo' }
  | { stato: 'fuori' }
  // ⚠️ «Non sei un Super Admin» e «non sono riuscito a leggerlo» sono
  // due frasi diverse e vanno dette diverse: la prima chiede di
  // scrivere a noi, la seconda di ricaricare la pagina. Detta una al
  // posto dell'altra, un Super Admin vero passa il pomeriggio a
  // chiedersi chi gli ha tolto il ruolo.
  | { stato: 'nonAbilitato'; email: string; uid: string }
  | { stato: 'nonSiSa'; email: string; uid: string }
  | { stato: 'dentro'; email: string; uid: string; utente: User };

export function useSessione(): Sessione {
  const [sessione, setSessione] = useState<Sessione>({ stato: 'guardo' });

  useEffect(() => {
    // ⚠️ `onAuthStateChanged` e non una lettura sola: Firebase impiega
    // un istante a ricostruire la sessione dal browser, e chiedere
    // subito «chi c'e'?» risponde «nessuno» anche a chi e' entrato ieri.
    // E' il motivo per cui questo pannello non reindirizza mai prima di
    // aver ricevuto la prima risposta.
    return onAuthStateChanged(auth, async (utente) => {
      if (!utente) { setSessione({ stato: 'fuori' }); return; }
      const email = utente.email ?? '';
      try {
        const suo = await getDoc(doc(db, 'superadmin', utente.uid));
        if (!suo.exists()) {
          setSessione({ stato: 'nonAbilitato', email, uid: utente.uid });
          return;
        }
        setSessione({ stato: 'dentro', email, uid: utente.uid, utente });
      } catch {
        // ⚠️ UN GUASTO DI RETE NON E' UN RIFIUTO. La regola su
        // `superadmin` nega la lettura di chiunque non sia se stesso, e
        // un errore qui vuol dire «non lo so», non «non sei
        // autorizzato». Trattarlo come un no sbatterebbe fuori un Super
        // Admin vero perche' il wifi ha singhiozzato — e gli direbbe
        // pure che il ruolo non ce l'ha.
        setSessione({ stato: 'nonSiSa', email, uid: utente.uid });
      }
    });
  }, []);

  return sessione;
}
