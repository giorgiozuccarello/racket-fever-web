'use client';

// ============================================================
// LA PORTA DEL PANNELLO — e un rifiuto che dice il motivo.
//
// ⚠️ QUATTRO SCHERMATE, NON DUE, ed e' tutto il punto di questo file.
// «Sto guardando», «non e' entrato nessuno», «sei entrato ma non sei un
// Super Admin» e «non sono riuscito a leggerlo» sono quattro situazioni
// diverse, e le ultime due sono quelle che, ridotte a un rimando
// all'ingresso, producono la schermata peggiore che ci sia: il modulo
// d'accesso riproposto a chi ha appena fatto l'accesso, senza dire
// perche'. E' il guasto che `claude/TRAPPOLE_INTERFACCIA.md` chiama «un
// rifiuto che non parla».
//
// ⚠️ E QUESTA NON E' LA SICUREZZA. Questo e' cio' che si DISEGNA. Chi
// puo' cambiare qualcosa lo decidono le regole di Firestore e il
// controllo `soloSuperAdmin` dentro ogni Cloud Function: un browser
// riscritto salta questa pagina e non ottiene niente lo stesso.
// ============================================================

import React from 'react';
import { useRouter } from 'next/navigation';
import { signOut } from 'firebase/auth';
import { auth } from '../_lib/firebase';
import { useSessione } from '../_lib/sessione';
import Guscio, { Testata } from '../_pezzi/Guscio';

function Fermo({ titolo, testo, azione }: {
  titolo: string; testo: string; azione?: React.ReactNode;
}) {
  return (
    <>
      <Testata ruolo="Super Admin" />
      <div className="ingresso">
        <div className="scheda">
          <h1 className="titolo">{titolo}</h1>
          <p className="sottotitolo">{testo}</p>
          {azione ? <div className="azioni">{azione}</div> : null}
        </div>
      </div>
    </>
  );
}

export default function PortaSuperAdmin({ children }: { children: React.ReactNode }) {
  const sessione = useSessione();
  const router = useRouter();

  // ⚠️ NON SI REINDIRIZZA MENTRE SI GUARDA. Firebase impiega un istante
  // a ricostruire la sessione dal browser: mandare all'ingresso prima
  // della prima risposta butterebbe fuori, a ogni ricarica, proprio chi
  // e' gia' entrato.
  React.useEffect(() => {
    if (sessione.stato === 'fuori') router.replace('/rfcoach/entra');
  }, [sessione.stato, router]);

  if (sessione.stato === 'guardo') return <div className="vuoto">Un momento…</div>;
  if (sessione.stato === 'fuori') return <div className="vuoto">Un momento…</div>;

  if (sessione.stato === 'nonSiSa') {
    return (
      <Fermo
        titolo="Non riesco a controllare il tuo ruolo"
        testo={`Sei entrato come ${sessione.email}, ma la verifica non e’ arrivata a destinazione. `
          + 'Quasi sempre e’ la rete: ricarica la pagina.'}
        azione={(
          <button type="button" className="bottone acceso" onClick={() => window.location.reload()}>
            Riprova
          </button>
        )}
      />
    );
  }

  if (sessione.stato === 'nonAbilitato') {
    return (
      <Fermo
        titolo="Questo account non e’ un Super Admin"
        testo={`Sei entrato come ${sessione.email}, e l’accesso ha funzionato: e’ il ruolo che `
          + 'manca. Se dovresti averlo, serve che qualcuno del team te lo attivi.'}
        azione={(
          <button type="button" className="bottone leggero" onClick={() => signOut(auth)}>
            Esci e usa un altro account
          </button>
        )}
      />
    );
  }

  return <Guscio chi={sessione.email}>{children}</Guscio>;
}
