'use client';

import { SocioCircolo } from '../../../data/users';

export default function SezioneDebitiSoci({ soci }: { soci: SocioCircolo[] }) {
  const debitori = soci.filter((s) => (s.sosUtilizzato ?? 0) > 0);

  return (
    <div className="admin-card">
      <div className="admin-card-title">Debiti dei Soci</div>
      <p className="admin-card-hint">
        Soci con un credito S.O.S. ancora da saldare in segreteria. Escono da
        qui automaticamente non appena ripristini il loro credito.
      </p>

      {debitori.length === 0 && <p className="admin-empty-text">Nessun debito al momento.</p>}

      {debitori.map((soc) => (
        <div key={soc.uid} className="admin-list-row">
          {soc.fotoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={soc.fotoUrl} alt="" className="admin-list-avatar" />
          ) : (
            <div className="admin-list-avatar admin-list-avatar-fallback">
              {(soc.nome[0] + soc.cognome[0]).toUpperCase()}
            </div>
          )}
          <div style={{ flex: 1 }}>
            <div className="admin-list-main">{soc.nome} {soc.cognome}</div>
            <div className="admin-list-sub">{soc.email}</div>
          </div>
          <div className="admin-list-credito" style={{ color: '#B3261E' }}>€{soc.sosUtilizzato}</div>
        </div>
      ))}
    </div>
  );
}
