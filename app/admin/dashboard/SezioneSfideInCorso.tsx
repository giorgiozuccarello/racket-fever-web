'use client';

import { useEffect, useState } from 'react';
import { Circolo, sfideAccese } from '../../../data/circoli';
import { SocioCircolo } from '../../../data/users';
import {
  Sfida, concludiSfida, annullaSfida, notificaSfidaConRitentativi,
  nonPresentatoSfidante, nonPresentatoSfidato, modificaRisultatoUfficiale,
  MINUTI_TIMER_AMMESSI, MINUTI_TIMER_PREDEFINITI,
} from '../../../data/sfide';
import { useLingua } from '../../../lib/lingua';
import { Traduttore } from '../../../data/testi';

// ⚠️ QUI C'ERA `timerLeggibile` DI `data/sfide`, e non c'e' piu': quella
// componeva «5 minuti» e «3 ore» in italiano dentro un file condiviso
// con l'app, che questa tornata non tocca. La stessa scaletta — sotto
// l'ora si contano i minuti, sopra si arrotonda alle ore — vive adesso
// qui, con le frasi tradotte. Se un giorno la scaletta cambia di la',
// va cambiata anche qui: sono tre righe, e l'alternativa era lasciare
// un valore in italiano in mezzo a una scheda tedesca.
function timerScritto(t: Traduttore, minuti: number): string {
  if (minuti < 60) return t('adm.sfi.timerMinuti', { n: minuti });
  const ore = Math.round(minuti / 60);
  return ore === 1 ? t('adm.sfi.timerUnOra') : t('adm.sfi.timerOre', { n: ore });
}

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
  // ⚠️ `t` PRIMA DEL RETURN ANTICIPATO: sotto c'e' l'uscita «Scaduta»,
  // e un gancio chiamato dopo di quella girerebbe un giro si' e uno no.
  const { t } = useLingua();
  // ⚠️ `orologio` e non piu' `t`: il nome era gia' preso dal traduttore,
  // e due `t` nella stessa funzione sono un errore che si scopre a
  // schermo, non in compilazione.
  const [ora, setOra] = useState(Date.now());
  useEffect(() => {
    const orologio = setInterval(() => setOra(Date.now()), 1000);
    return () => clearInterval(orologio);
  }, []);
  const restante = Math.max(0, scadenza - ora);
  if (restante === 0) return <div style={{ color: '#B3261E', fontWeight: 800, fontSize: '.78rem' }}>{t('adm.sfi.scaduta')}</div>;
  const giorni = Math.floor(restante / 86400000);
  const ore = Math.floor((restante % 86400000) / 3600000);
  const minuti = Math.floor((restante % 3600000) / 60000);
  const secondi = Math.floor((restante % 60000) / 1000);
  const testo = giorni > 0
    ? t('adm.sfi.restaGiorniOre', { g: giorni, h: ore })
    : ore > 0
      ? t('adm.sfi.restaOreMinuti', { h: ore, m: minuti })
      : t('adm.sfi.restaMinutiSecondi', { m: minuti, s: secondi });
  return <div style={{ color: '#B3261E', fontWeight: 800, fontSize: '.78rem' }}>{t('adm.sfi.scadeTra', { tempo: testo })}</div>;
}

const CINQUE_GIORNI_MS = 5 * 24 * 60 * 60 * 1000;

