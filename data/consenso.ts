// ============================================================
// CONSENSO E VERSIONE DEI DOCUMENTI.
//
// ⚠️ QUELLO CHE SERVE DAVVERO IL GIORNO CHE QUALCUNO CONTESTA non è
// avere un'informativa: è poter dire QUALE informativa quella persona
// ha accettato e QUANDO. Un consenso senza versione non prova niente —
// il testo può essere cambiato dieci volte da allora, e chi contesta
// dirà di aver accettato un'altra cosa.
//
// Quindi la data qui sotto si cambia OGNI VOLTA che si tocca una riga
// dell'informativa o dei termini, e il valore vecchio resta scritto sui
// profili di chi aveva accettato prima. Non è un numero di versione
// tecnico: è una data, perché è la forma che si legge senza spiegazioni
// in un documento legale.
//
// ⚠️ E VA CAMBIATA ANCHE SULLE PAGINE DEL SITO, che riportano la stessa
// data in cima. Se le due divergono, il profilo dice di aver accettato
// una versione che sul sito non esiste.
//
// File gemello, identico nei due progetti, senza import.
// ============================================================

export const VERSIONE_DOCUMENTI = '2026-08-20';

// L'età minima per registrarsi da soli. Sotto, la posizione la crea il
// circolo e la collega a un genitore.
//
// ⚠️ NON È UN NUMERO SCELTO A CASO. Un'app che accetta iscrizioni di
// minori entra in un regime diverso — consenso dei genitori, e le
// regole degli store per le app rivolte anche ai bambini, che sono
// pesanti. Sedici anni è la soglia sotto la quale il GDPR pretende il
// consenso di chi esercita la responsabilità genitoriale.
export const ETA_MINIMA_REGISTRAZIONE = 16;

// ============================================================
// ⚠️ IL DOMINIO STA SCRITTO IN UN POSTO SOLO, e tutto il resto lo
// deriva. Prima era ricopiato a mano in sette file — le pagine del
// sito, il robots.txt, i link dentro l'app — e in uno di quelli era
// gia' diverso dagli altri (`racketfever.it` contro `racketfever.com`
// nei metadati del sito). Non e' un dettaglio estetico: l'indirizzo
// che l'utente accetta al momento della registrazione e quello che si
// incolla in Play Console e App Store Connect devono essere lo stesso,
// e un link che porta a un dominio non registrato e' un rifiuto in
// revisione.
//
// ⚠️ CONFERMATO IL 19 AGOSTO 2026: il dominio ufficiale e'
// `racketfever.it`, registrato presso Register.it e collegato a
// Firebase App Hosting. `racketfever.com` e `www.racketfever.com`
// restano registrati e reindirizzano qui con un 301, quindi i vecchi
// link non muoiono — ma l'indirizzo che l'utente accetta alla
// registrazione, quello scritto nei documenti legali e quello che si
// incolla in Play Console e App Store Connect e' questo.
// ============================================================
export const SITO = 'https://racketfever.it';

