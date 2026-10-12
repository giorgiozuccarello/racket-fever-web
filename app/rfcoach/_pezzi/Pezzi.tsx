'use client';

// ============================================================
// I PEZZI DELLE PAGINE — gli stessi del gestionale, in HTML.
//
// ⚠️ OGNI PEZZO HA IL SUO GEMELLO NELL'APP, e il nome lo dice:
//   Pagina + titolo   → `rf-coach/theme/TitoloPagina.tsx`
//   Fascia            → la fascia degli strumenti di `Scrivania.tsx`
//                       (cerca + pillole + «azzera filtri», come in
//                       `StrumentiIncordature`)
//   Affiancati        → `GestionaleIncordature.tsx`: elenco a sinistra,
//                       scheda a destra
//   Eroe, Capitolo,
//   Numero, Dati      → `Intestazione`, `SezioneScheda`, `Numero`, `RigaDato`
//                       di `PezziScheda.tsx`, con gli stili «del gestionale»
//
// ⚠️ NIENTE LOGICA QUI: disegnano quello che ricevono. Le decisioni stanno
// nelle pagine e in `_dati/`.
// ============================================================

import React from 'react';
import Icona from './Icona';

export function Pagina({ titolo, sotto, children }: {
  titolo: string; sotto?: string; children: React.ReactNode;
}) {
  return (
    <main className="contenuto">
      <div className="dentro">
        <h1 className="titolo">{titolo}</h1>
        {sotto ? <p className="sottotitolo">{sotto}</p> : null}
        {children}
      </div>
    </main>
  );
}

export type Filtro = { chiave: string; detto: string; quanti?: number };

export function Fascia({
  cerca, scriviCerca, segnaposto = 'Cerca', filtri = [], filtro = '', scegli, azzera, children,
}: {
  cerca?: string;
  scriviCerca?: (t: string) => void;
  segnaposto?: string;
  filtri?: Filtro[];
  filtro?: string;
  scegli?: (chiave: string) => void;
  azzera?: () => void;
  children?: React.ReactNode;
}) {
  const tuttoSpento = !cerca && (filtri.length === 0 || filtro === filtri[0]?.chiave);
  return (
    <div className="fascia">
      {scriviCerca ? (
        <label className="cerca">
          <Icona nome="cerca" lato={16} />
          <input
            value={cerca ?? ''}
            placeholder={segnaposto}
            onChange={(e) => scriviCerca(e.target.value)}
            autoComplete="off"
          />
        </label>
      ) : null}
      {filtri.length > 0 ? (
        <div className="pillole">
          {filtri.map((f) => (
            <button
              key={f.chiave}
              type="button"
              aria-pressed={filtro === f.chiave}
              className={`pillola-filtro${filtro === f.chiave ? ' acceso' : ''}`}
              onClick={() => scegli?.(f.chiave)}
            >
              {f.detto}{typeof f.quanti === 'number' ? ` · ${f.quanti}` : ''}
            </button>
          ))}
        </div>
      ) : null}
      {children}
      <div className="spinge" />
      {azzera ? (
        <button type="button" className="azzera-filtri" disabled={tuttoSpento} onClick={azzera}>
          Azzera filtri
        </button>
      ) : null}
    </div>
  );
}

export function Affiancati({ elenco, children }: { elenco: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="affiancati">
      <div className="colonna-elenco">{elenco}</div>
      <main className="pannello">{children}</main>
    </div>
  );
}

export function Invito({ testo, icona = 'scegli' }: { testo: string; icona?: string }) {
  return (
    <div className="invito">
      <Icona nome={icona} lato={40} />
      <div>{testo}</div>
    </div>
  );
}

export function RigaElenco({
  acceso, nome, sotto, destra, pastiglie, onClick,
}: {
  acceso: boolean;
  nome: string;
  sotto?: string;
  destra?: string;
  pastiglie?: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={`riga-elenco${acceso ? ' acceso' : ''}`}
      aria-current={acceso ? 'true' : undefined}
      onClick={onClick}
    >
      <span className="riga-parole">
        <span className="riga-nome">{nome}</span>
        {sotto ? <span className="riga-sotto">{sotto}</span> : null}
        {pastiglie ? <span className="pillole-stato">{pastiglie}</span> : null}
      </span>
      {destra ? <span className="riga-cifra">{destra}</span> : null}
    </button>
  );
}

export function GruppoElenco({ titolo, quanti }: { titolo: string; quanti: number }) {
  return <div className="gruppo-elenco">{`${titolo} · ${quanti}`}</div>;
}

export function Eroe({ nome, sotto, pastiglie }: {
  nome: string; sotto?: string; pastiglie?: React.ReactNode;
}) {
  const parole = nome.trim().split(/\s+/).filter(Boolean);
  const sigla = parole.slice(0, 2).map((p) => p[0]?.toUpperCase() ?? '').join('') || '·';
  return (
    <div className="eroe">
      <div className="sigla">{sigla}</div>
      <div className="eroe-parole">
        <h1 className="eroe-nome">{nome}</h1>
        {sotto ? <div className="eroe-sotto">{sotto}</div> : null}
      </div>
      {pastiglie ? <div className="pillole-stato">{pastiglie}</div> : null}
    </div>
  );
}

export function Capitoli({ children }: { children: React.ReactNode }) {
  return <div className="capitoli">{children}</div>;
}

export function Capitolo({ titolo, largo = false, children }: {
  titolo: string; largo?: boolean; children: React.ReactNode;
}) {
  return (
    <div className={`capitolo${largo ? ' largo' : ''}`}>
      <h2>{titolo}</h2>
      {children}
    </div>
  );
}

export function Numeri({ children }: { children: React.ReactNode }) {
  return <div className="numeri">{children}</div>;
}

export function Numero({ valore, etichetta, sotto, tinta = '' }: {
  valore: string | number; etichetta: string; sotto?: string; tinta?: '' | 'rosso' | 'verde' | 'giallo';
}) {
  return (
    <div className={`numero${tinta ? ` ${tinta}` : ''}`}>
      <span className="numero-valore">{valore}</span>
      <span className="numero-etichetta">{etichetta}</span>
      {sotto ? <span className="numero-sotto">{sotto}</span> : null}
    </div>
  );
}

// Le righe «etichetta / valore». ⚠️ Una riga col valore vuoto non si
// disegna, come `RigaDato`: un'etichetta seguita dal niente sembra un dato
// perso, non un dato che non c'e'.
export function Dati({ righe }: { righe: [string, React.ReactNode][] }) {
  const piene = righe.filter(([, v]) => v !== '' && v !== null && v !== undefined);
  if (piene.length === 0) return null;
  return (
    <dl className="dati">
      {piene.map(([e, v]) => (
        <React.Fragment key={e}>
          <dt>{e}</dt>
          <dd>{v}</dd>
        </React.Fragment>
      ))}
    </dl>
  );
}

export function Pillola({ tinta, children }: { tinta: string; children: React.ReactNode }) {
  return <span className={`pillola ${tinta}`}>{children}</span>;
}
