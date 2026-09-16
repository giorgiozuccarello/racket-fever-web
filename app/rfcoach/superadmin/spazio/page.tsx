'use client';

// ============================================================
// LA SCHEDA DI UNO SPAZIO — e i tre verbi che non sono sinonimi.
//
// ⚠️ SOSPENDERE NON E' CHIUDERE, e questa schermata deve dirlo prima che
// qualcuno prema. Sospendere e' l'abbonamento fermo: il rapporto resta,
// e `titolari/{uid}` resta — quella persona ha ancora la sua scuola.
// Chiudere e' la fine: il segnale se ne va, ed e' proprio quello che
// permette a quella persona di andare a insegnare da un altro. Rimetterlo
// dopo si puo', ma solo se nel frattempo non ha aperto altrove.
//
// ⚠️ NESSUNO DEI TRE CANCELLA NIENTE. Uno spazio non si cancella: le
// lezioni passate sono il conto di qualcun altro. Si spegne.
//
// ⚠️ E QUI C'E' L'ANAGRAFICA, che sembra un di piu' e non lo e': nome,
// tipo, citta', zona, telefono ed email pubblica NON sono fra i campi
// che il titolare puo' toccare dall'app. Senza questo riquadro, un nome
// scritto male il giorno della creazione tornava in console Firebase —
// cioe' nel posto da cui questa tornata doveva far uscire l'onboarding.
// ============================================================

import React, { Suspense, useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  SpazioRiga, statoDi, TesseraRiga, tessereDi, unoSpazio,
} from '../../_dati/spazi';
import {
  Anagrafica, Azione, cambiaStato, EsitoLink, eUnRifiuto, linkAccesso, modificaSpazio, motivo,
} from '../../_dati/onboarding';

