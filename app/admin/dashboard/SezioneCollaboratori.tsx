'use client';

import { useEffect, useState } from 'react';
import { ascoltaPasswordCollaboratore, impostaPasswordCollaboratore } from '../../../data/circoliRepo';
import { sessioniAperteDelCircolo, revocaSessioniDelCircolo } from '../../../data/collaboratori';
import { useLingua } from '../../../lib/lingua';

export default function SezioneCollaboratori({ circoloId }: { circoloId: string }) {
  const { t } = useLingua();
  const [passwordAttuale, setPasswordAttuale] = useState<string | null>(null);
  const [pass, setPass] = useState('');
  const [caricato, setCaricato] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [ok, setOk] = useState(false);
  const [aperte, setAperte] = useState<number | null>(null);
  const [revocando, setRevocando] = useState(false);
  const [confermaRevoca, setConfermaRevoca] = useState(false);

  // Quante sessioni sono attive adesso. Non e' un ascolto in tempo
  // reale: e' un dato che si guarda quando si apre la sezione, non un
  // cruscotto — e un onSnapshot su questa collezione la terrebbe
  // aperta in lettura per tutta la durata della Dashboard.
  const contaSessioni = () => {
    sessioniAperteDelCircolo(circoloId)
      .then((elenco) => setAperte(elenco.length))
      // Un Collaboratore non ha il permesso di leggerle: e' voluto, e
      // qui vuol dire semplicemente non mostrare il riquadro.
      .catch(() => setAperte(null));
  };
  useEffect(contaSessioni, [circoloId]);

  useEffect(() => {
    const unsub = ascoltaPasswordCollaboratore(circoloId, (p) => {
      setPasswordAttuale(p);
      setCaricato((giaCaricato) => {
        if (!giaCaricato) setPass(p ?? '');
        return true;
      });
    });
    return unsub;
  }, [circoloId]);

  const salva = async () => {
    if (!pass.trim()) return;
    setSalvando(true);
    await impostaPasswordCollaboratore(circoloId, pass);
    setSalvando(false);
    setOk(true);
    setTimeout(() => setOk(false), 2000);
  };

  return (
    <div className="admin-card">
      <div className="admin-card-title">{t('adm.cob.titolo')}</div>
      <p className="admin-card-hint">{t('adm.cob.hint')}</p>
      <div className="admin-row">
        <input
          className="admin-input" value={pass}
          onChange={(e) => setPass(e.target.value)} autoCapitalize="none"
          placeholder={t('adm.cob.phPassword')}
        />
        <button className="admin-btn-small" onClick={salva} disabled={salvando}>
          {ok ? t('adm.cob.salvato') : passwordAttuale ? t('adm.cob.aggiorna') : t('adm.cob.attiva')}
        </button>
      </div>
      {!passwordAttuale && caricato && (
        <p className="admin-card-hint" style={{ marginTop: '.5rem' }}>
          {t('adm.cob.nonAttivata')}
        </p>
      )}

      {aperte !== null && (
        <>
          <div className="superadmin-subtitolo">{t('adm.cob.accessiInCorso')}</div>
          {/* ⚠️ Tre frasi intere e non un pezzo cucito addosso a un
              numero: «C'è 1» e «Ci sono 2» cambiano il verbo, e in
              tedesco cambia anche il resto della frase. */}
          <p className="admin-card-hint">
            {aperte === 0
              ? t('adm.cob.nessunoCollegato')
              : aperte === 1
                ? t('adm.cob.unAccessoAperto')
                : t('adm.cob.piuAccessiAperti', { quanti: aperte })}
            {' '}{t('adm.cob.notaScadenza')}
          </p>
          <button
            className="admin-btn-full admin-btn-danger"
            onClick={() => setConfermaRevoca(true)}
            disabled={revocando || aperte === 0}
          >
            {revocando ? t('adm.cob.chiusuraInCorso') : t('adm.cob.chiudiSubitoTutti')}
          </button>
        </>
      )}

      {confermaRevoca && (
        <div className="admin-modal-backdrop" onClick={() => setConfermaRevoca(false)}>
          <div className="admin-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="admin-modal-title">{t('adm.cob.confermaTitolo')}</div>
            <p className="admin-modal-sub">{t('adm.cob.confermaTesto')}</p>
            <div className="admin-modal-btn-row">
              <button className="admin-modal-btn-cancel" onClick={() => setConfermaRevoca(false)}>{t('com.indietro')}</button>
              <button
                className="admin-modal-btn-confirm danger"
                onClick={async () => {
                  setConfermaRevoca(false);
                  setRevocando(true);
                  try { await revocaSessioniDelCircolo(circoloId); } finally {
                    setRevocando(false);
                    contaSessioni();
                  }
                }}
              >
                {t('adm.cob.chiudiTutti')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
