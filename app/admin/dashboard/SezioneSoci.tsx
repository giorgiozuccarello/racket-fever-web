'use client';

import { useState } from 'react';
import { SocioCircolo } from '../../../data/users';

// ⚠️ Titolo e descrizione stanno QUI, accanto alla sezione che
// descrivono, e non nel punto in cui viene montata. Sono montate in due
// posti diversi — dentro la Panoramica per il presidente, sciolte per
// il Collaboratore — e finche' le stringhe erano scritte a mano in
// tutti e due, cambiarne una voleva dire due sezioni con lo stesso
// contenuto e due nomi diversi a seconda di chi guarda. Oggi il posto è
// uno solo — la Panoramica, per tutti — ma le costanti restano: è il
// modo giusto di tenerle comunque.
export const ETICHETTA_SOCI = {
  titolo: 'Soci/Tesserati e Ospiti',
  descrizione: 'Anagrafica e credito di Soci/Tesserati e Ospiti',
};

export default function SezioneSoci({ soci, onSelezionaSocio }: {
  soci: SocioCircolo[]; onSelezionaSocio: (uid: string) => void;
}) {
  const [filtro, setFiltro] = useState('');

  const risultati = filtro.trim().length === 0 ? [] : soci
    .filter((soc) => (soc.nome + ' ' + soc.cognome + ' ' + soc.email).toLowerCase().includes(filtro.trim().toLowerCase()))
    .slice(0, 8);

  return (
    <div className="admin-card">
      <div className="admin-card-title">Soci/Tesserati e Ospiti</div>
      <p className="admin-card-hint">
        Cerca un Socio/Tesserato o un Ospite per vedere il suo profilo, ricaricare il credito o
        impostare il Fido
      </p>

      <input
        className="admin-input" value={filtro} onChange={(e) => setFiltro(e.target.value)}
        placeholder="Cerca Socio/Tesserato o Ospite…"
      />

      {risultati.map((soc) => (
        <div
          key={soc.uid} className="admin-list-row admin-list-row-clickable"
          onClick={() => { onSelezionaSocio(soc.uid); setFiltro(''); }}
        >
          {soc.fotoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={soc.fotoUrl} alt="" className="admin-list-avatar" />
          ) : (
            <div className="admin-list-avatar admin-list-avatar-fallback">
              {(soc.nome[0] + soc.cognome[0]).toUpperCase()}
            </div>
          )}
          <div style={{ flex: 1 }}>
            <div className="admin-list-main">
              {soc.nome} {soc.cognome}
              {soc.ruoloTessera === 'ospite' && (
                <span className="admin-etichetta-ospite"> (ospite)</span>
              )}
            </div>
            <div className="admin-list-sub">{soc.email}</div>
          </div>
          <div className="admin-list-credito">€ {(soc.credito ?? 0).toFixed(2)}</div>
        </div>
      ))}
      {filtro.trim().length > 0 && risultati.length === 0 && (
        <p className="admin-empty-text">Nessun socio trovato.</p>
      )}
    </div>
  );
}
