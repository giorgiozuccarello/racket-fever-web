'use client';

// ============================================================
// IL GUSCIO — il telaio del gestionale, per il Super Admin.
//
// ⚠️ DAL 12 OTTOBRE 2026 E' LO STESSO TELAIO DEL GESTIONALE DEL MAESTRO
// (`rf-coach/theme/Scrivania.tsx`), richiesta di Giorgio: testata grigia con
// la banda nera e il marchio COACH a destra, menu a sinistra con la targhetta
// del ruolo in cima e le famiglie in riquadri che si chiudono, voci con
// l'icona. Il contenuto a destra, con la sua fascia degli strumenti.
//
// ⚠️ E LE SEZIONI SONO ROTTE VERE, non uno stato di questa pagina: con uno
// stato, il tasto «indietro» uscirebbe dal pannello, un indirizzo non si
// potrebbe mandare a nessuno, e una ricarica riporterebbe sempre alla prima
// sezione.
//
// ⚠️ I BOTTONI NON SONO SCRITTI QUI: sono `SEZIONI_SUPERADMIN` in
// `_dati/sezioni.ts`.
// ============================================================

import React from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { signOut } from 'firebase/auth';
import { auth } from '../_lib/firebase';
import { famiglie, SEZIONI_SUPERADMIN, SezioneWeb } from '../_dati/sezioni';
import { leggiRichieste } from '../_dati/superadmin';
import Icona from './Icona';

// ⚠️ IL MARCHIO STA IN `public/rfcoach/`, FUORI da `public/rfcoach/admin/`:
// quella cartella la svuota `aggiorna.ps1` a ogni tornata per ricopiarci
// l'export dell'app, e un file messo li' sparirebbe alla prima consegna.
// E' lo stesso disegno di `rf-coach/assets/images/coach-marchio-banda.png`.
export const MARCHIO_BANDA = '/rfcoach/marchio-banda.png';

export function Testata({ nome = 'Super Admin', chi, conEsci = false }: {
  nome?: string; chi?: string; conEsci?: boolean;
}) {
  return (
    <header className="testata">
      <div className="testata-chi">
        <span className="testata-nome">{nome}</span>
        {chi ? <span className="testata-email">{chi}</span> : null}
      </div>
      {conEsci ? (
        <button type="button" className="esci" onClick={() => signOut(auth)}>Esci</button>
      ) : null}
      <div className="banda">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={MARCHIO_BANDA} alt="RF Coach" />
      </div>
    </header>
  );
}

// ⚠️ LE FAMIGLIE CHIUSE SI RICORDANO, come nel gestionale (`sezioniChiuse`),
// ma nel browser di chi guarda: e' una comodita' sua, non un dato. Se il
// browser non lascia scrivere — finestra privata — si riparte tutte aperte.
const CHIAVE_CHIUSE = 'rfcoach.superadmin.chiuse';

function leggiChiuse(): string[] {
  try {
    const t = window.localStorage.getItem(CHIAVE_CHIUSE);
    const v = t ? JSON.parse(t) : [];
    return Array.isArray(v) ? v.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

function scriviChiuse(v: string[]): void {
  try { window.localStorage.setItem(CHIAVE_CHIUSE, JSON.stringify(v)); } catch { /* resta in memoria */ }
}

export default function Guscio(
  { chi, children }: { chi: string; children: React.ReactNode },
) {
  const router = useRouter();
  const percorso = usePathname() ?? '';
  const [chiuse, setChiuse] = React.useState<string[]>([]);
  const [nuove, setNuove] = React.useState(0);

  React.useEffect(() => { setChiuse(leggiChiuse()); }, []);

  // ⚠️ IL NUMERINO DELLE RICHIESTE NUOVE, come quello della chat nel
  // gestionale: si legge una volta all'apertura e a ogni cambio di sezione.
  // Se la lettura cade non si dice niente: e' un numerino, non un dato.
  React.useEffect(() => {
    let vivo = true;
    leggiRichieste()
      .then((r) => { if (vivo) setNuove(r.filter((x) => x.stato === 'nuova').length); })
      .catch(() => { /* il numerino resta quello che era */ });
    return () => { vivo = false; };
  }, [percorso]);

  // ⚠️ SI CONFRONTA IL PEZZO DI PERCORSO, non l'intero indirizzo: con la
  // barra in fondo un confronto secco lascerebbe SEMPRE spenta la voce della
  // sezione aperta. E `spazio` (la vecchia scheda) accende «Spazi».
  const pezzi = percorso.split('/').filter(Boolean);
  const acceso = (s: SezioneWeb) => pezzi.includes(s.chiave) || (s.chiave === 'spazi' && pezzi.includes('spazio'));

  const cambia = (nome: string) => {
    setChiuse((prima) => {
      const dopo = prima.includes(nome) ? prima.filter((n) => n !== nome) : [...prima, nome];
      scriviChiuse(dopo);
      return dopo;
    });
  };

  return (
    <>
      <Testata chi={chi} conEsci />
      <div className="impalcatura">
        <div className="menu" role="navigation" aria-label="Sezioni del pannello">
          <div className="gestionale">Super Admin</div>
          <div className="menu-dentro">
            {famiglie(SEZIONI_SUPERADMIN).map((f, i) => {
              const chiusa = chiuse.includes(f.nome);
              return (
                <div key={f.nome} className={`gruppo${i % 2 === 1 ? ' pari' : ''}${chiusa ? ' chiuso' : ''}`}>
                  <button
                    type="button"
                    className="titolo-gruppo"
                    aria-expanded={!chiusa}
                    onClick={() => cambia(f.nome)}
                  >
                    <span className="famiglia">{f.nome}</span>
                    <Icona nome={chiusa ? 'giu' : 'su'} lato={14} />
                  </button>
                  <div className="voci">
                    {f.sezioni.map((s) => (
                      <button
                        key={s.chiave}
                        type="button"
                        title={s.sotto}
                        aria-current={acceso(s) ? 'page' : undefined}
                        className={`bottone-menu${acceso(s) ? ' acceso' : ''}`}
                        onClick={() => router.push(`/rfcoach/superadmin/${s.chiave}`)}
                      >
                        <Icona nome={s.icona} />
                        <b>{s.titolo}</b>
                        {s.chiave === 'richieste' && nuove > 0 ? (
                          <span className="numerino">{nuove > 99 ? '99+' : nuove}</span>
                        ) : null}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        <div className="colonna-destra">{children}</div>
      </div>
    </>
  );
}
