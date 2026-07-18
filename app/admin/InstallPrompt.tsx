'use client';

import { useEffect, useState } from 'react';

// Propone l'installazione dell'app sul desktop. Su Chrome/Edge usa il
// prompt nativo del browser (evento beforeinstallprompt). Su Safari
// quell'evento non esiste: mostriamo invece istruzioni testuali per
// "Aggiungi al Dock", che è il suo equivalente.
export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [visibile, setVisibile] = useState(false);
  const [isSafari, setIsSafari] = useState(false);

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }

    // Se l'app gira già come PWA installata, non proporre nulla.
    if (window.matchMedia('(display-mode: standalone)').matches) {
      return;
    }

    const ua = navigator.userAgent;
    const safari = /^((?!chrome|android).)*safari/i.test(ua);
    setIsSafari(safari);
    if (safari) setVisibile(true);

    const onPrompt = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setVisibile(true);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    return () => window.removeEventListener('beforeinstallprompt', onPrompt);
  }, []);

  if (!visibile) return null;

  const installa = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    setVisibile(false);
  };

  return (
    <div className="install-banner">
      <button className="install-banner-close" onClick={() => setVisibile(false)} aria-label="Chiudi">×</button>
      {isSafari ? (
        <p>
          <strong>Aggiungi al Dock:</strong> apri il menu Condividi (icona con la
          freccia verso l&apos;alto) e scegli <strong>&quot;Aggiungi al Dock&quot;</strong> per
          avere Racket Fever come un&apos;app sul tuo Mac.
        </p>
      ) : (
        <div className="install-banner-row">
          <p>Installa Racket Fever sul tuo computer: un&apos;icona sul desktop, accesso diretto.</p>
          <button className="btn" onClick={installa}>Installa</button>
        </div>
      )}
    </div>
  );
}
