'use client';

import { useEffect, useState } from 'react';
import {
  Circolo, FIDO_PASSO, FIDO_SLIDER_MAX,
  limiteFidoDi, fidoDaSlider, fidoASlider, fidoIllimitato, etichettaFido,
} from '../../../data/circoli';
import { aggiornaCircolo } from '../../../data/circoliRepo';

// ⚠️ GEMELLA della SezioneFido nella dashboard mobile: stessi testi,
// stessi scatti, stesso significato dei valori limite. Se cambia una,
// cambia l'altra — è un numero solo e non può avere due spiegazioni.
export default function SezioneFido({ circolo }: { circolo: Circolo }) {
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
      <div className="admin-card-title">Fido</div>
      <p className="admin-card-hint">
        Quanto può andare a debito un socio quando il credito non basta a pagare una
        prenotazione. Il debito si salda in segreteria — lo azzeri dalla scheda del socio,
        con «Ripristino del Fido». È lo stesso numero per tutti i soci.
      </p>

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
        {etichettaFido(limite)}
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
          ? 'Nessun tetto: un socio può prenotare a debito senza fine. Usalo solo se sai perché.'
          : limite <= 0
            ? 'Nessun Fido: chi non ha credito a sufficienza non riesce a prenotare e viene mandato in segreteria.'
            : `Ogni socio può arrivare a € ${limite} di debito. Oltre, la prenotazione si ferma.`}
      </p>
      {salvando && <div className="admin-saving">Salvataggio…</div>}
    </div>
  );
}
