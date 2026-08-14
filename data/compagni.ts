// ============================================================
// LISTA COMPAGNI — chi può aggiungermi a una prenotazione.
//
// ⚠️ PERCHE' ESISTE. Fino a ieri chiunque poteva aggiungere chiunque a
// una propria prenotazione e scalargli la quota dal portafoglio, senza
// che l'altro avesse mai detto di sì. Era l'unico punto
// dell'applicazione in cui una persona incide sul credito di un'altra
// senza consenso, e ha retto solo perché i circoli in prova sono due.
//
// Da qui in poi ci si aggiunge solo fra chi si è dato il permesso a
// vicenda. Il permesso non è "siamo amici": è "puoi aggiungermi,
// cambiarmi, togliermi e addebitarmi", e il testo della richiesta lo
// dice per esteso — nasconderlo dietro una formula gentile sarebbe
// scorretto verso chi accetta.
//
// ⚠️ UN DOCUMENTO PER COPPIA, non due elenchi.
// La tentazione era scrivere `compagni: string[]` sul profilo di
// ciascuno. Sarebbero stati due elenchi da tenere allineati a mano, e
// il giorno in cui una delle due scritture fallisce — rete, permessi,
// un'app chiusa a metà — resta una compagnia che esiste da una parte e
// non dall'altra: uno dei due può addebitare l'altro, l'altro no. Con
// un documento solo quello stato non è rappresentabile.
//
// L'identificativo si ricava dai due nomi messi in ordine, quindi la
// stessa coppia produce sempre lo stesso documento: due richieste
// incrociate — io chiedo a te mentre tu chiedi a me — finiscono sullo
// stesso posto invece di diventare due richieste da accettare a testa.
// E' lo stesso ragionamento degli identificativi degli slot.
// ============================================================

export type StatoCompagnia = 'in_attesa' | 'accettata';

export interface Compagnia {
  id: string;
  // I due identificativi, in ordine alfabetico. In questa forma
  // Firestore sa interrogare ("in quali coppie compaio?") con un
  // array-contains, che su due campi separati non sarebbe possibile.
  membri: string[];
  stato: StatoCompagnia;
  // Chi ha chiesto: serve a mostrare la richiesta solo a chi la deve
  // accettare, e a non far comparire a chi ha chiesto un pulsante
  // "Accetta" sulla propria stessa richiesta.
  richiedenteId: string;
  richiedenteNome: string;
  // Il destinatario, denormalizzato per lo stesso motivo: la Home deve
  // poter scrivere "Hai chiesto a Mario" senza leggere il suo profilo.
  destinatarioId: string;
  destinatarioNome: string;
  // Il circolo da cui è partita. Non limita niente — una compagnia
  // vale per la persona, non per il circolo — ma serve a mandare
  // l'avviso nel posto giusto.
  circoloId: string;
  creataIlMs?: number;
  accettataIlMs?: number;
}

// ⚠️ In ordine, sempre. Con l'ordine di arrivo, "io e te" e "te e io"
// darebbero due documenti diversi per la stessa coppia: due richieste
// aperte contemporaneamente, ognuna in attesa dell'altro.
export function idCompagnia(unUid: string, altroUid: string): string {
  if (!unUid || !altroUid) throw new Error('UID_MANCANTE');
  if (unUid === altroUid) throw new Error('COMPAGNIA_CON_SE_STESSI');
  // Nessun trattino basso dentro gli identificativi, o la scomposizione
  // non sarebbe più univoca: gli uid di Firebase sono alfanumerici,
  // questa riga serve al giorno in cui qualcuno ne scrivesse uno a mano.
  if (unUid.includes('_') || altroUid.includes('_')) throw new Error('UID_NON_AMMESSO');
  return [unUid, altroUid].sort().join('_');
}

export function membriDi(unUid: string, altroUid: string): string[] {
  return [unUid, altroUid].sort();
}

