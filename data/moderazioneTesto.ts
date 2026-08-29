// ============================================================
// IL FILTRO DELLE PAROLE — la prima linea, non l'unica.
//
// ⚠️ ESISTE PERCHÉ DA OGGI SI PUÒ SCRIVERE A MANO. Finché fra Maestro e
// allievo passavano solo cinque frasi prestampate, non c'era niente da
// filtrare: il problema non si gestiva, non esisteva. Con il testo
// libero l'app ospita contenuti scritti dagli utenti, e gli store
// chiedono quattro cose a chi lo fa: un filtro prima della
// pubblicazione, una segnalazione con risposta rapida, un modo di
// bloccare chi abusa, e dei contatti pubblicati. Le ultime tre ci sono
// (segnala, blocca, informativa). Questa è la prima.
//
// ⚠️ E NON È UNA GARANZIA, ed è importante che chi legge lo sappia.
// Un elenco di parole si aggira scrivendo con uno spazio in mezzo, e
// prende dei granchi: «cazzuola» contiene una parolaccia e non lo è.
// Qui si accetta di essere approssimativi in una direzione sola —
// meglio lasciar passare che rifiutare un messaggio innocente — perché
// la difesa vera contro chi è determinato a offendere non è una lista:
// è il pulsante «Blocca», che toglie la parola all'altro in un tocco, e
// «Segnala», che porta il messaggio a chi deve decidere.
//
// ⚠️ SI CONTROLLA SUL TELEFONO E NON NELLE REGOLE. Le regole di
// Firestore non sanno cercare parole dentro una frase in modo
// affidabile, e un controllo sul server vorrebbe dire leggere ogni
// messaggio di tutti — cioè esattamente il potere che questo progetto
// ha scelto di non darsi. Chi vuole aggirare il filtro chiamando l'API
// a mano ci riesce: contro di lui restano il blocco e la segnalazione,
// che invece reggono perché stanno nelle regole.
//
// ⚠️ FILE GEMELLO app↔web, e senza import: si prova da solo.
// ============================================================

// ⚠️ Radici, non parole intere: si cerca dentro la parola, così
// «stronzate» viene presa da «stronz». Sono volutamente poche e tutte
// inequivocabili — un elenco lungo prende più innocenti che colpevoli.
// Le tre lingue dell'app stanno insieme: la chat non sa chi legge.
const RADICI_VIETATE = [
  // italiano
  'stronz', 'coglion', 'vaffanc', 'puttan', 'troia', 'bastard', 'merdos',
  'frocio', 'negro ', 'ricchion', 'zoccola',
  // inglese
  'fuck', 'shit', 'bitch', 'cunt', 'faggot', 'nigger', 'whore',
  // tedesco
  'fotze', 'hurensohn', 'wichser', 'schlampe', 'nutte',
];

// ⚠️ Si toglie tutto quello che serve solo a mascherare: accenti,
// punteggiatura in mezzo, lettere ripetute e le sostituzioni più
// comuni (0 per o, 1 per i, 3 per e, @ per a). Non è un decoder: è
// quel tanto che basta perché il filtro non si aggiri con un punto.
function normalizza(testo: string): string {
  return testo
    .toLowerCase()
    .replace(/[àáâä]/g, 'a').replace(/[èéêë]/g, 'e').replace(/[ìíîï]/g, 'i')
    .replace(/[òóôö]/g, 'o').replace(/[ùúûü]/g, 'u').replace(/ß/g, 'ss')
    .replace(/0/g, 'o').replace(/1/g, 'i').replace(/3/g, 'e').replace(/@/g, 'a').replace(/\$/g, 's')
    .replace(/[^a-z ]/g, '')
    .replace(/(.)\1{2,}/g, '$1$1');
}

// Vero se il messaggio si può mandare. Chi chiama mostra la sua frase:
// qui non si decide cosa dire a chi scrive.
export function testoAmmesso(testo: string): boolean {
  const pulito = normalizza(testo);
  return !RADICI_VIETATE.some((r) => pulito.includes(r.trim()));
}

// ⚠️ IL TETTO DI LUNGHEZZA STA QUI E NELLE REGOLE, e i due numeri
// devono restare uguali: l'app lo usa per fermare chi scrive, le regole
// per fermare chi chiama l'API a mano. Cinquecento caratteri sono un
// messaggio lungo di chat e un decimo di un tema: bastano per spiegarsi
// e non bastano per usare la chat come deposito.
export const MAX_TESTO_MESSAGGIO = 500;

// ============================================================
// LE PROVE CHE ACCOMPAGNANO UNA SEGNALAZIONE.
//
// ⚠️ SENZA QUESTE, SEGNALARE UN MESSAGGIO È UN'ACCUSA SENZA PROVA. Chi
// modera non può leggere le chat — le regole gliele negano, e devono
// continuare a farlo — quindi se la segnalazione non porta con sé i
// messaggi, chi deve decidere non ha niente in mano e resta la parola
// di uno contro quella dell'altro.
//
// ⚠️ SI COPIA POCO E SOLO SU RICHIESTA DI CHI SEGNALA. Gli ultimi
// scambi, non la conversazione intera, e solo nell'istante in cui
// qualcuno preme «Segnala»: è lo stesso schema già usato per la foto
// del profilo. Le chat restano chiuse a tutti; quello che si legge è
// solo ciò che una persona ha scelto di consegnare.
// ============================================================
export const MAX_MESSAGGI_IN_SEGNALAZIONE = 10;
export const MAX_COPIA_MESSAGGI = 1500;

export function copiaUltimiMessaggi(
  messaggi: Array<{ mittenteNome?: string; testo?: string; codice?: string }>,
  testoDi: (m: { testo?: string; codice?: string }) => string,
): string {
  const ultimi = messaggi.slice(-MAX_MESSAGGI_IN_SEGNALAZIONE);
  const righe = ultimi
    .map((m) => {
      const corpo = testoDi(m).trim();
      if (!corpo) return '';
      return `${(m.mittenteNome ?? '').slice(0, 40)}: ${corpo.slice(0, 200)}`;
    })
    .filter((r) => r.length > 0);
  return righe.join('\n').slice(0, MAX_COPIA_MESSAGGI);
}
