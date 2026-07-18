'use client';

import { useState } from 'react';
import { Circolo } from '../../../data/circoli';
import { aggiornaCircolo } from '../../../data/circoliRepo';

export default function SezioneLimite({ circolo }: { circolo: Circolo }) {
  const [valore, setValore] = useState(circolo.limiteOreSettimanali);
  const [salvando, setSalvando] = useState(false);

  const salva = async (v: number) => {
    setSalvando(true);
    await aggiornaCircolo(circolo.id, { limiteOreSettimanali: v });
    setSalvando(false);
  };

  return (
    <div className="admin-card">
      <div className="admin-card-title">Limite prenotazioni settimanali</div>
      <p className="admin-card-hint">
        Numero massimo di ore che ogni socio può prenotare in una settimana.
      </p>
      <div className="admin-slider-value">
        {valore === 0 ? 'Nessun limite' : `${valore} ${valore === 1 ? 'ora' : 'ore'} / settimana`}
      </div>
      <input
        className="admin-slider" type="range" min={0} max={10} step={1}
        value={valore}
        onChange={(e) => setValore(Number(e.target.value))}
        onMouseUp={() => salva(valore)}
        onTouchEnd={() => salva(valore)}
      />
      {salvando && <div className="admin-saving">Salvataggio…</div>}
    </div>
  );
}
