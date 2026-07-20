'use client';

import { useState } from 'react';
import { SocioCircolo, aggiornaLimiteSOS, ripristinaSOS } from '../../../data/users';
import { ricaricaCredito, PrenotazioneAdmin } from '../../../data/prenotazioniRepo';
import { CONTENUTI_DEMO } from '../../../data/contenutiDemo';
import Modal from './Modal';

export default function SezioneSoci({ circoloId, soci, prenotazioni }: {
  circoloId: string; soci: SocioCircolo[]; prenotazioni: PrenotazioneAdmin[];
}) {
  const [filtro, setFiltro] = useState('');
  const [socioSelUid, setSocioSelUid] = useState<string | null>(null);
  const [ricaricaAperta, setRicaricaAperta] = useState(false);
  const [importo, setImporto] = useState('');
  const [inviando, setInviando] = useState(false);
  const [salvandoSOS, setSalvandoSOS] = useState(false);
  const [ripristinando, setRipristinando] = useState(false);

  // Sempre ripescato dalla lista live: se il credito cambia mentre la
  // scheda è aperta, si aggiorna da solo.
  const socioLive = socioSelUid ? soci.find((x) => x.uid === socioSelUid) ?? null : null;

  const risultati = filtro.trim().length === 0 ? [] : soci
    .filter((soc) => (soc.nome + ' ' + soc.cognome + ' ' + soc.email).toLowerCase().includes(filtro.trim().toLowerCase()))
    .slice(0, 8);

  const numeroPrenotazioni = (uid: string) => prenotazioni.filter((p) => p.utenteId === uid).length;

  const posizioneClassifica = (soc: SocioCircolo) => {
    const nomeCompleto = `${soc.nome} ${soc.cognome}`;
    const riga = CONTENUTI_DEMO[circoloId]?.classifica.find((r) => r.nome === nomeCompleto);
    return riga ? `#${riga.pos}` : '-';
  };

  const apriSocio = (soc: SocioCircolo) => {
    setSocioSelUid(soc.uid);
    setFiltro('');
  };

  const confermaRicarica = async () => {
    const v = parseFloat(importo.replace(',', '.'));
    if (!socioLive || Number.isNaN(v) || v <= 0) return;
    setInviando(true);
    await ricaricaCredito(socioLive.uid, v);
    setInviando(false);
    setRicaricaAperta(false);
    setImporto('');
  };

  const salvaLimiteSOS = async (v: number) => {
    if (!socioLive) return;
    setSalvandoSOS(true);
    await aggiornaLimiteSOS(socioLive.uid, v);
    setSalvandoSOS(false);
  };

  const confermaRipristino = async () => {
    if (!socioLive) return;
    setRipristinando(true);
    await ripristinaSOS(socioLive.uid);
    setRipristinando(false);
  };

  return (
    <div className="admin-card">
      <div className="admin-card-title">Soci</div>
      <p className="admin-card-hint">
        Cerca un socio per vedere il suo profilo, ricaricare il credito o
        impostare il limite di ricarica S.O.S.
      </p>

      <input
        className="admin-input" value={filtro} onChange={(e) => setFiltro(e.target.value)}
        placeholder="Cerca socio per nome o email…"
      />

      {risultati.map((soc) => (
        <div key={soc.uid} className="admin-list-row admin-list-row-clickable" onClick={() => apriSocio(soc)}>
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
          <div className="admin-list-credito">€{(soc.credito ?? 0).toFixed(2)}</div>
        </div>
      ))}
      {filtro.trim().length > 0 && risultati.length === 0 && (
        <p className="admin-empty-text">Nessun socio trovato.</p>
      )}

      {/* Scheda socio */}
      <Modal visible={!!socioLive} onClose={() => setSocioSelUid(null)}>
        {socioLive && (
          <>
            <div className="socio-detail-head">
              {socioLive.fotoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={socioLive.fotoUrl} alt="" className="socio-detail-avatar" />
              ) : (
                <div className="socio-detail-avatar admin-list-avatar-fallback" style={{ fontSize: '1.4rem' }}>
                  {(socioLive.nome[0] + socioLive.cognome[0]).toUpperCase()}
                </div>
              )}
              <div className="admin-modal-title" style={{ marginTop: '.7rem' }}>{socioLive.nome} {socioLive.cognome}</div>
              <div className="admin-modal-sub">{socioLive.email}</div>
            </div>

            <div className="socio-stats-row">
              <div className="socio-stat-box">
                <div className="socio-stat-val">{numeroPrenotazioni(socioLive.uid)}</div>
                <div className="socio-stat-label">Prenotazioni</div>
              </div>
              <div className="socio-stat-box">
                <div className="socio-stat-val">{posizioneClassifica(socioLive)}</div>
                <div className="socio-stat-label">Classifica</div>
              </div>
            </div>

            <div className="socio-credito-row">
              <div>
                <div className="socio-credito-label">Credito</div>
                <div className="socio-credito-valore">€{(socioLive.credito ?? 0).toFixed(2)}</div>
              </div>
              <button className="admin-btn-small" onClick={() => { setImporto(''); setRicaricaAperta(true); }}>
                + Ricarica
              </button>
            </div>

            <div className="socio-credito-row">
              <div>
                <div className="socio-credito-label">Credito S.O.S.</div>
                <div className="socio-credito-valore">
                  {socioLive.sosUtilizzato ?? 0}/{socioLive.limiteRicaricaSOS ?? 0}
                </div>
              </div>
              <button
                className="admin-btn-small"
                onClick={confermaRipristino}
                disabled={!socioLive.sosUtilizzato || ripristinando}
                style={!socioLive.sosUtilizzato ? { opacity: 0.4 } : undefined}
              >
                {ripristinando ? 'Attendere…' : 'Ripristina S.O.S.'}
              </button>
            </div>

            <div className="socio-sos-box">
              <label className="admin-label">Limite ricarica S.O.S.</label>
              <p className="admin-card-hint" style={{ marginBottom: '.6rem' }}>
                Quanto può ricaricarsi da solo il socio in caso di emergenza, dalla
                sua app, senza passare da un Admin.
              </p>
              <div className="socio-sos-valore">
                {(socioLive.limiteRicaricaSOS ?? 0) === 0 ? 'Disattivato' : `Fino a €${socioLive.limiteRicaricaSOS}`}
              </div>
              <input
                type="range" min={0} max={50} step={10}
                value={socioLive.limiteRicaricaSOS ?? 0}
                onChange={(e) => salvaLimiteSOS(Number(e.target.value))}
                style={{ width: '100%' }}
              />
              {salvandoSOS && <div className="admin-saving">Salvataggio…</div>}
            </div>
            <p className="socio-sos-reset-hint">
              &quot;Ripristina&quot; azzera l&apos;usato quando il socio salda in segreteria,
              restituendogli tutto il plafond.
            </p>
          </>
        )}
      </Modal>

      {/* Ricarica — sopra la scheda socio */}
      <Modal visible={ricaricaAperta} onClose={() => setRicaricaAperta(false)}>
        <div className="admin-modal-title">Ricarica wallet</div>
        <div className="admin-modal-sub">{socioLive?.nome} {socioLive?.cognome}</div>
        <input
          className="admin-input" style={{ marginTop: '1rem', textAlign: 'center' }}
          value={importo} onChange={(e) => setImporto(e.target.value)}
          placeholder="Importo, es. 20.00" inputMode="decimal" autoFocus
        />
        <div className="admin-modal-btn-row">
          <button className="admin-modal-btn-cancel" onClick={() => setRicaricaAperta(false)}>Annulla</button>
          <button className="admin-modal-btn-confirm" onClick={confermaRicarica} disabled={inviando}>
            {inviando ? 'Attendere…' : 'Ricarica'}
          </button>
        </div>
      </Modal>
    </div>
  );
}
