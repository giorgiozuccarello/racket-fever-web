'use client';

import { useEffect, useState } from 'react';
import { Campo, Blocco, Circolo, ORARI, fasciaOraria, orarioFineSlot } from '../../../data/circoli';
import { SocioCircolo } from '../../../data/users';
import { calcolaPrezzo } from '../../../data/prezzi';
import { aggiungiBlocco } from '../../../data/circoliRepo';
import { prenotaPerSocioDaAdmin, prenotaEsternoDaAdmin } from '../../../data/prenotazioniRepo';

const GIORNI_IT_ESTESO = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato'];
const MESI_IT = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];
import { PrenotazioneAdmin, cancellaConRimborso, cancellaConRimborsoDiviso, cancellaSenzaRimborso } from '../../../data/prenotazioniRepo';
import { Sfida } from '../../../data/sfide';
import { creaNotifica } from '../../../data/notifiche';
import { creaNotificaMaestro } from '../../../data/notificheMaestro';
import { formatISO } from '../../../data/settimana';
import Modal from './Modal';

const GIORNI_IT_BREVE = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'];

// Titolo prominente del pop-up di una prenotazione: chi gioca, con chi —
// la stessa regola in tutta l'app: le info contano più dell'azione.
function intestazionePrenotazione(p: PrenotazioneAdmin): string {
  if (p.tipo === 'lezione') {
    return p.prenotataDa === 'maestro'
      ? `${p.maestroNome} ${p.maestroCognome} lezione con ${p.utenteNome} ${p.utenteCognome}`
      : `${p.utenteNome} ${p.utenteCognome} lezione con ${p.maestroNome} ${p.maestroCognome}`;
  }
  if (p.compagnoNome) {
    return `${p.utenteNome} ${p.utenteCognome} gioca con ${p.compagnoNome} ${p.compagnoCognome}`;
  }
  return `${p.utenteNome} ${p.utenteCognome}`;
}

