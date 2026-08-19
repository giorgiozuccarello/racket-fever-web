'use client';

import { SocioCircolo } from '../../../data/users';

// ⚠️ Titolo e descrizione stanno QUI, accanto alla sezione che
// descrivono, e non nel punto in cui viene montata. Sono montate in due
// posti diversi — dentro la Panoramica per il presidente, sciolte per
// il Collaboratore — e finche' le stringhe erano scritte a mano in
// tutti e due, cambiarne una voleva dire due sezioni con lo stesso
// contenuto e due nomi diversi a seconda di chi guarda.
export const ETICHETTA_DEBITI = {
  titolo: 'Debiti dei Soci/Tesserati e Ospiti',
  // ⚠️ Diceva «con credito negativo o Fido da saldare», ma il filtro
  // qui sotto guarda SOLO il Fido: chi cercava un credito negativo
  // apriva una sezione che non glielo avrebbe mai mostrato.
  descrizione: 'Soci/Tesserati e Ospiti con un Fido ancora da saldare',
};

export default function SezioneDebitiSoci({ soci, onSelezionaSocio }: {
  soci: SocioCircolo[]; onSelezionaSocio: (uid: string) => void;
}) {
  const debitori = soci.filter((s) => (s.sosUtilizzato ?? 0) > 0);

  return (
    <div className="admin-card">
      <div className="admin-card-title">Debiti dei Soci/Tesserati e Ospiti</div>
      <p className="admin-card-hint">
        Soci/Tesserati e Ospiti con un Fido ancora da saldare in segreteria. Escono da
        qui automaticamente non appena ripristini il loro credito.
      </p>

      {debitori.length === 0 && <p className="admin-empty-text">Nessun debito al momento.</p>}

      {debitori.map((soc) => (
        <div
          key={soc.uid} className="admin-list-row admin-list-row-clickable"
          onClick={() => onSelezionaSocio(soc.uid)}
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
          <div className="admin-list-credito" style={{ color: '#B3261E' }}>€ {soc.sosUtilizzato}</div>
        </div>
      ))}
    </div>
  );
}
