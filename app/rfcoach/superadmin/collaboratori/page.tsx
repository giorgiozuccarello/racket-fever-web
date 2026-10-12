'use client';

// ============================================================
// COLLABORATORI — chi entra nel pannello, e con che livello. 12 ottobre 2026.
//
// Richiesta di Giorgio: si scrive un'email gia' registrata e una password da
// comunicare al collaboratore, che solo il titolare puo' cambiare. Due livelli:
//   · A — tutto quello che fa il Super Admin, tranne questa sezione;
//   · B — come A, e in piu' senza i contratti.
//
// ⚠️ LA VEDE SOLO IL TITOLARE, e non e' solo il menu che la nasconde: ogni
// azione di questa pagina passa da `coachSuperAdmin`, che rifiuta chiunque
// abbia un livello (`azionePermessa` nel server).
//
// ⚠️ LA PASSWORD NON SI LEGGE MAI: non e' scritta da nessuna parte, si puo'
// solo SOSTITUIRE. Ogni sostituzione chiude le sessioni aperte del
// collaboratore. E c'e' un limite che non si puo' togliere: l'account e'
// condiviso con Racket Fever, quindi chi ha accesso alla propria casella puo'
// sempre usare «password dimenticata». Il controllo vero e' la revoca, che
// toglie il ruolo subito.
// ============================================================

import React, { useCallback, useEffect, useState } from 'react';
import {
  Collaboratore, aggiungiCollaboratore, leggiCollaboratori, livelloCollaboratore,
  passwordCollaboratore, quandoConOra, revocaCollaboratore,
} from '../../_dati/superadmin';
import { motivo } from '../../_dati/onboarding';
import { Riservata } from '../../_pezzi/Guscio';
import { Capitoli, Capitolo, Pagina, Pillola } from '../../_pezzi/Pezzi';

const DETTO_LIVELLO: Record<string, string> = {
  titolare: 'Titolare — vede tutto',
  A: 'A — tutto tranne i collaboratori',
  B: 'B — anche senza i contratti',
};

