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

export const VERSIONE_DOCUMENTI = '2026-08-18';

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
// ⚠️ DA CONFERMARE PRIMA DELLA BUILD: qui sotto c'e' UNA riga da
// cambiare se il sito pubblico sara' .it invece che .com.
// ============================================================
export const SITO = 'https://racketfever.com';

export const INDIRIZZO_PRIVACY = `${SITO}/privacy`;
export const INDIRIZZO_TERMINI = `${SITO}/termini`;
export const INDIRIZZO_CANCELLAZIONE = `${SITO}/cancellazione-account`;

// Il nome nudo, senza schema, per quando va scritto dentro una frase
// («Valgono per l'app e per il sito ...»).
export const SITO_NUDO = SITO.replace(/^https?:\/\//, '');

export const EMAIL_CONTATTO = `info@${SITO_NUDO}`;
