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
import { leggiSessioneCollaboratore } from '../../../data/collaboratori';
import { ascoltaCircolo } from '../../../data/circoliRepo';
import { Circolo } from '../../../data/circoli';
import {
  ascoltaMovimentiCircolo, esecutorePerAdmin, etichettaMovimento,
  dettaglioPrenotazione, Movimento, TipoMovimento,
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
  { chiave: 'sos', label: 'S.O.S.' },
  { chiave: 'ripristino_sos', label: 'Ripristini' },
];

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
                  <td>{dettaglioPrenotazione(m) || m.descrizione}</td>
                  <td>{esecutorePerAdmin(m)}</td>
                  <td className={`destra ${m.importo >= 0 ? 'verde' : 'rosso'}`}>
                    {m.importo >= 0 ? '+' : ''}{m.importo.toFixed(2)} €
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

export default function PaginaMovimenti() {
  const router = useRouter();
  const [responsabile, setResponsabile] = useState<ProfiloResponsabile | null>(null);
  const [circolo, setCircolo] = useState<Circolo | null>(null);
  const [movimenti, setMovimenti] = useState<Movimento[]>([]);
  const [caricando, setCaricando] = useState(true);

  const [filtroNome, setFiltroNome] = useState('');
  const [periodo, setPeriodo] = useState('30');
  const [tipo, setTipo] = useState<TipoMovimento | 'tutti'>('tutti');

  useEffect(() => {
    return onAuthStateChanged(auth, async (user) => {
      if (!user) { router.replace('/admin/login'); return; }
      const r = await leggiResponsabile(user.uid);
      if (r) { setResponsabile(r); setCaricando(false); return; }
      // Come nella dashboard: puo' essere un Collaboratore.
      const sessione = await leggiSessioneCollaboratore(user.uid);
      if (sessione) {
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
  }, [movimenti, filtroNome, periodo, tipo]);

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

  const totali = useMemo(() => {
    let entrate = 0;
    let uscite = 0;
    filtrati.forEach((m: Movimento) => {
      if (m.importo > 0) entrate += m.importo;
      else uscite += Math.abs(m.importo);
    });
    return { entrate, uscite };
  }, [filtrati]);

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
              onClick={() => setTipo(t.chiave)}
            >{t.label}</button>
          ))}
        </div>

        <button className="admin-btn-full" style={{ marginTop: '1.2rem' }} onClick={() => window.print()}>
          Stampa il prospetto
        </button>
      </div>

      <div className="admin-card">
        <div className="mov-totali">
          <div>
            <div className="mov-totale-label">Entrate</div>
            <div className="mov-totale-valore verde">+ € {totali.entrate.toFixed(2)}</div>
          </div>
          <div>
            <div className="mov-totale-label">Uscite</div>
            <div className="mov-totale-valore rosso">− € {totali.uscite.toFixed(2)}</div>
          </div>
          <div>
            <div className="mov-totale-label">Movimenti</div>
            <div className="mov-totale-valore">{filtrati.length}</div>
          </div>
        </div>

        {filtrati.length === 0 ? (
          <p className="admin-empty-text">Nessun movimento con questi filtri.</p>
        ) : (
          <TabellaMovimenti elenco={filtrati} onScegliSocio={setFiltroNome} dataOra={dataOra} />
        )}
      </div>

      {/* Seconda sezione: i movimenti della sola persona selezionata.
          Compare quando il testo di ricerca corrisponde esattamente a
          un nome, cioe' dopo aver scelto un suggerimento o una riga. */}
      {!!socioSelezionato && (
        <div className="admin-card">
          <div className="admin-card-title">Movimenti per Socio</div>
          <p className="mov-socio-intestazione">{socioSelezionato}</p>
          <TabellaMovimenti elenco={movimentiSocio} onScegliSocio={setFiltroNome} dataOra={dataOra} />
        </div>
      )}
    </div>
  );
}