// L'altro, visto da me.
export function altroMembro(c: Compagnia, mioUid: string): { uid: string; nome: string } {
  if (c.richiedenteId === mioUid) return { uid: c.destinatarioId, nome: c.destinatarioNome };
  return { uid: c.richiedenteId, nome: c.richiedenteNome };
}

// Gli uid di chi mi può aggiungere e che io posso aggiungere: solo le
// compagnie accettate.
export function uidInLista(compagnie: Compagnia[], mioUid: string): string[] {
  return compagnie
    .filter((c) => c.stato === 'accettata')
    .map((c) => altroMembro(c, mioUid).uid);
}

export type StatoConMe = 'nessuna' | 'in_lista' | 'ho_chiesto' | 'mi_ha_chiesto';

// Come sto messo con questa persona. Sono quattro casi e non due,
// perché una richiesta in attesa va detta in modo diverso a seconda di
// chi l'ha mandata: a chi l'ha inviata si dice "in attesa di
// risposta", a chi l'ha ricevuta si offre di accettarla.
export function statoConMe(
  compagnie: Compagnia[], mioUid: string, altroUid: string,
): StatoConMe {
  const c = compagnie.find((x) => x.membri.includes(mioUid) && x.membri.includes(altroUid));
  if (!c) return 'nessuna';
  if (c.stato === 'accettata') return 'in_lista';
  return c.richiedenteId === mioUid ? 'ho_chiesto' : 'mi_ha_chiesto';
}

// Le richieste che aspettano una MIA risposta.
export function richiesteDaRispondere(compagnie: Compagnia[], mioUid: string): Compagnia[] {
  return compagnie.filter((c) => c.stato === 'in_attesa' && c.destinatarioId === mioUid);
}

// ⚠️ IL NOME DI CHI CHIEDE NON E' UNA PROVA.
// `richiedenteNome` lo scrive chi manda la richiesta, ed e' un campo
// libero: nessuna regola puo' controllare che corrisponda alla persona
// dietro l'uid. Chiunque puo' creare una compagnia con
// `richiedenteNome: "Mario Rossi"` e farsi accettare, da chi conosce
// Mario Rossi, il permesso di addebitargli il credito. Su una
// collezione che esiste apposta per raccogliere un consenso, il nome E'
// il consenso, e vale quanto la firma in fondo a un modulo.
//
// Quindi al momento di mostrarlo si rilegge dall'elenco dei soci, dove
// il nome lo ha scritto il diretto interessato. Se in quell'elenco non
// c'e' — una compagnia puo' legare due persone di circoli diversi — non
// si mostra il nome salvato come se fosse verificato: si dice che non
// si riesce a verificare chi sia, e chi legge decide con quel dubbio
// davanti invece che senza.
export interface NomeDiChiChiede {
  nome: string;
  verificato: boolean;
}

export function nomeVerificato(
  uid: string,
  nomeSalvato: string,
  elenco: { uid: string; nome?: string; cognome?: string }[],
): NomeDiChiChiede {
  const p = elenco.find((x) => x.uid === uid);
  if (p) {
    const intero = `${p.nome ?? ''} ${p.cognome ?? ''}`.trim();
    if (intero) return { nome: intero, verificato: true };
  }
  const ripiego = (nomeSalvato ?? '').trim();
  return { nome: ripiego || 'Una persona', verificato: false };
}

// ⚠️ Il testo della richiesta. Sta qui e non dentro una schermata
// perché lo leggono in due punti — l'avviso che arriva e la card in
// Home — e due versioni diverse della stessa frase, su una cosa che
// riguarda il portafoglio di chi legge, sarebbero due promesse diverse.
export function testoRichiesta(nomeRichiedente: string): string {
  return `${nomeRichiedente} ti chiede di entrare nella sua lista compagni. `
    + 'Accettando gli permetti di aggiungerti alle sue prenotazioni, di cambiarti o toglierti, '
    + 'e di addebitare la tua quota sul tuo credito. Vale anche al contrario: '
    + 'potrai fare lo stesso con lui. Si può togliere in qualsiasi momento.';
}
