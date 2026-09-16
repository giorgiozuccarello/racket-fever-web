'use client';

// ⚠️ `/superadmin` non e' una sezione: e' la porta. Manda alla prima
// dell'elenco, che e' scritta in `data/sezioni.ts` — cosi' il giorno che
// si riordina il menu, l'atterraggio segue da solo.
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { SEZIONE_DI_PARTENZA } from '../_dati/sezioni';

export default function Ingresso() {
  const router = useRouter();
  useEffect(() => { router.replace(`/rfcoach/superadmin/${SEZIONE_DI_PARTENZA}`); }, [router]);
  return <div className="vuoto">Un momento…</div>;
}
