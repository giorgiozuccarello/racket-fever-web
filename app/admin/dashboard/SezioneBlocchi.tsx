'use client';

import { useState } from 'react';
import { Campo, Blocco } from '../../../data/circoli';
import { rimuoviBlocco } from '../../../data/circoliRepo';
import { useLingua } from '../../../lib/lingua';
import Modal from './Modal';

// ============================================================
// ORARI RISERVATI — sola consultazione e rimozione.
//
// ⚠️ RISCRITTA IL 24 AGOSTO 2026 per allinearla al mobile, che era
// avanti di un sistema intero. Qui c'era ancora il modo vecchio:
// scegli il campo, «Ogni settimana» oppure «Data singola», i sette
// chip dei giorni, due tendine per l'ora di inizio e di fine,
// l'etichetta, la casella «Nascondi informazioni», più una finestra di
// modifica con gli stessi campi in duplicato. Ottanta righe di modulo
// per dire una cosa che sulla griglia si dice con un dito.
//
// La CREAZIONE non avviene più qui: si fa dalla griglia (sezione
// Prenotazione Campi), tenendo premuto su uno slot libero, estendendo
// la selezione agli slot accanto e scegliendo «Riserva». È più
// immediato che compilare date e orari a mano, e soprattutto si vede
// subito cosa è già occupato — che è proprio l'informazione che manca
// quando si scrive un orario dentro una tendina.
//
// ⚠️ Le RICORRENZE settimanali non si creano più, né qui né altrove.
// Quelle già esistenti restano visibili e rimovibili qui sotto, con
// l'etichetta che dice da dove vengono: cancellarle d'ufficio avrebbe
// riaperto alla prenotazione ore che qualche circolo tiene chiuse da
// mesi.
//
// ⚠️ È caduta anche «Nascondi informazioni sulla griglia», che sul
// mobile non è mai esistita: decisione di Giorgio, «lasciamo morire».
// I blocchi che ce l'hanno già la conservano — il campo si continua a
// leggere — ma non se ne creano più.
// ============================================================

// ⚠️ Le CHIAVI dei giorni, non i nomi: l'elenco era una costante di
// stringhe italiane fuori dal componente, e li' dentro il traduttore
// non arriva. L'ordine e' quello di `Date.getDay()` — 0 e' domenica —
// e non va toccato: e' l'indice con cui il blocco salva i giorni.
// Si riusano le forme corte comuni (`com.g.*`), le stesse della griglia.
const CHIAVI_GIORNI = [
  'com.g.dom', 'com.g.lun', 'com.g.mar', 'com.g.mer', 'com.g.gio', 'com.g.ven', 'com.g.sab',
] as const;

export default function SezioneBlocchi({ circoloId, campi, blocchi }: {
  circoloId: string; campi: Campo[]; blocchi: Blocco[];
}) {
  const { t } = useLingua();
  const [daRimuovere, setDaRimuovere] = useState<Blocco | null>(null);
  const [inCorso, setInCorso] = useState(false);
  const [errore, setErrore] = useState('');

  const oggi = new Date().toISOString().slice(0, 10);

  // I blocchi su data passata non servono più: restano nel database ma
  // non ingombrano l'elenco. Le ricorrenti non hanno data e finiscono
  // in fondo, per via della chiave di ripiego.
  const visibili = blocchi
    .filter((b) => b.tipo === 'ricorrente' || !b.data || b.data >= oggi)
    .sort((a, b) => (a.data ?? '9999').localeCompare(b.data ?? '9999'));

  const conferma = async () => {
    if (!daRimuovere || inCorso) return;
    setInCorso(true);
    setErrore('');
    try {
      await rimuoviBlocco(circoloId, daRimuovere.id);
      setDaRimuovere(null);
    } catch {
      setErrore(t('adm.blo.erroreRimozione'));
    } finally {
      setInCorso(false);
    }
  };

  return (
    <div className="admin-card">
      <div className="admin-card-title">{t('adm.blo.titolo')}</div>
      <p className="admin-card-hint">{t('adm.blo.hint')}</p>

      {visibili.length === 0 && (
        <p className="admin-empty-text">{t('adm.blo.nessunOrario')}</p>
      )}

      {visibili.map((b) => {
        const campo = campi.find((c) => c.id === b.campoId);
        const quando = b.tipo === 'ricorrente'
          ? t('adm.blo.ogniGiorni', {
            giorni: (b.giorniSettimana ?? []).map((g) => t(CHIAVI_GIORNI[g])).join(', '),
          })
          : b.data ?? '';
        return (
          <div key={b.id} className="admin-list-row">
            <div style={{ flex: 1 }}>
              <div className="admin-list-main">{b.etichetta}</div>
              <div className="admin-list-sub">
                {campo?.nome ?? t('adm.blo.campoRimosso')} · {quando} · {b.orarioInizio}–{b.orarioFine}
              </div>
              {!!b.descrizione && (
                <div className="admin-list-sub" style={{ fontStyle: 'italic' }}>{b.descrizione}</div>
              )}
              {b.tipo === 'ricorrente' && (
                <div className="admin-list-sub" style={{ color: '#8A6200', fontWeight: 700 }}>
                  {t('adm.blo.ricorrenteVecchio')}
                </div>
              )}
            </div>
            <button className="admin-btn-piccolo-rosso" onClick={() => setDaRimuovere(b)}>
              {t('adm.blo.rimuovi')}
            </button>
          </div>
        );
      })}

      <Modal visible={!!daRimuovere} onClose={() => setDaRimuovere(null)}>
        <div className="admin-modal-title">{t('adm.blo.confermaTitolo')}</div>
        <p className="admin-card-hint">
          {daRimuovere?.etichetta} · {daRimuovere?.orarioInizio}–{daRimuovere?.orarioFine}
        </p>
        <p className="admin-card-hint">{t('adm.blo.slotTornanoLiberi')}</p>
        {!!errore && <div className="admin-error-text">{errore}</div>}
        <div className="admin-modal-btn-row">
          <button className="admin-modal-btn-cancel" onClick={() => setDaRimuovere(null)} disabled={inCorso}>
            {t('com.annulla')}
          </button>
          <button className="admin-btn-danger" onClick={conferma} disabled={inCorso}>
            {inCorso ? t('com.attendi') : t('adm.blo.rimuovi')}
          </button>
        </div>
      </Modal>
    </div>
  );
}
