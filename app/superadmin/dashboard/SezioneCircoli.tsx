'use client';

// ============================================================
// CIRCOLI DELLA RETE — l'elenco non e' piu' in sola lettura: da qui
// si correggono i dati anagrafici e si sospende o si chiude un
// circolo.
//
// ⚠️ NON ESISTE UN PULSANTE "ELIMINA", ed e' voluto. Prenotazioni,
// tessere, sfide, movimenti e tornei citano il circolo per
// identificativo: cancellarne il documento lascerebbe centinaia di
// documenti che puntano al nulla, e sul telefono dei soci si
// tradurrebbe in schermate vuote senza spiegazione. Un circolo che
// esce dalla rete si CHIUDE — resta scritto, smette di funzionare.
// ============================================================

import { useEffect, useMemo, useState } from 'react';
import type { ChangeEvent } from 'react';
import { Circolo, statoCircolo, etichettaStatoCircolo, StatoCircolo } from '../../../data/circoli';
import { REGIONI_ITALIA, provinceDi } from '../../../data/tornei';
import {
  ascoltaCircoli, aggiornaAnagraficaCircolo, AnagraficaCircolo,
  sospendiCircolo, riattivaCircolo, chiudiCircolo,
  eliminaCircoloDefinitivo, impostaApprovazioneAutomatica,
} from '../../../data/circoliRepo';
import SchedaCircoloVista from './SchedaCircoloVista';

// I circoli si ordinano per stato e poi per nome: quelli che
// funzionano stanno in cima, i chiusi in fondo — sono quelli che si
// guardano meno spesso ma che non si possono nascondere.
const PESO_STATO: Record<StatoCircolo, number> = { attivo: 0, sospeso: 1, chiuso: 2 };

function dataLeggibile(ms?: number | null): string {
  if (!ms) return '';
  return new Date(ms).toLocaleDateString('it-IT', { day: '2-digit', month: 'long', year: 'numeric' });
}

