'use client';

import { SocioCircolo } from '../../../data/users';
import { Traduttore } from '../../../data/testi';
import { useLingua } from '../../../lib/lingua';

// ⚠️ Titolo e descrizione stanno QUI, accanto alla sezione che
// descrivono, e non nel punto in cui viene montata. Sono montate in due
// posti diversi — dentro la Panoramica per il presidente, sciolte per
// il Collaboratore — e finche' le stringhe erano scritte a mano in
// tutti e due, cambiarne una voleva dire due sezioni con lo stesso
// contenuto e due nomi diversi a seconda di chi guarda. Oggi il posto è
// uno solo — la Panoramica, per tutti — ma le etichette restano qui: è
// il modo giusto di tenerle comunque.
//
// ⚠️ ERA UNA COSTANTE, ADESSO E' UNA FUNZIONE, come la gemella di
// `SezioneSoci`: una costante si costruisce quando il file viene
// caricato, prima che si sappia la lingua dell'Admin, e resterebbe
// ferma su quella. Chi la monta le passa il suo `t`.
//
// ⚠️ La descrizione diceva «con credito negativo o Fido da saldare», ma
// il filtro qui sotto guarda SOLO il Fido: chi cercava un credito
// negativo apriva una sezione che non glielo avrebbe mai mostrato.
export function etichettaDebiti(t: Traduttore) {
  return {
    titolo: t('adm.deb.titolo'),
    descrizione: t('adm.deb.descrizione'),
  };
}

export default function SezioneDebitiSoci({ soci, onSelezionaSocio }: {
  soci: SocioCircolo[]; onSelezionaSocio: (uid: string) => void;
}) {
  const { t } = useLingua();
  const debitori = soci.filter((s) => (s.sosUtilizzato ?? 0) > 0);

  return (
    <div className="admin-card">
      <div className="admin-card-title">{t('adm.deb.titolo')}</div>
      <p className="admin-card-hint">{t('adm.deb.hint')}</p>

      {debitori.length === 0 && <p className="admin-empty-text">{t('adm.deb.nessunDebito')}</p>}

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
              {/* Stessa pastiglia dell'elenco Soci, stessa chiave: è la
                  stessa qualifica, e due chiavi diverse finirebbero
                  prima o poi con due parole diverse. */}
              {soc.ruoloTessera === 'ospite' && (
                <span className="admin-etichetta-ospite"> {t('adm.els.ospite')}</span>
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
