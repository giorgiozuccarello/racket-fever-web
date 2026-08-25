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
      {/* ⚠️ Il massimo è 16 ore e non più 48 (decisione di Giorgio del 25
          agosto 2026), identico alla dashboard mobile. Quarantotto ore in
          una settimana non sono un limite: metà corsa dello slider serviva
          a valori che nessun circolo avrebbe mai messo, e la metà utile —
          da due a otto ore — stava schiacciata in pochi pixel.
          Il passo resta di 2 ore, come prima. */}
      <input
        className="admin-slider" type="range" min={0} max={16} step={2}
        value={valore}
        onChange={(e) => setValore(Number(e.target.value))}
        onMouseUp={() => salva(valore)}
        onTouchEnd={() => salva(valore)}
      />
      {salvando && <div className="admin-saving">Salvataggio…</div>}
    </div>
  );
}
