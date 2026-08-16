'use client';

// ============================================================
// COME STA QUESTO CIRCOLO — la parte in sola lettura della scheda.
//
// Sta in cima, sopra i campi modificabili, e non è un vezzo: chi apre
// un circolo quasi sempre vuole sapere come va, non correggergli la
// sigla. I campi anagrafici restano subito sotto.
//
// ⚠️ QUI NON SI LEGGONO PIÙ PRENOTAZIONI E MOVIMENTI, e la cosa più
// importante di questo file è quella che non c'è più. Erano due ascolti
// senza limite né filtro di data — e non potevano averlo, perché i
// numeri sono storici e un elenco tagliato darebbe totali sbagliati con
// l'aria di essere giusti. Il risultato era che aprire un circolo
// costava decine di migliaia di letture, sempre, anche solo per
// correggerne la sigla, e cresceva ogni anno.
//
// Adesso quel conto lo fa il server una volta al giorno
// (functions/src/index.ts, fotografiaCircoli) e qui si legge un
// documento. Restano dal vivo solo le tessere e i maestri: sono query
// limitate dal numero di persone, e sono i dati che non possono
// mostrarsi vecchi di un giorno — il credito di un socio è denaro
// versato in segreteria stamattina.
//
// ⚠️ E la scheda DICE a quando risale ciò che mostra. Un totale fermo a
// stanotte va benissimo; diventa una bugia se chi legge lo crede di
// adesso.
// ============================================================

import { useEffect, useMemo, useState } from 'react';
import { ascoltaMaestriCircolo, MaestroConUid } from '../../../data/maestriRepo';
import { ascoltaTessereCircolo, Tessera } from '../../../data/tessere';
import {
  ascoltaFotografia, aggiornaFotografia, Fotografia, GIORNI_FINESTRA,
  ATTIVITA_SENZA_FOTO, REGISTRO_SENZA_FOTO,
  riepilogoPersone, riepilogoDenaro, righeSocio,
} from '../../../data/schedaCircolo';