function Elenco() {
  const [elenco, setElenco] = useState<Collaboratore[] | null>(null);
  const [guasto, setGuasto] = useState('');
  const [detto, setDetto] = useState('');
  const [lavoro, setLavoro] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [livello, setLivello] = useState<'A' | 'B'>('A');
  const [nuovaPassword, setNuovaPassword] = useState<Record<string, string>>({});

  const rileggi = useCallback(async () => {
    try {
      setElenco(await leggiCollaboratori());
    } catch (e) {
      setGuasto(motivo(e));
    }
  }, []);
  useEffect(() => { void rileggi(); }, [rileggi]);

  async function fai(lavoroDaFare: () => Promise<void>, fatto: string) {
    setGuasto('');
    setDetto('');
    setLavoro(true);
    try {
      await lavoroDaFare();
      setDetto(fatto);
      await rileggi();
    } catch (e) {
      setGuasto(motivo(e));
    }
    setLavoro(false);
  }

  return (
    <Pagina titolo="Collaboratori" sotto="Chi entra nel pannello Super Admin, e cosa vede.">
      {guasto ? <div className="avviso male">{guasto}</div> : null}
      {detto ? <div className="avviso bene">{detto}</div> : null}
      <Capitoli>
        <Capitolo titolo="Aggiungi un collaboratore">
          <form onSubmit={(e) => {
            e.preventDefault();
            void fai(async () => {
              await aggiungiCollaboratore(email.trim(), password, livello);
              setEmail(''); setPassword('');
            }, `Aggiunto. Comunica a ${email.trim()} la password che hai scelto.`);
          }}
          >
            <div className="campi">
              <div className="campo largo">
                <label htmlFor="cemail">Email</label>
                <input id="cemail" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
                <div className="aiuto">Deve essere gia’ registrata nell’app. Non puo’ essere gia’ un collaboratore.</div>
              </div>
              <div className="campo">
                <label htmlFor="cpassword">Password</label>
                <input id="cpassword" type="text" autoComplete="new-password" required minLength={10} value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <div className="aiuto">Almeno 10 caratteri. La comunichi tu al collaboratore.</div>
              </div>
              <div className="campo">
                <label htmlFor="clivello">Livello</label>
                <select id="clivello" value={livello} onChange={(e) => setLivello(e.target.value as 'A' | 'B')}>
                  <option value="A">{DETTO_LIVELLO.A}</option>
                  <option value="B">{DETTO_LIVELLO.B}</option>
                </select>
              </div>
            </div>
            <div className="avviso attenzione">
              <b>La password che scrivi sostituisce quella dell’account.</b>
              L’account e’ lo stesso di Racket Fever: da adesso entra con questa anche li’.
            </div>
            <div className="azioni">
              <button type="submit" className="bottone acceso" disabled={lavoro || password.length < 10 || !email.trim()}>
                Aggiungi
              </button>
            </div>
          </form>
        </Capitolo>

        <Capitolo titolo="Chi c’e’" largo>
          {elenco === null ? <div className="vuoto">Un momento…</div> : null}
          {elenco !== null && elenco.length > 0 ? (
            <table className="elenco">
              <thead>
                <tr><th>Email</th><th>Livello</th><th>Ultimo accesso</th><th>Password</th><th /></tr>
              </thead>
              <tbody>
                {elenco.map((c) => (
                  <tr key={c.uid}>
                    <td><b>{c.email || c.uid}</b></td>
                    <td>
                      {c.livello === 'titolare' ? (
                        <Pillola tinta="accento">Titolare</Pillola>
                      ) : (
                        <select
                          aria-label={`Livello di ${c.email}`}
                          value={c.livello}
                          disabled={lavoro}
                          onChange={(e) => void fai(
                            () => livelloCollaboratore(c.uid, e.target.value as 'A' | 'B'),
                            `${c.email}: livello ${e.target.value}.`,
                          )}
                        >
                          <option value="A">A</option>
                          <option value="B">B</option>
                        </select>
                      )}
                    </td>
                    <td>{quandoConOra(c.ultimoAccessoMs)}</td>
                    <td>
                      {c.livello === 'titolare' ? '—' : (
                        <span style={{ display: 'flex', gap: 6 }}>
                          <input
                            aria-label={`Nuova password per ${c.email}`}
                            type="text"
                            autoComplete="new-password"
                            placeholder="nuova password"
                            value={nuovaPassword[c.uid] ?? ''}
                            onChange={(e) => setNuovaPassword({ ...nuovaPassword, [c.uid]: e.target.value })}
                          />
                          <button
                            type="button"
                            className="bottone leggero piccolo"
                            disabled={lavoro || (nuovaPassword[c.uid] ?? '').length < 10}
                            onClick={() => void fai(async () => {
                              await passwordCollaboratore(c.uid, nuovaPassword[c.uid] ?? '');
                              setNuovaPassword({ ...nuovaPassword, [c.uid]: '' });
                            }, `Password di ${c.email} cambiata: le sue sessioni aperte si chiudono.`)}
                          >
                            Cambia
                          </button>
                        </span>
                      )}
                    </td>
                    <td>
                      {c.livello === 'titolare' ? null : (
                        <button
                          type="button"
                          className="bottone rosso piccolo"
                          disabled={lavoro}
                          onClick={() => {
                            if (!window.confirm(`Revoco l’accesso di ${c.email} al pannello? L’account resta, il ruolo no.`)) return;
                            void fai(() => revocaCollaboratore(c.uid), `${c.email} non entra piu’ nel pannello.`);
                          }}
                        >
                          Revoca
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}
          <p className="aiuto">
            Il titolare (chi e’ stato messo dalla console, senza livello) non si gestisce da qui.
            Chi ha accesso alla propria casella puo’ sempre usare «password dimenticata»: per
            togliere l’accesso davvero si usa «Revoca».
          </p>
        </Capitolo>
      </Capitoli>
    </Pagina>
  );
}

export default function Collaboratori() {
  return (
    <Riservata chiave="collaboratori">
      <Elenco />
    </Riservata>
  );
}
