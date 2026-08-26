'use client';

import { useEffect, useState } from 'react';
import {
  Circolo, FIDO_PASSO, FIDO_SLIDER_MAX,
  limiteFidoDi, fidoDaSlider, fidoASlider, fidoIllimitato,
} from '../../../data/circoli';
import { aggiornaCircolo } from '../../../data/circoliRepo';
import { useLingua } from '../../../lib/lingua';

// ⚠️ GEMELLA della SezioneFido nella dashboard mobile: stessi testi,
// stessi scatti, stesso significato dei valori limite. Se cambia una,
// cambia l'altra — è un numero solo e non può avere due spiegazioni.
export default function SezioneFido({ circolo }: { circolo: Circolo }) {
  const { t } = useLingua();
  const [posizione, setPosizione] = useState(fidoASlider(limiteFidoDi(circolo)));
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    setPosizione(fidoASlider(limiteFidoDi(circolo)));
  }, [circolo.limiteFido]);

  const salva = async (v: number) => {
    setSalvando(true);
    try {
      await aggiornaCircolo(circolo.id, { limiteFido: fidoDaSlider(v) });
    } finally {
      setSalvando(false);
    }
  };

  const limite = fidoDaSlider(posizione);
  const illimitato = fidoIllimitato(limite);

  return (
    <div className="admin-card">
      <div className="admin-card-title">{t('adm.fid.titolo')}</div>
      <p className="admin-card-hint">{t('adm.fid.hint')}</p>

      {/* ⚠️ «Illimitato» su fondo evidenziato, e non è decorazione: è
          l'ultimo scatto dello slider, quello in cui si finisce
          spingendo il pomello fino in fondo senza guardare. Un numero
          in più e un tetto tolto del tutto si assomigliano troppo per
          essere scritti nello stesso modo. */}
      <div
        className="admin-slider-value"
        style={illimitato ? {
          color: '#B3261E', background: '#FDECEA', border: '1px solid #F0B7B1',
          borderRadius: 10, padding: '3px 10px', display: 'inline-block',
        } : undefined}
      >
        {/* ⚠️ NON si chiama piu' `etichettaFido()` di `data/circoli.ts`:
            quella funzione compone la frase in italiano ed e' condivisa
            con l'app e con le Cloud Functions, che questa tornata non
            tocca. La stessa scaletta — illimitato, spento, cifra per
            socio — vive adesso qui con le frasi tradotte. Se di là
            cambia, va cambiata anche qui: sono tre righe, e
            l'alternativa era una pastiglia in italiano in mezzo a una
            scheda tedesca. */}
        {illimitato
          ? t('adm.fid.illimitato')
          : limite <= 0
            ? t('adm.fid.spento')
            : t('adm.fid.perSocio', { quanto: limite })}
      </div>

      <input
        className="admin-slider" type="range"
        min={0} max={FIDO_SLIDER_MAX} step={FIDO_PASSO}
        value={posizione}
        onChange={(e) => setPosizione(Number(e.target.value))}
        onMouseUp={() => salva(posizione)}
        onTouchEnd={() => salva(posizione)}
        onKeyUp={() => salva(posizione)}
      />

      <p className="admin-card-hint">
        {illimitato
          ? t('adm.fid.spiegaIllimitato')
          : limite <= 0
            ? t('adm.fid.spiegaSpento')
            : t('adm.fid.spiegaLimite', { quanto: limite })}
      </p>
      {salvando && <div className="admin-saving">{t('com.salvataggio')}</div>}
    </div>
  );
}
