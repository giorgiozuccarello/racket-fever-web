// ============================================================
// LE ICONE DEL PANNELLO — disegnate qui, non prese da una libreria.
//
// ⚠️ IL GESTIONALE USA IONICONS (`@expo/vector-icons`), che vive nell'app
// Expo e non nel sito. Tirarsi dietro un pacchetto di icone per sette
// disegni vorrebbe dire una dipendenza in piu' nel sito dei circoli: qui
// ci sono i tratti, a linea, nello stesso stile «outline» delle voci del
// gestionale, larghi 18 come `size={18}` di `Scrivania.tsx`.
//
// ⚠️ NIENTE IMPORT, come `_dati/sezioni.ts`: il nome dell'icona sta
// nell'elenco delle sezioni, e una prova controlla che ogni nome usato
// esista qui.
// ============================================================

import React from 'react';

export const TRATTI: Record<string, string> = {
  spazi: 'M3 21V9l9-6 9 6v12M9 21v-7h6v7',
  contratti: 'M7 3h7l5 5v13H7zM14 3v5h5M10 13h6M10 17h6',
  richieste: 'M3 6h18v12H3zM3 7l9 6 9-6',
  nuovo: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 8v8M8 12h8',
  sicurezza: 'M8 11V8a4 4 0 0 1 8 0v3M6 11h12v10H6zM12 15v2',
  cerca: 'M10.5 4a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13zM15.5 15.5 21 21',
  su: 'M6 15l6-6 6 6',
  giu: 'M6 9l6 6 6-6',
  scegli: 'M4 5h16v14H4zM4 9h16M9 13h6',
};

export default function Icona({ nome, lato = 18 }: { nome: string; lato?: number }) {
  const d = TRATTI[nome] ?? TRATTI.scegli;
  return (
    <svg
      width={lato}
      height={lato}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={d} />
    </svg>
  );
}
