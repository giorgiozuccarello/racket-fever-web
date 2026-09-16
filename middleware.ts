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
//
// ⚠️ E LA REGOLA NON STA QUI, sta in `lib/indirizzi.ts`. Non è pignoleria
// di ordine: questo file importa `next/server` e non si può eseguire in
// una prova senza tirarsi dietro mezzo Next. Là dentro non c'è nessun
// import, e la prova esegue la funzione VERA — compreso il motivo, che
// è scritto per esteso, per cui dal confine di `/rfcoach/admin` in giù
// gli indirizzi non si toccano: sette caratteri con le maiuscole nel
// nome e gli identificativi di Firestore.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { daReindirizzare } from './lib/indirizzi';

export function middleware(richiesta: NextRequest) {
  const dove = daReindirizzare(richiesta.nextUrl.pathname);
  if (dove === null) return NextResponse.next();

  const destinazione = richiesta.nextUrl.clone();
  destinazione.pathname = dove;
  // ⚠️ 308 e non 307: è permanente, quindi i browser e i motori di
  // ricerca imparano l'indirizzo giusto invece di chiederlo ogni volta.
  return NextResponse.redirect(destinazione, 308);
}

export const config = {
  matcher: '/rfcoach/:percorso*',
};
