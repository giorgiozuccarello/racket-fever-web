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
import {
  Torneo, TIPOLOGIE_TORNEO, REGIONI_ITALIA, MACROAREE, TUTTA_ITALIA,
  statoTorneo, etichettaStato, periodoTorneo, torneoDaMostrare, ordinaTornei,
  SportTorneo, sportDi,
} from '../../../data/tornei';
import { creaTorneo, aggiornaTorneo, rimuoviTorneo, ascoltaTorneiCircolo } from '../../../data/torneiRepo';

export default function SezioneTornei({ circolo }: { circolo: Circolo }) {
  const [nome, setNome] = useState('');
  const [tipologia, setTipologia] = useState<string>(TIPOLOGIE_TORNEO[0]);
  const [sport, setSport] = useState<SportTorneo>('tennis');
  const [dataInizio, setDataInizio] = useState('');
  const [dataFine, setDataFine] = useState('');
  const [scadenza, setScadenza] = useState('');
  const [link, setLink] = useState('');
  const [luogo, setLuogo] = useState('');
  const [note, setNote] = useState('');
  const [regioni, setRegioni] = useState<string[]>(circolo.regione ? [circolo.regione] : []);
  const [nazionale, setNazionale] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [errore, setErrore] = useState('');
  const [miei, setMiei] = useState<Torneo[]>([]);
  const [daRimuovere, setDaRimuovere] = useState<Torneo | null>(null);
  // ⚠️ Un torneo pubblicato si correggeva solo togliendolo e
  // rifacendolo: chi sbagliava una data — il caso piu' frequente di
  // tutti — lo faceva sparire dalla bacheca di mezza rete e ricomparire
  // qualche minuto dopo, con un altro identificativo. Da qui si riapre
  // lo stesso modulo sul torneo che c'e' gia'.
  const [inModifica, setInModifica] = useState<Torneo | null>(null);


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

  const apriModifica = (t: Torneo) => {
    setErrore('');
    setInModifica(t);
    setNome(t.nome ?? '');
    setTipologia(t.tipologia ?? TIPOLOGIE_TORNEO[0]);
    setSport(sportDi(t));
    setDataInizio(t.dataInizio ?? '');
    setDataFine(t.dataFine ?? '');
    setScadenza(t.scadenzaIscrizioni ?? '');
    setLink(t.linkIscrizione ?? '');
    setLuogo(t.luogo ?? '');
    setNote(t.note ?? '');
    const zone = t.regioni ?? [];
    setNazionale(zone.includes(TUTTA_ITALIA));
    setRegioni(zone.filter((r) => r !== TUTTA_ITALIA));
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const azzeraModulo = () => {
    setInModifica(null);
    setNome(''); setDataInizio(''); setDataFine(''); setScadenza('');
    setLink(''); setLuogo(''); setNote('');
    setNazionale(false);
    setRegioni(circolo.regione ? [circolo.regione] : []);
    // ⚠️ Anche questi due: senza, chi modificava un torneo di padel si
    // ritrovava il modulo su padel per il torneo successivo, e lo
    // pubblicava cosi' senza accorgersene.
    setTipologia(TIPOLOGIE_TORNEO[0]);
    setSport('tennis');
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
      const dati = {
        circoloId: circolo.id,
        circoloNome: circolo.nome,
        luogo: luogo.trim() || undefined,

        // ⚠️ LA PROVINCIA SI EREDITA DALL'ANAGRAFICA, non si sceglie
        // piu': e' quella del circolo che organizza. Se il torneo si
        // gioca da un'altra parte lo si scrive nelle note — succede di
        // rado, e un campo in piu' su ogni torneo per un caso raro
        // voleva dire un campo sbagliato su tanti tornei.
        // In modifica va messa a null se il circolo non ne ha piu' una:
        // con `undefined` il campo non si tocca, e il torneo terrebbe
        // per sempre la provincia di prima.
        provincia: circolo.provincia || (inModifica ? null : undefined),
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
      };
      // ⚠️ In MODIFICA i facoltativi svuotati vanno messi a null: con
      // `undefined` il campo non viene toccato, e un link cancellato dal
      // modulo resterebbe scritto sul torneo — cioe' il socio
      // continuerebbe a finire su una pagina di iscrizione chiusa.
      if (inModifica) {
        await aggiornaTorneo(inModifica.id, {
          ...dati,
          luogo: luogo.trim() || null as any,
          dataFine: dataFine || null as any,
          scadenzaIscrizioni: scadenza || null as any,
          linkIscrizione: link.trim() || null as any,
          // ⚠️ LE NOTE VUOTE SONO STRINGA VUOTA, NON null, e la
          // differenza qui vale tutta la funzione. Le regole controllano
          // la lunghezza delle note con `.get('note','')`, e quel
          // default vale solo a CHIAVE ASSENTE: con la chiave presente e
          // il valore a null si prende il null, e `null.size()` non e'
          // «zero», e' un errore di valutazione — cioe' scrittura
          // respinta. Sarebbe fallita ogni modifica di un torneo senza
          // note, cioe' quasi tutte: proprio il caso — correggere una
          // data — per cui la modifica e' stata fatta.
          note: note.trim(),
        });
      } else {
        await creaTorneo(dati);
      }
      azzeraModulo();
    } catch (e: any) {
      setErrore(e?.message ?? 'Non sono riuscito a pubblicare. Riprova.');
    } finally {
      setSalvando(false);
    }
  };

  const elenco = ordinaTornei(miei, [], new Date());

  return (
    <div className="admin-card">
      <div className="admin-card-title">{inModifica ? 'Modifica il torneo' : 'Pubblica un torneo'}</div>
      <p className="admin-card-hint">
        Il torneo compare nella pagina Tornei dei soci del tuo circolo e di tutti i circoli
        della rete che stanno nelle regioni che scegli. Dentro l&apos;app non ci si iscrive:
        il socio tocca la card e arriva alla pagina di iscrizione vera.
      </p>

      {/* ⚠️ REGIONE E PROVINCIA NON SI TOCCANO PIU' DA QUI. Erano due
          selettori, e decidevano dove si vedono i tornei del circolo e
          quali banner di rete gli arrivano: cose vendute a terzi. Da
          adesso le scrive e le verifica Racket Fever all'ingresso in
          rete, e le regole Firestore rifiutano la scrittura anche a chi
          ci provasse da fuori. Qui restano in sola lettura, che e'
          quello che serve davvero: sapere con che geografia si lavora. */}
      <div className="admin-card-hint" style={{ marginBottom: '.6rem' }}>
        <strong>Il circolo risulta in:</strong>{' '}
        {circolo.regione || '— regione non indicata —'}
        {circolo.provincia ? `, provincia di ${circolo.provincia}` : ''}
        {circolo.comune ? `, ${circolo.comune}` : ''}.
        {(!circolo.regione || !circolo.provincia) && (
          <span style={{ color: '#B3261E' }}>
            {' '}Finché mancano, i tuoi soci non trovano i tornei della vostra zona.
            Scrivici e li sistemiamo.
          </span>
        )}
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
        {salvando ? 'Attendere…' : inModifica ? 'Salva le modifiche' : '+ Pubblica torneo'}
      </button>
      {inModifica && (
        <button type="button" className="admin-input" style={{ cursor: 'pointer', marginTop: '.4rem' }}
          onClick={azzeraModulo}>
          Annulla la modifica
        </button>
      )}

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
          <button className="admin-icon-btn" onClick={() => apriModifica(t)} aria-label="Modifica"
            title="Correggi date, orari, link o note">✎</button>
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
