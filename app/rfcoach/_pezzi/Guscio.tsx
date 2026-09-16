'use client';

// ============================================================
// IL GUSCIO — testata in cima, bottoni a sinistra, contenuto a destra.
//
// ⚠️ E' LA RICHIESTA DEL 16 SETTEMBRE, alla lettera: «conserviamo la
// testata in alto dove ci sara' il logo e le stesse informazioni che ci
// sono adesso, ma invece che fare un elenco di sezioni al centro,
// facciamo i bottoni sulla sinistra e il contenuto si aggiorna nella
// parte destra». E' l'unica differenza vera rispetto ai pannelli di
// Racket Fever, dove le sezioni sono riquadri in mezzo alla pagina
// (`column-count: 2`) e ogni sezione aperta copre quella prima.
//
// ⚠️ E LE SEZIONI SONO ROTTE VERE, non uno stato di questa pagina. Con
// uno stato, il tasto «indietro» del browser uscirebbe dal pannello, un
// indirizzo non si potrebbe mandare a nessuno, e una ricarica
// riporterebbe sempre alla prima sezione — tre cose che su un pannello
// da scrivania si notano il primo giorno.
//
// ⚠️ I BOTTONI NON SONO SCRITTI QUI: sono `SEZIONI_SUPERADMIN` in
// `data/sezioni.ts`, e le prove confrontano quell'elenco con le
// cartelle vere sotto `app/superadmin/`.
// ============================================================

import React from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { signOut } from 'firebase/auth';
import { auth } from '../_lib/firebase';
import { famiglie, SEZIONI_SUPERADMIN, SezioneWeb } from '../_dati/sezioni';

export function Testata({ ruolo, chi }: { ruolo: string; chi?: string }) {
  return (
    <header className="testata">
      <div className="marchio"><b>RACKET FEVER</b><span>COACH</span></div>
      <div className="ruolo">{ruolo}</div>
      <div className="spinta" />
      {chi ? <div className="chi">{chi}</div> : null}
      {chi ? (
        <button type="button" className="esci" onClick={() => signOut(auth)}>Esci</button>
      ) : null}
    </header>
  );
}

export default function Guscio(
  { chi, children }: { chi: string; children: React.ReactNode },
) {
  const router = useRouter();
  const percorso = usePathname() ?? '';

  // ⚠️ SI CONFRONTA IL PEZZO DI PERCORSO, non l'intero indirizzo:
  // `trailingSlash` di Next fa arrivare qui `/rfcoach/superadmin/spazi/` con la
  // barra in fondo, e un confronto secco lascerebbe SEMPRE spento il
  // bottone della sezione aperta. Un menu in cui non si vede dove si e'
  // e' un menu che si preme due volte.
  const acceso = (s: SezioneWeb) => percorso.split('/').filter(Boolean).includes(s.chiave);

  return (
    <>
      <Testata ruolo="Super Admin" chi={chi} />
      <div className="impalcatura">
        <nav className="menu">
          {famiglie(SEZIONI_SUPERADMIN).map((f) => (
            <React.Fragment key={f.nome}>
              <div className="famiglia">{f.nome}</div>
              {f.sezioni.map((s) => (
                <button
                  key={s.chiave}
                  type="button"
                  className={`bottone-menu${acceso(s) ? ' acceso' : ''}`}
                  onClick={() => router.push(`/rfcoach/superadmin/${s.chiave}`)}
                >
                  <b>{s.titolo}</b>
                  <small>{s.sotto}</small>
                </button>
              ))}
            </React.Fragment>
          ))}
        </nav>
        <main className="contenuto"><div className="dentro">{children}</div></main>
      </div>
    </>
  );
}
