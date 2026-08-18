// ============================================================
// robots.txt — cosa i motori di ricerca possono guardare.
//
// ⚠️ ESISTE PER TENERE FUORI LE DASHBOARD. Oggi /admin e /superadmin
// sono indicizzabili: non contengono dati — sono schermate che senza
// accesso non mostrano niente — ma comparire su Google con «accesso
// Super Admin Racket Fever» è un invito a provare, e chi prova prima o
// poi trova un'email valida da cui partire.
//
// ⚠️ E NON È UNA MISURA DI SICUREZZA. Un robots.txt lo rispettano i
// motori seri, non chi cerca guai: la sicurezza vera sono le regole
// Firestore e l'autenticazione. Questo serve a non farsi trovare, che è
// un'altra cosa e vale comunque.
// ============================================================

import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        // Le pagine pubbliche restano indicizzabili — il sito serve
        // anche a farsi trovare dai circoli — e le due pagine legali pure:
        // Google e Apple vogliono poterle raggiungere.
        disallow: ['/admin', '/admin/', '/superadmin', '/superadmin/'],
      },
    ],
    // ⚠️ NIENTE `sitemap`. C'era, e puntava a /sitemap.xml — un file che
    // in questo progetto non esiste: dichiarare una sitemap assente fa
    // registrare un errore nella Search Console e non porta nessun
    // vantaggio. Il giorno che la sitemap si scrive davvero
    // (app/sitemap.ts), la riga si rimette.
  };
}
