'use client';

// ============================================================
// IL MIO ACCESSO — l'unica sezione che parla di chi guarda.
//
// ⚠️ IL CAMBIO PASSWORD PASSA DA UN MESSAGGIO, non da un campo. Sembra
// piu' scomodo, ed e' la stessa scelta che Firebase impone: cambiare la
// password da dentro vuole una ri-autenticazione recente, e una sessione
// vecchia fallirebbe con `auth/requires-recent-login` — un errore che
// non spiega niente a chi ha appena scritto la password giusta due
// volte. Il messaggio funziona sempre, anche se la sessione e' di
// stamattina.
//
// ⚠️ E QUI NON SI TOCCA IL RUOLO. Un Super Admin non si da' e non si
// toglie da questa schermata: si scrive o si cancella
// `superadmin/{uid}` con l'Admin SDK. Una pagina che potesse creare
// Super Admin sarebbe una pagina da cui ci si puo' moltiplicare.
// ============================================================

import React, { useState } from 'react';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../../_lib/firebase';
import { useSessione } from '../../_lib/sessione';

export default function Sicurezza() {
  const sessione = useSessione();
  const [detto, setDetto] = useState('');
  const [guasto, setGuasto] = useState('');
  const email = sessione.stato === 'dentro' ? sessione.email : '';

  async function manda() {
    setDetto('');
    setGuasto('');
    if (!email) { setGuasto('Non so con che indirizzo sei entrato.'); return; }
    try {
      await sendPasswordResetEmail(auth, email);
      setDetto(`Il messaggio e’ partito verso ${email}.`);
    } catch {
      setGuasto('Il messaggio non e’ partito. Riprova fra poco.');
    }
  }

  return (
    <>
      <h1 className="titolo">Il mio accesso</h1>
      <p className="sottotitolo">L’account con cui stai guardando questo pannello.</p>

      <div className="foglio">
        <h2>Chi sei</h2>
        <p><b>{email || '—'}</b></p>
        <p className="aiuto">
          E’ lo stesso account che useresti nell’app: l’anagrafica degli accessi e’ una
          sola per RF Coach e Racket Fever. Il ruolo di Super Admin, invece, vale solo
          qui dentro.
        </p>
      </div>

      <div className="foglio">
        <h2>Cambiare password</h2>
        {detto ? <div className="avviso bene">{detto}</div> : null}
        {guasto ? <div className="avviso male">{guasto}</div> : null}
        <p className="aiuto">
          Arriva un messaggio con un link: la password nuova la scegli li’, e nessun
          altro la vede passare.
        </p>
        <div className="azioni">
          <button type="button" className="bottone acceso" onClick={manda}>
            Mandami il link
          </button>
        </div>
      </div>
    </>
  );
}
