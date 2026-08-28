'use client';

import { useEffect, useState } from 'react';
import { Campo, TariffaSpeciale } from '../../../data/circoli';
import {
  tariffeDelCampo, tariffaInConflitto, iniziDisponibili, finiDisponibili, nuovoIdTariffa,
} from '../../../data/prezzi';
import { aggiornaCampo } from '../../../data/circoliRepo';
import { ChiaveTesto } from '../../../data/testi';
import { useLingua } from '../../../lib/lingua';
import Modal from './Modal';

// I giorni con l'indice che usa JavaScript: 0 = domenica. Sono le
// chiavi comuni in forma CORTA, perche' qui i giorni stanno dentro
// pastiglie larghe tre lettere e dentro una riga di riepilogo: prima si
// scriveva il nome intero e poi lo si tagliava con `slice(0, 3)`, che in
// tedesco dava «Mit» invece di «Mi».
const GIORNI_SETTIMANA: ChiaveTesto[] = [
  'com.g.dom', 'com.g.lun', 'com.g.mar', 'com.g.mer', 'com.g.gio', 'com.g.ven', 'com.g.sab',
];
const PREZZI_DISPONIBILI = Array.from({ length: 33 }, (_, i) => Math.round(i * 0.5 * 100) / 100);

export default function SezionePrezzi({ circoloId, campi }: { circoloId: string; campi: Campo[] }) {
  const { t } = useLingua();
  const [selCampoId, setSelCampoId] = useState<string | null>(campi[0]?.id ?? null);

  useEffect(() => {
    if ((!selCampoId || !campi.some((c) => c.id === selCampoId)) && campi[0]) {
      setSelCampoId(campi[0].id);
    }
  }, [campi]);

  const campo = campi.find((c) => c.id === selCampoId);
  const tariffe = tariffeDelCampo(campo);

  const [salvandoBase, setSalvandoBase] = useState(false);
  const salvaPrezzoBase = async (v: string) => {
    if (!campo) return;
    setSalvandoBase(true);
    await aggiornaCampo(circoloId, campo.id, { prezzoOraDefault: v === '' ? null : parseFloat(v) } as any);
    setSalvandoBase(false);
  };

  // ⚠️ SI MODIFICA UNA RIGA, NON «LA» TARIFFA. Con una tariffa sola
  // bastava un interruttore aperto/chiuso; con un elenco bisogna sapere
  // QUALE riga si sta toccando, e la si tiene per `id` e non per
  // posizione: la posizione cambia sotto i piedi appena qualcuno
  // cancella una riga più in alto.
  // `''` vuol dire «form aperto su una tariffa NUOVA», `null` chiuso.
  const [idInModifica, setIdInModifica] = useState<string | null>(null);
  const [orarioInizio, setOrarioInizio] = useState('');
  const [orarioFine, setOrarioFine] = useState('');
  const [prezzoSpeciale, setPrezzoSpeciale] = useState('');
  const [etichetta, setEtichetta] = useState('');
  const [giorniSel, setGiorniSel] = useState<number[]>([]);
  const [errore, setErrore] = useState('');

  // ============================================================
  // LE ORE CHE SI POSSONO ANCORA SCEGLIERE.
  //
  // ⚠️ DIPENDONO DAI GIORNI, ed è il motivo per cui nel modulo i giorni
  // stanno SOPRA le ore. Una tariffa 18-20 del lunedì non occupa il
  // sabato: chiedere le ore prima di sapere i giorni vorrebbe dire o
  // nascondere ore che sono libere, o mostrarne di già prese.
  //
  // ⚠️ `idInModifica` esce dal conto: una tariffa non si sovrappone a sé
  // stessa, e senza questa esclusione non si potrebbe riaprire una riga
  // nemmeno per cambiarle il prezzo.
  // ============================================================
  const escludi = idInModifica || undefined;
  const inizi = iniziDisponibili(tariffe, giorniSel, escludi);
  const fini = finiDisponibili(orarioInizio, tariffe, giorniSel, escludi);

  // ⚠️ Cambiando i giorni, un'ora scelta prima può diventare occupata.
  // Lasciarla scritta nel modulo vorrebbe dire un salvataggio respinto
  // con un messaggio che parla di ore che l'Admin non ricorda di aver
  // scelto. Cade da sola, e la si risceglie fra quelle rimaste.
  useEffect(() => {
    if (idInModifica === null) return;
    if (orarioInizio && !inizi.includes(orarioInizio)) { setOrarioInizio(''); setOrarioFine(''); return; }
    if (orarioFine && !fini.includes(orarioFine)) setOrarioFine('');
  }, [giorniSel, idInModifica]);

  const apriForm = (tar?: TariffaSpeciale) => {
    if (tar) {
      setIdInModifica(tar.id);
      setGiorniSel(tar.giorni ?? []);
      setOrarioInizio(tar.orarioInizio);
      setOrarioFine(tar.orarioFine);
      setPrezzoSpeciale(String(tar.prezzo));
      setEtichetta(tar.etichetta);
    } else {
      setIdInModifica('');
      setGiorniSel([]);
      setOrarioInizio('');
      setOrarioFine('');
      setPrezzoSpeciale('');
      // ⚠️ QUESTA E' UNA PROPOSTA, NON UN TESTO DI SISTEMA: l'etichetta
      // finisce in Firestore ed e' un dato scritto dall'Admin, che puo'
      // cambiarla prima di salvare. Si suggerisce nella sua lingua
      // perche' un Admin tedesco riscriverebbe comunque a mano un
      // «Con illuminazione» che non capisce.
      setEtichetta(t('adm.pri.etichettaEsempio'));
    }
    setErrore('');
  };

  const toggleGiorno = (i: number) => {
    setGiorniSel((prev) => (prev.includes(i) ? prev.filter((x) => x !== i) : [...prev, i]));
  };

  // Come si legge una fascia in un messaggio d'errore.
  const scrittaFascia = (tar: TariffaSpeciale) => `${tar.orarioInizio}–${tar.orarioFine}`;

  // ⚠️ TUTTE LE TARIFFE SI RISCRIVONO INSIEME, ed è voluto. Sono un
  // campo solo del documento del campo, non una sottocollezione: si
  // legge l'elenco, si sostituisce la riga e si riscrive tutto.
  // ⚠️ E `tariffaSpeciale` VA A NULL nello stesso colpo: è il campo
  // vecchio, e lasciarlo pieno vorrebbe dire due fonti di verità —
  // `tariffeDelCampo` preferisce l'elenco, quindi quella vecchia
  // sparirebbe dai conti restando scritta sul documento, pronta a
  // riaffiorare il giorno che qualcuno svuota l'elenco.
  const scriviTariffe = async (nuove: TariffaSpeciale[]) => {
    if (!campo) return;
    await aggiornaCampo(circoloId, campo.id, {
      tariffeSpeciali: nuove, tariffaSpeciale: null,
    } as any);
  };

  const salvaTariffa = async () => {
    if (!campo || idInModifica === null) return;
    if (!orarioInizio || !orarioFine) { setErrore(t('adm.pri.scegliOrari')); return; }
    if (orarioFine <= orarioInizio) { setErrore(t('adm.pri.fineDopoInizio')); return; }
    if (prezzoSpeciale === '') { setErrore(t('adm.pri.scegliPrezzo')); return; }
    if (!etichetta.trim()) { setErrore(t('adm.pri.scegliEtichetta')); return; }

    const proposta: TariffaSpeciale = {
      id: idInModifica || nuovoIdTariffa(),
      orarioInizio, orarioFine, prezzo: parseFloat(prezzoSpeciale),
      etichetta: etichetta.trim(), giorni: giorniSel,
    };

    // ⚠️ IL CONTROLLO C'È ANCHE SE LE TENDINE GIÀ NASCONDONO LE ORE
    // PRESE, e non è una ripetizione inutile: i giorni si possono
    // cambiare DOPO aver scelto le ore, e in quell'istante una fascia
    // che era libera può diventare occupata. La tendina è la difesa che
    // si vede; questa è quella che tiene.
    const conflitto = tariffaInConflitto(tariffe, proposta, escludi);
    if (conflitto) {
      setErrore(t('adm.pri.sovrapposta', {
        tariffa: conflitto.etichetta, fascia: scrittaFascia(conflitto),
      }));
      return;
    }

    const nuove = idInModifica
      ? tariffe.map((x) => (x.id === idInModifica ? proposta : x))
      : [...tariffe, proposta];
    // In ordine di orario: l'elenco si legge come si legge una giornata.
    nuove.sort((a, b) => a.orarioInizio.localeCompare(b.orarioInizio));
    await scriviTariffe(nuove);
    setIdInModifica(null);
  };

  const rimuoviTariffa = async (id: string) => {
    await scriviTariffe(tariffe.filter((x) => x.id !== id));
  };

  return (
    <div className="admin-card">
      <div className="admin-card-title">{t('adm.pri.titolo')}</div>
      <p className="admin-card-hint">{t('adm.pri.intro')}</p>

      <div className="admin-chip-row">
        {campi.map((c) => (
          <button
            key={c.id} className={`admin-chip ${selCampoId === c.id ? 'selected' : ''}`}
            onClick={() => setSelCampoId(c.id)}
          >
            {c.nome}
          </button>
        ))}
      </div>

      {campo && (
        <>
          <label className="admin-label">{t('adm.pri.prezzoBase', { campo: campo.nome })}</label>
          <select
            className="admin-select"
            value={campo.prezzoOraDefault === null || campo.prezzoOraDefault === undefined ? '' : String(campo.prezzoOraDefault)}
            onChange={(e) => salvaPrezzoBase(e.target.value)}
          >
            <option value="">--</option>
            {PREZZI_DISPONIBILI.map((p) => (
              <option key={p} value={p}>€ {p.toFixed(2)}</option>
            ))}
          </select>
          {salvandoBase && <div className="admin-saving">{t('com.salvataggio')}</div>}

          <label className="admin-label">{t('adm.pri.tariffeSpeciali')}</label>
          {tariffe.length === 0 && <p className="admin-card-hint">{t('adm.pri.nessunaTariffa')}</p>}
          {tariffe.map((tar) => (
            <div className="admin-list-row" key={tar.id}>
              <div style={{ flex: 1 }}>
                <div className="admin-list-main">{tar.etichetta} · € {tar.prezzo.toFixed(2)}</div>
                <div className="admin-list-sub">
                  {scrittaFascia(tar)}
                  {tar.giorni && tar.giorni.length > 0
                    ? `  ·  ${tar.giorni.map((g) => t(GIORNI_SETTIMANA[g])).join(', ')}`
                    : `  ·  ${t('adm.pri.tuttiIGiorni')}`}
                </div>
              </div>
              <button className="admin-icon-btn" onClick={() => apriForm(tar)} aria-label={t('adm.pri.modifica')}>✎</button>
              <button className="admin-icon-btn danger" onClick={() => rimuoviTariffa(tar.id)} aria-label={t('adm.pri.rimuovi')}>🗑</button>
            </div>
          ))}
          <button className="admin-btn-full" onClick={() => apriForm()}>
            + {t(tariffe.length === 0 ? 'adm.pri.aggiungiTariffa' : 'adm.pri.aggiungiAltra')}
          </button>
        </>
      )}

      <Modal visible={idInModifica !== null} onClose={() => setIdInModifica(null)}>
        <div className="admin-modal-title">{t('adm.pri.tariffaSpeciale')}{campo ? ` — ${campo.nome}` : ''}</div>

        {/* ⚠️ I GIORNI STANNO SOPRA LE ORE, e prima stavano sotto. Non è
            un riordino estetico: le ore che restano libere dipendono dai
            giorni scelti, quindi chiedere prima le ore vorrebbe dire
            chiederle senza sapere quali mostrare. */}
        <label className="admin-label">{t('adm.pri.giorni')}</label>
        <div className="admin-chip-row">
          {GIORNI_SETTIMANA.map((chiave, i) => (
            <button key={i} className={`admin-chip ${giorniSel.includes(i) ? 'selected' : ''}`} onClick={() => toggleGiorno(i)}>
              {t(chiave)}
            </button>
          ))}
        </div>

        {inizi.length === 0 ? (
          <div className="admin-error-text">{t('adm.pri.nessunaOraLibera')}</div>
        ) : (
          <>
            <label className="admin-label">{t('adm.pri.dalle')}</label>
            <select className="admin-select" value={orarioInizio} onChange={(e) => setOrarioInizio(e.target.value)}>
              <option value="">--</option>
              {inizi.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>

            <label className="admin-label">{t('adm.pri.alle')}</label>
            <select className="admin-select" value={orarioFine} onChange={(e) => setOrarioFine(e.target.value)}>
              <option value="">--</option>
              {fini.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          </>
        )}

        <label className="admin-label">{t('adm.pri.prezzo')}</label>
        <select className="admin-select" value={prezzoSpeciale} onChange={(e) => setPrezzoSpeciale(e.target.value)}>
          <option value="">--</option>
          {PREZZI_DISPONIBILI.map((p) => <option key={p} value={p}>€ {p.toFixed(2)}</option>)}
        </select>

        <label className="admin-label">{t('adm.pri.etichetta')}</label>
        <input
          className="admin-input" value={etichetta} onChange={(e) => setEtichetta(e.target.value)}
          placeholder={t('adm.pri.etichettaEsempio')}
        />

        {errore && <div className="admin-error-text">{errore}</div>}

        <div className="admin-modal-btn-row">
          <button className="admin-modal-btn-cancel" onClick={() => setIdInModifica(null)}>{t('com.annulla')}</button>
          <button className="admin-modal-btn-confirm" onClick={salvaTariffa}>{t('com.salva')}</button>
        </div>
      </Modal>
    </div>
  );
}