// ============================================================
// ⚠️ CHI RISPONDE DEL TRATTAMENTO, scritto in un posto solo.
//
// Sta qui e non dentro le pagine del sito perche' compare in tre punti
// — informativa, termini e, il giorno che servira', la scheda degli
// store — e tre copie a mano di un dato legale sono tre occasioni di
// divergere. Il giorno che una di quelle righe cambia, deve cambiarne
// una sola.
//
// ⚠️ PERSONA FISICA, NON SOCIETA': non c'e' partita IVA, e al suo posto
// va il codice fiscale. E' la forma corretta per un titolare persona
// fisica, non una mancanza da colmare. Il giorno che nasce una societa'
// si cambiano queste tre righe, si alza VERSIONE_DOCUMENTI qui sopra —
// cosi' chi aveva accettato prima se lo vede richiedere di nuovo — e si
// aggiornano le schede degli store.
// ============================================================
export const TITOLARE = {
  nome: 'Giorgio Zuccarello',
  // ⚠️ «Sant'Agata DI Militello»: e' il nome ufficiale del comune, ed
  // e' quello che va scritto perche' questa stessa riga finisce su Play
  // Console, su App Store Connect e dentro due documenti legali. Se la
  // forma non coincide con quella dell'anagrafe, la verifica
  // dell'identita' degli store si ferma.
  indirizzo: 'Via Gen. Aurelio Liotta 30, 98076 Sant’Agata di Militello (ME), Italia',
  // Persona fisica: codice fiscale, non partita IVA.
  codiceFiscale: 'ZCCGRG77T23F158W',
  // ============================================================
  // ⚠️ IL TELEFONO E' UN DATO OBBLIGATORIO, NON UN RECAPITO IN PIU'.
  //
  // Chi pubblica un'app nell'Unione Europea come «operatore
  // commerciale» deve rendere pubblici nome, indirizzo, EMAIL e
  // TELEFONO del responsabile: lo pretende il Digital Services Act, e
  // vale anche per le app gratuite. Play Console lo chiede
  // esplicitamente nella verifica dell'operatore commerciale, e il
  // numero che si scrive li' deve coincidere con quello dei documenti
  // legali — altrimenti la verifica si ferma.
  //
  // Scritto il 20 agosto 2026. Compare in tre punti che lo leggono da
  // qui: Impostazioni nell'app, informativa privacy e termini sul sito.
  // Se un giorno cambia, si cambia SOLO questa riga — e allora si alza
  // VERSIONE_DOCUMENTI, perche' e' scritto dentro due documenti legali.
  // ⚠️ Oggi NON serve alzarla: la versione '2026-08-20' e' stata creata
  // stamattina per la verifica dell'eta' e non e' ancora stata
  // pubblicata, quindi il telefono ci entra dentro senza far
  // riaccettare i documenti una seconda volta nello stesso giorno.
  //
  // ⚠️ E deve coincidere, cifra per cifra, con quello che si scrive in
  // Play Console e in App Store Connect: la verifica dell'operatore
  // commerciale confronta le due cose.
  // ============================================================
  telefono: '+39 333 918 1917',
};

export const INDIRIZZO_PRIVACY = `${SITO}/privacy`;
export const INDIRIZZO_TERMINI = `${SITO}/termini`;
export const INDIRIZZO_CANCELLAZIONE = `${SITO}/cancellazione-account`;

