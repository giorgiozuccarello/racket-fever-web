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
};

module.exports = nextConfig;