// 'YYYY-MM-DD' -> millisecondi. Si costruisce a mezzogiorno e non a
// mezzanotte: a mezzanotte basta un fuso o l'ora legale perche' la
// data riletta torni indietro di un giorno.
function msDaGiorno(giorno: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(giorno)) return null;
  const [a, m, g] = giorno.split('-').map(Number);
  const d = new Date(a, m - 1, g, 12, 0, 0);
  return isNaN(d.getTime()) ? null : d.getTime();
}
function giornoDaMs(ms?: number): string {
  if (!ms) return '';
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

interface Modulo {
  nome: string; citta: string; sigla: string; regione: string; provincia: string; comune: string; password: string;
  richiedenteNome: string; richiedenteRuolo: string; richiedenteEmail: string; richiedenteTelefono: string;
  firmatarioNome: string; firmatarioRuolo: string; firmaIl: string;
  noteInterne: string; creatoIlGiorno: string;
}

function moduloDa(c: Circolo): Modulo {
  return {
    nome: c.nome ?? '', citta: c.citta ?? '', sigla: c.sigla ?? '',
    regione: c.regione ?? '', provincia: c.provincia ?? '', comune: c.comune ?? '',
    password: c.password ?? '',
    richiedenteNome: c.richiedenteNome ?? '', richiedenteRuolo: c.richiedenteRuolo ?? '',
    richiedenteEmail: c.richiedenteEmail ?? '', richiedenteTelefono: c.richiedenteTelefono ?? '',
    firmatarioNome: c.firmatarioNome ?? '', firmatarioRuolo: c.firmatarioRuolo ?? '',
    firmaIl: c.firmaIl ?? '', noteInterne: c.noteInterne ?? '',
    creatoIlGiorno: giornoDaMs(c.creatoIlMs),
  };
}

export default function SezioneCircoli() {
  const [circoli, setCircoli] = useState<Circolo[]>([]);
  const [apertoId, setApertoId] = useState<string | null>(null);
  const [modulo, setModulo] = useState<Modulo | null>(null);
  // ⚠️ Com'era il circolo QUANDO LA SCHEDA E' STATA APERTA. Serve a
  // capire cosa e' stato davvero toccato, e non si puo' ricavare dal
  // documento vivo: quello si aggiorna in tempo reale, quindi una
  // modifica fatta nel frattempo dall'Admin del circolo risulterebbe
  // "una differenza" e verrebbe rimandata indietro dal Super Admin —
  // esattamente il danno che questo confronto deve evitare.
  const [originale, setOriginale] = useState<Modulo | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [esito, setEsito] = useState('');
  const [errore, setErrore] = useState('');
  const [conferma, setConferma] = useState<'sospendi' | 'riattiva' | 'chiudi' | null>(null);
  // L'eliminazione vera ha una finestra sua, perche' chiede di
  // ricopiare il nome: mescolarla con le altre conferme avrebbe voluto
  // dire un modulo dentro una finestra che di solito non ne ha.
  const [eliminando, setEliminando] = useState(false);
  const [nomeScritto, setNomeScritto] = useState('');
  const [ancheAccessi, setAncheAccessi] = useState(false);
  const [inCancellazione, setInCancellazione] = useState(false);
  const [ricerca, setRicerca] = useState('');

  useEffect(() => ascoltaCircoli(setCircoli), []);

  const ordinati = useMemo(() => {
    const testo = ricerca.trim().toLowerCase();
    return circoli
      .filter((c) => testo.length === 0 ||
        `${c.nome ?? ''} ${c.citta ?? ''} ${c.sigla ?? ''}`.toLowerCase().includes(testo))
      .slice()
      .sort((a, b) => {
        const d = PESO_STATO[statoCircolo(a)] - PESO_STATO[statoCircolo(b)];
        return d !== 0 ? d : (a.nome ?? '').localeCompare(b.nome ?? '');
      });
  }, [circoli, ricerca]);

  // ⚠️ Il circolo aperto si ripesca SEMPRE dall'elenco in ascolto, non
  // si copia in uno stato locale: dopo una sospensione e' l'ascolto a
  // portare lo stato nuovo, e una copia resterebbe ferma a com'era.
  const aperto = apertoId ? (circoli.find((c) => c.id === apertoId) ?? null) : null;

  const apri = (c: Circolo) => {
    setApertoId(c.id);
    setModulo(moduloDa(c));
    setOriginale(moduloDa(c));
    setEsito(''); setErrore(''); setConferma(null);
  };
  const chiudiScheda = () => {
    setApertoId(null); setModulo(null); setOriginale(null);
    setEsito(''); setErrore(''); setConferma(null); setRicerca('');
  };

  const salva = async () => {
    if (!aperto || !modulo || !originale) return;
    if (!modulo.nome.trim() || !modulo.citta.trim() || !modulo.sigla.trim()) {
      setErrore('Nome, città e sigla non possono restare vuoti.');
      return;
    }
    // Stessa regola dell'onboarding: senza regione il circolo non
    // compare a nessuno nella bacheca Tornei. Si accetta il vuoto solo
    // se era gia' vuoto — togliergliela sarebbe un peggioramento, non
    // averla mai avuta e' un dato da recuperare con calma.
    // ⚠️ La provincia deve appartenere alla regione, e il controllo sta
    // qui perche' qui e' l'unico posto dove si scrivono. Cambiando
    // regione, il menu della provincia mostra una casella vuota — il
    // valore vecchio non e' fra le voci — ma resta nello stato e non
    // essendo cambiato non riparte: sul documento sarebbe rimasto un
    // circolo lombardo in provincia di Messina, e un banner venduto su
    // Messina gli sarebbe arrivato lo stesso. E' esattamente il danno
    // per cui questi campi sono stati tolti all'Admin.
    if (modulo.provincia.trim() && modulo.regione.trim()
      && !provinceDi(modulo.regione).includes(modulo.provincia)) {
      setErrore(`${modulo.provincia} non è una provincia della regione ${modulo.regione}: correggi prima la provincia.`);
      return;
    }
    if (!modulo.regione.trim() && (aperto.regione ?? '').trim()) {
      setErrore('La regione non si può togliere: serve ai Tornei per far trovare il circolo.');
      return;
    }
    setSalvando(true); setErrore(''); setEsito('');
    try {
      // ⚠️ SI SCRIVE SOLO QUELLO CHE E' STATO DAVVERO CAMBIATO.
      // Il modulo e' stato riempito quando la scheda si e' aperta: se
      // nel frattempo l'Admin del circolo ha cambiato la password dei
      // soci o la regione dalla sua Dashboard, rimandare tutti i campi
      // gliele riporterebbe indietro senza che nessuno se ne accorga.
      // Con il confronto, un campo non toccato non parte proprio.
      const dati: Partial<AnagraficaCircolo> = {};
      const metti = (chiave: keyof AnagraficaCircolo, valore: string, vuotoENull = true) => {
        const prima = String((originale as any)[chiave] ?? '').trim();
        const adesso = valore.trim();
        if (prima === adesso) return;
        (dati as any)[chiave] = adesso.length > 0 ? adesso : (vuotoENull ? null : '');
      };
      metti('nome', modulo.nome, false);
      metti('citta', modulo.citta, false);
      if (modulo.sigla.trim().toUpperCase() !== originale.sigla.trim().toUpperCase()) {
        dati.sigla = modulo.sigla.trim().toUpperCase();
      }
      metti('regione', modulo.regione);
      metti('provincia', modulo.provincia);
      metti('comune', modulo.comune);
      metti('password', modulo.password, false);
      metti('richiedenteNome', modulo.richiedenteNome);
      metti('richiedenteRuolo', modulo.richiedenteRuolo);
      metti('richiedenteEmail', modulo.richiedenteEmail);
      metti('richiedenteTelefono', modulo.richiedenteTelefono);
      metti('firmatarioNome', modulo.firmatarioNome);
      metti('firmatarioRuolo', modulo.firmatarioRuolo);
      metti('firmaIl', modulo.firmaIl);
      metti('noteInterne', modulo.noteInterne);

      // La data d'ingresso si scrive UNA VOLTA SOLA, e solo se manca:
      // e' il recupero manuale dei circoli nati prima che il campo
      // esistesse. Su un circolo che ce l'ha gia' non si tocca — non
      // e' un dato che si "corregge", e' quando e' successo.
      if (!aperto.creatoIlMs && modulo.creatoIlGiorno) {
        const ms = msDaGiorno(modulo.creatoIlGiorno);
        if (ms === null) { setErrore('Data di ingresso non valida.'); setSalvando(false); return; }
        dati.creatoIlMs = ms;
      }
      if (Object.keys(dati).length === 0) {
        setEsito('Nessuna modifica da salvare.');
        setSalvando(false);
        return;
      }
      await aggiornaAnagraficaCircolo(aperto.id, dati);
      // L'istantanea si riallinea a quello che si e' appena scritto:
      // un secondo "Salva" senza altre modifiche non deve rimandare
      // di nuovo gli stessi campi.
      setOriginale({ ...modulo });
      setEsito('Modifiche salvate.');
    } catch (err: any) {
      setErrore(err?.message ?? 'Salvataggio non riuscito.');
    } finally {
      setSalvando(false);
    }
  };

  const eseguiConferma = async () => {
    if (!aperto || !conferma) return;
    const azione = conferma;
    setConferma(null); setErrore(''); setEsito('');
    try {
      if (azione === 'sospendi') await sospendiCircolo(aperto.id);
      else if (azione === 'riattiva') await riattivaCircolo(aperto.id);
      else await chiudiCircolo(aperto.id);
      setEsito('Stato aggiornato.');
    } catch (err: any) {
      setErrore(err?.message ?? 'Operazione non riuscita.');
    }
  };

  // ---------------- Scheda del singolo circolo ----------------
  if (aperto && modulo) {
    const stato = statoCircolo(aperto);
    const agg = (k: keyof Modulo) => (
      e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
    ) => setModulo({ ...modulo, [k]: e.target.value });

    return (
      <div className="admin-card">
        <button
          className="admin-input" style={{ cursor: 'pointer', width: 'auto', marginBottom: '1rem' }}
          onClick={chiudiScheda}
        >
          ← Torna all&apos;elenco
        </button>

        <div className="admin-card-title">
          {aperto.nome}{' '}
          <span className={`superadmin-stato superadmin-stato-${stato}`}>{etichettaStatoCircolo(stato)}</span>
        </div>
        <p className="admin-card-hint">
          {aperto.creatoIlMs
            ? `In rete dal ${dataLeggibile(aperto.creatoIlMs)}.`
            : 'Data di ingresso in rete non registrata: questo circolo è nato prima che il dato venisse raccolto. Scrivila qui sotto, una volta sola.'}
          {stato === 'sospeso' && aperto.sospesoIlMs ? ` Sospeso il ${dataLeggibile(aperto.sospesoIlMs)}.` : ''}
          {stato === 'chiuso' && aperto.chiusoIlMs ? ` Chiuso il ${dataLeggibile(aperto.chiusoIlMs)}.` : ''}
        </p>

        {!aperto.creatoIlMs && (
          <>
            <label className="admin-label">Data di ingresso in rete</label>
            <input className="admin-input" type="date" value={modulo.creatoIlGiorno} onChange={agg('creatoIlGiorno')} />
          </>
        )}

        {/* ⚠️ Come sta il circolo PRIMA dei campi da correggere: chi
            apre un circolo quasi sempre vuole sapere come va, non
            correggergli la sigla. */}
        <SchedaCircoloVista circoloId={aperto.id} />

        <div className="superadmin-subtitolo">Anagrafica</div>

        <label className="admin-label">Nome del circolo</label>
        <input className="admin-input" value={modulo.nome} onChange={agg('nome')} />

        <div className="admin-row" style={{ marginTop: '.6rem' }}>
          <div style={{ flex: 2 }}>
            <label className="admin-label">Città</label>
            <input className="admin-input" value={modulo.citta} onChange={agg('citta')} />
          </div>
          <div style={{ flex: 1 }}>
            <label className="admin-label">Sigla</label>
            <input className="admin-input" value={modulo.sigla} onChange={agg('sigla')} maxLength={4} />
          </div>
        </div>

        {/* ⚠️ LA GEOGRAFIA LA SCRIVE SOLO CHI STA QUI. Regione,
            provincia e comune decidono a quali circoli arriva un banner
            venduto su una zona e dove si vedono i tornei: nella
            dashboard dell'Admin sono in sola lettura, e le regole
            Firestore glieli rifiutano anche se ci provasse da fuori. Un
            circolo che si trasferisce davvero chiama Racket Fever. */}
        <label className="admin-label">Regione</label>
        <select
          className="admin-select"
          value={modulo.regione}
          onChange={(e) => {
            const nuova = e.target.value;
            setModulo((m) => (m === null ? m : {
              ...m,
              regione: nuova,
              // Se la provincia non appartiene alla regione nuova cade:
              // meglio un campo vuoto da ricompilare che uno pieno di un
              // valore che non si vede piu' nel menu.
              provincia: nuova && provinceDi(nuova).includes(m.provincia) ? m.provincia : '',
            }));
          }}
        >
          <option value="">— non indicata —</option>
          {REGIONI_ITALIA.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>

        <div className="admin-row" style={{ gap: '.8rem' }}>
          <div style={{ flex: 1 }}>
            <label className="admin-label">Provincia</label>
            <select className="admin-select" value={modulo.provincia} onChange={agg('provincia')}>
              <option value="">— non indicata —</option>
              {provinceDi(modulo.regione || null).map((pr) => <option key={pr} value={pr}>{pr}</option>)}
            </select>
          </div>
          <div style={{ flex: 1 }}>
            <label className="admin-label">Comune</label>
            <input className="admin-input" value={modulo.comune} onChange={agg('comune')} maxLength={80} />
          </div>
        </div>
        <p className="admin-card-hint" style={{ marginTop: '.4rem', marginBottom: 0 }}>
          Regione e provincia decidono dove si vedono i tornei del circolo e quali banner di
          rete gli arrivano. Il circolo non può cambiarle da solo: verificale all&apos;ingresso
          in rete.
        </p>

        <label className="admin-label">Password d&apos;accesso soci</label>
        <input className="admin-input" value={modulo.password} onChange={agg('password')} />

        <div className="superadmin-subtitolo">Chi ha chiesto l&apos;adesione</div>
        <div className="admin-row">
          <div>
            <label className="admin-label">Nome e cognome</label>
            <input className="admin-input" value={modulo.richiedenteNome} onChange={agg('richiedenteNome')} />
          </div>
          <div>
            <label className="admin-label">Ruolo nel circolo</label>
            <input className="admin-input" value={modulo.richiedenteRuolo} onChange={agg('richiedenteRuolo')} placeholder="Segretario" />
          </div>
        </div>
        <div className="admin-row">
          <div>
            <label className="admin-label">Email</label>
            <input className="admin-input" type="email" value={modulo.richiedenteEmail} onChange={agg('richiedenteEmail')} />
          </div>
          <div>
            <label className="admin-label">Telefono</label>
            <input className="admin-input" value={modulo.richiedenteTelefono} onChange={agg('richiedenteTelefono')} />
          </div>
        </div>

        <div className="superadmin-subtitolo">Chi ha firmato il contratto</div>
        <div className="admin-row">
          <div>
            <label className="admin-label">Nome e cognome</label>
            <input className="admin-input" value={modulo.firmatarioNome} onChange={agg('firmatarioNome')} />
          </div>
          <div>
            <label className="admin-label">Ruolo nel circolo</label>
            <input className="admin-input" value={modulo.firmatarioRuolo} onChange={agg('firmatarioRuolo')} placeholder="Presidente" />
          </div>
        </div>
        <label className="admin-label">Data della firma</label>
        <input className="admin-input" type="date" value={modulo.firmaIl} onChange={agg('firmaIl')} />

        <div className="superadmin-subtitolo">Note interne</div>
        <p className="admin-card-hint">
          Non escono da qui: non le vede né l&apos;Admin del circolo né i soci. Servono a chi
          prenderà in mano questo circolo dopo di te.
        </p>
        <textarea
          className="admin-input" rows={4} value={modulo.noteInterne} onChange={agg('noteInterne')}
          style={{ resize: 'vertical', fontFamily: 'inherit' }}
        />

        {errore && <div className="admin-error-text">{errore}</div>}
        {esito && <div className="admin-saving">{esito}</div>}

        <button className="admin-btn-full" onClick={salva} disabled={salvando}>
          {salvando ? 'Salvataggio…' : 'Salva modifiche'}
        </button>

        <div className="superadmin-subtitolo">Presenza nella rete</div>
        {stato === 'attivo' && (
          <>
            <p className="admin-card-hint">
              Sospendere il circolo lo toglie dall&apos;elenco di scelta dell&apos;app, blocca le nuove
              tessere e le nuove prenotazioni. Tutto il resto resta leggibile: i soci già dentro
              continuano a vedere storico, classifica e prenotazioni già confermate. Si può
              annullare in qualsiasi momento.
            </p>
            <button className="admin-btn-full admin-btn-danger" onClick={() => setConferma('sospendi')}>
              Sospendi il circolo
            </button>
          </>
        )}
        {stato === 'sospeso' && (
          <>
            <p className="admin-card-hint">
              Il circolo è sospeso. Puoi riattivarlo — torna tutto come prima — oppure chiuderlo
              in via definitiva.
            </p>
            <button className="admin-btn-full" onClick={() => setConferma('riattiva')}>
              Riattiva il circolo
            </button>
            <button className="admin-btn-full admin-btn-danger" onClick={() => setConferma('chiudi')}>
              Chiudi definitivamente
            </button>
          </>
        )}
        {stato === 'chiuso' && (
          <p className="admin-card-hint">
            Il circolo è chiuso: non fa più parte della rete e non si può riaprire da qui. I suoi
            dati restano scritti — prenotazioni, movimenti e tessere continuano ad avere un
            circolo a cui riferirsi.
          </p>
        )}

        <div className="superadmin-subtitolo">Circolo dimostrativo</div>
        <p className="admin-card-hint">
          Con l&apos;approvazione automatica accesa, chi chiede di entrare in questo circolo viene
          ammesso all&apos;istante, senza che nessuno tocchi «Approva». Serve per i revisori di
          Google e Apple, che aprono l&apos;app quando vogliono loro e non hanno nessuno dall&apos;altra
          parte ad aspettarli. ⚠️ Su un circolo vero non va accesa mai: da quando non c&apos;è più
          la password d&apos;ingresso, l&apos;approvazione a mano è l&apos;unica porta che ha.
        </p>
        <button
          className={aperto.approvazioneAutomatica ? 'admin-btn-full admin-btn-danger' : 'admin-btn-full'}
          onClick={async () => {
            try {
              await impostaApprovazioneAutomatica(aperto.id, !aperto.approvazioneAutomatica);
            } catch {
              setErrore('Non sono riuscito a cambiare l’approvazione automatica.');
            }
          }}
        >
          {aperto.approvazioneAutomatica
            ? 'Approvazione automatica ACCESA — spegnila'
            : 'Accendi l’approvazione automatica'}
        </button>

        <div className="superadmin-subtitolo">Eliminazione definitiva</div>
        <p className="admin-card-hint">
          Diversa da «Chiudi»: qui spariscono i <strong>dati</strong> — tessere, prenotazioni,
          movimenti, sfide, lezioni, bacheca, tornei, campi, immagini. Serve a ripulire i circoli
          di prova. Gli account dei soci non vengono toccati: sparisce solo la loro tessera con
          questo circolo, perché possono essere soci anche altrove.
        </p>
        <button className="admin-btn-full admin-btn-danger" onClick={() => { setEliminando(true); setNomeScritto(''); setAncheAccessi(false); }}>
          Elimina definitivamente
        </button>

        {eliminando && (
          <div className="admin-modal-backdrop" onClick={() => !inCancellazione && setEliminando(false)}>
            <div className="admin-modal-card" onClick={(e) => e.stopPropagation()}>
              <div className="admin-modal-title">Eliminare {aperto.nome}?</div>
              <p className="admin-modal-sub">
                Spariscono tutti i dati di questo circolo e non si torna indietro. Per confermare,
                riscrivi il nome esatto del circolo.
              </p>
              <input
                className="admin-input"
                value={nomeScritto}
                onChange={(e) => setNomeScritto(e.target.value)}
                placeholder={aperto.nome}
                disabled={inCancellazione}
              />
              <label className="admin-card-hint" style={{ display: 'flex', gap: '.5rem', alignItems: 'flex-start', marginTop: '.6rem' }}>
                <input
                  type="checkbox"
                  checked={ancheAccessi}
                  onChange={(e) => setAncheAccessi(e.target.checked)}
                  disabled={inCancellazione}
                />
                <span>
                  Cancella anche gli accessi di Admin e Maestri di questo circolo (libera le loro
                  email per riusarle). Senza la spunta restano, ma non appartengono più a nessun circolo.
                </span>
              </label>
              <div className="admin-modal-btn-row">
                <button
                  className="admin-modal-btn-cancel"
                  onClick={() => setEliminando(false)}
                  disabled={inCancellazione}
                >
                  Indietro
                </button>
                <button
                  className="admin-modal-btn-confirm danger"
                  disabled={inCancellazione || nomeScritto.trim().toLowerCase() !== aperto.nome.trim().toLowerCase()}
                  onClick={async () => {
                    setInCancellazione(true);
                    setErrore('');
                    try {
                      await eliminaCircoloDefinitivo(aperto.id, nomeScritto, ancheAccessi);
                      setEliminando(false);
                      chiudiScheda();
                    } catch (e: any) {
                      setErrore(e?.message ?? 'Non sono riuscito a eliminare il circolo.');
                    } finally {
                      setInCancellazione(false);
                    }
                  }}
                >
                  {inCancellazione ? 'Elimino…' : 'Elimina tutto'}
                </button>
              </div>
            </div>
          </div>
        )}

        {conferma && (
          <div className="admin-modal-backdrop" onClick={() => setConferma(null)}>
            <div className="admin-modal-card" onClick={(e) => e.stopPropagation()}>
              <div className="admin-modal-title">
                {conferma === 'sospendi' && 'Sospendere il circolo?'}
                {conferma === 'riattiva' && 'Riattivare il circolo?'}
                {conferma === 'chiudi' && 'Chiudere definitivamente?'}
              </div>
              <p className="admin-modal-sub">
                {conferma === 'sospendi' &&
                  `${aperto.nome} sparirà dall'elenco dei circoli nell'app e non accetterà più nuove tessere né nuove prenotazioni. I soci già dentro continuano a vedere i loro dati. Si può annullare.`}
                {conferma === 'riattiva' &&
                  `${aperto.nome} torna visibile nell'app e riprende ad accettare tessere e prenotazioni.`}
                {conferma === 'chiudi' &&
                  `${aperto.nome} uscirà dalla rete Racket Fever. Non si torna indietro da questa schermata: per riaprirlo servirà un intervento tecnico. I dati restano scritti.`}
              </p>
              <div className="admin-modal-btn-row">
                <button className="admin-modal-btn-cancel" onClick={() => setConferma(null)}>Indietro</button>
                <button
                  className={`admin-modal-btn-confirm${conferma === 'riattiva' ? '' : ' danger'}`}
                  onClick={eseguiConferma}
                >
                  {conferma === 'sospendi' && 'Sospendi'}
                  {conferma === 'riattiva' && 'Riattiva'}
                  {conferma === 'chiudi' && 'Chiudi'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ---------------- Elenco ----------------
  const attivi = circoli.filter((c) => statoCircolo(c) === 'attivo').length;
  const sospesi = circoli.filter((c) => statoCircolo(c) === 'sospeso').length;
  const chiusi = circoli.filter((c) => statoCircolo(c) === 'chiuso').length;

  return (
    <div className="admin-card">
      <div className="admin-card-title">Circoli della rete ({circoli.length})</div>
      <p className="admin-card-hint">
        {attivi} attivi{sospesi > 0 ? `, ${sospesi} sospesi` : ''}{chiusi > 0 ? `, ${chiusi} chiusi` : ''}.
        Apri un circolo per correggerne i dati o cambiarne lo stato nella rete.
      </p>

      {(circoli.length > 6 || ricerca.length > 0) && (
        <input
          className="admin-input" value={ricerca} onChange={(e) => setRicerca(e.target.value)}
          placeholder="Cerca per nome, città o sigla" style={{ marginBottom: '.8rem' }}
        />
      )}

      {circoli.length === 0 && <p className="admin-empty-text">Nessun circolo ancora creato.</p>}
      {circoli.length > 0 && ordinati.length === 0 && (
        <p className="admin-empty-text">Nessun circolo corrisponde alla ricerca.</p>
      )}

      {ordinati.map((c) => {
        const stato = statoCircolo(c);
        return (
          <div
            key={c.id} className="admin-list-row admin-list-row-clickable"
            onClick={() => apri(c)} role="button" tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); apri(c); }
            }}
          >
            {c.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={c.logoUrl} alt="" className="admin-list-avatar" />
            ) : (
              // Segnaposto per il circolo senza logo: il vecchio campo
              // "tema" non esiste piu' (sostituito dagli 8 TEMI_APP), si
              // usa il colore istituzionale.
              <div className="superadmin-swatch" style={{ background: '#0E3B2E' }} />
            )}
            <div style={{ flex: 1 }}>
              <div className="admin-list-main">{c.nome}</div>
              <div className="admin-list-sub">
                {c.citta} · {c.sigla}{c.provincia ? ` (${c.provincia})` : ''}{c.regione ? ` · ${c.regione}` : ''}
              </div>
            </div>
            {stato !== 'attivo' && (
              <span className={`superadmin-stato superadmin-stato-${stato}`}>{etichettaStatoCircolo(stato)}</span>
            )}
          </div>
        );
      })}
    </div>
  );
}
