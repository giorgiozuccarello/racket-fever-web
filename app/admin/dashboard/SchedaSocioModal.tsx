'use client';

import { useState } from 'react';
import { SocioCircolo, aggiornaLimiteSOS, aggiornaLimitePersonale, ripristinaSOS } from '../../../data/users';
import { creaNotifica } from '../../../data/notifiche';
import { ricaricaCredito, azzeraCredito, PrenotazioneAdmin } from '../../../data/prenotazioniRepo';
import { CONTENUTI_DEMO } from '../../../data/contenutiDemo';
import Modal from './Modal';

export default function SchedaSocioModal({ circoloId, socio, prenotazioni, onClose }: {
  circoloId: string; socio: SocioCircolo | null; prenotazioni: PrenotazioneAdmin[]; onClose: () => void;
}) {
  const [ricaricaAperta, setRicaricaAperta] = useState(false);
  const [importo, setImporto] = useState('');
  const [inviando, setInviando] = useState(false);
  const [salvandoSOS, setSalvandoSOS] = useState(false);
  const [salvandoLimite, setSalvandoLimite] = useState(false);
  const [ripristinando, setRipristinando] = useState(false);
  const [confermaRipristinoAperta, setConfermaRipristinoAperta] = useState(false);
  const [confermaAzzeraAperta, setConfermaAzzeraAperta] = useState(false);
  const [azzerando, setAzzerando] = useState(false);

  const numeroPrenotazioni = (uid: string) => prenotazioni.filter((p) => p.utenteId === uid).length;

  const posizioneClassifica = (soc: SocioCircolo) => {
    const nomeCompleto = `${soc.nome} ${soc.cognome}`;
    const riga = CONTENUTI_DEMO[circoloId]?.classifica.find((r) => r.nome === nomeCompleto);
    return riga ? `#${riga.pos}` : '-';
  };

  const confermaRicarica = async () => {
    const v = parseFloat(importo.replace(',', '.'));
    if (!socio || Number.isNaN(v) || v <= 0) return;
    setInviando(true);
    await ricaricaCredito(socio.uid, v);
    setInviando(false);
    setRicaricaAperta(false);
    setImporto('');
  };

  const salvaLimiteSOS = async (v: number) => {
    if (!socio) return;
    setSalvandoSOS(true);
    await aggiornaLimiteSOS(socio.uid, v);
    setSalvandoSOS(false);
  };

  const salvaLimitePersonale = async (v: number) => {
    if (!socio) return;
    setSalvandoLimite(true);
    await aggiornaLimitePersonale(socio.uid, v);
    setSalvandoLimite(false);
  };

  const confermaRipristino = async () => {
    if (!socio) return;
    setRipristinando(true);
    await ripristinaSOS(socio.uid);
    setRipristinando(false);
    setConfermaRipristinoAperta(false);
  };

  const confermaAzzeraCredito = async () => {
    if (!socio) return;
    setAzzerando(true);
    await azzeraCredito(socio.uid);
    await creaNotifica(
      socio.uid,
      `Il circolo ha azzerato il tuo credito wallet (era €${(socio.credito ?? 0).toFixed(2)}). Se non ti torna, rivolgiti alla segreteria.`
    );
    setAzzerando(false);
    setConfermaAzzeraAperta(false);
  };

  return (
    <>
      <Modal visible={!!socio} onClose={onClose}>
        {socio && (
          <>
            <div className="socio-detail-head">
              {socio.fotoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={socio.fotoUrl} alt="" className="socio-detail-avatar" />
              ) : (
                <div className="socio-detail-avatar admin-list-avatar-fallback" style={{ fontSize: '1.4rem' }}>
                  {(socio.nome[0] + socio.cognome[0]).toUpperCase()}
                </div>
              )}
              <div className="admin-modal-title" style={{ marginTop: '.7rem' }}>{socio.nome} {socio.cognome}</div>
              <div className="admin-modal-sub">{socio.email}</div>
            </div>

            <div className="socio-stats-row">
              <div className="socio-stat-box">
                <div className="socio-stat-val">{numeroPrenotazioni(socio.uid)}</div>
                <div className="socio-stat-label">Prenotazioni</div>
              </div>
              <div className="socio-stat-box">
                <div className="socio-stat-val">{posizioneClassifica(socio)}</div>
                <div className="socio-stat-label">Classifica</div>
              </div>
            </div>

            <div className="socio-credito-row">
              <div>
                <div className="socio-credito-label">Credito</div>
                <div className="socio-credito-valore">€{(socio.credito ?? 0).toFixed(2)}</div>
              </div>
              <div className="socio-credito-btns">
                <button className="admin-btn-small" onClick={() => { setImporto(''); setRicaricaAperta(true); }}>
                  + Ricarica
                </button>
                <button className="admin-btn-danger-small" onClick={() => setConfermaAzzeraAperta(true)}>
                  Azzera Credito
                </button>
              </div>
            </div>

            <div className="socio-credito-row">
              <div>
                <div className="socio-credito-label">Credito S.O.S.</div>
                <div className="socio-credito-valore">
                  <span style={{ color: (socio.sosUtilizzato ?? 0) > 0 ? '#B3261E' : 'var(--inchiostro)' }}>
                    €{socio.sosUtilizzato ?? 0}
                  </span>
                  <span>/{socio.limiteRicaricaSOS ?? 0}</span>
                </div>
                <div className="socio-debito-hint">Debito verso Circolo: €{socio.sosUtilizzato ?? 0}</div>
              </div>
              <button
                className="admin-btn-small"
                onClick={() => setConfermaRipristinoAperta(true)}
                disabled={!socio.sosUtilizzato || ripristinando}
                style={!socio.sosUtilizzato ? { opacity: 0.4 } : undefined}
              >
                Ripristina S.O.S.
              </button>
            </div>

            <div className="socio-sos-box">
              <label className="admin-label">Limite ricarica S.O.S.</label>
              <p className="admin-card-hint" style={{ marginBottom: '.6rem' }}>
                Quanto può ricaricarsi da solo il socio in caso di emergenza, dalla
                sua app, senza passare da un Admin.
              </p>
              <div className="socio-sos-valore">
                {(socio.limiteRicaricaSOS ?? 0) === 0 ? 'Disattivato' : `Fino a €${socio.limiteRicaricaSOS}`}
              </div>
              <input
                type="range" min={0} max={50} step={10}
                value={socio.limiteRicaricaSOS ?? 0}
                onChange={(e) => salvaLimiteSOS(Number(e.target.value))}
                style={{ width: '100%' }}
              />
              {salvandoSOS && <div className="admin-saving">Salvataggio…</div>}
            </div>
            <p className="socio-sos-reset-hint">
              &quot;Ripristina&quot; azzera l&apos;usato quando il socio salda in segreteria,
              restituendogli tutto il plafond.
            </p>

            <div className="socio-sos-box">
              <label className="admin-label">Limite prenotazioni settimanali (personale)</label>
              <p className="admin-card-hint" style={{ marginBottom: '.6rem' }}>
                Sostituisce, solo per questo socio, il limite generale del circolo.
              </p>
              <div className="socio-sos-valore">
                {(socio.limitePrenotazioniPersonale ?? 0) === 0
                  ? 'Usa il limite del circolo'
                  : `${socio.limitePrenotazioniPersonale} ${socio.limitePrenotazioniPersonale === 1 ? 'ora' : 'ore'} / settimana`}
              </div>
              <input
                type="range" min={0} max={10} step={1}
                value={socio.limitePrenotazioniPersonale ?? 0}
                onChange={(e) => salvaLimitePersonale(Number(e.target.value))}
                style={{ width: '100%' }}
              />
              {salvandoLimite && <div className="admin-saving">Salvataggio…</div>}
            </div>
          </>
        )}
      </Modal>

      {/* Conferma ripristino — sopra la scheda socio */}
      <Modal visible={confermaRipristinoAperta} onClose={() => setConfermaRipristinoAperta(false)}>
        <div className="admin-modal-title">Ripristinare il credito?</div>
        <div className="admin-modal-sub">
          Stai azzerando il debito di {socio?.nome} {socio?.cognome}. Vuoi continuare?
        </div>
        <div className="admin-modal-btn-row">
          <button className="admin-modal-btn-cancel" onClick={() => setConfermaRipristinoAperta(false)}>Annulla</button>
          <button className="admin-modal-btn-confirm danger" onClick={confermaRipristino} disabled={ripristinando}>
            {ripristinando ? 'Attendere…' : 'Conferma'}
          </button>
        </div>
      </Modal>

      {/* Azzera Credito — sopra la scheda socio */}
      <Modal visible={confermaAzzeraAperta} onClose={() => setConfermaAzzeraAperta(false)}>
        <div className="admin-modal-title">Azzera Credito di {socio?.nome} {socio?.cognome}</div>
        <div className="admin-modal-sub">
          Il credito attuale (€{(socio?.credito ?? 0).toFixed(2)}) verrà portato a zero. Usalo solo se la
          segreteria ha già restituito i soldi reali fuori dall&apos;app.
        </div>
        <div className="admin-modal-btn-row">
          <button className="admin-modal-btn-cancel" onClick={() => setConfermaAzzeraAperta(false)}>Annulla</button>
          <button className="admin-modal-btn-confirm danger" onClick={confermaAzzeraCredito} disabled={azzerando}>
            {azzerando ? 'Attendere…' : 'Azzera Credito'}
          </button>
        </div>
      </Modal>

      {/* Ricarica — sopra la scheda socio */}
      <Modal visible={ricaricaAperta} onClose={() => setRicaricaAperta(false)}>
        <div className="admin-modal-title">Ricarica wallet</div>
        <div className="admin-modal-sub">{socio?.nome} {socio?.cognome}</div>
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
    </>
  );
}
