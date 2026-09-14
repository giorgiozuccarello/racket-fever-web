// ============================================================
// /competitiontennis — la rotta in tedesco, che è la predefinita
// perché è la lingua del cliente e del suo pubblico (Kriens,
// Stansstad, Aesch ZH).
//
// ⚠️ QUESTO FILE NON CONTIENE NÉ TESTO NÉ IMPAGINATO: il testo sta in
// contenuti.ts, la pagina in Pagina.tsx. Le tre rotte devono restare
// tre righe uguali fra loro — il giorno che una delle tre comincia ad
// avere codice suo, le altre due smettono di somigliarle.
// ============================================================

import type { Metadata } from 'next';
import Pagina from './Pagina';
import { metadatiPer } from './metadati';

export const metadata: Metadata = metadatiPer('de');

export default function PaginaCompetitionTennisDe() {
  return <Pagina lingua="de" />;
}