// Il nome nudo, senza schema, per quando va scritto dentro una frase
// («Valgono per l'app e per il sito ...»).
export const SITO_NUDO = SITO.replace(/^https?:\/\//, '');

export const EMAIL_CONTATTO = `info@${SITO_NUDO}`;

// ============================================================
// L'ETA' — DA DICHIARATA A VERIFICATA.
//
// ⚠️ FINO A OGGI ERA UNA CASELLA DA SPUNTARE, e non provava niente.
// «Ho almeno 16 anni» scritto da chi ha undici anni e vuole entrare
// vale esattamente quanto niente: il giorno in cui si scopre che un
// account e' di un bambino, la difesa «l'aveva dichiarato lui» regge
// solo se qualcosa e' stato davvero chiesto e controllato. Adesso si
// chiede la data di nascita, si calcola l'eta' vera, e sotto la soglia
// non si entra — ne' dalla schermata ne' dalle regole Firestore, che
// rifanno lo stesso conto lato server.
//
// ⚠️ SI CHIEDE LA DATA COMPLETA e non il solo anno, perche' con l'anno
// non si distingue chi compie sedici anni a gennaio da chi li compie a
// dicembre: uno dei due sarebbe respinto per undici mesi, o accettato
// con undici mesi di anticipo. E' l'unico dato in piu' che raccogliamo,
// e serve a una cosa sola.
// ============================================================

// La data di nascita piu' RECENTE che permette di registrarsi oggi:
// chi e' nato dopo non ha ancora l'eta'. Formato AAAA-MM-GG.
//
// ⚠️ Il confronto poi si fa fra stringhe, e funziona proprio perche'
// il formato ha lunghezza fissa e va dal pezzo piu' grande al piu'
// piccolo: '2010-03-07' < '2010-03-08' e' vero sia come data sia come
// testo. E' anche l'unica forma che le regole Firestore sanno
// confrontare senza saper fare i conti sulle date.
// ⚠️ IN UTC, e non e' pignoleria da fuso orario. Lo stesso conto lo
// rifa' la regola Firestore su `request.time`, che e' l'orologio del
// SERVER e sta in UTC. Facendolo qui sull'ora locale, un ragazzo
// italiano che compie sedici anni oggi e si registra all'una di notte
// avrebbe trovato la schermata che lo lascia passare e il server che
// lo respinge — con un «permesso negato» in inglese al posto di una
// spiegazione. Due orologi diversi sulla stessa soglia producono
// sempre, prima o poi, una coppia di ore in cui i due non sono
// d'accordo.
export function dataNascitaMassimaPerRegistrarsi(adesso: Date = new Date()): string {
  const a = adesso.getUTCFullYear() - ETA_MINIMA_REGISTRAZIONE;
  const m = String(adesso.getUTCMonth() + 1).padStart(2, '0');
  const g = String(adesso.getUTCDate()).padStart(2, '0');
  return `${a}-${m}-${g}`;
}

// Compone GG/MM/AAAA in AAAA-MM-GG, oppure restituisce null se quella
// data non esiste.
//
// ⚠️ Il controllo del 31 febbraio non e' pedanteria: `new Date(2010, 1,
// 31)` in JavaScript non fallisce, scivola al 3 marzo. Senza il
// riscontro sui tre pezzi, una data impossibile sarebbe stata accettata
// e scritta sul profilo come un'altra data.
export function dataNascitaISO(
  giorno: number, mese: number, anno: number,
): string | null {
  if (!Number.isInteger(giorno) || !Number.isInteger(mese) || !Number.isInteger(anno)) return null;
  if (anno < 1900 || anno > 2200) return null;
  if (mese < 1 || mese > 12) return null;
  if (giorno < 1 || giorno > 31) return null;
  const d = new Date(anno, mese - 1, giorno);
  if (d.getFullYear() !== anno || d.getMonth() !== mese - 1 || d.getDate() !== giorno) return null;
  return `${String(anno).padStart(4, '0')}-${String(mese).padStart(2, '0')}-${String(giorno).padStart(2, '0')}`;
}

// Gli anni compiuti a oggi. `null` se la data non e' scritta bene.
export function etaCompiuta(dataNascita: string, adesso: Date = new Date()): number | null {
  if (typeof dataNascita !== 'string' || dataNascita.length !== 10) return null;
  const anno = Number(dataNascita.slice(0, 4));
  const mese = Number(dataNascita.slice(5, 7));
  const giorno = Number(dataNascita.slice(8, 10));
  if (dataNascitaISO(giorno, mese, anno) !== dataNascita) return null;
  // In UTC, per la stessa ragione scritta sopra: e' l'orologio con cui
  // il server giudichera' la stessa registrazione.
  let eta = adesso.getUTCFullYear() - anno;
  const compiuto = (adesso.getUTCMonth() + 1) > mese
    || ((adesso.getUTCMonth() + 1) === mese && adesso.getUTCDate() >= giorno);
  if (!compiuto) eta -= 1;
  return eta;
}

// Vero se quella data di nascita permette di registrarsi da soli.
export function etaSufficientePerRegistrarsi(
  dataNascita: string, adesso: Date = new Date(),
): boolean {
  const eta = etaCompiuta(dataNascita, adesso);
  return eta !== null && eta >= ETA_MINIMA_REGISTRAZIONE;
}

// Una data di nascita palesemente impossibile va fermata prima di
// arrivare al conto dell'eta': 130 anni non e' un socio, e' un errore
// di battitura sull'anno che poi resterebbe scritto sul profilo.
export const ETA_MASSIMA_PLAUSIBILE = 120;
