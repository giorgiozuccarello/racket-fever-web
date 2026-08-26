'use client';

import { useState } from 'react';
import { SocioCircolo, ripristinaSOS, etaDaAnno } from '../../../data/users';
import { creaNotifica } from '../../../data/notifiche';
import { avviso } from '../../../data/linguaDestinatario';
import {
  ricaricaCredito, azzeraCredito, cancellaConRimborso, importoDaRimborsare, PrenotazioneAdmin,
} from '../../../data/prenotazioniRepo';
import { anteprimaRimozione, rimuoviSocioDaCircolo } from '../../../data/tessere';
import { fidoIllimitato } from '../../../data/circoli';
import { useLingua } from '../../../lib/lingua';
import Modal from './Modal';

export default function SchedaSocioModal({ circoloId, socio, prenotazioni, onClose, limiteFido }: {
  circoloId: string; socio: SocioCircolo | null; prenotazioni: PrenotazioneAdmin[]; onClose: () => void;
  // Il tetto del Fido del circolo: serve solo a scrivere «usato/tetto»
  // accanto al debito del socio.
  limiteFido: number;
}) {
  const { t } = useLingua();
  const [ricaricaAperta, setRicaricaAperta] = useState(false);
  const [importo, setImporto] = useState('');
  const [inviando, setInviando] = useState(false);
  const [confermaRipristinoAperta, setConfermaRipristinoAperta] = useState(false);
  const [ripristinando, setRipristinando] = useState(false);
  const [confermaAzzeraAperta, setConfermaAzzeraAperta] = useState(false);
  const [azzerando, setAzzerando] = useState(false);

  // ============================================================
  // TOGLIERE UNA PERSONA DAL CIRCOLO.
  //
  // ⚠️ ESISTEVA SOLO NELLA DASHBOARD DELL'APP. Il motore c'era da
  // sempre — anteprima di cosa succede, rimborso delle prenotazioni
  // future, ricompattazione della classifica, chiusura della tessera —
  // ma dal browser, che e' dove un segretario lavora davvero, non
  // c'era nessun pulsante per chiamarlo. Chi provava a togliere un
  // socio dal computer concludeva che la funzione non ci fosse.
  //
  // ⚠️ E IL NOME DEL PULSANTE CAMBIA CON IL RUOLO: a un ospite non si
  // toglie la qualifica di socio, che non ha mai avuto — gli si toglie
  // l'accesso come ospite. E' la stessa operazione, ma chiamarla nello
  // stesso modo faceva esitare chi la doveva usare.
  // ============================================================
  const [rimozioneAperta, setRimozioneAperta] = useState(false);
  const [anteprima, setAnteprima] = useState<{
    prenotazioniFuture: number; credito: number; debito: number; inClassifica: boolean;
  } | null>(null);
  const [rimuovendo, setRimuovendo] = useState(false);
  const [erroreRimozione, setErroreRimozione] = useState('');

  const eOspite = socio?.ruoloTessera === 'ospite';
  const etichettaRimozione = eOspite ? t('adm.soc.togliOspite') : t('adm.soc.rimuoviDalCircolo');

  const apriRimozione = async () => {
    if (!socio) return;
    setErroreRimozione('');
    setRimozioneAperta(true);
    setAnteprima(null);
    try {
      setAnteprima(await anteprimaRimozione(socio.uid, circoloId));
    } catch {
      // ⚠️ Non blocca: l'anteprima e' un aiuto, non un permesso. Non
      // riuscendo a leggerla si mostra quello che si sa gia' dalla
      // scheda, invece di impedire un'operazione legittima.
      setAnteprima({
        prenotazioniFuture: 0,
        credito: socio.credito ?? 0,
        debito: socio.sosUtilizzato ?? 0,
        inClassifica: false,
      });
    }
  };

  const confermaRimozione = async () => {
    if (!socio) return;
    setRimuovendo(true);
    setErroreRimozione('');
    try {
      const esito = await rimuoviSocioDaCircolo({
        uid: socio.uid,
        circoloId,
        // ⚠️ `void` davanti: da questa tornata `cancellaConRimborso`
        // restituisce quante mezz'ore restano, ma qui non interessa a
        // nessuno — si sta svuotando l'intera agenda di un socio che
        // esce dal circolo. Dichiararlo esplicitamente e' meglio di
        // farlo sparire in un tipo che non combacia.
        rimborsa: async (p) => { await cancellaConRimborso({
          uid: socio.uid,
          circoloId,
          prenotazioneId: p.id,
          prezzo: importoDaRimborsare(p),
          // ⚠️ QUESTA RESTA IN ITALIANO E NON E' UNA DIMENTICANZA: non
          // e' una frase che la pagina disegna, e' la causale che
          // finisce SCRITTA sul registro movimenti in Firestore.
          // Tradurla con la lingua di chi preme il tasto vorrebbe dire
          // un registro con le righe in tre lingue a seconda di chi era
          // in segreteria quel giorno.
          descrizione: 'Rimborso per rimozione dal circolo',
        }); },
      });
      // ⚠️ I due pezzi facoltativi sono a loro volta frasi da tradurre:
      // si passano come valori e si risolvono nella lingua del socio.
      const saldo = (socio.credito ?? 0) > 0
        ? avviso('avv.cir.creditoDaRitirare', { importo: (socio.credito ?? 0).toFixed(2) })
        : (socio.sosUtilizzato ?? 0) > 0
          ? avviso('avv.cir.debitoDaSaldare', { importo: (socio.sosUtilizzato ?? 0).toFixed(2) })
          : '';
      await creaNotifica(
        socio.uid,
        avviso(eOspite ? 'avv.cir.chiusaOspiteCoda' : 'avv.cir.fuoriDaiSociCoda', {
          saldo,
          coda: esito.prenotazioniCancellate > 0
            ? avviso('avv.cir.prenotazioniCancellate', { n: esito.prenotazioniCancellate })
            : '',
        }),
        undefined,
        circoloId,
        // Globale: da questo momento la persona non è più membro del
        // circolo, quindi un avviso legato al circolo non lo leggerebbe.
        true
      );
      setRimozioneAperta(false);
      onClose();
    } catch {
      setErroreRimozione(t('adm.soc.erroreRimozione'));
    } finally {
      setRimuovendo(false);
    }
  };

  const numeroPrenotazioni = (uid: string) => prenotazioni.filter((p) => p.utenteId === uid).length;

  // ⚠️ DALLA CLASSIFICA VERA, non più da un file di contenuti finti.
  // Prima questa riga cercava il socio per nome e cognome dentro
  // `contenutiDemo.ts`, una classifica inventata del solo circolo
  // «milazzo»: per ogni altro circolo la posizione era sempre «-», e
  // per Milazzo era un numero che non veniva da nessuna parte. La
  // posizione sta sulla tessera, la scrive il server dopo ogni sfida,
  // ed è quella che il socio vede nella propria app.
  const posizioneClassifica = (soc: SocioCircolo) => (
    soc.posizioneClassificaSociale != null ? `#${soc.posizioneClassificaSociale}` : '-'
  );

  const confermaRicarica = async () => {
    const v = parseFloat(importo.replace(',', '.'));
    if (!socio || Number.isNaN(v) || v <= 0) return;
    setInviando(true);
    await ricaricaCredito(socio.uid, circoloId, v);
    setInviando(false);
    setRicaricaAperta(false);
    setImporto('');
  };

  const confermaRipristino = async () => {
    if (!socio) return;
    setRipristinando(true);
    await ripristinaSOS(socio.uid, circoloId);
    setRipristinando(false);
    setConfermaRipristinoAperta(false);
  };

  const confermaAzzeraCredito = async () => {
    if (!socio) return;
    setAzzerando(true);
    await azzeraCredito(socio.uid, circoloId);
    await creaNotifica(
      socio.uid,
      avviso('avv.cir.creditoAzzeratoSito', { importo: (socio.credito ?? 0).toFixed(2) }),
      // ⚠️ IL CIRCOLO MANCAVA, e il gemello dell'app lo passava. Senza,
      // l'avviso finisce legato al circolo principale del socio — quello
      // sbagliato, se qui e' Ospite — e la notifica sul telefono perde
      // il nome del club nel titolo.
      undefined,
      circoloId,
    );
    setAzzerando(false);
    setConfermaAzzeraAperta(false);
  };

  return (
    <>
      <Modal visible={!!socio} onClose={onClose}>
        {socio && (
          <>
            <div className="socio-detail-head">
              {socio.fotoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={socio.fotoUrl} alt="" className="socio-detail-avatar" />
              ) : (
                <div className="socio-detail-avatar admin-list-avatar-fallback" style={{ fontSize: '1.4rem' }}>
                  {(socio.nome[0] + socio.cognome[0]).toUpperCase()}
                </div>
              )}
              <div className="admin-modal-title" style={{ marginTop: '.7rem' }}>{socio.nome} {socio.cognome}</div>
              <div className="admin-modal-sub">{socio.email}</div>
              {/* Ruolo per esteso: nell'elenco basta un'etichetta, ma
                  aprendo la scheda l'admin deve sapere con chi ha a
                  che fare. */}
              <div className={`admin-badge-ruolo${socio.ruoloTessera === 'ospite' ? ' admin-badge-ruolo-ospite' : ''}`}>
                {socio.ruoloTessera === 'ospite'
                  ? t('adm.soc.badgeOspite')
                  : t('adm.soc.badgeSocio')}
              </div>
            </div>

            {/* Eta' e racchetta le scrive il socio dall'app: qui si
                leggono e basta. La riga compare solo se ne ha compilata
                almeno una, per non lasciare due trattini nel vuoto. */}
            {(etaDaAnno(socio.annoNascita) != null || socio.racchetta) && (
              <div className="socio-scheda-riga">
                {etaDaAnno(socio.annoNascita) != null && (
                  <span><b>{t('adm.soc.eta')}</b> {t('adm.soc.anni', { anni: etaDaAnno(socio.annoNascita)! })}</span>
                )}
                {socio.racchetta && <span><b>{t('adm.soc.racchetta')}</b> {socio.racchetta}</span>}
              </div>
            )}

            <div className="socio-stats-row">
              <div className="socio-stat-box">
                <div className="socio-stat-val">{numeroPrenotazioni(socio.uid)}</div>
                <div className="socio-stat-label">{t('adm.soc.statPrenotazioni')}</div>
              </div>
              <div className="socio-stat-box">
                <div className="socio-stat-val">{posizioneClassifica(socio)}</div>
                <div className="socio-stat-label">{t('adm.soc.statClassifica')}</div>
              </div>
            </div>

            <div className="socio-credito-row">
              <div>
                <div className="socio-credito-label">{t('adm.soc.credito')}</div>
                <div className="socio-credito-valore">€ {(socio.credito ?? 0).toFixed(2)}</div>
              </div>
              <div className="socio-credito-btns">
                <button className="admin-btn-small" onClick={() => { setImporto(''); setRicaricaAperta(true); }}>
                  {t('adm.soc.ricaricaBtn')}
                </button>
                <button className="admin-btn-danger-small" onClick={() => setConfermaAzzeraAperta(true)}>
                  {t('adm.soc.azzeraCredito')}
                </button>
              </div>
            </div>

            <div className="socio-credito-row">
              <div>
                <div className="socio-credito-label">{t('adm.soc.fido')}</div>
                <div className="socio-credito-valore">
                  <span style={{ color: (socio.sosUtilizzato ?? 0) > 0 ? '#B3261E' : 'var(--inchiostro)' }}>
                    € {socio.sosUtilizzato ?? 0}
                  </span>
                  {/* ⚠️ Il tetto è quello del CIRCOLO, non più uno per socio:
                      arriva come prop dalla dashboard. */}
                  <span>/{fidoIllimitato(limiteFido) ? '∞' : limiteFido}</span>
                </div>
                <div className="socio-debito-hint">
                  {t('adm.soc.debitoVersoCircolo', { importo: socio.sosUtilizzato ?? 0 })}
                </div>
              </div>
              <button
                className="admin-btn-small"
                onClick={() => setConfermaRipristinoAperta(true)}
                disabled={!socio.sosUtilizzato || ripristinando}
                style={!socio.sosUtilizzato ? { opacity: 0.4 } : undefined}
              >
                {t('adm.soc.ripristinoFido')}
              </button>
            </div>

            <div className="socio-sos-box">
              <label className="admin-label">{t('adm.soc.fido')}</label>
              <p className="admin-card-hint" style={{ marginBottom: '.6rem' }}>
                {/* Il nome del pulsante e' dentro la frase: si passa
                    tradotto, cosi' la spiegazione nomina il tasto con
                    le parole che l'admin vede davvero. */}
                {t('adm.soc.fidoSpiegazione', { tasto: t('adm.soc.ripristinoFido') })}
              </p>
              <div className="socio-sos-valore">
                {t('adm.soc.usatoFinora', { importo: (socio.sosUtilizzato ?? 0).toFixed(2) })}
              </div>
            </div>
            {/* ⚠️ QUI STAVA una seconda riga su «Ripristina», tolta il 25
                agosto 2026 insieme alla gemella mobile: diceva la stessa cosa
                del riquadro qui sopra, che adesso nomina il pulsante per
                esteso. */}

            {/* ⚠️ QUI STAVA IL «Limite prenotazioni settimanali
                (personale)», tolto il 25 agosto 2026 per decisione di
                Giorgio, insieme al gemello della dashboard mobile. Dava a
                un singolo socio un limite diverso da quello del circolo, e
                il risultato era che la stessa domanda — «quante ore posso
                prenotare?» — aveva due risposte a seconda di dove la si
                leggeva. Da oggi il limite è UNO SOLO, quello del circolo,
                e si imposta nella sezione «Limite prenotazioni
                settimanali». */}

            <div className="superadmin-subtitolo" style={{ marginTop: '1.4rem' }}>
              {eOspite ? t('adm.soc.qualificaOspite') : t('adm.soc.appartenenzaCircolo')}
            </div>
            <p className="admin-card-hint">
              {eOspite
                ? t('adm.soc.spiegaChiusuraOspite')
                : t('adm.soc.spiegaChiusuraSocio')}
            </p>
            <button className="admin-btn-full admin-btn-danger" onClick={apriRimozione}>
              {etichettaRimozione}
            </button>
          </>
        )}
      </Modal>

      {/* Rimozione dal circolo — sopra la scheda socio */}
      <Modal visible={rimozioneAperta} onClose={() => !rimuovendo && setRimozioneAperta(false)}>
        <div className="admin-modal-title">{etichettaRimozione}?</div>
        <div className="admin-modal-sub">{socio?.nome} {socio?.cognome}</div>
        {/* ⚠️ Si dice PRIMA cosa sta per succedere, con i numeri veri.
            Una rimozione tocca prenotazioni già pagate e un conto
            aperto: chiedere «sei sicuro?» senza dire quanto c'è in
            ballo è chiedere una conferma a chi non sa cosa conferma. */}
        {anteprima === null ? (
          <p className="admin-modal-sub" style={{ marginTop: '.6rem' }}>{t('adm.soc.controlloSituazione')}</p>
        ) : (
          <div style={{ marginTop: '.8rem', display: 'grid', gap: '.35rem' }}>
            <p className="admin-modal-sub" style={{ margin: 0 }}>
              {/* Il pallino resta fuori dalle frasi: e' decorazione,
                  non testo da tradurre. Singolare e plurale sono due
                  chiavi perche' non tutte le lingue spezzano il plurale
                  dove lo spezza l'italiano. */}
              • {anteprima.prenotazioniFuture === 0
                ? t('adm.soc.nessunaPrenotazioneFutura')
                : anteprima.prenotazioniFuture === 1
                  ? t('adm.soc.unaPrenotazioneFutura', { n: 1 })
                  : t('adm.soc.piuPrenotazioniFuture', { n: anteprima.prenotazioniFuture })}
            </p>
            {anteprima.prenotazioniFuture > 0 && (
              <p className="admin-modal-sub" style={{ margin: 0 }}>
                • {t('adm.soc.partitaDivisa')}
              </p>
            )}
            {anteprima.inClassifica && (
              <p className="admin-modal-sub" style={{ margin: 0 }}>
                • {t('adm.soc.esceDallaClassifica')}
              </p>
            )}
            {anteprima.credito > 0 && (
              <p className="admin-modal-sub" style={{ margin: 0 }}>
                • {t('adm.soc.restaCredito', { importo: anteprima.credito.toFixed(2) })}
              </p>
            )}
            {anteprima.debito > 0 && (
              <p className="admin-modal-sub" style={{ margin: 0, color: '#B3261E' }}>
                • {t('adm.soc.restaDebito', { importo: anteprima.debito.toFixed(2) })}
              </p>
            )}
            {(anteprima.credito > 0 || anteprima.debito > 0) && (
              <p className="admin-modal-sub" style={{ margin: 0 }}>
                {t('adm.soc.finiraInTessereDaSaldare')}
              </p>
            )}
          </div>
        )}
        {!!erroreRimozione && <div className="admin-error-text">{erroreRimozione}</div>}
        <div className="admin-modal-btn-row">
          <button className="admin-modal-btn-cancel" onClick={() => setRimozioneAperta(false)} disabled={rimuovendo}>
            {t('com.annulla')}
          </button>
          <button
            className="admin-modal-btn-confirm danger"
            onClick={confermaRimozione}
            disabled={rimuovendo || anteprima === null}
          >
            {rimuovendo ? t('com.attendi') : etichettaRimozione}
          </button>
        </div>
      </Modal>

      {/* Conferma ripristino — sopra la scheda socio */}
      <Modal visible={confermaRipristinoAperta} onClose={() => setConfermaRipristinoAperta(false)}>
        <div className="admin-modal-title">{t('adm.soc.ripristinareCreditoTitolo')}</div>
        <div className="admin-modal-sub">
          {/* Il nome della persona e' un dato: entra nella frase come
              valore, cosi' ogni lingua lo mette dove le serve. */}
          {t('adm.soc.confermaRipristinoTesto', { nome: `${socio?.nome ?? ''} ${socio?.cognome ?? ''}`.trim() })}
        </div>
        <div className="admin-modal-btn-row">
          <button className="admin-modal-btn-cancel" onClick={() => setConfermaRipristinoAperta(false)}>{t('com.annulla')}</button>
          <button className="admin-modal-btn-confirm danger" onClick={confermaRipristino} disabled={ripristinando}>
            {ripristinando ? t('com.attendi') : t('com.conferma')}
          </button>
        </div>
      </Modal>

      {/* Azzera Credito — sopra la scheda socio */}
      <Modal visible={confermaAzzeraAperta} onClose={() => setConfermaAzzeraAperta(false)}>
        <div className="admin-modal-title">
          {t('adm.soc.azzeraCreditoTitolo', { nome: `${socio?.nome ?? ''} ${socio?.cognome ?? ''}`.trim() })}
        </div>
        <div className="admin-modal-sub">
          {t('adm.soc.azzeraCreditoTesto', { importo: (socio?.credito ?? 0).toFixed(2) })}
        </div>
        <div className="admin-modal-btn-row">
          <button className="admin-modal-btn-cancel" onClick={() => setConfermaAzzeraAperta(false)}>{t('com.annulla')}</button>
          <button className="admin-modal-btn-confirm danger" onClick={confermaAzzeraCredito} disabled={azzerando}>
            {azzerando ? t('com.attendi') : t('adm.soc.azzeraCredito')}
          </button>
        </div>
      </Modal>

      {/* Ricarica — sopra la scheda socio */}
      <Modal visible={ricaricaAperta} onClose={() => setRicaricaAperta(false)}>
        <div className="admin-modal-title">{t('adm.soc.ricaricaTitolo')}</div>
        <div className="admin-modal-sub">{socio?.nome} {socio?.cognome}</div>
        <input
          className="admin-input" style={{ marginTop: '1rem', textAlign: 'center' }}
          value={importo} onChange={(e) => setImporto(e.target.value)}
          placeholder={t('adm.soc.importoPlaceholder')} inputMode="decimal" autoFocus
        />
        <div className="admin-modal-btn-row">
          <button className="admin-modal-btn-cancel" onClick={() => setRicaricaAperta(false)}>{t('com.annulla')}</button>
          <button className="admin-modal-btn-confirm" onClick={confermaRicarica} disabled={inviando}>
            {inviando ? t('com.attendi') : t('adm.soc.ricarica')}
          </button>
        </div>
      </Modal>


    </>
  );
}
