'use client';

import { useState } from 'react';
import { PrenotazioneAdmin } from '../../../data/prenotazioniRepo';
import { fasciaOraria } from '../../../data/circoli';
import Modal from './Modal';
import { useLingua } from '../../../lib/lingua';

export default function SezioneNotePrenotazioni({ prenotazioni }: { prenotazioni: PrenotazioneAdmin[] }) {
  const { t } = useLingua();
  const [selezionata, setSelezionata] = useState<PrenotazioneAdmin | null>(null);
  const oggi = new Date().toISOString().slice(0, 10);
  const conNote = prenotazioni
    .filter((p) => !!p.note && p.data >= oggi)
    .sort((a, b) => (a.data + a.orario).localeCompare(b.data + b.orario));

  return (
    <div className="admin-card">
      <div className="admin-card-title">{t('adm.not.titolo')}</div>
      <p className="admin-card-hint">{t('adm.not.hint')}</p>

      {conNote.length === 0 && <p className="admin-empty-text">{t('adm.not.nessunaNota')}</p>}

      {conNote.map((p) => (
        <div
          key={p.id} className="admin-list-row admin-list-row-clickable"
          onClick={() => setSelezionata(p)}
        >
          <div style={{ flex: 1 }}>
            {/* ⚠️ `dataLabel` NON passa da `t()` e non deve passarci: è
                l'etichetta di data che è stata SCRITTA dentro la
                prenotazione su Firestore nel momento in cui il socio
                l'ha fatta, e resta scritta così per sempre. Tradurla
                alla lettura vorrebbe dire rileggere e reinterpretare
                una frase già salvata. Il nome del campo e i nomi delle
                persone sono dati anche loro. */}
            <div className="admin-list-main">{p.utenteNome} {p.utenteCognome}</div>
            <div className="admin-list-sub">{p.campoNome} · {p.dataLabel} {fasciaOraria(p.orario)}</div>
          </div>
        </div>
      ))}

      <Modal visible={!!selezionata} onClose={() => setSelezionata(null)}>
        <div className="admin-modal-title">{t('adm.not.modaleTitolo')}</div>
        <div className="admin-modal-sub">
          {selezionata?.utenteNome} {selezionata?.utenteCognome}
          <br />
          {selezionata?.campoNome} · {selezionata?.dataLabel} {selezionata ? fasciaOraria(selezionata.orario) : ''}
        </div>
        {/* La nota è scritta dal socio: è un dato, resta come l'ha
            scritta lui. Tradotto è solo il giro di parole che la
            introduce. */}
        <p style={{ marginTop: '1rem', lineHeight: 1.5 }}>
          {t('adm.not.introNota')} {selezionata?.note}
        </p>
        <button className="admin-modal-btn-cancel" onClick={() => setSelezionata(null)} style={{ marginTop: '1rem' }}>
          {t('com.chiudi')}
        </button>
      </Modal>
    </div>
  );
}
