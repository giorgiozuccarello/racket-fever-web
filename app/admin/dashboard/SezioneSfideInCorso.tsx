'use client';

import { useEffect, useState } from 'react';
import { Circolo, sfideAccese } from '../../../data/circoli';
import { SocioCircolo } from '../../../data/users';
import {
  Sfida, concludiSfida, annullaSfida, notificaSfidaConRitentativi,
  nonPresentatoSfidante, nonPresentatoSfidato, modificaRisultatoUfficiale,
  MINUTI_TIMER_AMMESSI, MINUTI_TIMER_PREDEFINITI, timerLeggibile,
} from '../../../data/sfide';

// Legge il campo nuovo e, se manca, il vecchio sì/no: la stessa scala di
// `durataTimerMs`, altrimenti il valore a schermo direbbe una cosa e il
// server ne applicherebbe un'altra.
function minutiTimerDi(circolo: { minutiTimerSfida?: number; timerSfideVeloce?: boolean }): number {
  const m = circolo.minutiTimerSfida;
  if (typeof m === 'number' && MINUTI_TIMER_AMMESSI.includes(m)) return m;
  if (circolo.timerSfideVeloce) return 5;
  return MINUTI_TIMER_PREDEFINITI;
}
import { aggiornaCircolo } from '../../../data/circoliRepo';
import Modal from './Modal';

