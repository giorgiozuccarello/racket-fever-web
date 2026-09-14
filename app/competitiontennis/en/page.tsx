// ============================================================
// /competitiontennis/en — la stessa pagina in inglese.
// Vedi le avvertenze in ../page.tsx e in ../contenuti.ts.
// ============================================================

import type { Metadata } from 'next';
import Pagina from '../Pagina';
import { metadatiPer } from '../metadati';

export const metadata: Metadata = metadatiPer('en');

export default function PaginaCompetitionTennisEn() {
  return <Pagina lingua="en" />;
}
