import type { Metadata } from 'next';
import { Archivo, Spline_Sans_Mono } from 'next/font/google';
import './globals.css';

const archivo = Archivo({
  subsets: ['latin'],
  variable: '--font-archivo',
  display: 'swap',
});

const splineMono = Spline_Sans_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-spline-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Racket Fever — La piattaforma italiana per i circoli tennis',
  description:
    "App e gestionale per circoli tennis: prenotazioni, tornei, community. Gratis per il circolo, un'app brandizzata per ogni club.",
  icons: {
    icon: '/icons/icon-192.png',
    apple: '/icons/icon-180.png',
  },
};

export const viewport = {
  themeColor: '#0E3B2E',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it" className={`${archivo.variable} ${splineMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
