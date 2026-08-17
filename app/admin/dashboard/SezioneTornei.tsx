'use client';

// ============================================================
// TORNEI — la sezione con cui l'Admin pubblica sulla bacheca.
//
// ⚠️ E' l'unica cosa che l'Admin pubblica FUORI dal proprio circolo.
// Tutto il resto di questa dashboard riguarda i suoi campi, i suoi
// soci, i suoi prezzi; un torneo invece finisce sul telefono di soci
// che non ha mai visto. Per questo la copertura e' una scelta
// esplicita e non un valore di serie: chi pubblica deve sapere fin
// dove sta mandando quello che scrive.
// ============================================================

import { useEffect, useState } from 'react';
import { Circolo } from '../../../data/circoli';
import { aggiornaCircolo } from '../../../data/circoliRepo';
import {
  Torneo, TIPOLOGIE_TORNEO, REGIONI_ITALIA, MACROAREE, TUTTA_ITALIA,
  statoTorneo, etichettaStato, periodoTorneo, torneoDaMostrare, ordinaTornei,
  SportTorneo, sportDi, provinceDi,
} from '../../../data/tornei';
import { creaTorneo, rimuoviTorneo, ascoltaTorneiCircolo } from '../../../data/torneiRepo';

export default function SezioneTornei({ circolo }: { circolo: Circolo }) {
  const [nome, setNome] = useState('');
  const [tipologia, setTipologia] = useState<string>(TIPOLOGIE_TORNEO[0]);
  const [sport, setSport] = useState<SportTorneo>('tennis');
  const [dataInizio, setDataInizio] = useState('');
  const [dataFine, setDataFine] = useState('');
  const [scadenza, setScadenza] = useState('');
  const [link, setLink] = useState('');
  const [luogo, setLuogo] = useState('');
  // Parte dalla provincia del circolo: quasi tutti i tornei si giocano
  // in casa, e chi fa diversamente cambia una voce.
  const [provincia, setProvincia] = useState(circolo.provincia ?? '');
  const [note, setNote] = useState('');
  const [regioni, setRegioni] = useState<string[]>(circolo.regione ? [circolo.regione] : []);
  const [nazionale, setNazionale] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [errore, setErrore] = useState('');
  const [miei, setMiei] = useState<Torneo[]>([]);
  const [daRimuovere, setDaRimuovere] = useState<Torneo | null>(null);

  // ⚠️ La provincia cade quando cambia la regione del circolo. Senza,
  // chi sceglieva Messina e poi correggeva la regione in Lombardia
  // pubblicava un torneo con una provincia siciliana — e nel menu a
  // tendina non lo vedeva nemmeno, perche' un valore che non e' fra le
  // voci disponibili si mostra come casella vuota.
  useEffect(() => {
    if (provincia && !provinceDi(circolo.regione).includes(provincia)) setProvincia('');
  }, [circolo.regione, provincia]);

  useEffect(() => ascoltaTorneiCircolo(circolo.id, setMiei), [circolo.id]);

  useEffect(() => {
    if (circolo.regione) setRegioni((r) => (r.length === 0 ? [circolo.regione as string] : r));
  }, [circolo.regione]);

  const cambiaRegione = (r: string) => {
    setRegioni((elenco) => (elenco.includes(r) ? elenco.filter((x) => x !== r) : [...elenco, r]));
  };
  const aggiungiMacro = (elenco: string[]) => {
    setRegioni((attuali) => {
      const tutte = elenco.every((r) => attuali.includes(r));
      return tutte ? attuali.filter((r) => !elenco.includes(r)) : Array.from(new Set([...attuali, ...elenco]));
    });
  };

  const pubblica = async () => {
    setErrore('');
    if (!nome.trim()) { setErrore('Manca il nome del torneo.'); return; }
    if (!dataInizio) { setErrore('Manca la data di inizio.'); return; }
    if (dataFine && dataFine < dataInizio) { setErrore('La data di fine viene prima di quella di inizio.'); return; }
    if (scadenza && scadenza > dataInizio) { setErrore('Le iscrizioni scadono dopo l’inizio del torneo: controlla le date.'); return; }
    // ⚠️ Senza copertura il torneo non lo vedrebbe nessuno, nemmeno i
    // soci del circolo che lo pubblica.
    if (!nazionale && regioni.length === 0) { setErrore('Scegli almeno una regione, oppure tutta Italia.'); return; }
    setSalvando(true);
    try {
      await creaTorneo({
        circoloId: circolo.id,
        circoloNome: circolo.nome,
        luogo: luogo.trim() || undefined,
        // Vuota = campo assente: `ripulisci` scarta gli undefined, e una
        // stringa vuota sul documento sarebbe una provincia inesistente.
        provincia: provincia || undefined,
        nome: nome.trim(),
        tipologia,
        sport,
        dataInizio,
        dataFine: dataFine || undefined,
        scadenzaIscrizioni: scadenza || undefined,
        linkIscrizione: link.trim() || undefined,
        // La copertura nazionale sostituisce le regioni: spuntarle
        // tutte e venti sarebbe la stessa cosa scritta peggio.
        // La propria ci finisce SEMPRE: e' la dimenticanza piu' facile,
        // e lascerebbe i soci di casa senza il torneo del loro circolo.
        regioni: nazionale
          ? [TUTTA_ITALIA]
          : Array.from(new Set([...regioni, ...(circolo.regione ? [circolo.regione] : [])])),
        note: note.trim() || undefined,
      });
      setNome(''); setDataInizio(''); setDataFine(''); setScadenza('');
      setLink(''); setLuogo(''); setNote(''); setProvincia(circolo.provincia ?? '');
    } catch (e: any) {
      setErrore(e?.message ?? 'Non sono riuscito a pubblicare. Riprova.');
    } finally {
      setSalvando(false);
    }
  };

  const elenco = ordinaTornei(miei, [], new Date());

  return (
    <div className="admin-card">
      <div className="admin-card-title">Pubblica un torneo</div>
      <p className="admin-card-hint">
        Il torneo compare nella pagina Tornei dei soci del tuo circolo e di tutti i circoli
        della rete che stanno nelle regioni che scegli. Dentro l&apos;app non ci si iscrive:
        il socio tocca la card e arriva alla pagina di iscrizione vera.
      </p>

      {/* ⚠️ La regione del circolo si imposta qui e non in una sezione
          sua: e' l'unica cosa che la usa. */}
      <div className="admin-row" style={{ alignItems: 'center', gap: '.6rem', marginBottom: '.6rem' }}>
        <span style={{ fontWeight: 700, fontSize: '.9rem' }}>Regione del circolo:</span>
        <select
          className="admin-input"
          style={{ maxWidth: 260 }}
          value={circolo.regione ?? ''}
          onChange={async (e) => {
            const r = e.target.value;
            if (!r) return;
            try { await aggiornaCircolo(circolo.id, { regione: r }); } catch { /* lo dira' il prossimo tentativo */ }
          }}
        >
          <option value="">— da scegliere —</option>
          {REGIONI_ITALIA.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
      </div>
      {!circolo.regione && (
        <p className="admin-card-hint" style={{ color: '#B3261E' }}>
          Senza regione i tuoi soci non trovano i tornei della loro zona, e la bacheca si apre
          su tutta Italia invece che su quello che hanno vicino.
        </p>
      )}

      {/* ⚠️ LA PROVINCIA DEL CIRCOLO, che e' un'altra cosa da quella del
          torneo qui sotto: questa dice dove sta il circolo, quella dove
          si gioca. Sta qui accanto alla regione perche' e' la stessa
          anagrafica e si compila una volta sola. */}
      <div className="admin-row" style={{ alignItems: 'center', gap: '.6rem', marginBottom: '.6rem' }}>
        <span style={{ fontWeight: 700, fontSize: '.9rem' }}>Provincia del circolo:</span>
        <select
          className="admin-input"
          style={{ maxWidth: 260 }}
          value={circolo.provincia ?? ''}
          onChange={async (e) => {
            const pr = e.target.value;
            if (!pr) return;
            try { await aggiornaCircolo(circolo.id, { provincia: pr }); } catch { /* lo dira' il prossimo tentativo */ }
          }}
        >
          <option value="">— da scegliere —</option>
          {provinceDi(circolo.regione).map((pr) => <option key={pr} value={pr}>{pr}</option>)}
        </select>
      </div>

      {/* ⚠️ LA PROVINCIA E' DEL TORNEO, non del circolo, e sta qui
          sotto la regione perche' e' da quella che l'elenco si accorcia:
          scelta la Sicilia si scelgono nove province, non centosette. */}
      <div className="admin-row" style={{ alignItems: 'center', gap: '.6rem', marginBottom: '.6rem' }}>
        <span style={{ fontWeight: 700, fontSize: '.9rem' }}>Provincia del torneo:</span>
        <select
          className="admin-input"
          style={{ maxWidth: 260 }}
          value={provincia}
          onChange={(e) => setProvincia(e.target.value)}
        >
          <option value="">— non indicata —</option>
          {provinceDi(circolo.regione).map((pr) => <option key={pr} value={pr}>{pr}</option>)}
        </select>
      </div>

      <input
        className="admin-input" value={nome} onChange={(e) => setNome(e.target.value)}
        placeholder="Nome del torneo" style={{ marginTop: '.6rem' }}
      />

      {/* ⚠️ Due scelte alternative, non due caselle da spuntare: un
          torneo e' di tennis O di padel, e con due caselle si poteva
          lasciarle vuote entrambe o accenderle tutte e due. */}
      <div className="admin-card-hint" style={{ marginTop: '.8rem', fontWeight: 700 }}>Sport</div>
      <div style={{ display: 'flex', gap: '.4rem' }}>
        {(['tennis', 'padel'] as SportTorneo[]).map((sp) => (
          <button
            key={sp}
            className={sport === sp ? 'admin-btn-full' : 'admin-input'}
            style={{
              width: 'auto', padding: '.45rem .9rem', fontSize: '.85rem', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: '.45rem',
            }}
            onClick={() => setSport(sp)}
          >
            <img
              src={sp === 'padel' ? '/padel-racket-black.png' : '/tennis-racket-black.png'}
              alt="" width={16} height={16}
              style={{ filter: sport === sp ? 'invert(1) brightness(2)' : 'none' }}
            />
            {sp === 'padel' ? 'Padel' : 'Tennis'}
          </button>
        ))}
      </div>

      <div className="admin-card-hint" style={{ marginTop: '.8rem', fontWeight: 700 }}>Tipologia</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '.4rem' }}>
        {TIPOLOGIE_TORNEO.map((t) => (
          <button
            key={t}
            className={tipologia === t ? 'admin-btn-full' : 'admin-input'}
            style={{ width: 'auto', padding: '.45rem .8rem', fontSize: '.85rem', cursor: 'pointer' }}
            onClick={() => setTipologia(t)}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="admin-card-hint" style={{ marginTop: '.8rem', fontWeight: 700 }}>Date</div>
      <div className="admin-row">
        <input className="admin-input" type="date" value={dataInizio} onChange={(e) => setDataInizio(e.target.value)} />
        <input className="admin-input" type="date" value={dataFine} onChange={(e) => setDataFine(e.target.value)} />
        <input className="admin-input" type="date" value={scadenza} onChange={(e) => setScadenza(e.target.value)} />
      </div>
      <p className="admin-card-hint">Inizio, fine (facoltativa) e scadenza delle iscrizioni (facoltativa).</p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '.5rem', marginTop: '.6rem' }}>
        <input className="admin-input" value={luogo} onChange={(e) => setLuogo(e.target.value)} placeholder="Luogo, es. Mistretta (ME)" />
        <input className="admin-input" value={link} onChange={(e) => setLink(e.target.value)} placeholder="Link alla pagina di iscrizione" />
        <textarea className="admin-input" value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="Nota (facoltativa), es. categorie ammesse" />
      </div>

      <div className="admin-card-hint" style={{ marginTop: '.8rem', fontWeight: 700 }}>Dove si vede</div>
      <label style={{ display: 'flex', alignItems: 'center', gap: '.5rem', marginBottom: '.5rem' }}>
        <input type="checkbox" checked={nazionale} onChange={(e) => setNazionale(e.target.checked)} />
        <span style={{ fontWeight: 700 }}>Tutta Italia</span>
      </label>

      {!nazionale && (
        <>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '.4rem', marginBottom: '.5rem' }}>
            {MACROAREE.map((mm) => (
              <button
                key={mm.nome} className="admin-input"
                style={{ width: 'auto', padding: '.3rem .7rem', fontSize: '.8rem', cursor: 'pointer' }}
                onClick={() => aggiungiMacro(mm.regioni as unknown as string[])}
              >
                {mm.nome}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '.4rem' }}>
            {REGIONI_ITALIA.map((r) => (
              <button
                key={r}
                className={regioni.includes(r) ? 'admin-btn-full' : 'admin-input'}
                style={{ width: 'auto', padding: '.35rem .7rem', fontSize: '.8rem', cursor: 'pointer' }}
                onClick={() => cambiaRegione(r)}
              >
                {r}
              </button>
            ))}
          </div>
        </>
      )}

      {!!errore && <div className="admin-error-text" style={{ marginTop: '.6rem' }}>{errore}</div>}

      <button className="admin-btn-full" onClick={pubblica} disabled={salvando}>
        {salvando ? 'Attendere…' : '+ Pubblica torneo'}
      </button>

      <div className="admin-card-title" style={{ marginTop: '1.4rem' }}>I tornei del circolo</div>
      {elenco.length === 0 && <p className="admin-card-hint">Non hai ancora pubblicato nessun torneo.</p>}
      {elenco.map((t) => (
        <div key={t.id} className="admin-list-row">
          <div style={{ flex: 1 }}>
            <div className="admin-list-main">{t.nome}</div>
            <div className="admin-list-sub">
              {sportDi(t) === 'padel' ? 'Padel' : 'Tennis'} · {t.tipologia} · {periodoTorneo(t)} · {etichettaStato(statoTorneo(t))}
            </div>
            {/* Passati i quindici giorni sparisce ai soci ma resta qui:
                e' l'archivio da cui si ripesca l'anno dopo. */}
            {!torneoDaMostrare(t) && <div className="admin-list-sub">Non più visibile ai soci (archivio)</div>}
          </div>
          <button className="admin-icon-btn danger" onClick={() => setDaRimuovere(t)} aria-label="Rimuovi">🗑</button>
        </div>
      ))}

      {daRimuovere && (
        <div className="admin-modal-backdrop" onClick={() => setDaRimuovere(null)}>
          <div className="admin-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="admin-card-title">Rimuovere il torneo?</div>
            <p className="admin-card-hint">
              «{daRimuovere.nome}» sparirà dalla bacheca di tutti i circoli in cui si vede.
              Non si può annullare.
            </p>
            <div className="admin-row" style={{ marginTop: '.8rem' }}>
              <button className="admin-input" style={{ cursor: 'pointer' }} onClick={() => setDaRimuovere(null)}>Indietro</button>
              <button
                className="admin-btn-full"
                style={{ background: '#B3261E' }}
                onClick={async () => {
                  const id = daRimuovere.id;
                  setDaRimuovere(null);
                  try { await rimuoviTorneo(id); } catch { /* resta in elenco, si riprova */ }
                }}
              >
                Rimuovi il torneo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
