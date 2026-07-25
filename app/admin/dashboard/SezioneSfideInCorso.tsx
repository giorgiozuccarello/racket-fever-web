'use client';

import { useEffect, useState } from 'react';
import { SocioCircolo } from '../../../data/users';
import { Sfida, concludiSfida, annullaSfida, notificaSfidaConRitentativi } from '../../../data/sfide';
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

export default function SezioneSfideInCorso({ sfide, soci }: { sfide: Sfida[]; soci: SocioCircolo[] }) {
  const [daConcludere, setDaConcludere] = useState<Sfida | null>(null);
  const [vincitoreScelto, setVincitoreScelto] = useState<string | null>(null);
  const [concludendo, setConcludendo] = useState(false);
  const [confermaAnnullaAperta, setConfermaAnnullaAperta] = useState(false);
  const [annullando, setAnnullando] = useState(false);
  const [annullamentoFatto, setAnnullamentoFatto] = useState(false);

  const attive = sfide
    .filter((sf) => sf.stato === 'lanciata' || sf.stato === 'accettata' || sf.stato === 'rinviata')
    .sort((a, b) => (a.creataIl?.seconds ?? 0) - (b.creataIl?.seconds ?? 0));

  // Ogni riga è cliccabile, qualunque sia lo stato — non solo quelle
  // accettate: prima le sfide "in attesa" o "rimandate" non aprivano
  // nulla, ora mostrano sempre le loro informazioni.
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
  };

  const confermaConclusione = async () => {
    if (!daConcludere || !vincitoreScelto) return;
    setConcludendo(true);
    try {
      const applicata = await concludiSfida(daConcludere.id, daConcludere.sfidanteId, daConcludere.sfidatoId, vincitoreScelto, soci, 'accettata');
      if (applicata) {
        const vinceSfidante = vincitoreScelto === daConcludere.sfidanteId;
        const nomeVincitore = vinceSfidante
          ? `${daConcludere.sfidanteNome} ${daConcludere.sfidanteCognome}`
          : `${daConcludere.sfidatoNome} ${daConcludere.sfidatoCognome}`;
        await notificaSfidaConRitentativi(
          daConcludere.sfidanteId,
          vinceSfidante
            ? 'Il circolo ha confermato: hai vinto la sfida! La tua posizione in classifica è stata aggiornata.'
            : `Il circolo ha confermato: ${nomeVincitore} ha vinto la sfida. La classifica è stata aggiornata di conseguenza.`
        );
        await notificaSfidaConRitentativi(
          daConcludere.sfidatoId,
          !vinceSfidante
            ? 'Il circolo ha confermato: hai vinto la sfida! La classifica resta invariata (eri già nella posizione migliore).'
            : `Il circolo ha confermato: ${nomeVincitore} ha vinto la sfida. La tua posizione in classifica è stata aggiornata.`
        );
        alert('Sfida conclusa e classifica aggiornata ✓');
        setDaConcludere(null);
      } else {
        alert('Questa sfida è già stata gestita nel frattempo (da un altro dispositivo, o per scadenza).');
        setDaConcludere(null);
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
      await annullaSfida(daConcludere);
      setConfermaAnnullaAperta(false);
      setDaConcludere(null);
      setAnnullamentoFatto(true);
    } catch {
      alert('Errore di connessione. Riprova.');
    } finally {
      setAnnullando(false);
    }
  };

  return (
    <div className="admin-card">
      <div className="admin-card-title">Sfide in Corso</div>
      <p className="admin-card-hint">
        Dal lancio alla conclusione — qui trovi anche le eventuali discrepanze tra i due risultati dichiarati.
      </p>

      {attive.length === 0 && <p className="admin-empty-text">Nessuna sfida in corso al momento.</p>}

      {attive.map((sf) => {
        const slotScelto = sf.slotSceltoIndex != null ? sf.proposte[sf.slotSceltoIndex] : null;
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
              {sf.stato === 'rinviata' && (
                <div className="admin-list-sub">Rimandata — nessuno slot compatibile trovato</div>
              )}
              {sf.stato === 'lanciata' && (
                <>
                  <div className="admin-list-sub">In attesa che lo sfidato scelga un orario</div>
                  {!!sf.scadenzaAccettazione && <CountdownAdmin scadenza={sf.scadenzaAccettazione} />}
                </>
              )}
              {sf.stato === 'accettata' && slotScelto && (
                <>
                  <div className="admin-list-sub">
                    {slotScelto.dataLabel} · {slotScelto.campoNome} · {slotScelto.orari[0]} - {slotScelto.orari[2]}
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

      <Modal visible={!!daConcludere} onClose={() => setDaConcludere(null)}>
        <div className="admin-modal-title">
          {daConcludere?.stato === 'accettata' ? 'Concludi la sfida' : 'Info Sfida'}
        </div>
        <p className="admin-card-hint" style={{ textAlign: 'center' }}>
          {daConcludere?.sfidanteNome} {daConcludere?.sfidanteCognome} vs {daConcludere?.sfidatoNome} {daConcludere?.sfidatoCognome}
        </p>

        <div style={{ background: '#F7F4EA', borderRadius: 10, padding: '.8rem', marginTop: '.7rem' }}>
          <div className="admin-list-sub">
            Posizioni al lancio: {daConcludere?.sfidanteNome} #{daConcludere?.posizioneSfidante} · {daConcludere?.sfidatoNome} #{daConcludere?.posizioneSfidato}
          </div>
          <div className="admin-list-sub">
            Stato: {daConcludere?.stato === 'lanciata' ? 'In attesa di risposta'
              : daConcludere?.stato === 'accettata' ? 'Accettata, in attesa del risultato'
              : daConcludere?.stato === 'rinviata' ? 'Rimandata' : daConcludere?.stato}
          </div>

          {daConcludere?.stato === 'lanciata' && (
            <>
              {!!daConcludere.scadenzaAccettazione && <CountdownAdmin scadenza={daConcludere.scadenzaAccettazione} />}
              <div className="admin-list-sub" style={{ fontWeight: 700, marginTop: '.4rem' }}>Orari proposti:</div>
              {daConcludere.proposte.map((p, idx) => (
                <div key={idx} className="admin-list-sub">
                  · {p.dataLabel} · {p.campoNome} · {p.orari[0]} - {p.orari[2]}
                </div>
              ))}
            </>
          )}

          {daConcludere?.stato === 'accettata' && daConcludere.slotSceltoIndex != null && (
            <div className="admin-list-sub" style={{ fontWeight: 700 }}>
              {daConcludere.proposte[daConcludere.slotSceltoIndex]?.dataLabel} · {daConcludere.proposte[daConcludere.slotSceltoIndex]?.campoNome} · {daConcludere.proposte[daConcludere.slotSceltoIndex]?.orari[0]} - {daConcludere.proposte[daConcludere.slotSceltoIndex]?.orari[2]}
            </div>
          )}

          {daConcludere?.stato === 'rinviata' && (
            <div className="admin-list-sub">{daConcludere.motivoRinvio ?? 'Nessuno slot compatibile trovato nei 14 giorni di ricerca.'}</div>
          )}
        </div>

        {daConcludere?.stato === 'accettata' && (
          <>
            <label className="admin-label" style={{ marginTop: '.9rem' }}>Chi ha vinto?</label>
            <div
              className="admin-list-row admin-list-row-clickable"
              onClick={() => setVincitoreScelto(daConcludere?.sfidanteId ?? null)}
            >
              <input type="radio" checked={vincitoreScelto === daConcludere?.sfidanteId} onChange={() => {}} style={{ marginRight: '.6rem' }} />
              <span>{daConcludere?.sfidanteNome} {daConcludere?.sfidanteCognome} (sfidante)</span>
            </div>
            <div
              className="admin-list-row admin-list-row-clickable"
              onClick={() => setVincitoreScelto(daConcludere?.sfidatoId ?? null)}
            >
              <input type="radio" checked={vincitoreScelto === daConcludere?.sfidatoId} onChange={() => {}} style={{ marginRight: '.6rem' }} />
              <span>{daConcludere?.sfidatoNome} {daConcludere?.sfidatoCognome} (sfidato)</span>
            </div>
          </>
        )}

        {(daConcludere?.stato === 'lanciata' || daConcludere?.stato === 'accettata') && (
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
            {daConcludere?.stato === 'accettata' ? 'Annulla' : 'Chiudi'}
          </button>
          {daConcludere?.stato === 'accettata' && (
            <button
              className="admin-modal-btn-confirm"
              onClick={confermaConclusione}
              disabled={!vincitoreScelto || concludendo}
            >
              {concludendo ? 'Attendere…' : 'Dichiara Sfida Conclusa'}
            </button>
          )}
        </div>
      </Modal>

      <Modal visible={confermaAnnullaAperta} onClose={() => setConfermaAnnullaAperta(false)}>
        <div className="admin-modal-title">Annullare questa sfida?</div>
        <p className="admin-card-hint" style={{ textAlign: 'center' }}>
          {daConcludere?.sfidanteNome} {daConcludere?.sfidanteCognome} vs {daConcludere?.sfidatoNome} {daConcludere?.sfidatoCognome}
          <br /><br />
          Le eventuali tre mezz&apos;ore prenotate verranno liberate, entrambi i soci saranno avvisati.
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
          Gli slot prenotati sono stati liberati, entrambi i soci sono stati avvisati.
          La classifica non è stata toccata.
        </p>
        <button className="admin-btn-full" style={{ marginTop: '1rem' }} onClick={() => setAnnullamentoFatto(false)}>
          Chiudi
        </button>
      </Modal>
    </div>
  );
}
