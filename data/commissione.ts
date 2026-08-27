// ============================================================
// LA COMMISSIONE — quanto Racket Fever incassa dal circolo.
//
// ⚠️ QUESTO FILE ESISTE SOLO NEL PROGETTO DEL SITO, E NON È UN CASO.
//
// Non ha un gemello nell'app e non deve averlo. `data/ricavi.ts`, che
// gli sta accanto, è invece condiviso: sta nell'app, sta qui, e viene
// copiato dentro le Cloud Functions — quindi tutto quello che ci si
// scrive finisce nel pacchetto che va sugli store.
//
// La cifra qui sotto non ci deve finire. Il socio non paga niente di
// questo, non lo vede e non lo deve vedere: è un rapporto fra due
// aziende. Tenerla fuori dall'app vuol dire che non c'è nemmeno da
// spenta, e che un revisore di App Store non ha nessun pagamento su
// cui aprire la domanda «perché non passa dallo store?».
//
// ⚠️ E NON COMPARE NEMMENO NELLA DASHBOARD DEL CIRCOLO. Quella
// schermata è raggiungibile con le credenziali di un Admin, e un
// revisore potrebbe averle: lì ci sono cinque numeri del circolo —
// quante mezz'ore, quante ore, quanto ha incassato — e nient'altro.
// Questo file lo importa solo il pannello Super Admin.
//
// ⚠️ CHI PORTASSE QUESTA COSTANTE IN `data/ricavi.ts` per «tenere
// tutto insieme» annullerebbe tutte e tre le protezioni in una riga.
// ============================================================

// Quanto vale una mezz'ora maturata, in centesimi.
//
// ⚠️ IN CENTESIMI E NON IN EURO: 0,10 in virgola mobile non è 0,10, e
// diecimila mezz'ore moltiplicate per un numero che vale
// 0,1000000000000000055 danno un totale che non torna con la somma
// delle righe. Un revisore che ricontrolla una fattura trova scarti di
// centesimi e ha ragione lui.
//
// ⚠️ ED È UNA SOLA PER TUTTA LA RETE. Il giorno che a un circolo si
// concedesse una commissione diversa, questa costante diventerebbe un
// listino: andrebbe tolta di qui e scritta nel contratto, e il
// software mostrerebbe soltanto il conteggio. È la stessa regola già
// scritta in cima a `data/fatturazione.ts`, e vale ancora.
export const CENTESIMI_PER_MEZZORA = 10;

// ⚠️ SI CALCOLA SUL NETTO MATURATO, mai sul live. Il live comprende le
// partite di domani e del mese prossimo: fatturarle vorrebbe dire
// farsi pagare campo che non è ancora stato giocato, e che potrebbe
// non esserlo mai.
export function commissioneCentesimi(mezzOreNetteMaturate: number): number {
  return Math.max(0, mezzOreNetteMaturate) * CENTESIMI_PER_MEZZORA;
}
