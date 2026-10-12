'use client';

// ============================================================
// LA VECCHIA SCHEDA — dal 12 ottobre 2026 rimanda a `spazi?id=…`.
//
// ⚠️ LA SCHEDA SI APRE ACCANTO ALL'ELENCO, come nel gestionale, e il suo
// codice sta in `_pezzi/SchedaSpazio.tsx`. Questa pagina resta perche' un
// indirizzo gia' mandato a qualcuno — `/rfcoach/superadmin/spazio/?id=…` —
// continui ad arrivare allo spazio giusto invece che a un 404.
// ============================================================

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

function Rimando() {
  const router = useRouter();
  const id = useSearchParams().get('id') ?? '';
  useEffect(() => {
    router.replace(id ? `/rfcoach/superadmin/spazi?id=${encodeURIComponent(id)}` : '/rfcoach/superadmin/spazi');
  }, [id, router]);
  return <div className="vuoto">Un momento…</div>;
}

export default function VecchiaScheda() {
  return (
    <Suspense fallback={<div className="vuoto">Un momento…</div>}>
      <Rimando />
    </Suspense>
  );
}
