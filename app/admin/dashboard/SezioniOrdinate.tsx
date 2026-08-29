'use client';

// ============================================================
// LE SEZIONI IN ORDINE ALFABETICO.
//
// ⚠️ AVVOLGE, NON SPOSTA. Le sezioni restano scritte nel JSX dov'erano,
// con i loro commenti e le loro condizioni: questo componente le legge
// dai propri figli, le mette in fila per titolo e le disegna nell'ordine
// nuovo. Spostare le righe nel file avrebbe dato un ordine giusto in
// italiano soltanto — vedi `data/ordineSezioni.ts` — e avrebbe costretto
// a rimescolare il codice a ogni sezione nuova.
//
// ⚠️ I FRAMMENTI SI APRONO. Alcune sezioni stanno dentro un
// `{condizione && (<>…</>)}`: senza aprirlo, quel gruppo verrebbe
// ordinato come se fosse una sezione sola e le due che contiene
// finirebbero appiccicate nel posto sbagliato.
//
// ⚠️ CHI NON HA TITOLO RESTA IN FONDO, nell'ordine in cui era scritto.
// Nella Dashboard c'è almeno una cosa che non è una sezione — la
// finestra della scheda socio — e non ha senso ordinarla: non si vede
// finché non la si apre.
// ============================================================

import React, { ReactNode } from 'react';

function apri(nodi: ReactNode): React.ReactElement[] {
  const fuori: React.ReactElement[] = [];
  React.Children.forEach(nodi, (figlio) => {
    if (!React.isValidElement(figlio)) return;
    if (figlio.type === React.Fragment) {
      fuori.push(...apri((figlio.props as { children?: ReactNode }).children));
      return;
    }
    fuori.push(figlio);
  });
  return fuori;
}

export function ordinaPerTitolo(
  figli: ReactNode,
  confronta: (a: string, b: string) => number,
): React.ReactElement[] {
  const tutti = apri(figli);
  const conTitolo: { titolo: string; nodo: React.ReactElement }[] = [];
  const senzaTitolo: React.ReactElement[] = [];
  for (const nodo of tutti) {
    const titolo = (nodo.props as { titolo?: unknown }).titolo;
    if (typeof titolo === 'string' && titolo.length > 0) conTitolo.push({ titolo, nodo });
    else senzaTitolo.push(nodo);
  }
  conTitolo.sort((a, b) => confronta(a.titolo, b.titolo));
  return [...conTitolo.map((x) => x.nodo), ...senzaTitolo];
}

export default function SezioniOrdinate({
  children, confronta,
}: {
  children: ReactNode;
  confronta: (a: string, b: string) => number;
}) {
  const ordinate = ordinaPerTitolo(children, confronta);
  // ⚠️ La chiave viene dalla sezione stessa quando ce l'ha: le sezioni
  // hanno gia' un `id` che non cambia mai, ed e' quello che permette a
  // React di riconoscerle quando l'ordine cambia — per esempio al
  // cambio di lingua. Senza, riaprirebbe tutte le sezioni chiuse.
  return (
    <>
      {ordinate.map((nodo, i) => {
        const id = (nodo.props as { id?: unknown }).id;
        const chiave = typeof id === 'string' && id ? id : `senza-id-${i}`;
        return <React.Fragment key={chiave}>{nodo}</React.Fragment>;
      })}
    </>
  );
}
