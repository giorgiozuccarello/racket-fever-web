'use client';

// ============================================================
// L'INGRESSO — e non dice mai se quell'indirizzo esiste.
//
// ⚠️ Firebase distingue «utente sconosciuto» da «password sbagliata», e
// riportarlo alla lettera trasformerebbe questa pagina in uno strumento
// per sapere chi ha un account nel progetto. Si dice una frase sola.
//
// ⚠️ E CHI ENTRA NON E' ANCORA DENTRO: qui si dimostra solo di essere
// una certa persona. Se quella persona sia un Super Admin lo decide
// `app/superadmin/layout.tsx`, che guarda `superadmin/{uid}`.
// ============================================================

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { sendPasswordResetEmail, signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../_lib/firebase';
import { useSessione } from '../_lib/sessione';
import { SEZIONE_DI_PARTENZA } from '../_dati/sezioni';
import { Testata } from '../_pezzi/Guscio';

export default function Entra() {
  const router = useRouter();
  const sessione = useSessione();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [guasto, setGuasto] = useState('');
  const [detto, setDetto] = useState('');
  const [lavoro, setLavoro] = useState(false);

  // ⚠️ CHI E' GIA' ENTRATO NON RIVEDE IL MODULO. Senza questo, un Super
  // Admin che apre l'indirizzo dell'ingresso per abitudine si trova a
  // digitare la password che ha gia' dato.
  useEffect(() => {
    if (sessione.stato === 'dentro') router.replace(`/rfcoach/superadmin/${SEZIONE_DI_PARTENZA}`);
  }, [sessione.stato, router]);

  async function prova(e: React.FormEvent) {
    e.preventDefault();
    setGuasto('');
    setDetto('');
    setLavoro(true);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
      router.replace(`/rfcoach/superadmin/${SEZIONE_DI_PARTENZA}`);
    } catch {
      setGuasto('Indirizzo o password non validi.');
      setLavoro(false);
    }
  }

  async function dimenticata() {
    setGuasto('');
    if (!email.trim()) { setGuasto('Scrivi prima il tuo indirizzo.'); return; }
    try {
      await sendPasswordResetEmail(auth, email.trim());
    } catch {
      // ⚠️ SI DICE LA STESSA FRASE ANCHE QUANDO FALLISCE, e per la stessa
      // ragione di sopra: un errore diverso direbbe a chiunque se quel
      // conto esiste.
    }
    setDetto('Se quell’indirizzo esiste, il messaggio e’ partito.');
  }

  // ⚠️ NON SI MOSTRA IL MODULO MENTRE SI GUARDA. Firebase impiega un
  // istante a ricostruire la sessione dal browser: senza questa riga, un
  // Super Admin gia' dentro che apre questo indirizzo vedeva lampeggiare
  // il modulo d'accesso prima del rimando — cioe' gli si chiedeva di
  // fare una cosa che aveva gia' fatto.
  if (sessione.stato === 'guardo' || sessione.stato === 'dentro') {
    return (
      <>
        <Testata ruolo="Super Admin" />
        <div className="ingresso"><div className="scheda"><div className="vuoto">Un momento…</div></div></div>
      </>
    );
  }

  return (
    <>
      <Testata ruolo="Super Admin" />
      <div className="ingresso">
        <form className="scheda" onSubmit={prova}>
          <div className="marchio"><b>RACKET FEVER</b><span>COACH</span></div>
          <p className="sottotitolo">Pannello di gestione</p>

          {guasto ? <div className="avviso male">{guasto}</div> : null}
          {detto ? <div className="avviso bene">{detto}</div> : null}

          <div className="campi">
            <div className="campo largo">
              <label htmlFor="email">Indirizzo</label>
              <input
                id="email" type="email" autoComplete="username" value={email}
                onChange={(e) => setEmail(e.target.value)} required
              />
            </div>
            <div className="campo largo">
              <label htmlFor="password">Password</label>
              <input
                id="password" type="password" autoComplete="current-password" value={password}
                onChange={(e) => setPassword(e.target.value)} required
              />
            </div>
          </div>

          <div className="azioni">
            <button type="submit" className="bottone acceso" disabled={lavoro}>
              {lavoro ? 'Un momento…' : 'Entra'}
            </button>
            <button type="button" className="bottone leggero" onClick={dimenticata}>
              Password dimenticata
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
