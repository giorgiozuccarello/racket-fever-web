// ============================================================
// LE MAIUSCOLE DI `/rfcoach/...` — e perché sono un middleware e non
// due cartelle.
//
// ⚠️ LA RICHIESTA DEL 16 SETTEMBRE diceva `/rfcoach/SuperAdmin` e
// `/rfcoach/Admin`. Gli indirizzi distinguono maiuscole e minuscole:
// chi digita `superadmin` prenderebbe un 404 che non saprebbe
// spiegarsi. Le cartelle vere sono minuscole — è la forma normale di un
// indirizzo — e questo file fa in modo che funzionino tutte e due.
//
// ⚠️ E LA PRIMA STESURA LO FACEVA CON DUE CARTELLE, `SuperAdmin` accanto
// a `superadmin`. NON SI PUÒ, ed è un guasto che si sarebbe visto solo
// in produzione: su Windows e su macOS il filesystem non distingue le
// maiuscole, quindi le due cartelle sono LA STESSA; su Linux — cioè su
// Cloud Build, dove il sito viene costruito davvero — sono due. Il
// repository si sarebbe comportato in un modo sul PC e in un altro sul
// server. `tsc` lo rifiuta, ed è stato lui a dirlo.
//
// ⚠️ IL `matcher` È STRETTO APPOSTA: questo middleware gira su OGNI
// richiesta che gli passa, e il sito non ha bisogno di niente del
// genere. Limitato a `/rfcoach/...`, il resto delle pagine non lo
// incontra nemmeno.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';

export function middleware(richiesta: NextRequest) {
  const { pathname } = richiesta.nextUrl;
  const minuscolo = pathname.toLowerCase();

  // ⚠️ Si reindirizza SOLO se cambia qualcosa: senza questo confronto,
  // ogni indirizzo già minuscolo verrebbe rimandato a se stesso — un
  // anello infinito, e il browser direbbe soltanto «troppi
  // reindirizzamenti».
  if (minuscolo === pathname) return NextResponse.next();

  const dove = richiesta.nextUrl.clone();
  dove.pathname = minuscolo;
  // ⚠️ 308 e non 307: è permanente, quindi i browser e i motori di
  // ricerca imparano l'indirizzo giusto invece di chiederlo ogni volta.
  return NextResponse.redirect(dove, 308);
}

export const config = {
  matcher: '/rfcoach/:percorso*',
};