export default function SezioneSfideInCorso({ sfide, soci, circolo, puoCambiareSfide = true }: { sfide: Sfida[]; soci: SocioCircolo[]; circolo: Circolo; puoCambiareSfide?: boolean }) {
  const { t } = useLingua();
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
      alert(`${t('adm.sfi.risultatoCorretto')} ✓`);
      setDaModificare(null);
    } catch {
      alert(t('adm.sfi.erroreConnessione'));
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
        // ============================================================
        // ⚠️ QUESTE QUATTRO FRASI RESTANO IN ITALIANO, ED È VOLUTO.
        // Non le legge l'Admin: le legge il socio, sul suo telefono.
        // Passarle da `t(...)` vorrebbe dire comporle nella lingua di
        // CHI PUBBLICA — un presidente che ha messo la dashboard in
        // tedesco spedirebbe notifiche tedesche a soci italiani.
        // La strada giusta esiste già ed è `avviso('chiave', {...})` di
        // `data/linguaDestinatario.ts`, che legge la lingua di chi
        // riceve: ma le sue chiavi vivono in `data/traduzioni/avvisi.ts`,
        // che questa tornata non tocca. Finché non ci si passa, qui si
        // scrive italiano — che è il ripiego previsto, non una svista.
        // ============================================================
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
        alert(`${t('adm.sfi.conclusaOk')} ✓`);
        setConfermaInvioAperta(false);
        setDaConcludere(null);
        setRisultatoTesto('');
      } else {
        alert(t('adm.sfi.giaGestita'));
        setConfermaInvioAperta(false);
        setDaConcludere(null);
        setRisultatoTesto('');
      }
    } catch {
      alert(t('adm.sfi.erroreConnessione'));
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
        alert(t('adm.sfi.giaAnnullata'));
      } else if (esito.oreVere > 0) {
        // Le ore tornano libere e il denaro torna ai due, con la sua
        // riga nel registro.
        // ⚠️ DUE FRASI INTERE E NON PIÙ UN PEZZO ATTACCATO ALL'ALTRO:
        // singolare e plurale non si spostano allo stesso modo nelle tre
        // lingue, e concatenando si sarebbe imposta la grammatica
        // italiana anche al tedesco.
        alert(esito.oreVere === 1
          ? t('adm.sfi.annullataRimborsoUna', { n: esito.oreVere })
          : t('adm.sfi.annullataRimborsoTante', { n: esito.oreVere }));
      } else {
        setAnnullamentoFatto(true);
      }
    } catch (e: any) {
      // ⚠️ Non più un catch cieco: era lui a chiamare «errore di
      // connessione» un rifiuto dei permessi.
      alert(
        e?.code === 'functions/permission-denied'
          ? t('adm.sfi.annullaNegato')
          : t('adm.sfi.annullaFallito', { motivo: e?.message ?? '' }).trim(),
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
      alert(`${t('adm.sfi.assenzaRegistrata')} ✓`);
      setConfermaNonPresentatoDi(null);
      setDaConcludere(null);
    } catch {
      alert(t('adm.sfi.erroreConnessione'));
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
      // ⚠️ FRASE INTERA IN OGNI RAMO, singolare e plurale: prima erano
      // un pezzo variabile piu' due pezzi fissi incollati, e la coda
      // fissa («Concludile o annullale…») e' al plurale — in una lingua
      // che declina, il pezzo singolare non ci si attacca.
      window.alert(attive.length === 1
        ? t('adm.sfi.spegniBloccoUna')
        : t('adm.sfi.spegniBloccoTante', { n: attive.length }));
      return;
    }
    setSalvandoTimer(true);
    try {
      await aggiornaCircolo(circolo.id, { sfideAttive: attivo });
    } catch {
      // Senza questo, un rifiuto del server restava un errore non
      // gestito nella console del browser e la casella tornava indietro
      // da sola: chi l'aveva toccata non vedeva niente e riprovava.
      window.alert(t('adm.sfi.cambioNonSalvato'));
    } finally {
      setSalvandoTimer(false);
    }
  };

  const testoStato = (sf: Sfida): string => {
    if (sf.fase === 'accordo') {
      if (sf.accordoSfidante && sf.accordoSfidato) return t('adm.sfi.statoAccordoTrovato');
      if (sf.accordoSfidante) return t('adm.sfi.statoSfidanteTrovato');
      if (sf.accordoSfidato) return t('adm.sfi.statoSfidatoTrovato');
      return t('adm.sfi.statoTrattativa');
    }
    if (sf.fase === 'prenotazione') {
      // ⚠️ RISCRITTO SULLA TRATTATIVA NUOVA. Diceva «in attesa della
      // conferma finale» di un passaggio che non esiste piu': chi
      // sceglie prenota, e non c'e' nessuna conferma dopo. Una riga di
      // stato che descrive un meccanismo smontato manda l'Admin a
      // cercare al telefono un socio che non deve fare niente.
      const quante = (sf.orariProposti ?? []).length;
      if (sf.propostaDi === 'sfidante') {
        return t('adm.sfi.statoPropostaSfidante', { n: quante });
      }
      if (sf.propostaDi === 'sfidato') {
        return t('adm.sfi.statoPropostaSfidato', { n: quante });
      }
      // Le sfide nate prima della trattativa a lista.
      if (sf.propostaAccettata) return t('adm.sfi.statoVecchiaAccettata');
      if (sf.proposta) return t('adm.sfi.statoVecchiaInviata');
      return t('adm.sfi.statoAttesaOrari');
    }
    return '';
  };

  return (
    <div className="admin-card">
      <div className="admin-card-title">{t('adm.sfi.titolo')}</div>
      <p className="admin-card-hint">
        {t('adm.sfi.sottotitolo')}
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
          <span className="admin-label">{t('adm.sfi.interruttore')}</span>
          <span className="admin-card-hint">
            {accese
              ? t('adm.sfi.accesoSpiega')
              : t('adm.sfi.spentoSpiega')}
            {!puoCambiareSfide ? ` ${t('adm.sfi.soloPresidente')}` : ''}
          </span>
        </span>
        {puoCambiareSfide ? (
          <input
            type="checkbox"
            role="switch"
            aria-label={t('adm.sfi.interruttore')}
            checked={accese}
            onChange={(e) => cambiaSfideAttive(e.target.checked)}
            disabled={salvandoTimer}
          />
        ) : (
          <span className="timer-sfide-valore">{accese ? t('adm.sfi.attive') : t('adm.sfi.spente')}</span>
        )}
      </div>
      {!accese && (
        <p className="admin-card-hint timer-sfide-avviso">
          {t('adm.sfi.spenteAvviso')}
        </p>
      )}

      {accese && <>
      {/* Sul sito il cursore vero non costa niente — è un elemento del
          browser — quindi qui c'è quello, con lo stesso elenco chiuso di
          valori del telefono: 5 minuti, poi da un'ora a ventiquattro. */}
      <label className="admin-label" htmlFor="timer-sfide">{t('adm.sfi.tempoRisposta')}</label>
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
        <span className="timer-sfide-valore">{timerScritto(t, minutiTimer)}</span>
      </div>
      <div className="admin-chip-row">
        <button
          type="button"
          className={`admin-chip${minutiTimer === 5 ? ' selected' : ''}`}
          onClick={() => impostaMinutiTimer(5)}
          disabled={salvandoTimer}
        >
          {t('adm.sfi.timerMinuti', { n: 5 })}
        </button>
        <button
          type="button"
          className={`admin-chip${minutiTimer === 1440 ? ' selected' : ''}`}
          onClick={() => impostaMinutiTimer(1440)}
          disabled={salvandoTimer}
        >
          {t('adm.sfi.timerOre', { n: 24 })}
        </button>
      </div>
      {minutiTimer < 60 && (
        <p className="admin-card-hint timer-sfide-avviso">
          {t('adm.sfi.timerCortoAvviso')}
        </p>
      )}
      </>}

      {attive.length === 0 && <p className="admin-empty-text">{t('adm.sfi.nessunaInCorso')}</p>}

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
                    {sf.matchViaRegolaCircolo ? ` (${t('adm.sfi.fissataUfficio')})` : ''}
                  </div>
                  {/* ⚠️ `esito` è un valore del database — 'vinta' o 'persa' —
                      e finiva a schermo così com'era: una parola italiana
                      dentro una scheda tedesca. Non è testo scritto
                      dall'Admin, è un'etichetta nostra, quindi si traduce. */}
                  {sf.risultatoSfidante && (
                    <div className="admin-list-sub">
                      {sf.sfidanteNome}: {t(`adm.sfi.esito.${sf.risultatoSfidante.esito}` as any)} {sf.risultatoSfidante.punteggio ? `(${sf.risultatoSfidante.punteggio})` : ''}
                    </div>
                  )}
                  {sf.risultatoSfidato && (
                    <div className="admin-list-sub">
                      {sf.sfidatoNome}: {t(`adm.sfi.esito.${sf.risultatoSfidato.esito}` as any)} {sf.risultatoSfidato.punteggio ? `(${sf.risultatoSfidato.punteggio})` : ''}
                    </div>
                  )}
                  {discrepanza && (
                    <div style={{ color: '#B3261E', fontWeight: 700, fontSize: '.72rem', marginTop: '.2rem' }}>
                      ⚠ {t('adm.sfi.discrepanza')}
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
        <div className="admin-card-title" style={{ fontSize: '.95rem' }}>{t('adm.sfi.storicoTitolo')}</div>
        <p className="admin-card-hint">{t('adm.sfi.storicoSpiega')}</p>
        {storicoRecente.length === 0 && <p className="admin-empty-text">{t('adm.sfi.storicoVuoto')}</p>}
        {storicoRecente.map((sf) => (
          <div key={sf.id} className="admin-list-row" style={{ alignItems: 'center' }}>
            <div style={{ flex: 1 }}>
              <div className="admin-list-main">
                {sf.sfidanteNome} {sf.sfidanteCognome} vs {sf.sfidatoNome} {sf.sfidatoCognome}
              </div>
              <div className="admin-list-sub">{sf.risultatoUfficiale || t('com.nessunDato')}</div>
            </div>
            <button
              type="button"
              onClick={() => apriModifica(sf)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '.4rem', fontSize: '1rem' }}
              title={t('adm.sfi.correggiRisultato')}
            >
              ✏️
            </button>
          </div>
        ))}
      </div>

      <Modal visible={!!daConcludere} onClose={() => setDaConcludere(null)}>
        <div className="admin-modal-title">
          {daConcludere?.fase === 'accettata' ? t('adm.sfi.concludiTitolo') : t('adm.sfi.infoTitolo')}
        </div>
        <p className="admin-card-hint" style={{ textAlign: 'center' }}>
          {daConcludere?.sfidanteNome} {daConcludere?.sfidanteCognome} vs {daConcludere?.sfidatoNome} {daConcludere?.sfidatoCognome}
        </p>

        <div style={{ background: '#F7F4EA', borderRadius: 10, padding: '.8rem', marginTop: '.7rem' }}>
          <div className="admin-list-sub">
            {t('adm.sfi.posizioniAlLancio', {
              sfidante: daConcludere?.sfidanteNome ?? '',
              posSfidante: daConcludere?.posizioneSfidante ?? '',
              sfidato: daConcludere?.sfidatoNome ?? '',
              posSfidato: daConcludere?.posizioneSfidato ?? '',
            })}
          </div>
          {daConcludere && (daConcludere.fase === 'accordo' || daConcludere.fase === 'prenotazione') && (
            <div className="admin-list-sub" style={{ marginTop: '.3rem' }}>{testoStato(daConcludere)}</div>
          )}
          {daConcludere?.fase === 'accettata' && daConcludere.matchData && (
            <div className="admin-list-sub" style={{ fontWeight: 700 }}>
              {daConcludere.matchDataLabel} · {daConcludere.matchCampoNome} · {daConcludere.matchOrari?.[0]}
              {daConcludere.matchViaRegolaCircolo ? ` — ${t('adm.sfi.fissataUfficioCircolo')}` : ''}
            </div>
          )}
        </div>

        {daConcludere?.fase === 'accettata' && (
          <>
            <label className="admin-label" style={{ marginTop: '.9rem' }}>{t('adm.sfi.chiHaVinto')}</label>
            <div className="admin-checkbox-row" onClick={() => setVincitoreScelto(daConcludere?.sfidanteId ?? null)}>
              <input type="checkbox" checked={vincitoreScelto === daConcludere?.sfidanteId} onChange={() => {}} />
              <span>{daConcludere?.sfidanteNome} {daConcludere?.sfidanteCognome} ({t('adm.sfi.ruoloSfidante')})</span>
            </div>
            <div className="admin-checkbox-row" onClick={() => setVincitoreScelto(daConcludere?.sfidatoId ?? null)}>
              <input type="checkbox" checked={vincitoreScelto === daConcludere?.sfidatoId} onChange={() => {}} />
              <span>{daConcludere?.sfidatoNome} {daConcludere?.sfidatoCognome} ({t('adm.sfi.ruoloSfidato')})</span>
            </div>

            <label className="admin-label" style={{ marginTop: '.9rem' }}>{t('adm.sfi.risultatoUfficiale')}</label>
            <p className="admin-card-hint" style={{ marginBottom: '.4rem' }}>
              {t('adm.sfi.risultatoSpiega')}
            </p>
            <input
              className="admin-input"
              value={risultatoTesto}
              onChange={(e) => setRisultatoTesto(e.target.value)}
              placeholder={t('adm.sfi.esempioPunteggio')}
            />

            <label className="admin-label" style={{ marginTop: '.9rem' }}>{t('adm.sfi.oppureAssenza')}</label>
            <div style={{ display: 'flex', gap: '.5rem' }}>
              <button
                type="button"
                onClick={() => setConfermaNonPresentatoDi('sfidante')}
                style={{ flex: 1, border: '1.5px solid #B3261E', borderRadius: 8, padding: '.5rem', color: '#B3261E', fontSize: '.78rem', fontWeight: 700, background: 'none', cursor: 'pointer' }}
              >
                {t('adm.sfi.sfidanteAssente')}
              </button>
              <button
                type="button"
                onClick={() => setConfermaNonPresentatoDi('sfidato')}
                style={{ flex: 1, border: '1.5px solid #B3261E', borderRadius: 8, padding: '.5rem', color: '#B3261E', fontSize: '.78rem', fontWeight: 700, background: 'none', cursor: 'pointer' }}
              >
                {t('adm.sfi.sfidatoAssente')}
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
            {t('adm.sfi.annullaCorrente')}
          </button>
        )}

        <div className="admin-modal-btn-row">
          <button className="admin-modal-btn-cancel" onClick={() => setDaConcludere(null)}>
            {daConcludere?.fase === 'accettata' ? t('com.annulla') : t('com.chiudi')}
          </button>
          {daConcludere?.fase === 'accettata' && (
            <button
              className="admin-modal-btn-confirm"
              onClick={apriRevisioneConclusione}
              disabled={!vincitoreScelto || !risultatoTesto.trim() || concludendo}
            >
              {t('adm.sfi.dichiaraConclusa')}
            </button>
          )}
        </div>
      </Modal>

      <Modal visible={confermaInvioAperta} onClose={() => setConfermaInvioAperta(false)}>
        <div className="admin-modal-title">{t('adm.sfi.confermiInvio')}</div>
        <div style={{ background: '#F7F4EA', borderRadius: 10, padding: '.8rem', marginTop: '.6rem' }}>
          <div className="admin-list-sub">
            {daConcludere?.sfidanteNome} {daConcludere?.sfidanteCognome} vs {daConcludere?.sfidatoNome} {daConcludere?.sfidatoCognome}
          </div>
          <div className="admin-list-sub" style={{ fontWeight: 700, marginTop: '.3rem' }}>
            {t('adm.sfi.vince', {
              nome: vincitoreScelto === daConcludere?.sfidanteId
                ? `${daConcludere?.sfidanteNome ?? ''} ${daConcludere?.sfidanteCognome ?? ''}`.trim()
                : `${daConcludere?.sfidatoNome ?? ''} ${daConcludere?.sfidatoCognome ?? ''}`.trim(),
            })}
          </div>
          <div className="admin-list-sub" style={{ marginTop: '.3rem' }}>{t('adm.sfi.risultatoEtichetta', { risultato: risultatoTesto })}</div>
        </div>
        <p className="admin-card-hint" style={{ marginTop: '.6rem' }}>
          {t('adm.sfi.avvisoStoricoPubblico')}
        </p>
        <div className="admin-modal-btn-row">
          <button className="admin-modal-btn-cancel" onClick={() => setConfermaInvioAperta(false)}>{t('com.indietro')}</button>
          <button className="admin-modal-btn-confirm" onClick={eseguiConclusione} disabled={concludendo}>
            {concludendo ? t('com.attendi') : t('adm.sfi.confermaInvia')}
          </button>
        </div>
      </Modal>

      <Modal visible={!!confermaNonPresentatoDi} onClose={() => setConfermaNonPresentatoDi(null)}>
        <div className="admin-modal-title">{t('adm.sfi.confermiAssenza')}</div>
        <p className="admin-card-hint" style={{ textAlign: 'center' }}>
          {confermaNonPresentatoDi === 'sfidante'
            ? t('adm.sfi.assenzaSfidante', { nome: `${daConcludere?.sfidanteNome ?? ''} ${daConcludere?.sfidanteCognome ?? ''}`.trim() })
            : t('adm.sfi.assenzaSfidato', { nome: `${daConcludere?.sfidatoNome ?? ''} ${daConcludere?.sfidatoCognome ?? ''}`.trim() })}
        </p>
        <div className="admin-modal-btn-row">
          <button className="admin-modal-btn-cancel" onClick={() => setConfermaNonPresentatoDi(null)}>{t('com.indietro')}</button>
          <button className="admin-modal-btn-confirm danger" onClick={confermaNonPresentato} disabled={registrandoAssenza}>
            {registrandoAssenza ? t('com.attendi') : t('com.conferma')}
          </button>
        </div>
      </Modal>

      <Modal visible={confermaAnnullaAperta} onClose={() => setConfermaAnnullaAperta(false)}>
        <div className="admin-modal-title">{t('adm.sfi.annullareTitolo')}</div>
        <p className="admin-card-hint" style={{ textAlign: 'center' }}>
          {daConcludere?.sfidanteNome} {daConcludere?.sfidanteCognome} vs {daConcludere?.sfidatoNome} {daConcludere?.sfidatoCognome}
          <br /><br />
          {t('adm.sfi.annullaSpiega')}
        </p>
        <div className="admin-modal-btn-row">
          <button className="admin-modal-btn-cancel" onClick={() => setConfermaAnnullaAperta(false)}>{t('com.indietro')}</button>
          <button className="admin-modal-btn-confirm danger" onClick={confermaAnnullaSfida} disabled={annullando}>
            {annullando ? t('com.attendi') : t('adm.sfi.annullaSfidaBtn')}
          </button>
        </div>
      </Modal>

      <Modal visible={annullamentoFatto} onClose={() => setAnnullamentoFatto(false)}>
        <div className="admin-modal-title">{t('adm.sfi.annullataTitolo')} ✓</div>
        <p className="admin-card-hint" style={{ textAlign: 'center' }}>
          {t('adm.sfi.annullataSpiega')}
        </p>
        <button className="admin-btn-full" style={{ marginTop: '1rem' }} onClick={() => setAnnullamentoFatto(false)}>
          {t('com.chiudi')}
        </button>
      </Modal>

      <Modal visible={!!daModificare} onClose={() => setDaModificare(null)}>
        <div className="admin-modal-title">{t('adm.sfi.correggiRisultato')}</div>
        <p className="admin-card-hint" style={{ textAlign: 'center' }}>
          {daModificare?.sfidanteNome} {daModificare?.sfidanteCognome} vs {daModificare?.sfidatoNome} {daModificare?.sfidatoCognome}
        </p>
        <label className="admin-label" style={{ marginTop: '.7rem' }}>{t('adm.sfi.risultatoUfficiale')}</label>
        <input
          className="admin-input"
          value={testoModifica}
          onChange={(e) => setTestoModifica(e.target.value)}
          placeholder={t('adm.sfi.esempioPunteggio')}
        />
        <div className="admin-modal-btn-row">
          <button className="admin-modal-btn-cancel" onClick={() => setDaModificare(null)}>{t('com.annulla')}</button>
          <button className="admin-modal-btn-confirm" onClick={salvaModifica} disabled={!testoModifica.trim() || salvandoModifica}>
            {salvandoModifica ? t('com.attendi') : t('com.salva')}
          </button>
        </div>
      </Modal>
    </div>
  );
}