export default function SezionePrenotazioni({ campi, blocchi, prenotazioni, sfide, circolo, soci }: {
  campi: Campo[]; blocchi: Blocco[]; prenotazioni: PrenotazioneAdmin[]; sfide: Sfida[]; circolo: Circolo; soci: SocioCircolo[];
}) {
  const [selDay, setSelDay] = useState(0);
  const [selCampoId, setSelCampoId] = useState('');
  const [daAnnullare, setDaAnnullare] = useState<PrenotazioneAdmin | null>(null);
  const [bloccoInfo, setBloccoInfo] = useState<Blocco | null>(null);
  const [sfidaInfo, setSfidaInfo] = useState<Sfida | null>(null);
  const [elaborando, setElaborando] = useState(false);

  // --- Selezione multipla, prenotazione e riserva dalla griglia ---
  // Stesso meccanismo dell'app mobile: si parte da uno slot libero e
  // si estende toccando gli slot adiacenti.
  const [selezioneMultipla, setSelezioneMultipla] = useState<string[]>([]);
  const [oreDaAssegnare, setOreDaAssegnare] = useState<string[]>([]);
  const [oreDaPrenotare, setOreDaPrenotare] = useState<string[]>([]);
  const [oreDaRiservare, setOreDaRiservare] = useState<string[]>([]);
  const [modalitaEsterno, setModalitaEsterno] = useState(false);
  const [nomeEsterno, setNomeEsterno] = useState('');
  const [filtroSocio, setFiltroSocio] = useState('');
  const [socioScelto, setSocioScelto] = useState<SocioCircolo | null>(null);
  const [senzaAddebito, setSenzaAddebito] = useState(false);
  const [etichettaRiserva, setEtichettaRiserva] = useState('');
  const [descrizioneRiserva, setDescrizioneRiserva] = useState('');

  useEffect(() => {
    if ((!selCampoId || !campi.some((c) => c.id === selCampoId)) && campi[0]) {
      setSelCampoId(campi[0].id);
    }
  }, [campi]);

  const giorni = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    return d;
  });
  const giornoSel = giorni[selDay];
  const dataSelIso = formatISO(giornoSel);

  const bloccoAttivo = (ora: string): Blocco | undefined => {
    if (!selCampoId) return undefined;
    return blocchi.find((b) => {
      if (b.campoId !== selCampoId) return false;
      if (ora < b.orarioInizio || ora >= b.orarioFine) return false;
      if (b.tipo === 'data') return b.data === dataSelIso;
      return (b.giorniSettimana ?? []).includes(giornoSel.getDay());
    });
  };

  const campoSel = campi.find((c) => c.id === selCampoId);
  const MASSIMO_SLOT_MULTIPLI = 8;

  const slotPrenotabile = (ora: string) =>
    !prenotazioneSlot(ora) && !bloccoAttivo(ora);

  const iniziaSelezione = (ora: string) => {
    if (!slotPrenotabile(ora)) return;
    setSelezioneMultipla([ora]);
  };

  // Durante la selezione, cliccare un'estremita' la toglie, cliccare
  // uno slot adiacente e libero la estende. Ogni altro click e' inerte.
  const clickDuranteSelezione = (ora: string) => {
    const idx = ORARI.indexOf(ora);
    const idxMin = ORARI.indexOf(selezioneMultipla[0]);
    const idxMax = ORARI.indexOf(selezioneMultipla[selezioneMultipla.length - 1]);
    if (idx === idxMin || idx === idxMax) {
      if (selezioneMultipla.length === 1) { setSelezioneMultipla([]); return; }
      if (idx === idxMin) { setSelezioneMultipla(selezioneMultipla.slice(1)); return; }
      setSelezioneMultipla(selezioneMultipla.slice(0, -1));
      return;
    }
    if (selezioneMultipla.length >= MASSIMO_SLOT_MULTIPLI) return;
    if (idx === idxMin - 1 && slotPrenotabile(ora)) { setSelezioneMultipla([ora, ...selezioneMultipla]); return; }
    if (idx === idxMax + 1 && slotPrenotabile(ora)) setSelezioneMultipla([...selezioneMultipla, ora]);
  };

  const chiudiTutto = () => {
    setOreDaAssegnare([]); setOreDaPrenotare([]); setOreDaRiservare([]);
    setSelezioneMultipla([]); setModalitaEsterno(false); setNomeEsterno('');
    setFiltroSocio(''); setSocioScelto(null); setSenzaAddebito(false);
    setEtichettaRiserva(''); setDescrizioneRiserva('');
  };

  const risultatiSoci = filtroSocio.trim().length < 2 ? [] : soci
    .filter((so) => `${so.nome} ${so.cognome}`.toLowerCase().includes(filtroSocio.trim().toLowerCase()))
    .slice(0, 6);

  const dataLeggibile = `${GIORNI_IT_ESTESO[giornoSel.getDay()]} ${giornoSel.getDate()} ${MESI_IT[giornoSel.getMonth()]}`;

  const confermaPrenotazione = async () => {
    if (oreDaPrenotare.length === 0 || !campoSel) return;
    if (modalitaEsterno && !nomeEsterno.trim()) return;
    if (!modalitaEsterno && !socioScelto) return;
    setElaborando(true);
    try {
      // Uno scritto per mezz'ora, in sequenza: stesso principio del
      // mobile. Le card si ricompongono poi in un blocco unico.
      for (const ora of oreDaPrenotare) {
        const prezzo = senzaAddebito && !modalitaEsterno
          ? 0
          : calcolaPrezzo(campoSel, giornoSel, ora);
        const base = {
          circoloId: circolo.id, campoId: campoSel.id, campoNome: campoSel.nome,
          data: dataSelIso, dataLabel: dataLeggibile, orario: ora, prezzo,
        };
        if (modalitaEsterno) {
          await prenotaEsternoDaAdmin({ ...base, nomeEsterno: nomeEsterno.trim() });
        } else if (socioScelto) {
          await prenotaPerSocioDaAdmin({
            ...base, uid: socioScelto.uid,
            utenteNome: socioScelto.nome, utenteCognome: socioScelto.cognome,
            tipoUtente: socioScelto.ruoloTessera === 'ospite' ? 'ospite' : 'socio',
          });
        }
      }
      // Una sola notifica per l'intero blocco, non una per mezz'ora.
      if (!modalitaEsterno && socioScelto) {
        const daA = oreDaPrenotare.length > 1
          ? `dalle ${oreDaPrenotare[0]} alle ${orarioFineSlot(oreDaPrenotare[oreDaPrenotare.length - 1])}`
          : `alle ${oreDaPrenotare[0]}`;
        await creaNotifica(
          socioScelto.uid,
          `Il circolo ha prenotato per te ${campoSel.nome} il ${dataLeggibile} ${daA}.`
            + (senzaAddebito ? ' Nessun addebito sul tuo credito.' : ''),
          undefined, circolo.id
        );
      }
      chiudiTutto();
    } catch {
      alert('Non è stato possibile completare la prenotazione. Riprova.');
    } finally {
      setElaborando(false);
    }
  };

  const confermaRiserva = async () => {
    if (oreDaRiservare.length === 0 || !campoSel || !etichettaRiserva.trim()) return;
    setElaborando(true);
    try {
      // Un solo blocco per l'intero intervallo: gli orari riservati
      // sono continui per natura, non serve spezzarli.
      await aggiungiBlocco(circolo.id, {
        campoId: campoSel.id,
        tipo: 'data',
        data: dataSelIso,
        orarioInizio: oreDaRiservare[0],
        orarioFine: orarioFineSlot(oreDaRiservare[oreDaRiservare.length - 1]),
        etichetta: etichettaRiserva.trim().slice(0, 14),
        descrizione: descrizioneRiserva.trim() || undefined,
      });
      chiudiTutto();
    } catch {
      alert("Non è stato possibile riservare l'orario. Riprova.");
    } finally {
      setElaborando(false);
    }
  };

  const prenotazioneSlot = (ora: string) =>
    prenotazioni.find((p) => p.campoId === selCampoId && p.data === dataSelIso && p.orario === ora);

  const confermaAnnulla = async () => {
    if (!daAnnullare) return;
    setElaborando(true);
    try {
      if (!daAnnullare.utenteId) {
        await cancellaSenzaRimborso(daAnnullare.id);
      } else if (daAnnullare.costoDiviso && daAnnullare.compagnoId) {
        const meta = (daAnnullare.prezzo / 2).toFixed(2);
        await cancellaConRimborsoDiviso({
          circoloId: circolo.id,
          utenteId: daAnnullare.utenteId,
          compagnoId: daAnnullare.compagnoId,
          prenotazioneId: daAnnullare.id,
          prezzoTotale: daAnnullare.prezzo,
        });
        await creaNotifica(
          daAnnullare.utenteId,
          `Il circolo ha annullato la tua prenotazione: ${daAnnullare.campoNome}, ${daAnnullare.dataLabel} ore ${fasciaOraria(daAnnullare.orario)}. Ti è stata rimborsata la tua metà: € ${meta}.`
        );
        await creaNotifica(
          daAnnullare.compagnoId,
          `Il circolo ha annullato la prenotazione con ${daAnnullare.utenteNome} ${daAnnullare.utenteCognome}: ${daAnnullare.campoNome}, ${daAnnullare.dataLabel} ore ${fasciaOraria(daAnnullare.orario)}. Ti è stata rimborsata la tua metà: € ${meta}.`
        );
      } else {
        await cancellaConRimborso({
          circoloId: circolo.id,
          uid: daAnnullare.utenteId,
          prenotazioneId: daAnnullare.id,
          prezzo: daAnnullare.prezzo,
        });
        await creaNotifica(
          daAnnullare.utenteId,
          `Il circolo ha annullato la tua prenotazione: ${daAnnullare.campoNome}, ${daAnnullare.dataLabel} ore ${fasciaOraria(daAnnullare.orario)}. Credito rimborsato: € ${daAnnullare.prezzo.toFixed(2)}.`
        );
      }
      if (daAnnullare.tipo === 'lezione' && daAnnullare.maestroId) {
        await creaNotificaMaestro(
          daAnnullare.maestroId,
          `Il circolo ha annullato la lezione: ${daAnnullare.campoNome}, ${daAnnullare.dataLabel} ore ${fasciaOraria(daAnnullare.orario)}.`
        );
      }
      setDaAnnullare(null);
    } finally {
      setElaborando(false);
    }
  };

  return (
    <div className="admin-card">
      <div className="admin-card-title">Prenotazione Campi</div>
      <p className="admin-card-hint">
        Clicca su uno slot occupato per vedere chi ha prenotato ed eventualmente annullare.
      </p>

      <div className="pc-row">
        {giorni.map((d, i) => (
          <button
            key={i} onClick={() => setSelDay(i)}
            className={`pc-day ${i === selDay ? 'selected' : ''}`}
          >
            <div className="pc-day-label">{i === 0 ? 'Oggi' : GIORNI_IT_BREVE[d.getDay()]}</div>
            <div className="pc-day-num">{d.getDate()}</div>
          </button>
        ))}
      </div>

      <div className="pc-row">
        {campi.map((c) => (
          <button
            key={c.id} onClick={() => setSelCampoId(c.id)}
            className={`pc-court ${c.id === selCampoId ? 'selected' : ''}`}
          >
            {c.nome}
          </button>
        ))}
      </div>

      <div className="pc-legend">
        <span className="pc-legend-item"><span className="pc-legend-dot pc-legend-libero" /> Libero</span>
        <span className="pc-legend-item"><span className="pc-legend-dot pc-legend-occupato" /> Prenotato</span>
        <span className="pc-legend-item"><span className="pc-legend-dot pc-legend-lezione" /> Lezione</span>
        <span className="pc-legend-item"><span className="pc-legend-dot pc-legend-riservato" /> Riservato</span>
      </div>

      {selezioneMultipla.length > 0 && (
        <div className="pc-barra-selezione">
          <div style={{ flex: 1 }}>
            <strong>
              {selezioneMultipla[0]} - {orarioFineSlot(selezioneMultipla[selezioneMultipla.length - 1])}
              {'  ·  '}{selezioneMultipla.length * 0.5}h
            </strong>
            <div className="pc-barra-sub">Clicca gli slot tratteggiati per estendere</div>
          </div>
          <button className="admin-modal-btn-cancel" onClick={() => setSelezioneMultipla([])}>Annulla</button>
          <button className="admin-modal-btn-confirm" onClick={() => setOreDaAssegnare([...selezioneMultipla])}>
            Conferma
          </button>
        </div>
      )}

      <div className="pc-grid">
        {ORARI.map((ora) => {
          const blocco = bloccoAttivo(ora);
          const p = !blocco ? prenotazioneSlot(ora) : undefined;
          const eLezione = p?.tipo === 'lezione';
          let sotto = 'Libero';
          if (p?.sfidaId) sotto = 'Sfida in corso';
          else if (p) sotto = p.utenteCognome ? `${p.utenteNome} ${p.utenteCognome[0]}.` : p.utenteNome;
          else if (blocco) sotto = 'Riservato';
          const selezionatoOra = selezioneMultipla.includes(ora);
          const idxOra = ORARI.indexOf(ora);
          const idxMinSel = selezioneMultipla.length ? ORARI.indexOf(selezioneMultipla[0]) : -1;
          const idxMaxSel = selezioneMultipla.length ? ORARI.indexOf(selezioneMultipla[selezioneMultipla.length - 1]) : -1;
          const estendibileOra = selezioneMultipla.length > 0 && !selezionatoOra
            && (idxOra === idxMinSel - 1 || idxOra === idxMaxSel + 1)
            && selezioneMultipla.length < MASSIMO_SLOT_MULTIPLI && !p && !blocco;
          return (
            <button
              key={ora}
              onClick={() => {
                if (selezioneMultipla.length > 0) { clickDuranteSelezione(ora); return; }
                if (p?.sfidaId) setSfidaInfo(sfide.find((sf) => sf.id === p.sfidaId) ?? null);
                else if (p) setDaAnnullare(p);
                else if (blocco) setBloccoInfo(blocco);
                else setOreDaAssegnare([ora]);
              }}
              // Sul web non esiste la pressione prolungata: la selezione
              // multipla si avvia con un click destro (o pressione lunga
              // sui dispositivi touch), che qui e' il gesto equivalente.
              onContextMenu={(e) => { e.preventDefault(); iniziaSelezione(ora); }}
              className={`pc-slot ${p ? 'occupato' : ''} ${eLezione ? 'lezione' : ''} ${blocco ? 'riservato' : ''}${selezionatoOra ? ' selezionato' : ''}${estendibileOra ? ' estendibile' : ''}${selezioneMultipla.length > 0 && !selezionatoOra && !estendibileOra ? ' attenuato' : ''}`}
            >
              <div className="pc-slot-ora">{ora}</div>
              <div className="pc-slot-sotto">{sotto}</div>
            </button>
          );
        })}
      </div>

      {/* Scelta: cosa fare degli slot selezionati */}
      <Modal visible={oreDaAssegnare.length > 0} onClose={chiudiTutto}>
        <div className="admin-modal-title">Cosa vuoi fare?</div>
        <p className="admin-modal-sub">
          {oreDaAssegnare.length > 1
            ? `${oreDaAssegnare[0]} - ${orarioFineSlot(oreDaAssegnare[oreDaAssegnare.length - 1])} (${oreDaAssegnare.length * 0.5}h)`
            : oreDaAssegnare[0] ? fasciaOraria(oreDaAssegnare[0]) : ''}
        </p>
        <p className="admin-modal-sub">{campoSel?.nome} · {dataLeggibile}</p>
        <button
          className="pc-scelta-btn"
          onClick={() => { setOreDaPrenotare([...oreDaAssegnare]); setOreDaAssegnare([]); }}
        >
          <strong>Prenota</strong><span>Per un socio o per un esterno</span>
        </button>
        <button
          className="pc-scelta-btn riserva"
          onClick={() => { setOreDaRiservare([...oreDaAssegnare]); setOreDaAssegnare([]); }}
        >
          <strong>Riserva</strong><span>Orario non prenotabile dai soci</span>
        </button>
        <button className="admin-modal-btn-cancel" style={{ marginTop: '.8rem' }} onClick={chiudiTutto}>
          Annulla
        </button>
      </Modal>

      {/* Prenotazione creata dall'admin */}
      <Modal visible={oreDaPrenotare.length > 0} onClose={chiudiTutto}>
        <div className="admin-modal-title">Prenota come Circolo</div>
        <p className="admin-modal-sub">
          {oreDaPrenotare.length > 1
            ? `${oreDaPrenotare[0]} - ${orarioFineSlot(oreDaPrenotare[oreDaPrenotare.length - 1])} (${oreDaPrenotare.length * 0.5}h)`
            : oreDaPrenotare[0] ? fasciaOraria(oreDaPrenotare[0]) : ''}
        </p>
        <p className="admin-modal-sub">{campoSel?.nome} · {dataLeggibile}</p>

        <div className="pc-toggle-row">
          <button
            className={`pc-toggle-btn${!modalitaEsterno ? ' selezionato' : ''}`}
            onClick={() => { setModalitaEsterno(false); setNomeEsterno(''); }}
          >Per un socio</button>
          <button
            className={`pc-toggle-btn${modalitaEsterno ? ' selezionato' : ''}`}
            onClick={() => { setModalitaEsterno(true); setSocioScelto(null); setFiltroSocio(''); }}
          >Per un esterno</button>
        </div>

        {modalitaEsterno ? (
          <>
            <input
              className="admin-input" value={nomeEsterno}
              onChange={(e) => setNomeEsterno(e.target.value)}
              placeholder="Nome e cognome dell'esterno"
            />
            <p className="admin-card-hint">
              L&apos;esterno non ha un account: la prenotazione non genera alcun addebito.
            </p>
          </>
        ) : socioScelto ? (
          <div className="admin-list-row">
            <div style={{ flex: 1, fontWeight: 700 }}>{socioScelto.nome} {socioScelto.cognome}</div>
            <button className="admin-btn-small" onClick={() => { setSocioScelto(null); setFiltroSocio(''); }}>
              Cambia
            </button>
          </div>
        ) : (
          <>
            <input
              className="admin-input" value={filtroSocio}
              onChange={(e) => setFiltroSocio(e.target.value)}
              placeholder="Cerca Socio/Tesserato o Ospite…"
            />
            {risultatiSoci.map((so) => (
              <div key={so.uid} className="admin-list-row admin-list-row-clickable" onClick={() => setSocioScelto(so)}>
                <div style={{ flex: 1 }}>
                  {so.nome} {so.cognome}
                  {so.ruoloTessera === 'ospite' && <span className="admin-etichetta-ospite"> (ospite)</span>}
                </div>
                <div className="admin-list-sub">credito € {(so.credito ?? 0).toFixed(2)}</div>
              </div>
            ))}
            <p className="admin-card-hint">
              Il costo verrà scalato dal credito del socio, come per una sua prenotazione.
            </p>
          </>
        )}

        {!modalitaEsterno && (
          <label className="pc-spunta-riga">
            <input type="checkbox" checked={senzaAddebito} onChange={(e) => setSenzaAddebito(e.target.checked)} />
            <span>Non addebitare il costo al socio</span>
          </label>
        )}

        <div className="admin-modal-btn-row">
          <button className="admin-modal-btn-cancel" onClick={chiudiTutto} disabled={elaborando}>Annulla</button>
          <button
            className="admin-modal-btn-confirm"
            onClick={confermaPrenotazione}
            disabled={elaborando || (modalitaEsterno ? !nomeEsterno.trim() : !socioScelto)}
          >
            {elaborando ? 'Attendere…' : 'Conferma'}
          </button>
        </div>
      </Modal>

      {/* Riserva orario */}
      <Modal visible={oreDaRiservare.length > 0} onClose={chiudiTutto}>
        <div className="admin-modal-title">Riserva orario</div>
        <p className="admin-modal-sub">
          {oreDaRiservare.length > 1
            ? `${oreDaRiservare[0]} - ${orarioFineSlot(oreDaRiservare[oreDaRiservare.length - 1])} (${oreDaRiservare.length * 0.5}h)`
            : oreDaRiservare[0] ? fasciaOraria(oreDaRiservare[0]) : ''}
        </p>
        <p className="admin-modal-sub">{campoSel?.nome} · {dataLeggibile}</p>

        <label className="admin-label">Etichetta</label>
        <input
          className="admin-input" value={etichettaRiserva}
          onChange={(e) => setEtichettaRiserva(e.target.value.slice(0, 14))}
          placeholder="Es. Scuola Tennis" maxLength={14}
        />
        <p className="admin-card-hint">
          Compare sotto &quot;Riservato&quot; nello slot — {14 - etichettaRiserva.length} caratteri rimasti
        </p>

        <label className="admin-label">Descrizione</label>
        <textarea
          className="admin-input" value={descrizioneRiserva}
          onChange={(e) => setDescrizioneRiserva(e.target.value)}
          placeholder="Di cosa si tratta, per chi tocca lo slot…" rows={3}
        />
        <p className="admin-card-hint">
          La vedranno soci, maestri e admin toccando lo slot riservato.
        </p>

        <div className="admin-modal-btn-row">
          <button className="admin-modal-btn-cancel" onClick={chiudiTutto} disabled={elaborando}>Annulla</button>
          <button
            className="admin-modal-btn-confirm"
            onClick={confermaRiserva}
            disabled={elaborando || !etichettaRiserva.trim()}
          >
            {elaborando ? 'Attendere…' : 'Riserva'}
          </button>
        </div>
      </Modal>

      <Modal visible={!!bloccoInfo} onClose={() => setBloccoInfo(null)}>
        <div className="admin-modal-title">Orario riservato</div>
        <div className="admin-modal-sub">
          {campi.find((c) => c.id === bloccoInfo?.campoId)?.nome} · {bloccoInfo?.orarioInizio} - {bloccoInfo?.orarioFine}
        </div>
        <p style={{ marginTop: '1rem', fontWeight: 700 }}>{bloccoInfo?.etichetta}</p>
        <button className="admin-modal-btn-cancel" onClick={() => setBloccoInfo(null)} style={{ marginTop: '1rem' }}>
          Chiudi
        </button>
      </Modal>

      <Modal visible={!!sfidaInfo} onClose={() => setSfidaInfo(null)}>
        <div className="admin-modal-title">Sfida in corso</div>
        <p className="admin-card-hint" style={{ textAlign: 'center' }}>
          {sfidaInfo?.sfidanteNome} {sfidaInfo?.sfidanteCognome} vs {sfidaInfo?.sfidatoNome} {sfidaInfo?.sfidatoCognome}
        </p>

        <div style={{ background: '#F7F4EA', borderRadius: 10, padding: '.8rem', marginTop: '.6rem' }}>
          <div className="admin-list-sub">
            Posizioni al lancio: {sfidaInfo?.sfidanteNome} #{sfidaInfo?.posizioneSfidante} · {sfidaInfo?.sfidatoNome} #{sfidaInfo?.posizioneSfidato}
          </div>
          {sfidaInfo?.fase === 'accettata' && sfidaInfo?.matchData && (
            <div className="admin-list-sub" style={{ fontWeight: 700, marginTop: '.3rem' }}>
              {sfidaInfo.matchDataLabel} · {sfidaInfo.matchCampoNome} · {sfidaInfo.matchOrari?.[0]}
            </div>
          )}
          {sfidaInfo?.risultatoSfidante && (
            <div className="admin-list-sub">
              {sfidaInfo.sfidanteNome}: {sfidaInfo.risultatoSfidante.esito} {sfidaInfo.risultatoSfidante.punteggio ? `(${sfidaInfo.risultatoSfidante.punteggio})` : ''}
            </div>
          )}
          {sfidaInfo?.risultatoSfidato && (
            <div className="admin-list-sub">
              {sfidaInfo.sfidatoNome}: {sfidaInfo.risultatoSfidato.esito} {sfidaInfo.risultatoSfidato.punteggio ? `(${sfidaInfo.risultatoSfidato.punteggio})` : ''}
            </div>
          )}
        </div>

        <p className="admin-card-hint" style={{ textAlign: 'center', marginTop: '.8rem' }}>
          Per annullarla, vai nella sezione &quot;Sfide in Corso&quot; e usa &quot;Annulla Sfida Corrente&quot;
          — da qui puoi solo consultarla.
        </p>
        <button className="admin-btn-full" style={{ marginTop: '1rem' }} onClick={() => setSfidaInfo(null)}>
          Ho capito
        </button>
      </Modal>

      <Modal visible={!!daAnnullare} onClose={() => setDaAnnullare(null)}>
        <div className="admin-modal-title" style={{ textTransform: 'none', fontSize: '1rem' }}>
          {daAnnullare ? intestazionePrenotazione(daAnnullare) : ''}
        </div>
        <div className="admin-modal-sub">
          {daAnnullare?.campoNome} · {daAnnullare?.dataLabel} {daAnnullare ? fasciaOraria(daAnnullare.orario) : ''}
          {daAnnullare?.etichetta ? ` · ${daAnnullare.etichetta}` : ''}
        </div>
        <div className="admin-modal-amount" style={{ fontSize: '.9rem', opacity: 0.75 }}>
          {!daAnnullare?.utenteId
            ? 'Nessun rimborso (allievo non socio)'
            : daAnnullare?.costoDiviso
              ? `Saranno rimborsati entrambi: ${daAnnullare.utenteNome} e ${daAnnullare.compagnoNome} · € ${(daAnnullare.prezzo / 2).toFixed(2)} a testa`
              : `Rimborso: € ${daAnnullare?.prezzo.toFixed(2)}`}
        </div>
        <div className="admin-modal-btn-row">
          <button className="admin-modal-btn-cancel" onClick={() => setDaAnnullare(null)}>Indietro</button>
          <button className="admin-modal-btn-confirm danger" onClick={confermaAnnulla} disabled={elaborando}>
            {elaborando ? 'Attendere…' : 'Annulla e rimborsa'}
          </button>
        </div>
      </Modal>
    </div>
  );
}
