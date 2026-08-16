'use client';

// ============================================================
// REGISTRO MOVIMENTI — pagina web dell'Admin.
//
// Pensata per il caso concreto della contestazione: si filtra per
// socio e periodo, si legge la catena dei saldi, e se serve si stampa
// il prospetto da consegnare a mano.
//
// La stampa usa il dialogo del browser con un foglio di stile
// dedicato: nessuna libreria aggiuntiva, e chi vuole un file lo salva
// in PDF dallo stesso dialogo.
// ============================================================

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../../../lib/firebase';
import { leggiResponsabile, ProfiloResponsabile } from '../../../data/responsabili';
import { leggiSessioneCollaboratore, sessioneScaduta } from '../../../data/collaboratori';
import { ascoltaCircolo } from '../../../data/circoliRepo';
import { Circolo } from '../../../data/circoli';
import {
  ascoltaMovimentiCircolo, esecutorePerAdmin, etichettaMovimento,
  dettaglioPrenotazione, raggruppaInCard, testoPasso, intervalloDelPasso, importoDaMostrare,
  Movimento, TipoMovimento, CardMovimenti, PassoStoria,
} from '../../../data/movimenti';

const PERIODI = [
  { chiave: '7', label: '7 giorni' },
  { chiave: '30', label: '30 giorni' },
  { chiave: '90', label: '3 mesi' },
  { chiave: 'tutto', label: 'Tutto' },
];

const TIPI: { chiave: TipoMovimento | 'tutti'; label: string }[] = [
  { chiave: 'tutti', label: 'Tutti' },
  { chiave: 'ricarica', label: 'Ricariche' },
  { chiave: 'addebito', label: 'Addebiti' },
  { chiave: 'rimborso', label: 'Rimborsi' },
  { chiave: 'sos', label: 'Fido' },
  { chiave: 'ripristino_sos', label: 'Ripristini' },
];

// Le lezioni non sono un tipo a se': sono addebiti con un maestro.
const FILTRO_LEZIONI = 'lezioni';

// Numero progressivo del BLOCCO a cui appartiene una riga: cambia solo
// quando cambia il gruppo rispetto alla riga precedente. Serve ad
// alternare gli sfondi per prenotazione invece che riga per riga.
function indiceBlocco(elenco: Movimento[], i: number): number {
  let blocco = 0;
  for (let k = 1; k <= i; k++) {
    if (!elenco[k].gruppoId || elenco[k].gruppoId !== elenco[k - 1].gruppoId) blocco++;
  }
  return blocco;
}