function CountdownAdmin({ scadenza }: { scadenza: number }) {
  const [ora, setOra] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setOra(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const restante = Math.max(0, scadenza - ora);
  if (restante === 0) return <div style={{ color: '#B3261E', fontWeight: 800, fontSize: '.78rem' }}>Scaduta</div>;
  const giorni = Math.floor(restante / 86400000);
  const ore = Math.floor((restante % 86400000) / 3600000);
  const minuti = Math.floor((restante % 3600000) / 60000);
  const secondi = Math.floor((restante % 60000) / 1000);
  const testo = giorni > 0 ? `${giorni}g ${ore}h` : ore > 0 ? `${ore}h ${minuti}m` : `${minuti}m ${secondi}s`;
  return <div style={{ color: '#B3261E', fontWeight: 800, fontSize: '.78rem' }}>Scade tra {testo}</div>;
}

const CINQUE_GIORNI_MS = 5 * 24 * 60 * 60 * 1000;

export default function SezioneSfideInCorso({ sfide, soci, circolo, puoCambiareSfide = true }: { sfide: Sfida[]; soci: SocioCircolo[]; circolo: Circolo; puoCambiareSfide?: boolean }) {
  const [daConcludere, setDaConcludere] = useState<Sfida | null>(null);
  const [vincitoreScelto, setVincitoreScelto] = useState<string | null>(null);
  const [risultatoTesto, setRisultatoTesto] = useState('');
  const [confermaInvioAperta, setConfermaInvioAperta] = useState(false);
  const [concludendo, setConcludendo] = useState(false);
  const [confermaAnnullaAperta, setConfermaAnnullaAperta] = useState(false);
  const [annullando, setAnnullando] = useState(false);
  const [annullamentoFatto, setAnnullamentoFatto] = useState(false);
  const [confermaNonPresentatoDi, setConfermaNonPresentatoDi] = useState<'sfidante' | 'sfidato' | null>(null);
  const [registrandoAssenza, setRegistrandoAssenza] = useState(false);
  const [salvandoTimer, setSalvandoTimer] = useState(false);
  const [daModificare, setDaModificare] = useState<Sfida | null>(null);
  const [testoModifica, setTestoModifica] = useState('');
  const [salvandoModifica, setSalvandoModifica] = useState(false);

  const attive = sfide
    .filter((sf) => sf.fase === 'accordo' || sf.fase === 'prenotazione' || sf.fase === 'accettata')
    .sort((a, b) => (a.creataIl?.seconds ?? 0) - (b.creataIl?.seconds ?? 0));

  // Copia "corta" dello storico, solo per Admin: serve a correggere in
  // fretta un errore di battitura nel risultato appena scritto, finché
  // il ricordo è ancora fresco — 5 giorni, non 30 come la Bacheca.
  const storicoRecente = sfide
    .filter((sf) => (sf.fase === 'conclusa' || sf.fase === 'decaduta') && sf.conclusaIl?.seconds && sf.conclusaIl.seconds * 1000 >= Date.now() - CINQUE_GIORNI_MS)
    .sort((a, b) => (b.conclusaIl?.seconds ?? 0) - (a.conclusaIl?.seconds ?? 0));

  const apriModifica = (sf: Sfida) => {
    setDaModificare(sf);
    setTestoModifica(sf.risultatoUfficiale ?? '');
  };

  const salvaModifica = async () => {
    if (!daModificare || !testoModifica.trim()) return;
    setSalvandoModifica(true);
    try {
      await modificaRisultatoUfficiale(daModificare.id, testoModifica);
      alert('Risultato corretto ✓');
      setDaModificare(null);
    } catch {
      alert('Errore di connessione. Riprova.');
    } finally {
      setSalvandoModifica(false);
    }
  };

  const apriInfo = (sf: Sfida) => {
    setDaConcludere(sf);
    if (sf.risultatoSfidante && sf.risultatoSfidato) {
      if (sf.risultatoSfidante.esito === 'vinta' && sf.risultatoSfidato.esito === 'persa') {
        setVincitoreScelto(sf.sfidanteId);
      } else if (sf.risultatoSfidante.esito === 'persa' && sf.risultatoSfidato.esito === 'vinta') {
        setVincitoreScelto(sf.sfidatoId);
      } else {
        setVincitoreScelto(null); // discrepanza: nessuna pre-selezione, decide l'Admin
      }
    } else {
      setVincitoreScelto(null);
    }
    // Comodità, non un obbligo: se un punteggio dichiarato è già
    // coerente col vincitore individuato, lo precompilo — Admin resta
    // comunque libero di cambiarlo prima di inviare.
    if (sf.risultatoSfidante?.esito === 'vinta' && sf.risultatoSfidato?.esito === 'persa') {
      setRisultatoTesto(sf.risultatoSfidante.punteggio || '');
    } else if (sf.risultatoSfidato?.esito === 'vinta' && sf.risultatoSfidante?.esito === 'persa') {
      setRisultatoTesto(sf.risultatoSfidato.punteggio || '');
    } else {
      setRisultatoTesto('');
    }
  };

  const apriRevisioneConclusione = () => {
    if (!vincitoreScelto || !risultatoTesto.trim()) return;
    setConfermaInvioAperta(true);
  };

  const eseguiConclusione = async () => {
    if (!daConcludere || !vincitoreScelto || !risultatoTesto.trim()) return;
    setConcludendo(true);
    try {
      const applicata = await concludiSfida(daConcludere.id, daConcludere.sfidanteId, daConcludere.sfidatoId, vincitoreScelto, soci, 'accettata', risultatoTesto, daConcludere.circoloId);
      if (applicata) {
        const vinceSfidante = vincitoreScelto === daConcludere.sfidanteId;
        const nomeVincitore = vinceSfidante
          ? `${daConcludere.sfidanteNome} ${daConcludere.sfidanteCognome}`
          : `${daConcludere.sfidatoNome} ${daConcludere.sfidatoCognome}`;
        await notificaSfidaConRitentativi(
          daConcludere.sfidanteId,
          vinceSfidante
            ? 'Il circolo ha confermato: hai vinto la sfida! La tua posizione in classifica è stata aggiornata.'
            : `Il circolo ha confermato: ${nomeVincitore} ha vinto la sfida. La classifica è stata aggiornata di conseguenza.`,
          circolo.id,
        );
        await notificaSfidaConRitentativi(
          daConcludere.sfidatoId,
          !vinceSfidante
            ? 'Il circolo ha confermato: hai vinto la sfida! La classifica resta invariata (eri già nella posizione migliore).'
            : `Il circolo ha confermato: ${nomeVincitore} ha vinto la sfida. La tua posizione in classifica è stata aggiornata.`,
          circolo.id,
        );
        alert('Sfida conclusa e classifica aggiornata ✓');
        setConfermaInvioAperta(false);
        setDaConcludere(null);
        setRisultatoTesto('');
      } else {
        alert('Questa sfida è già stata gestita nel frattempo (da un altro dispositivo, o per scadenza).');
        setConfermaInvioAperta(false);
        setDaConcludere(null);
        setRisultatoTesto('');
      }
    } catch {
      alert('Errore di connessione. Riprova.');
    } finally {
      setConcludendo(false);
    }
  };

  const confermaAnnullaSfida = async () => {
    if (!daConcludere) return;
    setAnnullando(true);
    try {
      const esito = await annullaSfida(daConcludere);
      setConfermaAnnullaAperta(false);
      setDaConcludere(null);
      if (esito.giaAnnullata) {
        alert('Questa sfida era già stata annullata.');
      } else if (esito.oreVere > 0) {
        // Le ore tornano libere e il denaro torna ai due, con la sua
        // riga nel registro.
        alert(
          `Sfida annullata. Liberate e rimborsate ${esito.oreVere} `
          + `${esito.oreVere === 1 ? 'mezz’ora già pagata' : 'mezz’ore già pagate'}.`,
        );
      } else {
        setAnnullamentoFatto(true);
      }
    } catch (e: any) {
      // ⚠️ Non più un catch cieco: era lui a chiamare «errore di
      // connessione» un rifiuto dei permessi.
      alert(
        e?.code === 'functions/permission-denied'
          ? 'Non hai i permessi per annullare questa sfida.'
          : `Non sono riuscito ad annullare la sfida. ${e?.message ?? ''}`.trim(),
      );
    } finally {
      setAnnullando(false);
    }
  };

  const confermaNonPresentato = async () => {
    if (!daConcludere || !confermaNonPresentatoDi) return;
    setRegistrandoAssenza(true);
    try {
      if (confermaNonPresentatoDi === 'sfidante') await nonPresentatoSfidante(daConcludere);
      else await nonPresentatoSfidato(daConcludere, soci);
      alert('Mancata presentazione registrata ✓');
      setConfermaNonPresentatoDi(null);
      setDaConcludere(null);
    } catch {
      alert('Errore di connessione. Riprova.');
    } finally {
      setRegistrandoAssenza(false);
    }
  };

  // ⚠️ UN VALORE, NON PIÙ UN SÌ/NO. Erano due chip, «24 ore (reale)» e
  // «5 minuti (test)»: uno strumento di prova finito in mano ai
  // presidenti. La domanda vera del circolo non è di prova — quanto
  // tempo do a un socio per rispondere a una sfida — e cambia da club
  // a club.
  //
  // ⚠️ E si scrive sempre anche `timerSfideVeloce: false`: se restasse
  // acceso dal vecchio comando, il ripiego di `durataTimerMs` lo
  // rileggerebbe e il circolo si ritroverebbe cinque minuti senza
  // capire da dove arrivano.
  const minutiTimer = minutiTimerDi(circolo);
  const impostaMinutiTimer = async (minuti: number) => {
    setSalvandoTimer(true);
    try {
      await aggiornaCircolo(circolo.id, { minutiTimerSfida: minuti, timerSfideVeloce: false });
    } finally {
      setSalvandoTimer(false);
    }
  };

  // ============================================================
  // ⚠️ SPEGNERE LE SFIDE NON SI PUÒ FARE CON DELLE SFIDE APERTE.
  //
  // Spegnendo, la voce sparisce dall'app dei soci: i due che hanno una
  // sfida in corso non possono più né rispondere né accordarsi, mentre
  // i timer continuano a correre e alla scadenza uno dei due perde la
  // posizione in classifica e si prende sette giorni di congelamento.
  // Una penalità per una decisione presa dall'Admin dopo, che il socio
  // non ha nemmeno potuto vedere.
  //
  // Le sfide aperte stanno qui sotto, in questa stessa card, con
  // «Concludi» e «Annulla». Deve passare di lì.
  // ============================================================
  const accese = sfideAccese(circolo);
  const cambiaSfideAttive = async (attivo: boolean) => {
    if (!attivo && attive.length > 0) {
      window.alert(
        `${attive.length === 1 ? 'C’è ancora una sfida aperta' : `Ci sono ancora ${attive.length} sfide aperte`}. `
        + 'Concludile o annullale qui sotto, poi potrai spegnere le Sfide: se le spegni adesso, '
        + 'i soci coinvolti non possono più rispondere e alla scadenza del timer prendono la penalità.',
      );
      return;
    }
    setSalvandoTimer(true);
    try {
      await aggiornaCircolo(circolo.id, { sfideAttive: attivo });
    } catch {
      // Senza questo, un rifiuto del server restava un errore non
      // gestito nella console del browser e la casella tornava indietro
      // da sola: chi l'aveva toccata non vedeva niente e riprovava.
      window.alert('Il cambiamento non è stato salvato. Riprova, oppure chiedi al presidente del circolo.');
    } finally {
      setSalvandoTimer(false);
    }
  };

  const testoStato = (sf: Sfida): string => {
    if (sf.fase === 'accordo') {
      if (sf.accordoSfidante && sf.accordoSfidato) return 'Accordo trovato, in attesa di proposta formale';
      if (sf.accordoSfidante) return 'Sfidante ha detto "Trovato" — in attesa dello Sfidato';
      if (sf.accordoSfidato) return 'Sfidato ha detto "Trovato" — in attesa dello Sfidante';
      return 'Trattativa in chat, nessuno ha ancora risposto';
    }
    if (sf.fase === 'prenotazione') {
      // ⚠️ RISCRITTO SULLA TRATTATIVA NUOVA. Diceva «in attesa della
      // conferma finale» di un passaggio che non esiste piu': chi
      // sceglie prenota, e non c'e' nessuna conferma dopo. Una riga di
      // stato che descrive un meccanismo smontato manda l'Admin a
      // cercare al telefono un socio che non deve fare niente.
      const quante = (sf.orariProposti ?? []).length;
      if (sf.propostaDi === 'sfidante') {
        return `Lo Sfidante ha proposto ${quante} mezz’ore — tocca allo Sfidato scegliere o controproporre`;
      }
      if (sf.propostaDi === 'sfidato') {
        return `Lo Sfidato ha proposto ${quante} mezz’ore — tocca allo Sfidante scegliere o controproporre`;
      }
      // Le sfide nate prima della trattativa a lista.
      if (sf.propostaAccettata) return 'Proposta accettata (vecchio meccanismo) — in attesa della conferma';
      if (sf.proposta) return 'Proposta formale inviata (vecchio meccanismo), in attesa di risposta';
      return 'Accordo trovato, in attesa che lo Sfidante proponga gli orari';
    }
    return '';
  };

  return (
    <div className="admin-card">
      <div className="admin-card-title">Sfide in Corso</div>
      <p className="admin-card-hint">
        Dal lancio alla conclusione — qui trovi anche le eventuali discrepanze tra i due risultati dichiarati.
      </p>

      {/* ⚠️ L'interruttore sta in cima, prima del timer: con le sfide
          spente il tempo di risposta non ha nessun significato. */}
      {/* ⚠️ AL COLLABORATORE NON SI MOSTRA UN COMANDO CHE VERRÀ
          RESPINTO. Le regole Firestore lasciano cambiare questo campo
          solo al presidente — spegnere le sfide è una scelta di
          regolamento, non un'operazione di giornata — e una casella che
          si spunta e torna indietro da sola è peggio di una casella
          assente: è la stessa cura già usata per la Password Circolo e
          per i Collaboratori. */}
      <div className="admin-riga-interruttore">
        <span>
          <span className="admin-label">Sfide attive nel circolo</span>
          <span className="admin-card-hint">
            {accese
              ? 'I soci vedono il tabellone delle sfide e possono sfidarsi fra loro.'
              : 'Il tabellone è nascosto ai soci. Al suo posto, nella barra dell’app, trovano la Classifica.'}
            {!puoCambiareSfide ? ' Solo il presidente può cambiarlo.' : ''}
          </span>
        </span>
        {puoCambiareSfide ? (
          <input
            type="checkbox"
            role="switch"
            aria-label="Sfide attive nel circolo"
            checked={accese}
            onChange={(e) => cambiaSfideAttive(e.target.checked)}
            disabled={salvandoTimer}
          />
        ) : (
          <span className="timer-sfide-valore">{accese ? 'Attive' : 'Spente'}</span>
        )}
      </div>
      {!accese && (
        <p className="admin-card-hint timer-sfide-avviso">
          Le sfide restano spente finché non le riaccendi. La Classifica Sociale continua a
          funzionare e i soci la vedono: si aggiorna a mano dalla sezione qui sopra.
        </p>
      )}

      {accese && <>
      {/* Sul sito il cursore vero non costa niente — è un elemento del
          browser — quindi qui c'è quello, con lo stesso elenco chiuso di
          valori del telefono: 5 minuti, poi da un'ora a ventiquattro. */}
      <label className="admin-label" htmlFor="timer-sfide">Tempo per rispondere a una sfida</label>
      <div className="timer-sfide-riga">
        <input
          id="timer-sfide"
          type="range"
          min={0}
          max={MINUTI_TIMER_AMMESSI.length - 1}
          step={1}
          value={Math.max(0, MINUTI_TIMER_AMMESSI.indexOf(minutiTimer))}
          onChange={(e) => impostaMinutiTimer(MINUTI_TIMER_AMMESSI[Number(e.target.value)])}
          disabled={salvandoTimer}
          className="timer-sfide-cursore"
        />
        <span className="timer-sfide-valore">{timerLeggibile(minutiTimer)}</span>
      </div>
      <div className="admin-chip-row">
        <button
          type="button"
          className={`admin-chip${minutiTimer === 5 ? ' selected' : ''}`}
          onClick={() => impostaMinutiTimer(5)}
          disabled={salvandoTimer}
        >
          5 minuti
        </button>
        <button
          type="button"
          className={`admin-chip${minutiTimer === 1440 ? ' selected' : ''}`}
          onClick={() => impostaMinutiTimer(1440)}
          disabled={salvandoTimer}
        >
          24 ore
        </button>
      </div>
      {minutiTimer < 60 && (
        <p className="admin-card-hint timer-sfide-avviso">
          Con un tempo così corto un socio che non guarda il telefono prende la penalità: tienilo
          per le prove, non per il gioco vero.
        </p>
      )}
      </>}

      {attive.length === 0 && <p className="admin-empty-text">Nessuna sfida in corso al momento.</p>}

      {attive.map((sf) => {
        const discrepanza = !!sf.risultatoSfidante && !!sf.risultatoSfidato
          && sf.risultatoSfidante.esito === sf.risultatoSfidato.esito;
        return (
          <div
            key={sf.id}
            className="admin-list-row admin-list-row-clickable"
            onClick={() => apriInfo(sf)}
          >
            <div style={{ flex: 1 }}>
              <div className="admin-list-main">
                {sf.sfidanteNome} {sf.sfidanteCognome} vs {sf.sfidatoNome} {sf.sfidatoCognome}
              </div>
              {(sf.fase === 'accordo' || sf.fase === 'prenotazione') && (
                <>
                  <div className="admin-list-sub">{testoStato(sf)}</div>
                  <CountdownAdmin scadenza={sf.fase === 'accordo' ? sf.accordoScadenza : (sf.prenotazioneScadenza ?? 0)} />
                </>
              )}
              {sf.fase === 'accettata' && sf.matchData && (
                <>
                  <div className="admin-list-sub">
                    {sf.matchDataLabel} · {sf.matchCampoNome} · {sf.matchOrari?.[0]}
                    {sf.matchViaRegolaCircolo ? ' (fissata d\'ufficio)' : ''}
                  </div>
                  {sf.risultatoSfidante && (
                    <div className="admin-list-sub">
                      {sf.sfidanteNome}: {sf.risultatoSfidante.esito} {sf.risultatoSfidante.punteggio ? `(${sf.risultatoSfidante.punteggio})` : ''}
                    </div>
                  )}
                  {sf.risultatoSfidato && (
                    <div className="admin-list-sub">
                      {sf.sfidatoNome}: {sf.risultatoSfidato.esito} {sf.risultatoSfidato.punteggio ? `(${sf.risultatoSfidato.punteggio})` : ''}
                    </div>
                  )}
                  {discrepanza && (
                    <div style={{ color: '#B3261E', fontWeight: 700, fontSize: '.72rem', marginTop: '.2rem' }}>
                      ⚠ I due risultati non coincidono — verifica con i soci prima di concludere.
                    </div>
                  )}
                </>
              )}
            </div>
            <span style={{ color: 'var(--grigio)', fontSize: '1.1rem' }}>›</span>
          </div>
        );
      })}

      <div style={{ marginTop: '1.2rem', paddingTop: '.9rem', borderTop: '1.5px solid #EFEBE0' }}>
        <div className="admin-card-title" style={{ fontSize: '.95rem' }}>Storico Sfide (ultimi 5 giorni)</div>
        <p className="admin-card-hint">Solo per correggere in fretta un errore appena scritto.</p>
        {storicoRecente.length === 0 && <p className="admin-empty-text">Nessuna sfida conclusa negli ultimi 5 giorni.</p>}
        {storicoRecente.map((sf) => (
          <div key={sf.id} className="admin-list-row" style={{ alignItems: 'center' }}>
            <div style={{ flex: 1 }}>
              <div className="admin-list-main">
                {sf.sfidanteNome} {sf.sfidanteCognome} vs {sf.sfidatoNome} {sf.sfidatoCognome}
              </div>
              <div className="admin-list-sub">{sf.risultatoUfficiale || '—'}</div>
            </div>
            <button
              type="button"
              onClick={() => apriModifica(sf)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '.4rem', fontSize: '1rem' }}
              title="Correggi il risultato"
            >
              ✏️
            </button>
          </div>
        ))}
      </div>

      <Modal visible={!!daConcludere} onClose={() => setDaConcludere(null)}>
        <div className="admin-modal-title">
          {daConcludere?.fase === 'accettata' ? 'Concludi la sfida' : 'Info Sfida'}
        </div>
        <p className="admin-card-hint" style={{ textAlign: 'center' }}>
          {daConcludere?.sfidanteNome} {daConcludere?.sfidanteCognome} vs {daConcludere?.sfidatoNome} {daConcludere?.sfidatoCognome}
        </p>

        <div style={{ background: '#F7F4EA', borderRadius: 10, padding: '.8rem', marginTop: '.7rem' }}>
          <div className="admin-list-sub">
            Posizioni al lancio: {daConcludere?.sfidanteNome} #{daConcludere?.posizioneSfidante} · {daConcludere?.sfidatoNome} #{daConcludere?.posizioneSfidato}
          </div>
          {daConcludere && (daConcludere.fase === 'accordo' || daConcludere.fase === 'prenotazione') && (
            <div className="admin-list-sub" style={{ marginTop: '.3rem' }}>{testoStato(daConcludere)}</div>
          )}
          {daConcludere?.fase === 'accettata' && daConcludere.matchData && (
            <div className="admin-list-sub" style={{ fontWeight: 700 }}>
              {daConcludere.matchDataLabel} · {daConcludere.matchCampoNome} · {daConcludere.matchOrari?.[0]}
              {daConcludere.matchViaRegolaCircolo ? ' — fissata d\'ufficio dal circolo' : ''}
            </div>
          )}
        </div>

        {daConcludere?.fase === 'accettata' && (
          <>
            <label className="admin-label" style={{ marginTop: '.9rem' }}>Chi ha vinto?</label>
            <div className="admin-checkbox-row" onClick={() => setVincitoreScelto(daConcludere?.sfidanteId ?? null)}>
              <input type="checkbox" checked={vincitoreScelto === daConcludere?.sfidanteId} onChange={() => {}} />
              <span>{daConcludere?.sfidanteNome} {daConcludere?.sfidanteCognome} (sfidante)</span>
            </div>
            <div className="admin-checkbox-row" onClick={() => setVincitoreScelto(daConcludere?.sfidatoId ?? null)}>
              <input type="checkbox" checked={vincitoreScelto === daConcludere?.sfidatoId} onChange={() => {}} />
              <span>{daConcludere?.sfidatoNome} {daConcludere?.sfidatoCognome} (sfidato)</span>
            </div>

            <label className="admin-label" style={{ marginTop: '.9rem' }}>Risultato ufficiale</label>
            <p className="admin-card-hint" style={{ marginBottom: '.4rem' }}>
              Scrivi tu il punteggio definitivo — è questo, non le dichiarazioni dei giocatori, a comparire nello storico pubblico.
            </p>
            <input
              className="admin-input"
              value={risultatoTesto}
              onChange={(e) => setRisultatoTesto(e.target.value)}
              placeholder="Es. 6-3 6-4"
            />

            <label className="admin-label" style={{ marginTop: '.9rem' }}>Oppure, mancata presentazione</label>
            <div style={{ display: 'flex', gap: '.5rem' }}>
              <button
                type="button"
                onClick={() => setConfermaNonPresentatoDi('sfidante')}
                style={{ flex: 1, border: '1.5px solid #B3261E', borderRadius: 8, padding: '.5rem', color: '#B3261E', fontSize: '.78rem', fontWeight: 700, background: 'none', cursor: 'pointer' }}
              >
                Sfidante assente
              </button>
              <button
                type="button"
                onClick={() => setConfermaNonPresentatoDi('sfidato')}
                style={{ flex: 1, border: '1.5px solid #B3261E', borderRadius: 8, padding: '.5rem', color: '#B3261E', fontSize: '.78rem', fontWeight: 700, background: 'none', cursor: 'pointer' }}
              >
                Sfidato assente
              </button>
            </div>
          </>
        )}

        {(daConcludere?.fase === 'accordo' || daConcludere?.fase === 'prenotazione' || daConcludere?.fase === 'accettata') && (
          <button
            type="button"
            onClick={() => setConfermaAnnullaAperta(true)}
            style={{
              width: '100%', marginTop: '1rem', background: 'transparent', color: '#B3261E',
              border: '2px solid #B3261E', borderRadius: 10, padding: '.7rem', fontWeight: 700,
              fontSize: '.85rem', cursor: 'pointer',
            }}
          >
            Annulla Sfida Corrente
          </button>
        )}

        <div className="admin-modal-btn-row">
          <button className="admin-modal-btn-cancel" onClick={() => setDaConcludere(null)}>
            {daConcludere?.fase === 'accettata' ? 'Annulla' : 'Chiudi'}
          </button>
          {daConcludere?.fase === 'accettata' && (
            <button
              className="admin-modal-btn-confirm"
              onClick={apriRevisioneConclusione}
              disabled={!vincitoreScelto || !risultatoTesto.trim() || concludendo}
            >
              Dichiara Sfida Conclusa
            </button>
          )}
        </div>
      </Modal>

      <Modal visible={confermaInvioAperta} onClose={() => setConfermaInvioAperta(false)}>
        <div className="admin-modal-title">Confermi l&apos;invio?</div>
        <div style={{ background: '#F7F4EA', borderRadius: 10, padding: '.8rem', marginTop: '.6rem' }}>
          <div className="admin-list-sub">
            {daConcludere?.sfidanteNome} {daConcludere?.sfidanteCognome} vs {daConcludere?.sfidatoNome} {daConcludere?.sfidatoCognome}
          </div>
          <div className="admin-list-sub" style={{ fontWeight: 700, marginTop: '.3rem' }}>
            Vince: {vincitoreScelto === daConcludere?.sfidanteId ? daConcludere?.sfidanteNome : daConcludere?.sfidatoNome} {vincitoreScelto === daConcludere?.sfidanteId ? daConcludere?.sfidanteCognome : daConcludere?.sfidatoCognome}
          </div>
          <div className="admin-list-sub" style={{ marginTop: '.3rem' }}>Risultato: {risultatoTesto}</div>
        </div>
        <p className="admin-card-hint" style={{ marginTop: '.6rem' }}>
          Questo testo comparirà nello storico pubblico e aggiornerà la classifica — controllalo bene prima di confermare.
        </p>
        <div className="admin-modal-btn-row">
          <button className="admin-modal-btn-cancel" onClick={() => setConfermaInvioAperta(false)}>Indietro</button>
          <button className="admin-modal-btn-confirm" onClick={eseguiConclusione} disabled={concludendo}>
            {concludendo ? 'Attendere…' : 'Conferma e Invia'}
          </button>
        </div>
      </Modal>

      <Modal visible={!!confermaNonPresentatoDi} onClose={() => setConfermaNonPresentatoDi(null)}>
        <div className="admin-modal-title">Confermi la mancata presentazione?</div>
        <p className="admin-card-hint" style={{ textAlign: 'center' }}>
          {confermaNonPresentatoDi === 'sfidante'
            ? `${daConcludere?.sfidanteNome} ${daConcludere?.sfidanteCognome} non si è presentato: verrà congelato dalle sfide per 7 giorni.`
            : `${daConcludere?.sfidatoNome} ${daConcludere?.sfidatoCognome} non si è presentato: perderà la sua posizione in classifica.`}
        </p>
        <div className="admin-modal-btn-row">
          <button className="admin-modal-btn-cancel" onClick={() => setConfermaNonPresentatoDi(null)}>Indietro</button>
          <button className="admin-modal-btn-confirm danger" onClick={confermaNonPresentato} disabled={registrandoAssenza}>
            {registrandoAssenza ? 'Attendere…' : 'Conferma'}
          </button>
        </div>
      </Modal>

      <Modal visible={confermaAnnullaAperta} onClose={() => setConfermaAnnullaAperta(false)}>
        <div className="admin-modal-title">Annullare questa sfida?</div>
        <p className="admin-card-hint" style={{ textAlign: 'center' }}>
          {daConcludere?.sfidanteNome} {daConcludere?.sfidanteCognome} vs {daConcludere?.sfidatoNome} {daConcludere?.sfidatoCognome}
          <br /><br />
          Le ore prenotate per questa sfida vengono liberate e rimborsate a tutti e due, con la
          loro riga nel registro. Le ore già giocate restano come prenotazioni normali: quelle
          non si rimborsano. Entrambi i soci saranno avvisati.
          La classifica NON viene toccata: nessuno vince né perde posizioni.
        </p>
        <div className="admin-modal-btn-row">
          <button className="admin-modal-btn-cancel" onClick={() => setConfermaAnnullaAperta(false)}>Indietro</button>
          <button className="admin-modal-btn-confirm danger" onClick={confermaAnnullaSfida} disabled={annullando}>
            {annullando ? 'Attendere…' : 'Annulla Sfida'}
          </button>
        </div>
      </Modal>

      <Modal visible={annullamentoFatto} onClose={() => setAnnullamentoFatto(false)}>
        <div className="admin-modal-title">Sfida annullata ✓</div>
        <p className="admin-card-hint" style={{ textAlign: 'center' }}>
          Gli slot prenotati/sospesi sono stati liberati, entrambi i soci sono stati avvisati.
          La classifica non è stata toccata.
        </p>
        <button className="admin-btn-full" style={{ marginTop: '1rem' }} onClick={() => setAnnullamentoFatto(false)}>
          Chiudi
        </button>
      </Modal>

      <Modal visible={!!daModificare} onClose={() => setDaModificare(null)}>
        <div className="admin-modal-title">Correggi il risultato</div>
        <p className="admin-card-hint" style={{ textAlign: 'center' }}>
          {daModificare?.sfidanteNome} {daModificare?.sfidanteCognome} vs {daModificare?.sfidatoNome} {daModificare?.sfidatoCognome}
        </p>
        <label className="admin-label" style={{ marginTop: '.7rem' }}>Risultato ufficiale</label>
        <input
          className="admin-input"
          value={testoModifica}
          onChange={(e) => setTestoModifica(e.target.value)}
          placeholder="Es. 6-3 6-4"
        />
        <div className="admin-modal-btn-row">
          <button className="admin-modal-btn-cancel" onClick={() => setDaModificare(null)}>Annulla</button>
          <button className="admin-modal-btn-confirm" onClick={salvaModifica} disabled={!testoModifica.trim() || salvandoModifica}>
            {salvandoModifica ? 'Attendere…' : 'Salva'}
          </button>
        </div>
      </Modal>
    </div>
  );
}