// ⚠️ Il denaro resta con il punto e due decimali, come in TUTTO il
// resto dell'applicazione (registro, dashboard Admin, pop-up di
// rimborso). Formattarlo all'italiana solo qui vorrebbe dire che la
// stessa cifra si scrive in due modi a seconda della schermata, ed e'
// il genere di dettaglio che fa dubitare del numero. I conteggi
// invece sono grandi e si leggono meglio separati: "1.284" contro
// "1284".
const EURO = (n: number) => `€ ${n.toFixed(2)}`;
const CONTA = (n: number) => n.toLocaleString('it-IT');
const ORE = (n: number) => n.toLocaleString('it-IT', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

function quandoLeggibile(ms: number | null): string {
  if (ms === null) return '—';
  return new Date(ms).toLocaleDateString('it-IT', { day: '2-digit', month: 'long', year: 'numeric' });
}

// "3 giorni fa", "oggi". Serve accanto alla data: una data da sola
// costringe chi legge a fare il conto a mente, ed è proprio il conto
// che dice se il circolo è vivo.
function daQuanto(ms: number | null, adesso = Date.now()): string {
  if (ms === null) return '';
  const giorni = Math.floor((adesso - ms) / (24 * 60 * 60 * 1000));
  if (giorni <= 0) return 'oggi';
  if (giorni === 1) return 'ieri';
  if (giorni < 30) return `${giorni} giorni fa`;
  const mesi = Math.floor(giorni / 30);
  return mesi === 1 ? 'un mese fa' : `${mesi} mesi fa`;
}

function giorniDa(ms: number | null): string {
  if (ms === null) return '';
  const giorni = Math.floor(ms / (24 * 60 * 60 * 1000));
  if (giorni <= 0) return 'da oggi';
  return giorni === 1 ? 'da ieri' : `da ${giorni} giorni`;
}

function giornoLeggibile(ms: number | null): string {
  if (ms === null) return '—';
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`;
}

const ETICHETTA_STATO: Record<string, string> = {
  approvata: 'attiva', in_attesa: 'in attesa', sospesa: 'sospesa',
  chiusa: 'chiusa', rifiutata: 'rifiutata',
};

function Dato({ valore, etichetta, allarme }: {
  valore: string; etichetta: string; allarme?: boolean;
}) {
  return (
    <div className={`scheda-conto${allarme ? ' scheda-conto-allarme' : ''}`}>
      <span className="scheda-conto-n">{valore}</span>
      <span className="scheda-conto-et">{etichetta}</span>
    </div>
  );
}

export default function SchedaCircoloVista({ circoloId }: { circoloId: string }) {
  const [tessere, setTessere] = useState<Tessera[]>([]);
  const [maestri, setMaestri] = useState<MaestroConUid[]>([]);
  // Tre stati, non due. undefined = non si sa ancora; null = non c'è
  // nessuna fotografia (si preme il tasto e c'è); 'respinta' = la
  // lettura è stata negata, e premere il tasto non servirà MAI, perché
  // anche riuscendo lo scatto il documento resterebbe illeggibile.
  // ⚠️ Mappare la lettura respinta su "non c'è" è esattamente il difetto
  // che il commento in data/schedaCircolo.ts dichiara di voler evitare:
  // il tasto premuto all'infinito senza che cambi niente.
  const [foto, setFoto] = useState<Fotografia | null | 'respinta' | undefined>(undefined);
  const conFoto = foto && foto !== 'respinta' ? foto : null;
  const [pronto, setPronto] = useState({ tessere: false, maestri: false });
  // ⚠️ Distinto da "non è arrivato": una lettura RESPINTA non torna
  // più, quindi lasciare il banner "caricamento…" per sempre sarebbe
  // un'altra bugia. Chi legge deve sapere che il problema è di
  // permessi, non di rete lenta.
  const [respinto, setRespinto] = useState<string[]>([]);
  const [elencoAperto, setElencoAperto] = useState(false);
  const [scattando, setScattando] = useState(false);
  const [erroreScatto, setErroreScatto] = useState('');

  useEffect(() => {
    // ⚠️ Si azzerano anche i DATI, non solo le spie. Tenendo quelli del
    // circolo precedente, passando da un circolo all'altro senza
    // smontare il componente si vedrebbero i numeri di uno sotto il
    // nome di un altro. Oggi si passa sempre dall'elenco e il
    // componente si smonta; questa riga serve al giorno in cui non sarà
    // più vero.
    setTessere([]); setMaestri([]); setFoto(undefined);
    setPronto({ tessere: false, maestri: false });
    setRespinto([]); setErroreScatto('');
    const segnalaRifiuto = (che: string) =>
      setRespinto((prec) => (prec.includes(che) ? prec : [...prec, che]));

    const u1 = ascoltaTessereCircolo(
      circoloId,
      (t) => { setTessere(t); setPronto((p) => ({ ...p, tessere: true })); },
      () => segnalaRifiuto('tessere'),
    );
    const u2 = ascoltaMaestriCircolo(
      circoloId,
      (m) => { setMaestri(m); setPronto((p) => ({ ...p, maestri: true })); },
      () => segnalaRifiuto('maestri'),
    );
    const u3 = ascoltaFotografia(
      circoloId,
      (f) => setFoto(f),
      () => { setFoto('respinta'); segnalaRifiuto('fotografia'); },
    );
    return () => { u1(); u2(); u3(); };
  }, [circoloId]);

  const scatta = async () => {
    setErroreScatto('');
    setScattando(true);
    try {
      await aggiornaFotografia(circoloId);
    } catch (e: any) {
      // ⚠️ Le cause non si equivalgono, e dire sempre "riprova" manda
      // qualcuno a ripremere un tasto che non funzionera' mai.
      const codice = String(e?.code ?? '');
      setErroreScatto(
        codice.includes('permission-denied')
          ? 'Aggiornamento non consentito: serve un accesso Super Admin.'
          : codice.includes('deadline-exceeded') || codice.includes('internal')
            ? 'Il calcolo ha impiegato troppo: il circolo ha molto storico. Riprova fra qualche minuto — se il server ha finito nel frattempo, i numeri qui sopra si aggiornano da soli.'
            : 'Aggiornamento non riuscito. Riprova fra un momento.',
      );
    } finally {
      setScattando(false);
    }
  };

  // Le tessere sono limitate dal numero di soci: qui useMemo serve a
  // non rifare il giro a ogni tocco sul pulsante dell'elenco, non a
  // salvare una situazione difficile.
  const persone = useMemo(() => riepilogoPersone(tessere, maestri.length), [tessere, maestri]);
  const denaro = useMemo(() => riepilogoDenaro(tessere), [tessere]);
  const righe = useMemo(
    () => righeSocio(tessere, conFoto?.perSocio ?? {}),
    [tessere, conFoto],
  );
  const attivita = conFoto?.attivita ?? ATTIVITA_SENZA_FOTO;
  const registro = conFoto?.registro ?? REGISTRO_SENZA_FOTO;
  // ⚠️ scattataIlMs a zero non è "il primo gennaio 1970": è un campo
  // mancante. Senza questa riga la barra annunciava con tutta serietà
  // una fotografia di cinquantasei anni fa.
  const scattoMs = conFoto && conFoto.scattataIlMs > 0 ? conFoto.scattataIlMs : null;
  // Oltre due giorni il calcolo notturno non sta girando: è l'unico
  // sintomo osservabile, e in grigio non lo nota nessuno.
  const fotoVecchia = scattoMs !== null && Date.now() - scattoMs > 2 * 24 * 60 * 60 * 1000;
  // Vero quando i numeri della fotografia non ci sono: gli zeri qui
  // sotto vanno detti, non mostrati come dati.
  const senzaNumeri = conFoto === null;

  const tutteArrivate = pronto.tessere && pronto.maestri && foto !== undefined;
  const CONTA_GIORNI = GIORNI_FINESTRA;

  return (
    <div className="scheda-circolo">
      {respinto.length > 0 ? (
        <p className="admin-card-hint scheda-attesa">
          Lettura respinta ({respinto.join(', ')}): i numeri qui sotto sono incompleti e non
          lo diventeranno. Di solito vuol dire che le regole del database non consentono
          questa lettura — non che il circolo sia vuoto.
        </p>
      ) : !tutteArrivate && (
        <p className="admin-card-hint scheda-attesa">
          Caricamento dei dati del circolo… i numeri qui sotto sono ancora parziali.
        </p>
      )}

      {/* ---------- PERSONE ---------- */}
      <div className="superadmin-subtitolo">Persone</div>
      <div className="scheda-conti">
        <Dato valore={CONTA(persone.soci)} etichetta="soci tesserati" />
        <Dato valore={CONTA(persone.ospiti)} etichetta="ospiti" />
        <Dato valore={CONTA(persone.maestri)} etichetta="maestri" />
        <Dato
          valore={CONTA(persone.inAttesa)} etichetta="richieste in attesa"
          allarme={persone.inAttesa > 0}
        />
      </div>
      <p className="admin-card-hint scheda-nota">
        {persone.inAttesa > 0 && persone.attesaPiuLungaMs !== null
          ? `La richiesta più vecchia aspetta ${giorniDa(persone.attesaPiuLungaMs)}. `
          : ''}
        {persone.sospese > 0 ? `${persone.sospese} tessere sospese. ` : ''}
        {persone.chiuse > 0 ? `${persone.chiuse} chiuse. ` : ''}
        {persone.sospese === 0 && persone.chiuse === 0 && persone.inAttesa === 0
          ? 'Nessuna tessera in attesa, sospesa o chiusa.'
          : ''}
      </p>

      {/* ---------- ATTIVITÀ (dalla fotografia) ---------- */}
      <div className="superadmin-subtitolo">Attività</div>
      {/* ⚠️ La data dello scatto sta PRIMA dei numeri, non dopo. Sotto
          si legge come una nota a piè di pagina, e i totali si sono già
          presi per correnti. */}
      <div className={`scheda-foto-barra${(senzaNumeri || fotoVecchia) ? ' scheda-foto-barra-allarme' : ''}`}>
        <span className="scheda-foto-quando">
          {foto === undefined
            ? 'Lettura della fotografia…'
            : foto === 'respinta'
              ? 'Lettura della fotografia respinta: i numeri qui sotto non ci sono, e il tasto non risolve — è un problema di permessi.'
              : foto === null
                ? 'Nessuna fotografia ancora: i numeri qui sotto mancano perché non sono stati calcolati, non perché il circolo sia fermo. Premi «Aggiorna adesso».'
                : scattoMs === null
                  ? 'Fotografia senza data di scatto: rifalla per sapere a quando risale.'
                  : `Aggiornato al ${quandoLeggibile(scattoMs)} · ${daQuanto(scattoMs)}${
                    fotoVecchia ? ' — il calcolo notturno non sta girando' : ''}`}
        </span>
        <button
          className="scheda-foto-tasto" onClick={scatta}
          disabled={scattando || foto === 'respinta'}
        >
          {scattando ? 'Calcolo in corso…' : 'Aggiorna adesso'}
        </button>
      </div>
      {erroreScatto && <div className="admin-error-text">{erroreScatto}</div>}
      <p className="admin-card-hint scheda-nota">
        Prenotazioni, ore, campi, fasce, registro e numeri per socio si calcolano una volta a
        notte sul server: contarli qui vorrebbe dire scaricare tutto lo storico del circolo a
        ogni apertura di questa pagina. Persone e denaro in giacenza, invece, sono dal vivo.
      </p>
      <div className="scheda-conti">
        <Dato valore={CONTA(attivita.prenotazioni)} etichetta="prenotazioni in tutto" />
        <Dato valore={CONTA(attivita.prenotazioni30)} etichetta="negli ultimi 30 giorni" />
        <Dato valore={ORE(attivita.oreGiocate)} etichetta="ore di campo" />
      </div>
      {/* ⚠️ È il numero che dice davvero se un circolo è vivo, e sta da
          solo apposta: dentro la fila degli altri si legge come una
          statistica, e invece è un semaforo. */}
      <div className="scheda-vivo">
        <span className="scheda-vivo-et">Ultima prenotazione fatta</span>
        <span className="scheda-vivo-n">
          {quandoLeggibile(attivita.ultimaPrenotazioneMs)}
          {attivita.ultimaPrenotazioneMs !== null && (
            <em> · {daQuanto(attivita.ultimaPrenotazioneMs)}</em>
          )}
        </span>
      </div>
      {attivita.senzaDataDiCreazione > 0 && (
        <p className="admin-card-hint scheda-nota">
          {attivita.senzaDataDiCreazione} prenotazioni non riportano quando sono state fatte:
          sono più vecchie di quel campo. Contano nel totale e nelle ore di campo, ma restano
          fuori dagli ultimi {CONTA_GIORNI} giorni e non possono essere l&apos;ultima
          prenotazione qui sopra. Non vuol dire che non ci siano state.
        </p>
      )}
      <div className="scheda-due-colonne">
        <div>
          <div className="scheda-mini-titolo">Campi più usati</div>
          {attivita.campiPiuUsati.length === 0
            ? <p className="admin-empty-text">Nessuna prenotazione.</p>
            : attivita.campiPiuUsati.map((c) => (
              <div key={c.etichetta} className="scheda-riga-mini">
                <span>{c.etichetta}</span><span>{c.quante} mezz&apos;ore</span>
              </div>
            ))}
        </div>
        <div>
          <div className="scheda-mini-titolo">Fasce di punta</div>
          {attivita.fascePunta.length === 0
            ? <p className="admin-empty-text">Nessuna prenotazione.</p>
            : attivita.fascePunta.map((f) => (
              <div key={f.etichetta} className="scheda-riga-mini">
                <span>{f.etichetta}</span><span>{f.quante} mezz&apos;ore</span>
              </div>
            ))}
        </div>
      </div>

      {/* ---------- DENARO ---------- */}
      <div className="superadmin-subtitolo">Denaro</div>
      <div className="scheda-conti">
        <Dato valore={EURO(denaro.creditoInGiacenza)} etichetta="credito in giacenza" />
        <Dato
          valore={EURO(denaro.debiti)} etichetta="debiti aperti"
          allarme={denaro.debiti > 0}
        />
        <Dato valore={EURO(denaro.fidoConcesso)} etichetta="fido concesso" />
      </div>
      <p className="admin-card-hint scheda-nota">
        {senzaNumeri
          ? `Movimenti, ricariche e addebiti degli ultimi ${CONTA_GIORNI} giorni: non disponibili finché non c'è una fotografia.`
          : `Negli ultimi ${CONTA_GIORNI} giorni: ${CONTA(registro.movimenti30)} movimenti, ${EURO(registro.ricariche30)} di ricariche, ${EURO(registro.addebiti30)} di addebiti — dalla fotografia. Le ricariche contano i versamenti in segreteria, non le ricariche con il Fido.`}
        {' '}Il credito in giacenza è denaro dei soci versato in segreteria: comprende anche le
        tessere chiuse, perché è una posizione ancora aperta con chi se n&apos;è andato.
      </p>

      {/* ---------- ELENCO PER SOCIO ---------- */}
      <button
        className="scheda-elenco-tasto" onClick={() => setElencoAperto((v) => !v)}
        aria-expanded={elencoAperto}
      >
        {elencoAperto ? 'Chiudi l’elenco per socio' : `Elenco per socio (${righe.length})`}
      </button>
      {elencoAperto && senzaNumeri && (
        <p className="admin-card-hint scheda-nota">
          Prenotazioni e data dell&apos;ultima si leggono dalla fotografia, che qui non c&apos;è: i
          nomi e i saldi sono veri e aggiornati, le due colonne dei conteggi no.
        </p>
      )}
      {elencoAperto && (
        righe.length === 0
          ? <p className="admin-empty-text">Nessuna tessera in questo circolo.</p>
          : (
            <div className="scheda-tabella-culla">
              <table className="scheda-tabella">
                <thead>
                  <tr>
                    <th>Persona</th><th>Stato</th><th>Pren.</th>
                    <th>Credito</th><th>Debito</th><th>Class.</th><th>Ultima pren.</th>
                  </tr>
                </thead>
                <tbody>
                  {righe.map((r) => (
                    <tr key={r.uid || r.email}>
                      <td>
                        <div className="scheda-td-nome">{r.nome}</div>
                        <div className="scheda-td-sub">
                          {r.ruolo === 'ospite' ? 'Ospite' : 'Socio'}
                        </div>
                      </td>
                      <td>{ETICHETTA_STATO[r.stato] ?? r.stato}</td>
                      <td>{r.prenotazioni}</td>
                      <td>{EURO(r.credito)}</td>
                      <td className={r.debito > 0 ? 'scheda-td-debito' : undefined}>
                        {EURO(r.debito)}
                      </td>
                      <td>{r.posizione ?? '—'}</td>
                      <td>{giornoLeggibile(r.ultimaPrenotazioneMs)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
      )}

      {/* ⚠️ Questa riga non è un disclaimer di cortesia: è la decisione
          presa sulla privacy, scritta dove chi usa il pannello la legge.
          La stessa decisione sta nelle regole Firestore, che è il posto
          dove conta davvero — l'interfaccia non protegge niente. */}
      {/* ⚠️ Questa riga è stata riscritta dopo una revisione, e la
          versione di prima è istruttiva: prometteva che le chat «non
          sono accessibili nemmeno tecnicamente». Non era vero — il Super
          Admin può creare documenti in /responsabili e /tessere, e da lì
          diventare admin o socio di un circolo. Quella strada adesso è
          chiusa nelle regole (non può crearli intestati a sé), ma
          «impossibile» resta una parola che un'interfaccia non può
          promettere: qui si dice cosa fanno le regole, non cosa non
          potrà mai succedere. */}
      <p className="admin-card-hint scheda-privacy">
        Da qui si vedono le tessere del circolo e i totali calcolati su prenotazioni e
        movimenti: servono all&apos;assistenza e alla fatturazione. Le conversazioni — chat delle lezioni e delle sfide — restano fuori:
        nessuna schermata di questo pannello le mostra, e le regole del database non ne
        concedono la lettura al team Racket Fever.
      </p>
    </div>
  );
}
