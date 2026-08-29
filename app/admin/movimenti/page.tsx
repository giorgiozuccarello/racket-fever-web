'use client';

// ============================================================
// LA PORTA DELL'ADMIN al Registro Movimenti.
//
// ⚠️ QUI C'E' SOLO IL CONTROLLO DI CHI ENTRA. Il registro vero — filtri,
// tabelle, card, storia della prenotazione, stampa — sta in
// `RegistroMovimenti.tsx`, ed e' lo stesso identico componente che apre
// il team Racket Fever da `/superadmin/movimenti`. Due copie di un
// registro contabile che mostrano numeri diversi a seconda di chi lo
// guarda sarebbero il difetto peggiore che questo pannello possa avere.
// ============================================================

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../../../lib/firebase';
import { leggiResponsabile, ProfiloResponsabile } from '../../../data/responsabili';
import { leggiSessioneCollaboratore, sessioneScaduta } from '../../../data/collaboratori';
import RegistroMovimenti from './RegistroMovimenti';

export default function PaginaMovimenti() {
  const router = useRouter();
  const [responsabile, setResponsabile] = useState<ProfiloResponsabile | null>(null);
  const [caricando, setCaricando] = useState(true);

  useEffect(() => {
    return onAuthStateChanged(auth, async (user) => {
      if (!user) { router.replace('/admin/login'); return; }
      const r = await leggiResponsabile(user.uid);
      if (r) { setResponsabile(r); setCaricando(false); return; }
      // Come nella dashboard: puo' essere un Collaboratore.
      // ⚠️ Una sessione scaduta NON e' una sessione. Senza questo
      // controllo la pagina si sarebbe aperta lo stesso — il documento
      // c'e' ancora — e poi ogni singola lettura sarebbe stata respinta
      // dalle regole, una per una, senza spiegazione. Meglio dire
      // subito "rientra con la password".
      const sessione = await leggiSessioneCollaboratore(user.uid);
      if (sessione && !sessioneScaduta(sessione)) {
        setResponsabile({ nome: 'Collaboratore', cognome: '', email: '', circoloId: sessione.circoloId });
        setCaricando(false);
        return;
      }
      router.replace('/admin/login');
    });
  }, [router]);

  if (caricando || !responsabile) {
    return <div className="admin-loading">Caricamento…</div>;
  }

  return <RegistroMovimenti circoloId={responsabile.circoloId} tornaHref="/admin/dashboard" />;
}
