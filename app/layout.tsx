import type { Metadata } from 'next';
import './globals.css';

const archivo = { variable: '' } as any;

const splineMono = { variable: '' } as any;

export const metadata: Metadata = {
  // ⚠️ La descrizione diceva «Gratis per il circolo»: era il modello
  // vecchio, e su una pagina indicizzata una frase sbagliata resta in
  // giro molto dopo che il sito e' cambiato. Quello che va detto e' che
  // e' gratis per CHI GIOCA.
  title: 'Racket Fever — L\'app dei circoli tennis italiani',
  description:
    'Prenotazioni, lezioni con il Maestro, sfide, tornei e bacheca del tuo circolo. '
    + "Gratuita per chi gioca, con i colori e il logo del proprio club.",
  metadataBase: new URL('https://racketfever.it'),
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
