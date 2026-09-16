// ============================================================
// ⚠️ IL RIPIEGO CHE FA VIVERE IL GESTIONALE.
//
// Sotto `public/rfcoach/admin/` sta l'app Expo esportata per il web, in
// modalita' `single`: UN SOLO `index.html` e un pacchetto di JavaScript.
// Tutte le schermate — `/allievi`, `/corsi`, `/lezione/abc123` — le
// risolve il router dell'app nel browser, non il server.
//
// ⚠️ MA IL SERVER LE VEDE LO STESSO, e senza queste due righe
// risponderebbe 404: chi apre un indirizzo profondo, chi ricarica con
// F5, chi torna su un segnalibro. Il ripiego manda tutto su
// `index.html`, e da li' in poi decide l'app.
//
// ⚠️ `afterFiles` E NON `beforeFiles`, ed e' la differenza fra un
// gestionale che funziona e uno schermo bianco: `afterFiles` viene dopo
// il filesystem, quindi i file veri — il pacchetto JavaScript, i
// caratteri, le immagini — vengono serviti per primi e il ripiego
// prende solo cio' che non esiste. Con `beforeFiles` ogni asset
// riceverebbe `index.html` al posto del proprio contenuto.
//
// ⚠️ E NON C'E' NESSUN `redirects()`, ne' ce ne devono entrare. I tre
// nomi di dominio vecchi li reindirizza Firebase App Hosting, al bordo:
// una seconda copia qui sarebbe una seconda verita' sullo stesso fatto,
// e il giorno che divergono vince quella che non si vede. Una prova lo
// sorveglia.
//
// ⚠️ IL PERCORSO `/rfcoach/admin` E' SCRITTO IN TRE POSTI, e devono
// coincidere: qui, in `lib/indirizzi.ts` e — in un ALTRO REPOSITORY —
// in `rf-coach/app.json` come `experiments.baseUrl`. Se divergono
// l'app non trova il proprio codice e la pagina resta bianca senza
// nessun errore.
// ============================================================

// ============================================================
// ⚠️ E LA CACHE, CHE IL 16 SETTEMBRE HA DATO UNA PAGINA BIANCA VERA.
//
// Il nome del pacchetto dell'app contiene un hash e CAMBIA A OGNI
// ESPORTAZIONE: `entry-0c3ce27….js` oggi, un altro domani. L'`index.html`
// e' l'unico file che quel nome lo NOMINA.
//
// Quindi un browser che si tiene in cache un `index.html` vecchio chiede
// un pacchetto che sul server non esiste piu'; il ripiego qui sopra
// risponde con `index.html` al posto del JavaScript; il browser si
// rifiuta di eseguire dell'HTML come script e resta BIANCO. Senza
// nemmeno cambiare indirizzo — il router dell'app non parte proprio.
//
// ⚠️ NON E' UN CASO ISOLATO: sarebbe successo A OGNI MAESTRO A OGNI
// RIESPORTAZIONE. Chi ha aperto il gestionale ieri, il giorno dopo si
// prende una pagina bianca finche' non forza la ricarica — e nessun
// maestro forza la ricarica: chiama.
//
// ⚠️ `no-store` SOLO SULL'HTML, E NON SUGLI ASSET, ed e' tutto il punto
// della divisione qui sotto. I file con l'hash nel nome sono
// IMMUTABILI per costruzione — quel nome vale per quel contenuto e per
// nessun altro — e vanno tenuti in cache il piu' a lungo possibile: sono
// 8 MB, e riscaricarli a ogni apertura sarebbe il difetto opposto.
// L'`index.html` invece non deve stare in cache MAI.
//
// ⚠️ IL PERCORSO `no-store` ESCLUDE `_expo` E `assets` NELLA PROPRIA
// ESPRESSIONE, e non conta sull'ordine delle regole: due regole che
// scrivono la stessa intestazione sullo stesso indirizzo si risolvono
// con una precedenza che non e' scritta da nessuna parte nel nostro
// codice — e una difesa che dipende da un dettaglio non documentato non
// e' una difesa. Qui i due insiemi non si sovrappongono affatto.
// ============================================================
const UN_ANNO = 'public, max-age=31536000, immutable';
const MAI = 'no-store, must-revalidate';

/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return {
      afterFiles: [
        { source: '/rfcoach/admin', destination: '/rfcoach/admin/index.html' },
        { source: '/rfcoach/admin/:percorso*', destination: '/rfcoach/admin/index.html' },
      ],
    };
  },

  async headers() {
    return [
      // I file con l'hash nel nome: immutabili.
      { source: '/rfcoach/admin/_expo/:percorso*', headers: [{ key: 'Cache-Control', value: UN_ANNO }] },
      { source: '/rfcoach/admin/assets/:percorso*', headers: [{ key: 'Cache-Control', value: UN_ANNO }] },
      // Tutto il resto sotto il confine e' l'`index.html` servito dal
      // ripiego: non si conserva mai.
      { source: '/rfcoach/admin', headers: [{ key: 'Cache-Control', value: MAI }] },
      {
        source: '/rfcoach/admin/:percorso((?!_expo/|assets/).*)',
        headers: [{ key: 'Cache-Control', value: MAI }],
      },
    ];
  },
};

module.exports = nextConfig;
