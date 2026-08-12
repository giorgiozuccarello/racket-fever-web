'use client';

import { useState } from 'react';
import { Circolo } from '../../../data/circoli';
import { Sfida, resettaSfideTest } from '../../../data/sfide';
import { resettaSociTest } from '../../../data/tessere';
import Modal from './Modal';

// Strumenti di reset per le sessioni di prova. Riuniti in un'unica
// sezione, in cima alla dashboard, perche' sono operazioni distruttive
// e devono essere facili da trovare quando servono — e altrettanto
// facili da rimuovere prima del lancio.
export default function SezioneTestReset({ circolo, sfide }: { circolo: Circolo; sfide: Sfida[] }) {
  const [confermaSfide, setConfermaSfide] = useState(false);
  const [confermaSoci, setConfermaSoci] = useState(false);
  const [resettando, setResettando] = useState(false);
  const [errore, setErrore] = useState('');
  const [esito, setEsito] = useState('');

  const resetSfide = async () => {
    setErrore(''); setResettando(true);
    try {
      await resettaSfideTest(circolo.id, sfide);
      setEsito('Sfide azzerate — puoi ripartire con i test.');
      setConfermaSfide(false);
    } catch (e: any) {
      setErrore(e?.message ?? 'Errore sconosciuto — controlla la connessione e riprova.');
    } finally {
      setResettando(false);
    }
  };

  const resetSoci = async () => {
    setErrore(''); setResettando(true);
    try {
      const r = await resettaSociTest(circolo.id);
      setEsito(`Azzerati ${r.tessereAzzerate} portafogli · ${r.prenotazioniCancellate} prenotazioni, ${r.movimentiCancellati} movimenti, ${r.avvisiCancellati} avvisi, ${r.sfideCancellate} sfide e ${r.richiesteCancellate} richieste di lezione cancellate.${r.richiesteFallite === -1 ? ' ⚠️ Le richieste di lezione non si sono potute leggere: controlla che le regole Firestore siano pubblicate.' : r.richiesteFallite > 0 ? ` ⚠️ ${r.richiesteFallite} richieste di lezione non cancellate.` : ''}`);
      setConfermaSoci(false);
    } catch (e: any) {
      setErrore(e?.message ?? 'Errore sconosciuto — controlla la connessione e riprova.');
    } finally {
      setResettando(false);
    }
  };

  return (
    <div className="admin-card">
      <div className="admin-card-title">Test Reset</div>
      <p className="admin-card-hint">
        Operazioni distruttive, pensate per ripartire puliti fra due sessioni di
        prova. Da rimuovere prima del lancio.
      </p>

      {!!esito && <div className="admin-esito-ok">{esito}</div>}

      <button className="admin-btn-reset" onClick={() => { setEsito(''); setConfermaSoci(true); }}>
        <strong>Reset Completo Soci</strong>
        <span>Azzera portafogli, prenotazioni, movimenti, avvisi, sfide e lezioni</span>
      </button>

      <button className="admin-btn-reset" onClick={() => { setEsito(''); setConfermaSfide(true); }}>
        <strong>Reset Sfide</strong>
        <span>Cancella tutte le sfide e le prenotazioni collegate</span>
      </button>

      <Modal visible={confermaSoci} onClose={() => setConfermaSoci(false)}>
        <div className="admin-modal-title">Reset Completo Soci</div>
        <p className="admin-modal-sub">
          Per TUTTI i Soci/Tesserati e gli Ospiti di questo circolo azzera credito e
          debito, e cancella prenotazioni, movimenti del registro, avvisi, sfide e
          richieste di lezione con le relative chat — comprese le prenotazioni passate.
        </p>
        <p className="admin-modal-sub" style={{ marginTop: '.5rem', fontWeight: 800, color: '#B3261E' }}>
          Nessuno viene rimosso dal circolo e le posizioni in classifica restano
          invariate. L&apos;operazione non si può annullare.
        </p>
        {!!errore && <p className="admin-errore">{errore}</p>}
        <div className="admin-modal-btn-row">
          <button className="admin-modal-btn-cancel" onClick={() => setConfermaSoci(false)} disabled={resettando}>
            Annulla
          </button>
          <button className="admin-modal-btn-confirm danger" onClick={resetSoci} disabled={resettando}>
            {resettando ? 'Attendere…' : 'Reset Completo'}
          </button>
        </div>
      </Modal>

      <Modal visible={confermaSfide} onClose={() => setConfermaSfide(false)}>
        <div className="admin-modal-title">Reset Sfide</div>
        <p className="admin-modal-sub">
          Cancella TUTTE le sfide di questo circolo, comprese quelle già concluse, e le
          prenotazioni collegate. Le posizioni in classifica NON vengono toccate.
        </p>
        {!!errore && <p className="admin-errore">{errore}</p>}
        <div className="admin-modal-btn-row">
          <button className="admin-modal-btn-cancel" onClick={() => setConfermaSfide(false)} disabled={resettando}>
            Annulla
          </button>
          <button className="admin-modal-btn-confirm danger" onClick={resetSfide} disabled={resettando}>
            {resettando ? 'Attendere…' : 'Reset Sfide'}
          </button>
        </div>
      </Modal>
    </div>
  );
}
