'use client';

// ============================================================
// IL REGISTRO DI UN CIRCOLO, VISTO DAL TEAM.
//
// ⚠️ ESISTE PER LA CONTESTAZIONE CHE ARRIVA DOPO. Fino al 29 agosto
// 2026 il registro riga per riga lo poteva leggere solo l'Admin di quel
// circolo: noi vedevamo tre numeri aggregati nella scheda, e per tutto
// il resto restava l'archivio in CSV — che contiene tutto ma non si
// filtra. Con un socio che contesta un addebito di due mesi fa,
// «scarica il CSV e cercalo a mano» non e' una risposta.
//
// ⚠️ LE REGOLE LO PERMETTEVANO GIA'. `firestore.rules` concede al Super
// Admin la lettura dei movimenti, in cima al blocco e con un commento
// che spiega perche'. Mancava solo la schermata: era un permesso che
// nessuno usava.
//
// ⚠️ UNA PAGINA A SE' E NON UNA SEZIONE. Il registro vive a tutta
// pagina e si stampa con un foglio di stile dedicato: dentro la
// dashboard a due colonne verrebbe schiacciato, e la stampa si
// porterebbe dietro tutto il pannello. E' lo stesso ragionamento gia'
// scritto per «Modelli di Revenue».
//
// ⚠️ E IL CORPO E' LO STESSO DELL'ADMIN, non una copia: vedi
// `app/admin/movimenti/RegistroMovimenti.tsx`.
// ============================================================

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import { auth } from '../../../lib/firebase';
import { leggiSuperAdmin, ProfiloSuperAdmin } from '../../../data/superadmin';
import { leggiCircolo } from '../../../data/circoliRepo';
import { Circolo } from '../../../data/circoli';
import RegistroMovimenti from '../../admin/movimenti/RegistroMovimenti';

function Contenuto() {
  const router = useRouter();
  const parametri = useSearchParams();
  const circoloId = parametri.get('circolo') ?? '';
  const [profilo, setProfilo] = useState<ProfiloSuperAdmin | null>(null);
  const [circolo, setCircolo] = useState<Circolo | null>(null);
  const [caricando, setCaricando] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user: User | null) => {
      if (!user) { router.replace('/superadmin/login'); return; }
      let p: ProfiloSuperAdmin | null = null;
      // ⚠️ Il `try` c'e' apposta: un rifiuto non raccolto dentro un
      // callback `async` lascerebbe la pagina su «Caricamento…» per
      // sempre, senza dire niente a nessuno.
      try { p = await leggiSuperAdmin(user.uid); } catch { p = null; }
      if (!p) {
        try { await signOut(auth); } catch { /* si esce comunque */ }
        router.replace('/superadmin/login');
        return;
      }
      setProfilo(p);
      setCaricando(false);
    });
    return unsub;
  }, [router]);

  // Il nome del circolo serve solo a scriverlo in testata: chi guarda
  // deve sapere di CHI e' il registro che ha davanti.
  useEffect(() => {
    if (!circoloId || !profilo) return;
    let vivo = true;
    leggiCircolo(circoloId).then((c) => { if (vivo) setCircolo(c); }).catch(() => { /* resta senza nome */ });
    return () => { vivo = false; };
  }, [circoloId, profilo]);

  if (caricando || !profilo) return <div className="admin-loading">Caricamento…</div>;

  if (!circoloId) {
    return (
      <div className="admin-root">
        <div className="admin-header">
          <button className="admin-btn-small" onClick={() => router.push('/superadmin/dashboard')}>
            ← Pannello
          </button>
          <h1 className="admin-header-title">Registro Movimenti</h1>
          <p className="admin-header-sub">
            Manca il circolo da guardare. Si entra qui dalla scheda di un circolo, nel pannello.
          </p>
        </div>
      </div>
    );
  }

  return (
    <RegistroMovimenti
      circoloId={circoloId}
      tornaHref="/superadmin/dashboard"
      tornaEtichetta="← Pannello"
      sottotitolo={
        circolo
          ? `${circolo.nome} — ogni ricarica, addebito e rimborso, in ordine di data.`
          : 'Ogni ricarica, addebito e rimborso del circolo, in ordine di data.'
      }
    />
  );
}

// ⚠️ `useSearchParams` obbliga a un confine di sospensione: senza,
// Next rifiuta di costruire la pagina statica e la build fallisce.
export default function PaginaMovimentiSuperAdmin() {
  return (
    <Suspense fallback={<div className="admin-loading">Caricamento…</div>}>
      <Contenuto />
    </Suspense>
  );
}