// Tabella condivisa dalle due sezioni — "Movimenti Totali" e
// "Movimenti per Socio" — cosi' le due viste non divergono nel tempo.
function TabellaMovimenti({ elenco, onScegliSocio, dataOra }: {
  elenco: Movimento[]; onScegliSocio: (n: string) => void; dataOra: (m: Movimento) => string;
}) {
  if (elenco.length === 0) {
    return <p className="admin-empty-text">Nessun movimento con questi filtri.</p>;
  }
  return (
          <table className="mov-tabella">
            <thead>
              <tr>
                <th>Socio</th>
                <th>Data</th>
                <th>Tipo</th>
                <th>Descrizione</th>
                <th>Eseguito da</th>
                <th className="destra">Importo</th>
                <th className="destra">Saldo</th>
              </tr>
            </thead>
            <tbody>
              {/* Click sulla riga: filtra su quel socio. Utile quando
                  il socio e' presente e vuole vedere il proprio
                  estratto conto. */}
              {elenco.map((m: Movimento, i: number) => (
                <tr key={m.id} className={`mov-riga${indiceBlocco(elenco, i) % 2 === 1 ? " alternata" : ""}`} onClick={() => onScegliSocio(m.socioNome || '')}>
                  <td className="mov-socio">
                    {m.socioNome || '— nome non registrato'}
                    {m.socioRuolo === 'ospite' && <span className="admin-etichetta-ospite"> (ospite)</span>}
                  </td>
                  <td>{dataOra(m)}</td>
                  <td>{etichettaMovimento(m)}</td>
                  {/* Campo, data e intervallo orario: su un rimborso
                      parziale e' l'unico modo per capire a quale
                      prenotazione si riferisce. */}
                  <td>
                    {dettaglioPrenotazione(m) || m.descrizione}
                    {!!m.maestroNome && <div className="mov-card-maestro">Lezione con {m.maestroNome}</div>}
                  </td>
                  <td>{esecutorePerAdmin(m)}</td>
                  <td className={`destra ${m.importo > 0 ? 'verde' : m.importo < 0 ? 'rosso' : ''}`}>
                    {importoDaMostrare(m.importo)
                      ? `${m.importo > 0 ? '+' : ''}${m.importo.toFixed(2)} €`
                      : '—'}
                  </td>
                  {/* La catena dei saldi e' cio' che rende il registro
                      una prova: ogni riga si aggancia alla precedente. */}
                  <td className="destra mov-saldo">
                    € {m.saldoPrima.toFixed(2)} → € {m.saldoDopo.toFixed(2)}
                    {m.debitoPrima !== m.debitoDopo && (
                      <div className="mov-debito">
                        debito € {m.debitoPrima.toFixed(2)} → € {m.debitoDopo.toFixed(2)}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
  );
}

// Blocco riusato dalle due sezioni: i pulsanti di vista e, sotto,
// l'elenco nella forma scelta.
function BloccoElenco({ elenco, onScegliSocio, dataOra, onApriStoria }: {
  elenco: Movimento[];
  onScegliSocio: (n: string) => void;
  dataOra: (m: Movimento) => string;
  onApriStoria: (c: CardMovimenti) => void;
}) {
  // La Vista Card e' quella predefinita: piu' leggibile, e mostra le
  // prenotazioni come le vede il socio.
  const [vista, setVista] = useState<'card' | 'completa'>('card');
  const card = useMemo(() => raggruppaInCard(elenco), [elenco]);

  return (
    <>
      <div className="mov-vista-riga">
        <button
          className={`mov-vista-btn${vista === 'card' ? ' selezionata' : ''}`}
          onClick={() => setVista('card')}
        >Vista Card</button>
        <button
          className={`mov-vista-btn${vista === 'completa' ? ' selezionata' : ''}`}
          onClick={() => setVista('completa')}
        >Vista Completa</button>
      </div>

      {vista === 'completa' ? (
        <TabellaMovimenti elenco={elenco} onScegliSocio={onScegliSocio} dataOra={dataOra} />
      ) : card.length === 0 ? (
        <p className="admin-empty-text">
          Nessuna prenotazione con questi filtri. Ricariche e movimenti di Fido
          si vedono nella Vista Completa.
        </p>
      ) : (
        card.map((cd: CardMovimenti) => (
          <button key={cd.chiave} className="mov-card" onClick={() => onApriStoria(cd)}>
            <div className="mov-card-testata">
              <div style={{ flex: 1, textAlign: 'left' }}>
                <div className="mov-card-socio">
                  {cd.socioNome || '— nome non registrato'}
                  {cd.socioRuolo === 'ospite' && <span className="admin-etichetta-ospite"> (ospite)</span>}
                </div>
                <div className="mov-card-campo">{cd.campoNome} · {cd.dataLabel}</div>
                {!!cd.movimenti[0]?.maestroNome && (
                  <div className="mov-card-maestro">Lezione con {cd.movimenti[0].maestroNome}</div>
                )}
                {/* Con una prenotazione condivisa serve distinguere chi
                    ha deciso da chi e' stato invitato. */}
                {!!cd.movimenti[0]?.compagnoNome && (
                  <div className="mov-card-compagno">
                    {cd.movimenti[0].sonoCompagno
                      ? `Aggiunto da ${cd.movimenti[0].compagnoNome}`
                      : `Ha invitato ${cd.movimenti[0].compagnoNome}`}
                  </div>
                )}
              </div>
              <span className={`mov-card-stato${cd.cancellata ? ' cancellata' : cd.conclusa ? ' conclusa' : ''}`}>
                {cd.cancellata ? 'Cancellata' : cd.conclusa ? 'Conclusa' : 'Attiva'}
              </span>
            </div>
            <div className="mov-card-corpo">
              {/* Su una card cancellata l'orario non c'e' piu': la
                  prenotazione non esiste, e una fascia oraria farebbe
                  pensare che sia ancora in piedi. La storia completa,
                  orari compresi, resta dentro la card. */}
              <span className={`mov-card-orario${cd.cancellata ? ' cancellata' : ''}`}>
                {cd.cancellata ? 'Cancellata' : `${cd.orarioInizio} - ${cd.orarioFine}`}
              </span>
              <span style={{ flex: 1 }} />
              <span className={`mov-card-netto ${cd.importoNetto > 0 ? 'verde' : cd.importoNetto < 0 ? 'rosso' : ''}`}>
                {cd.importoNetto === 0
                  ? 'Nessun addebito'
                  : `${cd.importoNetto > 0 ? '+' : ''}${cd.importoNetto.toFixed(2)} €`}
              </span>
            </div>
            <div className="mov-card-piede">
              Clicca per la storia della prenotazione · {cd.passi.length} operazioni
            </div>
          </button>
        ))
      )}
    </>
  );
}

// Pop-up: la storia dall'alto verso il basso, con i passi in box
// collegati da un filo verticale — come un diagramma di flusso.
function StoriaPrenotazione({ card, onChiudi }: { card: CardMovimenti | null; onChiudi: () => void }) {
  if (!card) return null;
  const quando = (m: Movimento) => m.quando
    ? new Date(m.quando.seconds * 1000).toLocaleString('it-IT', {
        day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
      })
    : '—';

  return (
    <div className="mov-storia-backdrop" onClick={onChiudi}>
      <div className="mov-storia-foglio" onClick={(e) => e.stopPropagation()}>
        <div className="mov-storia-testata">
          <div>
            <div className="admin-modal-title">Storia della prenotazione</div>
            <p className="admin-modal-sub">
              {card.socioNome} · {card.campoNome} · {card.dataLabel} · {card.orarioInizio} - {card.orarioFine}
              {card.cancellata ? ' · cancellata' : ''}
            </p>
          </div>
          <button className="mov-storia-chiudi" onClick={onChiudi}>×</button>
        </div>

        <div className="mov-storia-corpo">
          {card.passi.map((p: PassoStoria, i: number) => (
            <div key={p.chiave}>
              <div className="mov-passo">
                <span className="mov-passo-ora">{quando(p.esecutore)}</span>
                <div className="mov-passo-testo">{testoPasso(p)}</div>
                <div className="mov-passo-riga">
                  <span className={p.importo > 0 ? 'verde' : p.importo < 0 ? 'rosso' : ''} style={{ fontWeight: 900 }}>
                    {importoDaMostrare(p.importo)
                      ? `${p.importo > 0 ? '+' : ''}${p.importo.toFixed(2)} €`
                      : 'Nessun addebito'}
                  </span>
                  <span className="mov-passo-saldo">
                    saldo € {p.saldoPrima.toFixed(2)} → € {p.saldoDopo.toFixed(2)}
                  </span>
                </div>
                <div className="mov-passo-chi">{esecutorePerAdmin(p.esecutore)}</div>
                {/* Chi ha invitato chi: nella storia serve quanto nella
                    card, perche' e' qui che si legge il racconto. */}
                {!!p.esecutore.compagnoNome && (
                  <div className="mov-card-compagno">
                    {p.esecutore.sonoCompagno
                      ? `Aggiunto da ${p.esecutore.compagnoNome}`
                      : `Ha invitato ${p.esecutore.compagnoNome}`}
                  </div>
                )}
                {/* L'orario risultante DOPO questo passo: l'ultimo box
                    coincide sempre con quello mostrato nella card. */}
                <div className="mov-passo-intervallo">{intervalloDelPasso(p)}</div>
              </div>
              {i < card.passi.length - 1 && <div className="mov-connettore"><span /></div>}
            </div>
          ))}

          <div className="mov-connettore"><span /></div>
          <div className="mov-passo finale">
            <div className="mov-passo-testo">
              {card.cancellata
                ? '✕ Prenotazione cancellata'
                : card.conclusa ? '✓ Prenotazione conclusa' : '⏳ Prenotazione ancora da giocare'}
            </div>
            <div className="mov-passo-saldo">
              Totale: {card.importoNetto >= 0 ? '+' : ''}{card.importoNetto.toFixed(2)} €
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Sezione richiudibile con titolo e totali propri. Definirla una
// volta sola evita che le due sezioni divergano: prima i totali
// esistevano solo nei Totali e il titolo solo nella sezione Socio.
function SezioneMovimenti({ titolo, sottotitolo, elenco, aperta, disabilitata, onApriChiudi, onScegliSocio, dataOra, onApriStoria }: {
  titolo: string;
  sottotitolo?: string;
  elenco: Movimento[];
  aperta: boolean;
  disabilitata?: boolean;
  onApriChiudi: () => void;
  onScegliSocio: (n: string) => void;
  dataOra: (m: Movimento) => string;
  onApriStoria: (c: CardMovimenti) => void;
}) {
  const entrate = elenco.filter((m: Movimento) => m.importo > 0).reduce((t, m) => t + m.importo, 0);
  const uscite = elenco.filter((m: Movimento) => m.importo < 0).reduce((t, m) => t + Math.abs(m.importo), 0);

  return (
    <div className="admin-card">
      <button
        className={`mov-sezione-testata${disabilitata ? ' disabilitata' : ''}`}
        onClick={onApriChiudi}
        disabled={disabilitata}
      >
        <div style={{ flex: 1, textAlign: 'left' }}>
          <div className="admin-card-title" style={{ margin: 0 }}>{titolo}</div>
          {!!sottotitolo && <div className="mov-sezione-sub">{sottotitolo}</div>}
        </div>
        <span className="mov-sezione-conteggio">{elenco.length}</span>
        <span>{aperta ? '▲' : '▼'}</span>
      </button>

      {aperta && (
        <>
          <div className="mov-totali">
            <div>
              <div className="mov-totale-label">Entrate</div>
              <div className="mov-totale-valore verde">+ € {entrate.toFixed(2)}</div>
            </div>
            <div>
              <div className="mov-totale-label">Uscite</div>
              <div className="mov-totale-valore rosso">− € {uscite.toFixed(2)}</div>
            </div>
            <div>
              <div className="mov-totale-label">Movimenti</div>
              <div className="mov-totale-valore">{elenco.length}</div>
            </div>
          </div>
          <BloccoElenco elenco={elenco} onScegliSocio={onScegliSocio} dataOra={dataOra} onApriStoria={onApriStoria} />
        </>
      )}
    </div>
  );
}

export default function PaginaMovimenti() {
  const router = useRouter();
  const [responsabile, setResponsabile] = useState<ProfiloResponsabile | null>(null);
  const [circolo, setCircolo] = useState<Circolo | null>(null);
  const [movimenti, setMovimenti] = useState<Movimento[]>([]);
  const [caricando, setCaricando] = useState(true);

  const [filtroNome, setFiltroNome] = useState('');
  const [periodo, setPeriodo] = useState('30');
  const [tipo, setTipo] = useState<TipoMovimento | 'tutti' | typeof FILTRO_LEZIONI>('tutti');
  const [maestroFiltro, setMaestroFiltro] = useState<string | null>(null);
  // Si conserva solo la CHIAVE della card aperta, non la card stessa:
  // tenendo una copia, il pop-up resterebbe fermo alla fotografia
  // scattata all'apertura mentre i movimenti continuano ad arrivare.
  const [chiaveStoria, setChiaveStoria] = useState<string | null>(null);
  const [totaliAperti, setTotaliAperti] = useState(false);
  const [socioAperto, setSocioAperto] = useState(false);

  useEffect(() => {
    return onAuthStateChanged(auth, async (user) => {
      if (!user) { router.replace('/admin/login'); return; }
      const r = await leggiResponsabile(user.uid);
      if (r) { setResponsabile(r); setCaricando(false); return; }
      // Come nella dashboard: puo' essere un Collaboratore.
      // ⚠️ Una sessione scaduta NON e' una sessione. Senza questo
      // controllo la Dashboard si sarebbe aperta lo stesso — il
      // documento c'e' ancora — e poi ogni singola operazione sarebbe
      // stata respinta dalle regole, una per una, senza spiegazione.
      // Meglio dire subito "rientra con la password".
      const sessione = await leggiSessioneCollaboratore(user.uid);
      if (sessione && !sessioneScaduta(sessione)) {
        setResponsabile({ nome: 'Collaboratore', cognome: '', email: '', circoloId: sessione.circoloId });
        setCaricando(false);
        return;
      }
      router.replace('/admin/login');
    });
  }, [router]);

  useEffect(() => {
    if (!responsabile?.circoloId) return;
    const u1 = ascoltaCircolo(responsabile.circoloId, setCircolo);
    const u2 = ascoltaMovimentiCircolo(responsabile.circoloId, setMovimenti);
    return () => { u1(); u2(); };
  }, [responsabile?.circoloId]);

  // Filtri applicati in memoria: volumi che un circolo gestisce senza
  // problemi, e si evita di creare indici composti su Firestore.
  const filtrati = useMemo(() => {
    const testo = filtroNome.trim().toLowerCase();
    const limite = periodo === 'tutto' ? 0 : Date.now() / 1000 - Number(periodo) * 86400;
    return movimenti.filter((m) => {
      if (tipo !== 'tutti' && m.tipo !== tipo) return false;
      if (limite && (m.quando?.seconds ?? 0) < limite) return false;
      // La ricerca guarda prima di tutto il nome del socio: e' cio'
      // che l'admin digita quando cerca un estratto conto.
      if (testo
        && !(m.socioNome ?? '').toLowerCase().includes(testo)
        && !m.descrizione.toLowerCase().includes(testo)
        && !(m.eseguitoDaNome ?? '').toLowerCase().includes(testo)) return false;
      return true;
    });
  }, [movimenti, filtroNome, periodo, tipo, maestroFiltro]);

  // Suggerimenti sui nomi presenti nel registro: evita di dover
  // ricordare l'ortografia esatta.
  const suggerimenti = useMemo(() => {
    const testo = filtroNome.trim().toLowerCase();
    if (testo.length < 2) return [];
    const nomi = new Set<string>();
    movimenti.forEach((m: Movimento) => {
      if (m.socioNome && m.socioNome.toLowerCase().includes(testo)) nomi.add(m.socioNome);
    });
    if (nomi.size === 1 && [...nomi][0].toLowerCase() === testo) return [];
    return [...nomi].slice(0, 6);
  }, [movimenti, filtroNome]);

  // I maestri si ricavano DAL REGISTRO, non dall'elenco del circolo:
  // uno che ha smesso resta cercabile finche' esistono sue lezioni.
  const storiaAperta = useMemo(
    () => (chiaveStoria ? raggruppaInCard(movimenti).find((c: CardMovimenti) => c.chiave === chiaveStoria) ?? null : null),
    [chiaveStoria, movimenti]
  );

  const maestri = useMemo(() => {
    const nomi = new Set<string>();
    movimenti.forEach((m: Movimento) => { if (m.maestroNome) nomi.add(m.maestroNome); });
    return [...nomi].sort();
  }, [movimenti]);

  const socioSelezionato = useMemo(() => {
    const testo = filtroNome.trim().toLowerCase();
    if (testo.length < 2) return null;
    const esatto = movimenti.find((m: Movimento) => (m.socioNome ?? '').toLowerCase() === testo);
    return esatto?.socioNome ?? null;
  }, [movimenti, filtroNome]);

  const movimentiSocio = useMemo(
    () => (socioSelezionato ? filtrati.filter((m: Movimento) => m.socioNome === socioSelezionato) : []),
    [filtrati, socioSelezionato]
  );


  const dataOra = (m: Movimento) => m.quando
    ? new Date(m.quando.seconds * 1000).toLocaleString('it-IT', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
      })
    : '—';

  if (caricando) {
    return <div className="admin-loading">Caricamento…</div>;
  }

  return (
    <div className="admin-root">
      <div className="admin-header no-print">
        <button className="admin-btn-small" onClick={() => router.push('/admin/dashboard')}>
          ← Dashboard
        </button>
        <h1 className="admin-header-title">Registro Movimenti</h1>
        <p className="admin-header-sub">
          Ogni ricarica, addebito e rimborso del circolo, in ordine di data.
        </p>
      </div>

      {/* Intestazione visibile SOLO in stampa: chi riceve il foglio
          deve capire di che circolo e di che periodo si tratta. */}
      <div className="solo-stampa">
        <h1>{circolo?.nome ?? 'Circolo'}</h1>
        <p>Registro movimenti — {PERIODI.find((p) => p.chiave === periodo)?.label}
          {tipo !== 'tutti' ? ` · ${TIPI.find((t) => t.chiave === tipo)?.label}` : ''}
          {filtroNome.trim() ? ` · filtro: ${filtroNome.trim()}` : ''}
        </p>
        <p>Stampato il {new Date().toLocaleDateString('it-IT')}</p>
      </div>

      <div className="admin-card no-print">
        <input
          className="admin-input"
          value={filtroNome}
          onChange={(e) => setFiltroNome(e.target.value)}
          placeholder="Cerca per nome o descrizione…"
        />
        {suggerimenti.map((nome: string) => (
          <button key={nome} className="mov-suggerimento" onClick={() => setFiltroNome(nome)}>
            {nome}
          </button>
        ))}

        <label className="admin-label" style={{ marginTop: '1rem' }}>Periodo</label>
        <div className="mov-filtri">
          {PERIODI.map((p) => (
            <button
              key={p.chiave}
              className={`mov-pillola${periodo === p.chiave ? ' selezionata' : ''}`}
              onClick={() => setPeriodo(p.chiave)}
            >{p.label}</button>
          ))}
        </div>

        <label className="admin-label" style={{ marginTop: '1rem' }}>Tipo</label>
        <div className="mov-filtri">
          {TIPI.map((t) => (
            <button
              key={t.chiave}
              className={`mov-pillola${tipo === t.chiave ? ' selezionata' : ''}`}
              onClick={() => { setTipo(t.chiave); setMaestroFiltro(null); }}
            >{t.label}</button>
          ))}
          <button
            className={`mov-pillola${tipo === FILTRO_LEZIONI ? ' selezionata' : ''}`}
            onClick={() => { setTipo(FILTRO_LEZIONI); setMaestroFiltro(null); }}
          >Lezioni</button>
        </div>

        {/* Un pulsante per ogni maestro presente nel registro. */}
        {maestri.length > 0 && (
          <>
            <label className="admin-label" style={{ marginTop: '1rem' }}>Maestro</label>
            <div className="mov-filtri">
              {maestri.map((nome: string) => (
                <button
                  key={nome}
                  className={`mov-pillola${maestroFiltro === nome ? ' selezionata' : ''}`}
                  onClick={() => setMaestroFiltro(maestroFiltro === nome ? null : nome)}
                >{nome}</button>
              ))}
            </div>
          </>
        )}

        <button className="admin-btn-full" style={{ marginTop: '1.2rem' }} onClick={() => window.print()}>
          Stampa il prospetto
        </button>
      </div>

      {/* Due sezioni richiudibili, ciascuna con i propri totali:
          "Movimenti Totali" e "Movimenti per Socio". */}
      <SezioneMovimenti
        titolo="Movimenti Totali"
        elenco={filtrati}
        aperta={totaliAperti}
        onApriChiudi={() => setTotaliAperti((v) => !v)}
        onScegliSocio={setFiltroNome}
        dataOra={dataOra}
        onApriStoria={(cd: CardMovimenti) => setChiaveStoria(cd.chiave)}
      />

      <SezioneMovimenti
        titolo="Movimenti per Socio"
        sottotitolo={socioSelezionato ?? 'Scegli una persona dalla ricerca o dall\'elenco'}
        elenco={movimentiSocio}
        aperta={socioAperto && !!socioSelezionato}
        disabilitata={!socioSelezionato}
        onApriChiudi={() => socioSelezionato && setSocioAperto((v) => !v)}
        onScegliSocio={setFiltroNome}
        dataOra={dataOra}
        onApriStoria={(cd: CardMovimenti) => setChiaveStoria(cd.chiave)}
      />

      <StoriaPrenotazione card={storiaAperta} onChiudi={() => setChiaveStoria(null)} />
    </div>
  );
}
