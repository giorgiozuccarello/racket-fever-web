// ============================================================
// /competitiontennis/it — la stessa pagina in italiano.
// Vedi le avvertenze in ../page.tsx e in ../contenuti.ts.
// ============================================================

import type { Metadata } from 'next';
import Pagina from '../Pagina';
import { metadatiPer } from '../metadati';

export const metadata: Metadata = metadatiPer('it');

export default function PaginaCompetitionTennisIt() {
  return <Pagina lingua="it" />;
}
