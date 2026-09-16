// ============================================================
// LA PORTA DI `/rfcoach` — e fa due cose sole, tutte e due necessarie.
//
// ⚠️ 1. IMPORTA IL CSS DEL PANNELLO. In Next un foglio importato da un
// layout annidato viene caricato solo per le pagine sotto quel layout:
// il sito, fuori da qui, non se lo tira dietro.
//
// ⚠️ 2. AVVOLGE TUTTO IN `.rfcoach`. Questo e' il pezzo che rende vera
// la difesa scritta in testa a `rfcoach.css`: ogni regola di quel foglio
// e' figlia di questo contenitore, quindi non puo' raggiungere una
// pagina del sito nemmeno se il foglio restasse caricato. Tolto questo
// `div`, il pannello resterebbe senza stile e — peggio — le sue regole
// tornerebbero a poter toccare tutto.
//
// ⚠️ E NON C'E' NESSUNA LOGICA QUI. Chi puo' entrare lo decide
// `superadmin/layout.tsx`, che sta un livello sotto: `/rfcoach/entra`
// deve restare raggiungibile da chi non e' ancora entrato.
// ============================================================

import './rfcoach.css';

export default function GuscioRfCoach({ children }: { children: React.ReactNode }) {
  return <div className="rfcoach">{children}</div>;
}