function Scheda() {
  const router = useRouter();
  const parametri = useSearchParams();
  const id = parametri.get('id') ?? '';

  const [spazio, setSpazio] = useState<SpazioRiga | null>(null);
  const [tessere, setTessere] = useState<TesseraRiga[]>([]);
  const [manca, setManca] = useState(false);
  const [guasto, setGuasto] = useState('');
  const [detto, setDetto] = useState('');
  const [link, setLink] = useState<EsitoLink | null>(null);
  const [lavoro, setLavoro] = useState(false);
  const [modulo, setModulo] = useState<Anagrafica | null>(null);

  const rileggi = useCallback(async () => {
    // ⚠️ SENZA ID NON SI ASPETTA: si dice che non c'e'. La frontiera
    // `Suspense` qui sotto serve proprio a non disegnare niente finche' i
    // parametri dell'indirizzo non sono pronti, quindi un id vuoto a
    // questo punto vuol dire che l'indirizzo non ne portava nessuno —
    // non che manchi ancora. Restare su «un momento» per sempre sarebbe
    // il caricamento che non finisce mai.
    if (!id) { setManca(true); return; }
    try {
      const trovato = await unoSpazio(id);
      // ⚠️ E `manca` SI RIAZZERA. Nella prima stesura si accendeva e non
      // si spegneva piu': una rilettura riuscita caricava lo spazio e la
      // pagina continuava a dire che non esisteva. Uno stato a senso
      // unico e' una schermata che non puo' cambiare idea.
      setManca(!trovato);
      if (!trovato) return;
      setSpazio(trovato);
      setTessere(await tessereDi(id));
    } catch (e) {
      setGuasto(motivo(e));
    }
  }, [id]);

  useEffect(() => { void rileggi(); }, [rileggi]);

  function ripulisci() {
    setGuasto('');
    setDetto('');
    // ⚠️ IL LINK SPARISCE A OGNI AZIONE: un link generato cinque minuti
    // fa, rimasto a schermo mentre si sospende e si riattiva, e' un
    // riquadro che sembra parlare di quello che si e' appena fatto.
    setLink(null);
  }

  async function fai(azione: Azione, conferma: string) {
    // ⚠️ SI CHIEDE CONFERMA SOLO DOVE SERVE DAVVERO, e chiudere e' l'unico
    // gesto di questa schermata che toglie un documento. Un `confirm` su
    // ogni bottone insegna a premere «ok» senza leggere, e allora il
    // giorno che conta non lo legge nessuno.
    if (azione === 'chiudi' && !window.confirm(conferma)) return;
    ripulisci();
    setLavoro(true);
    try {
      await cambiaStato(id, azione);
      await rileggi();
      setDetto(azione === 'sospendi' ? 'Sospeso.'
        : azione === 'riattiva' ? 'Riattivato.' : 'Chiuso.');
    } catch (e) {
      setGuasto(eUnRifiuto(e) ? motivo(e)
        : `${motivo(e)} — non so se sia cambiato qualcosa: ricarica la pagina e guarda.`);
    }
    setLavoro(false);
  }

  async function nuovoLink() {
    ripulisci();
    setLavoro(true);
    try {
      setLink(await linkAccesso(id));
    } catch (e) {
      setGuasto(motivo(e));
    }
    setLavoro(false);
  }

  async function salvaAnagrafica(e: React.FormEvent) {
    e.preventDefault();
    if (!modulo) return;
    ripulisci();
    setLavoro(true);
    try {
      await modificaSpazio(id, modulo);
      await rileggi();
      setModulo(null);
      setDetto('Salvato.');
    } catch (e2) {
      setGuasto(motivo(e2));
    }
    setLavoro(false);
  }

  if (manca) {
    return (
      <>
        <h1 className="titolo">Questo spazio non c’e’</h1>
        <p className="sottotitolo">
          L’indirizzo porta a uno spazio che non esiste — o non porta a nessuno spazio.
        </p>
        <div className="azioni">
          <button type="button" className="bottone acceso" onClick={() => router.push('/rfcoach/superadmin/spazi')}>
            Torna agli spazi
          </button>
        </div>
      </>
    );
  }

  if (!spazio) return <div className="vuoto">Un momento…</div>;

  const stato = statoDi(spazio);
  const titolare = tessere.find((t) => t.ruolo === 'titolare' && t.stato !== 'uscito');
  const maestri = tessere.filter((t) => t.ruolo === 'maestro' && t.stato !== 'uscito');

  return (
    <>
      <h1 className="titolo">{spazio.nome || '(senza nome)'}</h1>
      <p className="sottotitolo">
        {spazio.citta}{spazio.zona ? ` · ${spazio.zona}` : ''} · {spazio.paese} · {spazio.valuta}
      </p>

      {guasto ? <div className="avviso male">{guasto}</div> : null}
      {detto ? <div className="avviso bene">{detto}</div> : null}

      <div className="foglio">
        <h2>Com’e’ messo</h2>
        <p>
          <span className={`pillola ${stato}`}>
            {stato === 'attivo' ? 'Attivo' : stato === 'sospeso' ? 'Sospeso' : 'Chiuso'}
          </span>
          {stato === 'attivo' && !spazio.visibile ? (
            <> <span className="pillola nascosto">Non si trova nella ricerca</span></>
          ) : null}
        </p>
        {stato === 'attivo' && !spazio.visibile ? (
          <div className="avviso attenzione">
            <b>E’ attivo ma invisibile.</b>
            L’abbonamento e’ in corso, ma il maestro non compare agli allievi che cercano.
            E’ legittimo — chi lavora solo su presentazione — ma e’ anche la spiegazione
            piu’ frequente di «i miei allievi non mi trovano». Si accende qui sotto,
            in Anagrafica.
          </div>
        ) : null}
        <div className="azioni">
          {stato === 'attivo' ? (
            <button type="button" className="bottone" disabled={lavoro} onClick={() => fai('sospendi', '')}>
              Sospendi
            </button>
          ) : (
            <button type="button" className="bottone acceso" disabled={lavoro} onClick={() => fai('riattiva', '')}>
              Riattiva
            </button>
          )}
          {stato !== 'chiuso' ? (
            <button
              type="button"
              className="bottone rosso"
              // ⚠️ SPENTO SE NON C'E' UN TITOLARE: chiudere deve togliere
              // `titolari/{uid}`, e senza titolare la funzione rifiuta.
              // Un bottone acceso che fallisce sempre e' peggio di un
              // bottone spento accanto a un avviso che spiega.
              disabled={lavoro || !titolare}
              onClick={() => fai('chiudi',
                'Chiudere e’ la fine del rapporto: il titolare torna libero di insegnare '
                + 'altrove e lo spazio sparisce dalla ricerca. Procedo?')}
            >
              Chiudi
            </button>
          ) : null}
        </div>
      </div>

      <div className="foglio">
        <h2>Anagrafica</h2>
        {!modulo ? (
          <>
            <p className="aiuto">
              Questi campi il titolare non puo’ cambiarli dall’app: si correggono da qui.
            </p>
            <table className="elenco">
              <tbody>
                <tr><td><b>Nome</b></td><td>{spazio.nome || '—'}</td></tr>
                <tr><td><b>Tipo</b></td><td>{spazio.tipo === 'scuola' ? 'Scuola' : 'Persona'}</td></tr>
                <tr><td><b>Citta’</b></td><td>{spazio.citta || '—'}</td></tr>
                <tr><td><b>Zona</b></td><td>{spazio.zona || '—'}</td></tr>
                <tr>
                  <td><b>Si fa trovare</b></td>
                  <td>{spazio.visibile ? 'Si’' : 'No'}</td>
                </tr>
              </tbody>
            </table>
            <div className="azioni">
              <button
                type="button"
                className="bottone leggero"
                onClick={() => setModulo({
                  nome: spazio.nome,
                  tipo: spazio.tipo === 'scuola' ? 'scuola' : 'persona',
                  citta: spazio.citta,
                  zona: spazio.zona,
                  // ⚠️ Telefono, email pubblica e presentazione non si
                  // mostrano nel riepilogo ma si mandano lo stesso: la
                  // funzione scrive solo i campi che le arrivano, e
                  // mandarne meta' svuoterebbe l'altra meta'.
                  telefono: '',
                  emailPubblica: '',
                  presentazione: '',
                  visibile: spazio.visibile,
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
                <input
                  id="mnome" value={modulo.nome} required
                  onChange={(e) => setModulo({ ...modulo, nome: e.target.value })}
                />
              </div>
              <div className="campo">
                <label htmlFor="mtipo">Tipo</label>
                <select
                  id="mtipo" value={modulo.tipo}
                  onChange={(e) => setModulo({ ...modulo, tipo: e.target.value as 'persona' | 'scuola' })}
                >
                  <option value="persona">Persona</option>
                  <option value="scuola">Scuola</option>
                </select>
              </div>
              <div className="campo">
                <label htmlFor="mcitta">Citta’</label>
                <input
                  id="mcitta" value={modulo.citta}
                  onChange={(e) => setModulo({ ...modulo, citta: e.target.value })}
                />
              </div>
              <div className="campo largo">
                <label htmlFor="mzona">Zona</label>
                <input
                  id="mzona" value={modulo.zona}
                  onChange={(e) => setModulo({ ...modulo, zona: e.target.value })}
                />
              </div>
            </div>
            <label className="interruttore">
              <input
                type="checkbox" checked={modulo.visibile}
                onChange={(e) => setModulo({ ...modulo, visibile: e.target.checked })}
              />
              <span>
                <b>Si fa trovare</b>
                <small>Spento, lo spazio resta attivo ma non compare nella ricerca.</small>
              </span>
            </label>
            <div className="azioni">
              <button type="submit" className="bottone acceso" disabled={lavoro}>
                {lavoro ? 'Salvo…' : 'Salva'}
              </button>
              <button type="button" className="bottone leggero" onClick={() => setModulo(null)}>
                Lascia stare
              </button>
            </div>
          </form>
        )}
      </div>

      <div className="foglio">
        <h2>Chi ci lavora</h2>
        {titolare ? (
          <p>
            <b>{titolare.nome} {titolare.cognome}</b> — titolare
            {titolare.insegna ? ', insegna' : ', non insegna'}
            {titolare.dashboardUnica ? ', dashboard unica' : ''}.
          </p>
        ) : (
          <div className="avviso male">
            <b>Questo spazio non ha un titolare attivo.</b>
            Non dovrebbe succedere: uno spazio nasce con la tessera del titolare nello
            stesso momento in cui nasce. Si puo’ comunque sospendere; chiuderlo, no —
            la chiusura deve togliere il segnale <code>titolari</code>, e non sa a chi.
          </div>
        )}
        {!titolare?.insegna && maestri.length === 0 ? (
          <div className="avviso attenzione">
            <b>Nessuno insegna qui.</b>
            Finche’ non c’e’ almeno un maestro attivo, gli allievi non possono chiedere
            lezioni: lo spazio si trova, ma non fa niente.
          </div>
        ) : null}
        {maestri.length > 0 ? (
          <table className="elenco">
            <thead><tr><th>Maestro</th><th>Stato</th></tr></thead>
            <tbody>
              {maestri.map((m) => (
                <tr key={m.uid}>
                  <td>{m.nome} {m.cognome}</td>
                  <td>{m.stato}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
      </div>

      <div className="foglio">
        <h2>L’accesso del titolare</h2>
        {/* ⚠️ DUE GENERI DI LINK, e il pannello dice quale sta per
            chiedere PRIMA di chiederlo: uno fa entrare, l'altro no.
            Vedi la nota in testa a `coachLinkAccesso`. */}
        <p className="aiuto">
          {spazio.accountNuovo
            ? 'L’account e’ nato con lo spazio: qui si rigenera il link con cui il '
              + 'maestro sceglie la password, se il primo e’ scaduto.'
            : 'L’account esisteva gia’ prima dello spazio, quindi una password ce l’ha: '
              + 'da qui esce solo un link di VERIFICA dell’indirizzo, che non fa entrare '
              + 'nessuno. La password se la rimette lui con «password dimenticata».'}
        </p>
        <div className="azioni">
          <button type="button" className="bottone leggero" disabled={lavoro} onClick={nuovoLink}>
            Genera un link
          </button>
        </div>
        {link ? (
          <div className={`avviso ${link.gia && link.tipo === 'verifica' ? 'attenzione' : 'bene'}`}>
            <b>
              {link.tipo === 'password'
                ? `Link per la password — ${link.email}`
                : `Link di verifica — ${link.email}`}
            </b>
            {link.gia && link.tipo === 'verifica'
              ? 'Quell’indirizzo risulta gia’ verificato: questo link non serve a niente. '
                + 'Se il problema e’ la password, la rimette lui con «password dimenticata».'
              : 'Mandaglielo.'}
            <input className="link-consegna" readOnly value={link.link} onFocus={(e) => e.target.select()} />
          </div>
        ) : null}
      </div>
    </>
  );
}

// ⚠️ IL `Suspense` NON E' DECORAZIONE: con `output: 'export'`,
// `useSearchParams` obbliga a una frontiera, e senza il `build` si ferma
// — non la pagina, il build. Meglio saperlo qui che davanti al deploy.
export default function SchedaSpazio() {
  return (
    <Suspense fallback={<div className="vuoto">Un momento…</div>}>
      <Scheda />
    </Suspense>
  );
}
