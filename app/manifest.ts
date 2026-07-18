import type { MetadataRoute } from 'next';

// Manifest PWA: definisce come l'app si comporta una volta
// "installata" sul desktop (icona, nome, finestra senza barra
// del browser). Scope limitato a /admin: si installa la Dashboard,
// non l'intero sito istituzionale.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Racket Fever — Admin Circolo',
    short_name: 'Racket Fever',
    description: 'Gestisci il tuo circolo: campi, prezzi, soci e prenotazioni.',
    start_url: '/admin',
    scope: '/admin',
    display: 'standalone',
    background_color: '#0E3B2E',
    theme_color: '#0E3B2E',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
  };
}
