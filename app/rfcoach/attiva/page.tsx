'use client';

// ============================================================
// RICHIEDI L'ATTIVAZIONE — la porta pubblica per i maestri. 12 ottobre 2026.
//
// ⚠️ NON E' IL MODULO DELLA HOME: quello e' dei circoli di Racket Fever, e
// scrive nel database dei circoli. Questo e' per RF Coach, e passa da
// `coachRichiediAttivazione` (`rf-coach/functions/src/superadmin.ts`): il
// browser non scrive niente da solo, perche' `richiesteCoach` non ha nessuna
// regola Firestore e quindi e' chiusa a tutti.
//
// ⚠️ NIENTE CAMPI LIBERI OLTRE AI NOMI PROPRI, come il modulo dei circoli:
// un campo di testo libero su una pagina pubblica e' uno spazio pubblicitario
// gratuito, e lo spam arriva. Quanti allievi e' un menu.
//
// ⚠️ IL CAMPO CHE NON SI VEDE (`sito`): fuori schermo e senza etichetta, una
// persona non lo trova; i programmi che riempiono moduli lo riempiono. Se
// arriva pieno il server risponde «ricevuta» e non scrive niente — e non si
// dice niente a chi l'ha mandata, perche' dirglielo sarebbe insegnargli come
// aggirarlo.
// ============================================================

import React, { useState } from 'react';
import Link from 'next/link';
import { DatiRichiestaPubblica, richiediAttivazione } from '../_dati/superadmin';
import { motivo } from '../_dati/onboarding';
import { Testata } from '../_pezzi/Guscio';

const VUOTA: DatiRichiestaPubblica = {
  nome: '',
  cognome: '',
  email: '',
  telefono: '',
  citta: '',
  paese: 'CH',
  tipo: 'persona',
  allievi: '',
  sito: '',
};

export default function Attiva() {
  const [d, setD] = useState<DatiRichiestaPubblica>(VUOTA);
  const [consenso, setConsenso] = useState(false);
  const [lavoro, setLavoro] = useState(false);
  const [guasto, setGuasto] = useState('');
  const [fatto, setFatto] = useState(false);
  const cambia = (pezzo: Partial<DatiRichiestaPubblica>) => setD((v) => ({ ...v, ...pezzo }));

  async function manda(e: React.FormEvent) {
    e.preventDefault();
    setGuasto('');
    if (!d.allievi) { setGuasto('Scegli quanti allievi hai.'); return; }
    if (!consenso) { setGuasto('Spunta «Voglio essere contattato» per mandare la richiesta.'); return; }
    setLavoro(true);
    try {
      await richiediAttivazione({ ...d, email: d.email.trim() });
      setFatto(true);
    } catch (e2) {
      setGuasto(motivo(e2));
    }
    setLavoro(false);
  }

  return (
    <>
      <Testata nome="RF Coach" />
      <div className="ingresso">
        {fatto ? (
          <div className="scheda larga">
            <h1 className="titolo">Grazie</h1>
            <p className="sottotitolo">
              La richiesta e’ arrivata. Ti contattiamo noi, di solito entro due giorni lavorativi.
            </p>
            <div className="azioni" style={{ justifyContent: 'center' }}>
              <Link className="bottone leggero" href="/rfcoach">Torna indietro</Link>
            </div>
          </div>
        ) : (
          <form className="scheda larga" onSubmit={manda}>
            <h1 className="titolo">Richiedi RF Coach</h1>
            <p className="sottotitolo">
              Il gestionale del maestro di tennis: agenda, allievi, pacchetti, conto. Lascia i tuoi
              dati e ti contattiamo per attivare il tuo spazio.
            </p>

            {guasto ? <div className="avviso male">{guasto}</div> : null}

            <div className="campi">
              <div className="campo">
                <label htmlFor="anome">Nome</label>
                <input id="anome" required maxLength={60} autoComplete="given-name" value={d.nome}
                  onChange={(e) => cambia({ nome: e.target.value })}
                />
              </div>
              <div className="campo">
                <label htmlFor="acognome">Cognome</label>
                <input id="acognome" required maxLength={60} autoComplete="family-name" value={d.cognome}
                  onChange={(e) => cambia({ cognome: e.target.value })}
                />
              </div>
              <div className="campo">
                <label htmlFor="aemail">Email</label>
                <input id="aemail" type="email" required maxLength={200} autoComplete="email" value={d.email}
                  onChange={(e) => cambia({ email: e.target.value })}
                />
              </div>
              <div className="campo">
                <label htmlFor="atelefono">Telefono (facoltativo)</label>
                <input id="atelefono" type="tel" maxLength={30} autoComplete="tel" value={d.telefono}
                  onChange={(e) => cambia({ telefono: e.target.value })}
                />
              </div>
              <div className="campo">
                <label htmlFor="acitta">Citta’</label>
                <input id="acitta" required maxLength={60} value={d.citta}
                  onChange={(e) => cambia({ citta: e.target.value })}
                />
              </div>
              <div className="campo">
                <label htmlFor="apaese">Paese</label>
                <select id="apaese" value={d.paese} onChange={(e) => cambia({ paese: e.target.value })}>
                  <option value="CH">Svizzera</option>
                  <option value="IT">Italia</option>
                </select>
              </div>
              <div className="campo">
                <label htmlFor="atipo">Lavori come</label>
                <select id="atipo" value={d.tipo} onChange={(e) => cambia({ tipo: e.target.value })}>
                  <option value="persona">Maestro indipendente</option>
                  <option value="scuola">Scuola tennis</option>
                </select>
              </div>
              <div className="campo">
                <label htmlFor="aallievi">Quanti allievi hai</label>
                <select id="aallievi" value={d.allievi} onChange={(e) => cambia({ allievi: e.target.value })}>
                  <option value="">Scegli…</option>
                  <option value="1-10">Fino a 10</option>
                  <option value="11-30">Da 11 a 30</option>
                  <option value="31-60">Da 31 a 60</option>
                  <option value="oltre60">Oltre 60</option>
                </select>
              </div>
            </div>

            {/* ⚠️ La trappola: vedi la nota in testa. */}
            <div className="trappola" aria-hidden="true">
              <input tabIndex={-1} autoComplete="off" value={d.sito} onChange={(e) => cambia({ sito: e.target.value })} />
            </div>

            <label className="interruttore">
              <input type="checkbox" checked={consenso} onChange={(e) => setConsenso(e.target.checked)} />
              <span>
                <b>Voglio essere contattato</b>
                <small>
                  Usiamo questi dati solo per rispondere alla tua richiesta.{' '}
                  <a href="/privacy" target="_blank" rel="noreferrer">Informativa</a>
                </small>
              </span>
            </label>

            <div className="azioni">
              <button type="submit" className="bottone acceso" disabled={lavoro}>
                {lavoro ? 'Invio…' : 'Manda la richiesta'}
              </button>
            </div>
          </form>
        )}
      </div>
    </>
  );
}
