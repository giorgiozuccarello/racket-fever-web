// ============================================================
// I METADATI DELLE TRE ROTTE, scritti una volta sola.
//
// ⚠️ `alternates.languages` È QUELLO CHE RENDE LE TRE ROTTE UNA PAGINA
// SOLA agli occhi di Google: senza, tre indirizzi con lo stesso
// contenuto in tre lingue si fanno concorrenza fra loro. Con
// `canonical` ognuna dichiara sé stessa e indica le altre due.
//
// ⚠️ `metadataBase` NON SI RIPETE QUI: sta in app/layout.tsx e viene da
// data/consenso.ts, che è l'unico posto dove il dominio è scritto.
// ============================================================

import type { Metadata } from 'next';
import { T, ROTTE, LINGUE, FOTO, type Lingua } from './contenuti';

export function metadatiPer(lingua: Lingua): Metadata {
  const t = T[lingua];
  const lingue: Record<string, string> = {};
  LINGUE.forEach((l) => { lingue[T[l].htmlLang] = ROTTE[l]; });
  // ⚠️ Senza `x-default` chi non parla nessuna delle tre lingue riceve
  // una scelta arbitraria del motore di ricerca. Il nostro ripiego è il
  // tedesco, che è la lingua del cliente.
  lingue['x-default'] = ROTTE.de;

  return {
    title: t.titoloPagina,
    description: t.descrizionePagina,
    alternates: {
      canonical: ROTTE[lingua],
      languages: lingue,
    },
    openGraph: {
      type: 'website',
      // ⚠️ `og:locale` vuole lingua_TERRITORIO: `it` ed `en` nudi, che
      // è quello che veniva fuori da htmlLang, vengono ignorati.
      locale: t.ogLocale,
      title: t.titoloPagina,
      description: t.descrizionePagina,
      url: ROTTE[lingua],
      // ⚠️ I due pulsanti più grandi della pagina portano a WhatsApp:
      // il link viene incollato in chat, e senza questa immagine
      // l'anteprima è una riga di testo grigio.
      images: [{
        url: FOTO.ritratto.file,
        width: FOTO.ritratto.larghezza,
        height: FOTO.ritratto.altezza,
        alt: t.titoloPagina,
      }],
    },
  };
}
