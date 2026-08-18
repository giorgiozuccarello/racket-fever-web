import type { Metadata } from 'next';
import { Archivo, Spline_Sans_Mono } from 'next/font/google';
import './globals.css';
import { SITO } from '../data/consenso';

// ============================================================
// ⚠️ QUESTE DUE RIGHE ERANO STATE SOSTITUITE DA UNO STUB
// (`const archivo = { variable: '' } as any`) per far girare una build
// in un ambiente senza accesso a fonts.googleapis.com — e lo stub e'
// finito in consegna. Il sito non si rompeva: cadeva sui fallback
// `sans-serif` e `monospace` di globals.css, cioe' perdeva tutta la
// tipografia senza che niente segnalasse un errore. E' il tipo di
// guasto peggiore, quello che la build dichiara riuscita.
//
// ⚠️ SE UNA BUILD FALLISCE QUI per rete assente, si stubba, si
// verifica, E SI RIMETTE PRIMA DI IMPACCHETTARE.
//
// Nessun `weight`: sono entrambi font variabili, e chiedendo i pesi a
// mano si scaricano piu' file per avere di meno.
// ============================================================
const archivo = Archivo({
  subsets: ['latin'],
  variable: '--font-archivo',
  display: 'swap',
});

const splineMono = Spline_Sans_Mono({
  subsets: ['latin'],
  variable: '--font-spline-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  // ⚠️ La descrizione diceva «Gratis per il circolo»: era il modello
  // vecchio, e su una pagina indicizzata una frase sbagliata resta in
  // giro molto dopo che il sito e' cambiato. Quello che va detto e' che
  // e' gratis per CHI GIOCA.
  title: 'Racket Fever — L\'app dei circoli tennis italiani',
  description:
    'Prenotazioni, lezioni con il Maestro, sfide, tornei e bacheca del tuo circolo. '
    + "Gratuita per chi gioca, con i colori e il logo del proprio club.",
  // ⚠️ Un tempo qui c'era `racketfever.it` mentre ogni altra pagina
  // diceva `.com`. Adesso il dominio sta in data/consenso.ts e basta
  // cambiarlo li'.
  metadataBase: new URL(SITO),
  openGraph: {
    type: 'website',
    locale: 'it_IT',
    siteName: 'Racket Fever',
    title: 'Racket Fever — L\'app dei circoli tennis italiani',
    description:
      'Prenoti il campo, prendi lezione, sfidi un socio e segui i tornei. '
      + 'Gratuita per chi gioca.',
  },
  icons: {
    icon: '/icons/icon-192.png',
    apple: '/icons/icon-180.png',
  },
};

export const viewport = {
  themeColor: '#000000',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it" className={`${archivo.variable} ${splineMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
