'use client';

// ============================================================
// LA SCHEDA DI UNO SPAZIO — accanto all'elenco, come nel gestionale.
// Riscritta il 12 ottobre 2026 dalla vecchia pagina `spazio/`.
//
// I capitoli, in quest'ordine — quello delle domande che ci si fa aprendo un
// cliente:
//   1. i NUMERI — com'e' messo davvero (allievi, lezioni, ultimo accesso);
//   2. STATO — attivo / sospeso / chiuso, e i tre verbi;
//   3. CONTRATTO — quanto paga e fino a quando;
//   4. CHI CI LAVORA;
//   5. ANAGRAFICA — i campi che il titolare non puo' toccare dall'app;
//   6. L'ACCESSO DEL TITOLARE — il pronto soccorso;
//   7. AZZERA — solo per uno spazio segnato «di prova».
//
// ⚠️ SOSPENDERE NON E' CHIUDERE, e la scheda lo dice prima che qualcuno
// prema. Sospendere e' l'abbonamento fermo: `titolari/{uid}` resta. Chiudere
// e' la fine: il segnale se ne va, e il titolare torna libero di insegnare
// altrove. NESSUNO DEI TRE CANCELLA NIENTE: uno spazio si spegne.
// ============================================================

import React, { useCallback, useEffect, useState } from 'react';
import {
  SpazioRiga, statoDi, TesseraRiga, tessereDi, unoSpazio,
} from '../_dati/spazi';
import {
  Anagrafica, Azione, cambiaStato, eUnRifiuto, modificaSpazio, motivo,
} from '../_dati/onboarding';
import {
  AccessoTitolare, EsitoAzzera, NumeriSpazio, accessoTitolare, azzeraSpazio, cambiaEmailTitolare,
  esciOvunque, leggiContratti, linkTitolare, numeriSpazio, pesoScritto, quandoConOra, quandoScritto,
} from '../_dati/superadmin';
import { Contratto } from '../_dati/contratti';
import CapitoloContratto from './Contratto';
import {
  Capitoli, Capitolo, Dati, Eroe, Numeri, Numero, Pillola,
} from './Pezzi';

const DETTO_STATO = { attivo: 'Attivo', sospeso: 'Sospeso', chiuso: 'Chiuso' } as const;

// ⚠️ -1 VUOL DIRE «NON SONO RIUSCITO A CONTARE», non zero: il server lo
// manda cosi' apposta, e qui si scrive un trattino invece di un numero falso.
function conto(n: NumeriSpazio | null, chiave: string): string {
  if (!n) return '…';
  const v = n.conti[chiave];
  return typeof v === 'number' && v >= 0 ? String(v) : '—';
}

type Link = { titolo: string; email: string; link: string } | null;

export default function SchedaSpazio({ spazioId }: { spazioId: string }) {
  const [spazio, setSpazio] = useState<SpazioRiga | null>(null);
  const [tessere, setTessere] = useState<TesseraRiga[]>([]);
  const [contratto, setContratto] = useState<Contratto | null>(null);
  const [numeri, setNumeri] = useState<NumeriSpazio | null>(null);
  const [accesso, setAccesso] = useState<AccessoTitolare | null>(null);
  const [manca, setManca] = useState(false);
  const [guasto, setGuasto] = useState('');
  const [detto, setDetto] = useState('');
  const [link, setLink] = useState<Link>(null);
  const [lavoro, setLavoro] = useState(false);
  const [modulo, setModulo] = useState<Anagrafica | null>(null);
  const [emailNuova, setEmailNuova] = useState('');
  const [livello, setLivello] = useState<'attivita' | 'tutto'>('attivita');
  const [conferma, setConferma] = useState('');
  const [azzerato, setAzzerato] = useState<EsitoAzzera | null>(null);

  const rileggiContratto = useCallback(async () => {
    try {
      const tutti = await leggiContratti();
      setContratto(tutti.find((c) => c.spazioId === spazioId) ?? null);
    } catch (e) {
      setGuasto(`Il contratto non si legge: ${motivo(e)}`);
    }
  }, [spazioId]);

  const rileggi = useCallback(async () => {
    try {
      const trovato = await unoSpazio(spazioId);
      setManca(!trovato);
      if (!trovato) return;
      setSpazio(trovato);
      setTessere(await tessereDi(spazioId));
    } catch (e) {
      setGuasto(motivo(e));
    }
  }, [spazioId]);

  // ⚠️ I NUMERI E L'ACCESSO SI CHIEDONO A PARTE, e un guasto loro non ferma la
  // scheda: un conteggio che cade non e' una ragione per non poter sospendere
  // uno spazio.
  useEffect(() => {
    setSpazio(null); setNumeri(null); setAccesso(null); setContratto(null);
    setGuasto(''); setDetto(''); setLink(null); setModulo(null); setAzzerato(null); setConferma('');
    void rileggi();
    void rileggiContratto();
    numeriSpazio(spazioId).then(setNumeri).catch(() => setNumeri({ conti: {}, byte: -1, ultimoAccessoMs: 0, creatoMs: 0 }));
    accessoTitolare(spazioId).then(setAccesso).catch(() => setAccesso(null));
  }, [spazioId, rileggi, rileggiContratto]);

  function ripulisci() {
    setGuasto('');
    setDetto('');
    // ⚠️ IL LINK SPARISCE A OGNI AZIONE: un link di cinque minuti fa, rimasto
    // a schermo, sembra parlare di quello che si e' appena fatto.
    setLink(null);
  }

  async function fai(azione: Azione) {
    if (azione === 'chiudi' && !window.confirm(
      'Chiudere e’ la fine del rapporto: il titolare torna libero di insegnare altrove '
      + 'e lo spazio sparisce dalla ricerca. Procedo?',
    )) return;
    ripulisci();
    setLavoro(true);
    try {
      await cambiaStato(spazioId, azione);
      await rileggi();
      setDetto(azione === 'sospendi' ? 'Sospeso.' : azione === 'riattiva' ? 'Riattivato.' : 'Chiuso.');
    } catch (e) {
      setGuasto(eUnRifiuto(e) ? motivo(e)
        : `${motivo(e)} — non so se sia cambiato qualcosa: ricarica la pagina e guarda.`);
    }
    setLavoro(false);
  }

  async function salvaAnagrafica(e: React.FormEvent) {
    e.preventDefault();
    if (!modulo) return;
    ripulisci();
    setLavoro(true);
    try {
      // ⚠️ SI MANDANO SOLO I CAMPI DEL MODULO, CON I LORO VALORI VERI. La
      // vecchia scheda mandava telefono, email pubblica e presentazione VUOTI
      // «per non svuotarli»: la funzione scrive tutti i campi che le arrivano,
      // e quei tre si svuotavano davvero a ogni correzione del nome.
      await modificaSpazio(spazioId, {
        nome: modulo.nome,
        tipo: modulo.tipo,
        citta: modulo.citta,
        zona: modulo.zona,
        telefono: modulo.telefono,
        emailPubblica: modulo.emailPubblica,
        visibile: modulo.visibile,
        diProva: modulo.diProva,
      });
      await rileggi();
      setModulo(null);
      setDetto('Salvato.');
    } catch (e2) {
      setGuasto(motivo(e2));
    }
    setLavoro(false);
  }

  async function chiediLink(tipo: 'linkPassword' | 'linkVerifica') {
    ripulisci();
    setLavoro(true);
    try {
      const r = await linkTitolare(spazioId, tipo);
      setLink({ titolo: tipo === 'linkPassword' ? 'Link per scegliere la password' : 'Link di verifica dell’indirizzo', ...r });
    } catch (e) {
      setGuasto(motivo(e));
    }
    setLavoro(false);
  }

  async function cambiaEmail(e: React.FormEvent) {
    e.preventDefault();
    if (!window.confirm(
      `Cambio l’indirizzo d’accesso in ${emailNuova.trim()}? L’account e’ lo stesso anche su `
      + 'Racket Fever: da adesso entra con quello nuovo in tutte e due le app.',
    )) return;
    ripulisci();
    setLavoro(true);
    try {
      const r = await cambiaEmailTitolare(spazioId, emailNuova);
      setEmailNuova('');
      setAccesso(await accessoTitolare(spazioId));
      if (r.link) setLink({ titolo: 'Indirizzo cambiato — link di verifica da mandargli', email: r.email, link: r.link });
      else setDetto(`Indirizzo cambiato in ${r.email}. Il link di verifica non e’ uscito: chiedilo qui sotto.`);
    } catch (e2) {
      setGuasto(motivo(e2));
    }
    setLavoro(false);
  }

  async function chiudiSessioni() {
    if (!window.confirm('Chiudo l’accesso su tutti i telefoni e computer del titolare? Dovra’ rientrare con la sua password.')) return;
    ripulisci();
    setLavoro(true);
    try {
      await esciOvunque(spazioId);
      setDetto('Fatto: entro un’ora al massimo ogni sessione aperta si chiude.');
    } catch (e) {
      setGuasto(motivo(e));
    }
    setLavoro(false);
  }

  async function azzera(e: React.FormEvent) {
    e.preventDefault();
    ripulisci();
    setAzzerato(null);
    setLavoro(true);
    try {
      const r = await azzeraSpazio(spazioId, livello, conferma);
      setAzzerato(r);
      setConferma('');
      numeriSpazio(spazioId).then(setNumeri).catch(() => { /* restano quelli di prima */ });
    } catch (e2) {
      setGuasto(motivo(e2));
    }
    setLavoro(false);
  }

  if (manca) {
    return (
      <div className="invito">
        <div><b>Questo spazio non c’e’.</b></div>
        <div>L’indirizzo porta a uno spazio che non esiste.</div>
      </div>
    );
  }
  if (!spazio) return <div className="vuoto">Un momento…</div>;

  const stato = statoDi(spazio);
  const titolare = tessere.find((t) => t.ruolo === 'titolare' && t.stato !== 'uscito');
  const maestri = tessere.filter((t) => t.ruolo === 'maestro' && t.stato !== 'uscito');
  const nomeTitolare = titolare ? `${titolare.nome} ${titolare.cognome}`.trim() : '';
  const sotto = [spazio.citta, spazio.zona, spazio.paese, spazio.valuta, spazio.tipo === 'scuola' ? 'Scuola' : 'Maestro']
    .filter(Boolean).join(' · ');

  return (
    <>
      <Eroe
        nome={spazio.nome || '(senza nome)'}
        sotto={sotto}
        pastiglie={(
          <>
            <Pillola tinta={stato}>{DETTO_STATO[stato]}</Pillola>
            {stato === 'attivo' && !spazio.visibile ? <Pillola tinta="nascosto">Non si trova</Pillola> : null}
            {spazio.diProva ? <Pillola tinta="accento">Di prova</Pillola> : null}
          </>
        )}
      />

      {guasto ? <div className="avviso male">{guasto}</div> : null}
      {detto ? <div className="avviso bene">{detto}</div> : null}
      {link ? (
        <div className="avviso bene">
          <b>{`${link.titolo} — ${link.email}`}</b>
          Copialo e mandaglielo come puoi: messaggio, WhatsApp, telefono. Non parte nessuna email.
          <input className="link-consegna" readOnly value={link.link} onFocus={(ev) => ev.target.select()} />
        </div>
      ) : null}

      <Numeri>
        <Numero valore={conto(numeri, 'allievi')} etichetta="Allievi" sotto={numeri && (numeri.conti.inAttesa ?? 0) > 0 ? `${numeri.conti.inAttesa} in attesa` : ''} />
        <Numero valore={numeri ? String(numeri.conti.maestri ?? '—') : '…'} etichetta="Maestri" />
        <Numero valore={conto(numeri, 'lezioni')} etichetta="Lezioni" />
        <Numero valore={conto(numeri, 'pacchetti')} etichetta="Pacchetti" />
        <Numero valore={conto(numeri, 'corsi')} etichetta="Corsi" />
        <Numero valore={conto(numeri, 'incordature')} etichetta="Incordature" />
        <Numero valore={conto(numeri, 'video')} etichetta="Video" sotto={numeri && (numeri.conti.analisi ?? 0) > 0 ? `${numeri.conti.analisi} analisi` : ''} />
        <Numero valore={conto(numeri, 'fatture')} etichetta="Fatture" />
        <Numero valore={numeri ? pesoScritto(numeri.byte) : '…'} etichetta="Storage" />
        <Numero
          valore={numeri ? (numeri.ultimoAccessoMs ? quandoScritto(numeri.ultimoAccessoMs) : 'mai') : '…'}
          etichetta="Ultimo accesso"
          tinta={numeri && !numeri.ultimoAccessoMs ? 'rosso' : ''}
          sotto="del titolare"
        />
      </Numeri>

      <Capitoli>
        <Capitolo titolo="Stato">
          {stato === 'attivo' && !spazio.visibile ? (
            <div className="avviso attenzione">
              <b>E’ attivo ma invisibile.</b>
              L’abbonamento e’ in corso, ma il maestro non compare agli allievi che cercano. E’ la
              spiegazione piu’ frequente di «i miei allievi non mi trovano». Si accende in Anagrafica.
            </div>
          ) : null}
          <Dati righe={[
            ['Nato il', quandoScritto(spazio.creatoIlMs)],
            ['Sospeso il', spazio.sospesoIlMs ? quandoScritto(spazio.sospesoIlMs) : ''],
            ['Chiuso il', spazio.chiusoIlMs ? quandoScritto(spazio.chiusoIlMs) : ''],
          ]}
          />
          <p className="aiuto">
            Sospendere ferma l’abbonamento e la scuola resta sua. Chiudere e’ la fine: torna libero
            di insegnare altrove. Nessuno dei due cancella niente.
          </p>
          <div className="azioni">
            {stato === 'attivo' ? (
              <button type="button" className="bottone piccolo" disabled={lavoro} onClick={() => fai('sospendi')}>Sospendi</button>
            ) : (
              <button type="button" className="bottone acceso piccolo" disabled={lavoro} onClick={() => fai('riattiva')}>Riattiva</button>
            )}
            {stato !== 'chiuso' ? (
              <button type="button" className="bottone rosso piccolo" disabled={lavoro || !titolare} onClick={() => fai('chiudi')}>
                Chiudi
              </button>
            ) : null}
          </div>
        </Capitolo>

        <CapitoloContratto
          spazioId={spazioId}
          contratto={contratto}
          valutaSpazio={spazio.valuta}
          quandoCambia={rileggiContratto}
        />

        <Capitolo titolo="Chi ci lavora">
          {titolare ? (
            <Dati righe={[
              ['Titolare', nomeTitolare],
              ['Insegna', titolare.insegna ? 'Si’' : 'No'],
              ['Dashboard', titolare.dashboardUnica ? 'Unica' : 'Admin + Maestro'],
            ]}
            />
          ) : (
            <div className="avviso male">
              <b>Questo spazio non ha un titolare attivo.</b>
              Non dovrebbe succedere: uno spazio nasce insieme alla tessera del titolare. Si puo’
              sospendere; chiuderlo no — la chiusura deve togliere il segnale <code>titolari</code>.
            </div>
          )}
          {!titolare?.insegna && maestri.length === 0 ? (
            <div className="avviso attenzione">
              <b>Nessuno insegna qui.</b>
              Finche’ non c’e’ un maestro attivo, gli allievi non possono chiedere lezioni.
            </div>
          ) : null}
          {maestri.length > 0 ? (
            <table className="elenco">
              <thead><tr><th>Maestro</th><th>Stato</th></tr></thead>
              <tbody>
                {maestri.map((m) => (
                  <tr key={m.uid}><td>{m.nome} {m.cognome}</td><td>{m.stato}</td></tr>
                ))}
              </tbody>
            </table>
          ) : null}
        </Capitolo>

        <Capitolo titolo="Anagrafica">
          {!modulo ? (
            <>
              <Dati righe={[
                ['Nome', spazio.nome || '—'],
                ['Tipo', spazio.tipo === 'scuola' ? 'Scuola' : 'Persona'],
                ['Citta’', spazio.citta || '—'],
                ['Zona', spazio.zona],
                ['Telefono', spazio.telefono],
                ['Email pubblica', spazio.emailPubblica],
                ['Si fa trovare', spazio.visibile ? 'Si’' : 'No'],
                ['Di prova', spazio.diProva ? 'Si’' : 'No'],
              ]}
              />
              <p className="aiuto">Il titolare non puo’ cambiare questi campi dall’app: si correggono da qui.</p>
              <div className="azioni">
                <button
                  type="button"
                  className="bottone leggero piccolo"
                  onClick={() => setModulo({
                    nome: spazio.nome,
                    tipo: spazio.tipo === 'scuola' ? 'scuola' : 'persona',
                    citta: spazio.citta,
                    zona: spazio.zona,
                    telefono: spazio.telefono,
                    emailPubblica: spazio.emailPubblica,
                    presentazione: '',
                    visibile: spazio.visibile,
                    diProva: spazio.diProva,
                  })}
                >
                  Correggi
                </button>
              </div>
            </>
          ) : (
            <form onSubmit={salvaAnagrafica}>
              <div className="campi">
                <div className="campo largo">
                  <label htmlFor="mnome">Nome</label>
                  <input id="mnome" value={modulo.nome} required onChange={(e) => setModulo({ ...modulo, nome: e.target.value })} />
                </div>
                <div className="campo">
                  <label htmlFor="mtipo">Tipo</label>
                  <select id="mtipo" value={modulo.tipo} onChange={(e) => setModulo({ ...modulo, tipo: e.target.value as 'persona' | 'scuola' })}>
                    <option value="persona">Persona</option>
                    <option value="scuola">Scuola</option>
                  </select>
                </div>
                <div className="campo">
                  <label htmlFor="mcitta">Citta’</label>
                  <input id="mcitta" value={modulo.citta} onChange={(e) => setModulo({ ...modulo, citta: e.target.value })} />
                </div>
                <div className="campo">
                  <label htmlFor="mzona">Zona</label>
                  <input id="mzona" value={modulo.zona} onChange={(e) => setModulo({ ...modulo, zona: e.target.value })} />
                </div>
                <div className="campo">
                  <label htmlFor="mtel">Telefono</label>
                  <input id="mtel" value={modulo.telefono} onChange={(e) => setModulo({ ...modulo, telefono: e.target.value })} />
                </div>
                <div className="campo largo">
                  <label htmlFor="memail">Email pubblica</label>
                  <input id="memail" type="email" value={modulo.emailPubblica} onChange={(e) => setModulo({ ...modulo, emailPubblica: e.target.value })} />
                </div>
              </div>
              <label className="interruttore">
                <input type="checkbox" checked={modulo.visibile} onChange={(e) => setModulo({ ...modulo, visibile: e.target.checked })} />
                <span><b>Si fa trovare</b><small>Spento, lo spazio resta attivo ma non compare nella ricerca.</small></span>
              </label>
              <label className="interruttore">
                <input type="checkbox" checked={modulo.diProva} onChange={(e) => setModulo({ ...modulo, diProva: e.target.checked })} />
                <span><b>Di prova</b><small>Uno spazio per le prove: solo cosi’ si puo’ azzerare.</small></span>
              </label>
              <div className="azioni">
                <button type="submit" className="bottone acceso" disabled={lavoro}>{lavoro ? 'Salvo…' : 'Salva'}</button>
                <button type="button" className="bottone leggero" onClick={() => setModulo(null)}>Lascia stare</button>
              </div>
            </form>
          )}
        </Capitolo>

        <Capitolo titolo="Accesso del titolare">
          {accesso ? (
            <Dati righe={[
              ['Indirizzo', accesso.email || '—'],
              ['Verificato', accesso.verificata ? 'Si’' : 'No'],
              ['Entra con', accesso.fornitori.map((f) => (f === 'password' ? 'password' : f.replace('.com', ''))).join(', ') || '—'],
              ['Ultimo accesso', quandoConOra(accesso.ultimoAccessoMs)],
              ['Account nato il', quandoScritto(accesso.creatoMs)],
              ['Disattivato', accesso.disattivato ? 'Si’' : ''],
            ]}
            />
          ) : (
            <p className="aiuto">{titolare ? 'Un momento…' : 'Senza titolare non c’e’ un account da soccorrere.'}</p>
          )}
          <div className="avviso attenzione">
            <b>Pronto soccorso.</b>
            Serve quando «password dimenticata» non funziona — di solito perche’ la casella non e’
            raggiungibile. I link escono qui e li mandi tu. ⚠️ L’account e’ lo stesso anche su
            Racket Fever: cio’ che cambi qui vale per tutte e due le app.
          </div>
          <div className="azioni">
            <button type="button" className="bottone leggero piccolo" disabled={lavoro || !titolare} onClick={() => chiediLink('linkPassword')}>
              Link per la password
            </button>
            <button type="button" className="bottone leggero piccolo" disabled={lavoro || !titolare} onClick={() => chiediLink('linkVerifica')}>
              Link di verifica
            </button>
            <button type="button" className="bottone leggero piccolo" disabled={lavoro || !titolare} onClick={chiudiSessioni}>
              Esci da tutti i dispositivi
            </button>
          </div>
          <form onSubmit={cambiaEmail} style={{ marginTop: 14 }}>
            <div className="campi">
              <div className="campo largo">
                <label htmlFor="emailnuova">Cambia l’indirizzo d’accesso</label>
                <input id="emailnuova" type="email" value={emailNuova} placeholder="nuovo@indirizzo.ch"
                  onChange={(e) => setEmailNuova(e.target.value)}
                />
                <div className="aiuto">Il nuovo indirizzo nasce non verificato: esce subito il link per verificarlo.</div>
              </div>
            </div>
            <div className="azioni">
              <button type="submit" className="bottone piccolo" disabled={lavoro || !titolare || !emailNuova.trim()}>
                Cambia indirizzo
              </button>
            </div>
          </form>
        </Capitolo>

        {spazio.diProva ? (
          <Capitolo titolo="Azzera lo spazio di prova">
            {azzerato ? (
              <div className={`avviso ${azzerato.interrotto ? 'attenzione' : 'bene'}`}>
                <b>{azzerato.interrotto ? 'Azzerato in parte: il tempo non e’ bastato. Ripeti.' : 'Azzerato.'}</b>
                {Object.entries(azzerato.tolti).filter(([, n]) => n > 0).map(([c, n]) => `${c} ${n}`).join(' · ') || 'Non c’era niente da togliere.'}
              </div>
            ) : null}
            <p className="aiuto">
              «Attivita’» toglie lezioni, richieste, pacchetti, corsi, incordature, video, avvisi,
              incassi e spese, e le chat: gli allievi restano. «Tutto» toglie anche gli allievi.
              Lo spazio, le tessere e il titolare restano sempre. Le fatture no: hanno il loro
              azzeramento, dall’app, che rimette a posto anche la numerazione.
            </p>
            <form onSubmit={azzera}>
              <div className="campi">
                <div className="campo">
                  <label htmlFor="livello">Cosa togliere</label>
                  <select id="livello" value={livello} onChange={(e) => setLivello(e.target.value as 'attivita' | 'tutto')}>
                    <option value="attivita">Attivita’ (gli allievi restano)</option>
                    <option value="tutto">Tutto (anche gli allievi)</option>
                  </select>
                </div>
                <div className="campo">
                  <label htmlFor="conferma">Riscrivi il nome dello spazio</label>
                  <input id="conferma" value={conferma} placeholder={spazio.nome} onChange={(e) => setConferma(e.target.value)} />
                </div>
              </div>
              <div className="azioni">
                <button
                  type="submit"
                  className="bottone rosso piccolo"
                  disabled={lavoro || conferma.trim().toLowerCase() !== spazio.nome.trim().toLowerCase()}
                >
                  {lavoro ? 'Sto azzerando…' : 'Azzera'}
                </button>
              </div>
            </form>
          </Capitolo>
        ) : null}
      </Capitoli>
    </>
  );
}
