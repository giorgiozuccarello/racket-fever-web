// ============================================================
// SPAZIO WEB DI COMPETITION TENNIS GMBH — i contenuti.
// Indirizzo: /competitiontennis (tedesco), /it, /en.
//
// ⚠️ TUTTO IL TESTO STA QUI, il JSX in Pagina.tsx non ne contiene
// nemmeno una parola. È la stessa regola dello spazio web del Circolo
// Sant'Agata, e per lo stesso motivo: questa è la seconda pagina di una
// serie, e il giorno che gli spazi web si leggono da Firestore si
// sostituisce questo file e il componente non si tocca.
//
// ⚠️ IL TEDESCO NON L'ABBIAMO SCRITTO NOI. Slogan, presentazione, i
// cinque paragrafi di «Über mich», la testimonianza di Anna Keller, le
// due domande frequenti e la condizione di disdetta sono ricopiati
// parola per parola da competition-tennis.ch. Se il cliente cambia una
// frase sul suo sito, qui NON si riscrive a senso: si ricopia.
// Italiano e inglese sono traduzioni nostre e vanno fatte rileggere.
//
// ⚠️ I PREZZI SONO DI UN'ALTRA AZIENDA, e stanno sotto il nostro
// dominio. Vengono dalle pagine Angebot e Bespannungsservice lette il
// 14 settembre 2026. Non si arrotondano, non si «sistemano», e prima
// della pubblicazione li conferma Levin.
//
// ⚠️ I NUMERI STANNO FUORI DALLE TRE LINGUE. Una tabella prezzi
// ricopiata tre volte è una tabella che fra sei mesi dice tre cose
// diverse: LEZIONI, PRIVATA, JUNIORES e CORDE sono definiti una volta
// sola e le tre lingue traducono solo le intestazioni.
// ============================================================

export type Lingua = 'de' | 'it' | 'en';

export const BASE = '/competitiontennis';

export const TEL = '+41 79 577 10 22';
export const TEL_URL = 'tel:+41795771022';
export const WA = 'https://api.whatsapp.com/send?phone=41795771022';
export const IG = 'https://www.instagram.com/levintil';
export const IG_NOME = '@levintil';
export const AZIENDA = 'Competition Tennis GmbH';
export const MARCHIO = 'Competition Tennis';
export const MAESTRO = 'Levin Til Müller';
export const SITO_CLIENTE = 'https://www.competition-tennis.ch';

// ⚠️ UNA SOLA NOTAZIONE PER UNA SOLA VALUTA. Le schede dicevano
// «CHF 90.–» e la tabella «Fr. 90.–» nella stessa pagina, e il «Fr.»
// era scritto a mano dentro il JSX — cioè testo fuori da questo file,
// che è proprio la cosa che il commento in cima vieta.
export const VALUTA = 'Fr.';

// ⚠️ L'ANNO DEL PIEDE NON SI CALCOLA CON `new Date()`. Le tre rotte
// sono statiche: l'anno si congelerebbe al momento della build e il
// 1° gennaio il piede di un cliente mostrerebbe l'anno vecchio senza
// che nessuno se ne accorga. Meglio una costante che si vede.
export const ANNO = 2026;

// Gruppo, durata, prezzo a persona. Il campo (Fr. 20.– all'ora, diviso
// fra i partecipanti) è una colonna sola perché è sempre lo stesso.
export const LEZIONI: [string, string, string][] = [
  ['4er', '55 Min.', '28.–'],
  ['4er', '90 Min.', '42.–'],
  ['4er', '120 Min.', '56.–'],
  ['3er', '55 Min.', '36.–'],
  ['3er', '90 Min.', '54.–'],
  ['3er', '120 Min.', '72.–'],
  ['2er', '55 Min.', '50.–'],
  ['2er', '90 Min.', '75.–'],
];
export const CAMPO = '20.–';

// ⚠️ La privata è l'unica riga con DUE prezzi (socio e non socio):
// per questo è fuori dalla tabella e non dentro. Metterla dentro
// significava far dire alla quarta colonna due cose diverse — ed è
// esattamente l'errore che la prima stesura di questa pagina faceva.
export const PRIVATA = { durata: '55 Min.', socio: '90.–', nonSocio: '110.–' };
export const JUNIORES = { durata: '60 Min.', prezzo: '90.–' };

export const CORDE: [string, string][] = [
  ['Nur Bespannung', '30.–'],
  ['Head Lynx 1.25', '45.–'],
  ['Head Lynx Tour 1.25', '50.–'],
  ['Head Hawk Touch 1.25', '55.–'],
  ['Solinco Tour Bite 1.25 / 1.30', '50.–'],
  ['Solinco Tour Bite Soft 1.25', '50.–'],
  ['Solinco Hyper-G 1.25', '50.–'],
  ['Solinco Vanquish 1.25 / 1.30', '40.–'],
  ['Solinco Confidential Soft Pink', '50.–'],
  ['Yonex Pro Poly Tour', '50.–'],
  ['Babolat RPM Blast / Team / Power', '60.–'],
  ['Luxilon Alu Power 1.25', '65.–'],
  ['Luxilon Adrenalin / 4G', '65.–'],
  ['Hybrid Kunstdarm / Polyester', '80.–'],
  ['Natur-Darmsaite', '100.–'],
  ['Testschläger, 1 Woche', '10.–'],
];

export const MARCHE = ['Babolat', 'Luxilon', 'Solinco', 'Head', 'Toroline', 'Wilson', 'Yonex'];

// ⚠️ Il quinto logo il sito del cliente lo chiamava «TCS»: aprendolo è
// il Tennisclub Stansstad, che è anche una delle tre sedi. Sotto un
// logo ci va il nome che c'è scritto dentro.
export const PARTNER: { nome: string; file: string; larghezza: number; altezza: number }[] = [
  { nome: 'Babolat', file: `${BASE}/partner-babolat.png`, larghezza: 615, altezza: 113 },
  { nome: 'Solinco', file: `${BASE}/partner-solinco.png`, larghezza: 455, altezza: 246 },
  { nome: 'Tennisclub Kriens', file: `${BASE}/partner-tckriens.png`, larghezza: 437, altezza: 232 },
  { nome: 'J.Lindeberg', file: `${BASE}/partner-jlindeberg.png`, larghezza: 276, altezza: 77 },
  { nome: 'Tennisclub Stansstad', file: `${BASE}/partner-tcs.png`, larghezza: 488, altezza: 245 },
];

// Le foto, con le misure vere del file: servono a `width`/`height`
// nell'`img`, che è quello che impedisce alla pagina di saltare mentre
// le immagini arrivano.
// ⚠️ LA FOTO DELLA SEDE STA ATTACCATA AL NOME DELLA SEDE, non a una
// posizione. Prima era un array parallelo nel componente: aggiungendo
// una quarta sede le foto slittavano di uno senza nessun errore.
// I nomi delle sedi sono gli stessi in tutte e tre le lingue, ed è
// quello che rende possibile questa mappa.
export const FOTO_LUOGHI: Record<string, keyof typeof FOTO | null> = {
  'Kriens': 'kriens',
  'Stansstad': 'stansstad',
  'Aesch ZH': null,
};

export const FOTO = {
  ritratto: { file: `${BASE}/ritratto.jpg`, larghezza: 1200, altezza: 1500 },
  basilea: { file: `${BASE}/basilea.jpg`, larghezza: 1100, altezza: 1467 },
  kriens: { file: `${BASE}/kriens.jpg`, larghezza: 630, altezza: 356 },
  stansstad: { file: `${BASE}/stansstad.jpg`, larghezza: 821, altezza: 357 },
};

export type Testi = {
  htmlLang: string;
  ogLocale: string;
  etichetta: string;
  titoloPagina: string;
  descrizionePagina: string;
  nav: string[];
  ctaTel: string;
  ctaWa: string;
  heroOcchiello: string;
  heroTitolo: string[];
  heroTesto: string;
  heroNota: string;
  dati: [string, string][];
  chiOcchiello: string;
  chiTitolo: string[];
  chiTesto: string[];
  chiFirma: string;
  lezOcchiello: string;
  lezTitolo: string[];
  lezTesto: string;
  lezCarte: { titolo: string; testo: string; voce: string; prezzo: string }[];
  tabTitolo: string;
  tabGruppo: string;
  tabDurata: string;
  tabPersona: string;
  tabCampo: string;
  tabPrivata: string;
  tabSocio: string;
  tabNonSocio: string;
  lezNote: string[];
  incOcchiello: string;
  incTitolo: string[];
  incTesto: string;
  incAlt: string;
  incMarche: string;
  incColori: string;
  incCta: string;
  dovOcchiello: string;
  dovTitolo: string[];
  luoghi: { nome: string; club: string; nota: string }[];
  dovNota: string;
  newsOcchiello: string;
  news: { titolo: string; testo: string }[];
  partOcchiello: string;
  partTitolo: string;
  testimonianza: string;
  testimonianzaChi: string;
  faqOcchiello: string;
  faq: [string, string][];
  contOcchiello: string;
  contTitolo: string[];
  contTesto: string;
  contTel: string;
  contWa: string;
  contIg: string;
  piedeSito: string;
  piedeRf: string;
};

export const T: Record<Lingua, Testi> = {
  // ============================================================
  // TEDESCO — la lingua del cliente e quella predefinita.
  // ============================================================
  de: {
    htmlLang: 'de-CH',
    ogLocale: 'de_CH',
    etichetta: 'Deutsch',
    titoloPagina: `Tennisschule ${MAESTRO} — ${AZIENDA}`,
    descrizionePagina:
      'Tennisunterricht für Junioren und Erwachsene in Kriens, Stansstad und Aesch ZH, '
      + 'Wettkampftraining und Bespannungsservice. Preise, Standorte und Kontakt.',
    nav: ['Über mich', 'Training', 'Bespannung', 'Standorte', 'Kontakt'],
    ctaTel: 'Anrufen',
    ctaWa: 'WhatsApp',
    heroOcchiello: 'Schlag für Schlag zum Erfolg',
    heroTitolo: ['Auf die Plätze,', 'fertig, glücklich'],
    heroTesto:
      'Die Tennisschule von Levin Til Müller steht für hochwertige Tennis Produkte '
      + 'und professionelles Training. Unser Ziel ist es, Spielerinnen und Spieler '
      + 'aller Alters- und Leistungsstufen dabei zu unterstützen, ihr volles '
      + 'Potenzial zu entfalten.',
    heroNota: 'Kriens · Stansstad · Aesch ZH — und auf Anfrage in Ihrer Region',
    dati: [
      ['ab 10 Jahren', 'auf dem Platz, seither'],
      ['N4 Nr. 81', 'beste nationale Klassierung'],
      ['U14 Nr. 231', 'international, ITF'],
      ['C-Trainer', 'dipl. Tennislehrer'],
    ],
    chiOcchiello: 'Über mich',
    chiTitolo: ['Leidenschaft, Qualität', 'und nachhaltiger Erfolg'],
    chiTesto: [
      'Tennis begleitet mich seit meinem zehnten Lebensjahr – und es ist bis heute '
      + 'meine Leidenschaft.',
      'Bis zu meinem 17. Lebensjahr habe ich intensiv auf eine Profikarriere '
      + 'hingearbeitet. Meine beste Klassierung war N4 Rang 81 und international in '
      + 'der U14 Rang 231.',
      'Mit fundierter Ausbildung als C-Trainer und diplomierter Tennislehrer '
      + 'begleite ich Kinder, Jugendliche und Erwachsene auf ihrem individuellen Weg '
      + 'im Tennissport.',
      'Mein Ziel ist es, Freude am Spiel, technische Entwicklung und persönliche '
      + 'Betreuung zu verbinden, vom Anfänger bis zum ambitionierten '
      + 'Wettkampfspieler.',
    ],
    chiFirma: 'Meine Tennisschule steht für Leidenschaft, Qualität und nachhaltigen Erfolg.',
    lezOcchiello: 'Training',
    lezTitolo: ['Drei Wege auf', 'den Platz'],
    lezTesto:
      'Vom ersten Ballkontakt bis zur Turniersaison. Die Preise gelten für TC Kriens '
      + 'und TC Stansstad.',
    lezCarte: [
      {
        titolo: 'Junioren & Juniorinnen',
        testo:
          'Bis 18 Jahre und Studierende. Moderne Methoden, altersgerechte Spielformen '
          + '— und der Spass steht immer im Mittelpunkt.',
        voce: `Privatlektion ${JUNIORES.durata}, exkl. Platz`,
        prezzo: `${VALUTA} ${JUNIORES.prezzo}`,
      },
      {
        titolo: 'Erwachsene, Sommer 2026',
        testo:
          'Privatlektionen, Gruppenstunden zu zweit, zu dritt und zu viert, '
          + 'Interclub-Vorbereitung.',
        voce: `Privatstunde ${PRIVATA.durata}, Mitglied`,
        prezzo: `${VALUTA} ${PRIVATA.socio}`,
      },
      {
        titolo: 'Wettkampf',
        testo:
          'Matchorientiertes Training, Turnierplanung, Trainingsplanung, '
          + 'Turnierbetreuung, Intensivwochen.',
        voce: 'Nach Absprache',
        prezzo: 'Auf Anfrage',
      },
    ],
    tabTitolo: 'Gruppenpreise',
    tabGruppo: 'Gruppe',
    tabDurata: 'Dauer',
    tabPersona: 'pro Person',
    tabCampo: 'Platzkosten/Std.',
    tabPrivata: 'Privatstunde',
    tabSocio: 'Mitglied',
    tabNonSocio: 'Nicht-Mitglied',
    lezNote: [
      `Platzkosten Fr. ${CAMPO} pro Stunde, geteilt auf die Teilnehmenden.`,
      'Bei Privatstunden muss der Kunde/die Kundin sich 24 Stunden im Voraus '
      + 'abmelden, ansonsten wird die volle Stunde verrechnet.',
      'Die Versicherung ist Sache der Teilnehmenden.',
    ],
    incOcchiello: 'Bespannungsservice',
    incTitolo: ['Bespannt wie', 'in Basel'],
    incTesto:
      'Bespannungen für jedes Niveau, von der ersten Saite bis zum Hybrid. Erfahrung '
      + 'von den Swiss Indoors in Basel und von ITF-U18-Turnieren — dieselbe Sorgfalt '
      + 'für jeden Schläger.',
    incAlt: 'Levin Til Müller bespannt einen Schläger an den Swiss Indoors in Basel',
    incMarche: 'Marken',
    incColori: 'Farben: pink, schwarz, silber, orange, grün — je nach Saite.',
    incCta: 'Racket neu bespannen?',
    dovOcchiello: 'Standorte',
    dovTitolo: ['Wo trainiert wird'],
    luoghi: [
      { nome: 'Kriens', club: 'TC Kriens', nota: 'Clubtraining ab Frühling 2026' },
      { nome: 'Stansstad', club: 'TC Stansstad', nota: 'Offizieller Bespanner des Clubs' },
      { nome: 'Aesch ZH', club: '', nota: 'Einzel- und Gruppenstunden' },
    ],
    dovNota: 'Wir kommen auch gerne in Ihre Region — auf Anfrage.',
    newsOcchiello: 'News',
    news: [
      {
        titolo: 'Tennisclub Kriens',
        testo:
          'Ab Frühling 2026 übernimmt die Tennisschule das Clubtraining beim TC '
          + 'Kriens. Wer die ersten Stunden dabei sein möchte, meldet sich am besten '
          + 'schon jetzt.',
      },
      {
        titolo: 'Tennisclub Stansstad',
        testo:
          'Die Competition Tennis GmbH ist neuer offizieller Sponsor des Tennisclubs '
          + 'Stansstad. Für die laufende Saison ist Levin Til Müller zudem Bespanner '
          + 'des Clubs.',
      },
    ],
    partOcchiello: 'Partner',
    partTitolo: 'Unsere geschätzten Partner',
    testimonianza:
      'Dank der Tennisschule von Levin Til Müller habe ich nicht nur mein Spiel '
      + 'verbessert, sondern auch den passenden Tennisschläger gefunden. Die Beratung '
      + 'war erstklassig und ich kann die Tennisschule nur weiterempfehlen.',
    testimonianzaChi: 'Anna Keller',
    faqOcchiello: 'Häufige Fragen',
    faq: [
      [
        'Wie komme ich zu einer Tennisstunde mit Levin Til Müller?',
        `Rufe mich einfach an für einen Termin: ${TEL}`,
      ],
      [
        'Warum sollte mein Kind die Tennisschule von Levin Til Müller besuchen?',
        'In unserer Tennisschule trainieren Kinder mit modernen Methoden und '
        + 'altersgerechten Spielformen. Dabei steht der Spass immer im Mittelpunkt.',
      ],
    ],
    contOcchiello: 'Kontakt',
    contTitolo: ['Ruf einfach an'],
    contTesto: 'Ein Anruf oder eine Nachricht genügt für einen Termin.',
    contTel: 'Telefon',
    contWa: 'WhatsApp',
    contIg: 'Instagram',
    piedeSito: 'Zur Website der Tennisschule',
    piedeRf: 'Webauftritt und Buchungsplattform:',
  },

  // ============================================================
  // ITALIANO — traduzione nostra, da far rileggere.
  // ============================================================
  it: {
    htmlLang: 'it',
    ogLocale: 'it_IT',
    etichetta: 'Italiano',
    titoloPagina: `Scuola di tennis ${MAESTRO} — ${AZIENDA}`,
    descrizionePagina:
      'Lezioni di tennis per ragazzi e adulti a Kriens, Stansstad e Aesch ZH, '
      + 'allenamento agonistico e servizio di incordatura. Prezzi, sedi e contatti.',
    nav: ['Chi sono', 'Lezioni', 'Incordatura', 'Dove', 'Contatti'],
    ctaTel: 'Chiama',
    ctaWa: 'WhatsApp',
    heroOcchiello: 'Colpo dopo colpo, verso il risultato',
    heroTitolo: ['Pronti, via,', 'e che sia un piacere'],
    heroTesto:
      'La scuola di tennis di Levin Til Müller è fatta di attrezzatura di qualità e '
      + 'di allenamento professionale. L’obiettivo è uno: accompagnare giocatrici e '
      + 'giocatori di ogni età e di ogni livello a tirare fuori tutto quello che hanno.',
    heroNota: 'Kriens · Stansstad · Aesch ZH — e su richiesta nella vostra zona',
    dati: [
      ['dai 10 anni', 'in campo, senza smettere'],
      ['N4 n. 81', 'miglior classifica nazionale'],
      ['U14 n. 231', 'internazionale, ITF'],
      ['C-Trainer', 'maestro diplomato'],
    ],
    chiOcchiello: 'Chi sono',
    chiTitolo: ['Passione, qualità', 'e risultati che restano'],
    chiTesto: [
      'Il tennis mi accompagna da quando ho dieci anni, ed è ancora oggi la mia '
      + 'passione.',
      'Fino ai diciassette ho lavorato seriamente per una carriera da professionista. '
      + 'La mia miglior classifica è stata N4 numero 81, e a livello internazionale '
      + 'numero 231 nell’Under 14.',
      'Con una formazione solida da C-Trainer e da maestro diplomato seguo bambini, '
      + 'ragazzi e adulti lungo il loro percorso personale nel tennis.',
      'Il mio obiettivo è tenere insieme tre cose: il piacere di giocare, la crescita '
      + 'tecnica e un’attenzione personale, dal principiante al giocatore da torneo.',
    ],
    chiFirma: 'La mia scuola di tennis è passione, qualità e risultati che restano.',
    lezOcchiello: 'Lezioni',
    lezTitolo: ['Tre strade', 'per entrare in campo'],
    lezTesto:
      'Dal primo palleggio alla stagione dei tornei. I prezzi valgono per il TC Kriens '
      + 'e il TC Stansstad.',
    lezCarte: [
      {
        titolo: 'Ragazzi e ragazze',
        testo:
          'Fino ai 18 anni e studenti. Metodi moderni, forme di gioco adatte all’età '
          + '— e il divertimento sempre al centro.',
        voce: `Lezione privata ${JUNIORES.durata}, campo escluso`,
        prezzo: `${VALUTA} ${JUNIORES.prezzo}`,
      },
      {
        titolo: 'Adulti, estate 2026',
        testo:
          'Lezioni private, gruppi da due, da tre e da quattro, preparazione '
          + 'all’Interclub.',
        voce: `Lezione privata ${PRIVATA.durata}, socio`,
        prezzo: `${VALUTA} ${PRIVATA.socio}`,
      },
      {
        titolo: 'Agonismo',
        testo:
          'Allenamento orientato alla partita, programmazione dei tornei e degli '
          + 'allenamenti, assistenza in torneo, settimane intensive.',
        voce: 'Da concordare',
        prezzo: 'Su richiesta',
      },
    ],
    tabTitolo: 'Prezzi dei gruppi',
    tabGruppo: 'Gruppo',
    tabDurata: 'Durata',
    tabPersona: 'a persona',
    tabCampo: 'Campo, all’ora',
    tabPrivata: 'Lezione privata',
    tabSocio: 'Socio',
    tabNonSocio: 'Non socio',
    lezNote: [
      `Campo Fr. ${CAMPO} all’ora, diviso fra i partecipanti.`,
      'Le lezioni private si disdicono 24 ore prima: dopo, l’ora viene addebitata per '
      + 'intero.',
      'L’assicurazione è a carico dei partecipanti.',
    ],
    incOcchiello: 'Incordatura',
    incTitolo: ['Incordata', 'come a Basilea'],
    incTesto:
      'Incordature per ogni livello, dalla prima corda all’ibrido. L’esperienza viene '
      + 'dagli Swiss Indoors di Basilea e dai tornei ITF Under 18 — e la cura è la '
      + 'stessa per ogni racchetta.',
    incAlt: 'Levin Til Müller incorda una racchetta agli Swiss Indoors di Basilea',
    incMarche: 'Marche',
    incColori: 'Colori: rosa, nero, argento, arancione, verde — secondo la corda.',
    incCta: 'Racchetta da incordare?',
    dovOcchiello: 'Dove',
    dovTitolo: ['Dove si allena'],
    luoghi: [
      { nome: 'Kriens', club: 'TC Kriens', nota: 'Allenamento del club dalla primavera 2026' },
      { nome: 'Stansstad', club: 'TC Stansstad', nota: 'Incordatore ufficiale del club' },
      { nome: 'Aesch ZH', club: '', nota: 'Lezioni individuali e di gruppo' },
    ],
    dovNota: 'Veniamo volentieri anche nella vostra zona — su richiesta.',
    newsOcchiello: 'Novità',
    news: [
      {
        titolo: 'Tennisclub Kriens',
        testo:
          'Dalla primavera 2026 la scuola prende in carico l’allenamento del club al '
          + 'TC Kriens. Chi vuole esserci fin dalle prime ore conviene che si iscriva '
          + 'da adesso.',
      },
      {
        titolo: 'Tennisclub Stansstad',
        testo:
          'Competition Tennis GmbH è il nuovo sponsor ufficiale del Tennisclub '
          + 'Stansstad. Per la stagione in corso Levin Til Müller è anche '
          + 'l’incordatore del club.',
      },
    ],
    partOcchiello: 'Partner',
    partTitolo: 'I nostri partner',
    testimonianza:
      'Grazie alla scuola di Levin Til Müller non ho soltanto migliorato il mio gioco: '
      + 'ho anche trovato la racchetta giusta. La consulenza è stata di primo livello e '
      + 'la scuola la consiglio a occhi chiusi.',
    testimonianzaChi: 'Anna Keller',
    faqOcchiello: 'Domande frequenti',
    faq: [
      [
        'Come si prenota una lezione con Levin Til Müller?',
        `Basta una telefonata per fissare l’appuntamento: ${TEL}`,
      ],
      [
        'Perché iscrivere mio figlio a questa scuola?',
        'Qui i bambini si allenano con metodi moderni e con forme di gioco adatte alla '
        + 'loro età. E il divertimento è sempre al centro.',
      ],
    ],
    contOcchiello: 'Contatti',
    contTitolo: ['Una telefonata', 'e si è in campo'],
    contTesto: 'Per fissare una lezione basta una chiamata o un messaggio.',
    contTel: 'Telefono',
    contWa: 'WhatsApp',
    contIg: 'Instagram',
    piedeSito: 'Il sito della scuola',
    piedeRf: 'Spazio web e piattaforma di prenotazione:',
  },

  // ============================================================
  // INGLESE — traduzione nostra, da far rileggere.
  // ============================================================
  en: {
    htmlLang: 'en',
    ogLocale: 'en_GB',
    etichetta: 'English',
    titoloPagina: `${MAESTRO} Tennis School — ${AZIENDA}`,
    descrizionePagina:
      'Tennis lessons for juniors and adults in Kriens, Stansstad and Aesch ZH, '
      + 'competition training and a stringing service. Prices, locations and contact.',
    nav: ['About', 'Training', 'Stringing', 'Locations', 'Contact'],
    ctaTel: 'Call',
    ctaWa: 'WhatsApp',
    heroOcchiello: 'Stroke by stroke to success',
    heroTitolo: ['On your marks,', 'set, enjoy'],
    heroTesto:
      'Levin Til Müller’s tennis school stands for quality equipment and professional '
      + 'coaching. The aim is simple: to help players of every age and every level get '
      + 'everything they have out of their game.',
    heroNota: 'Kriens · Stansstad · Aesch ZH — and on request in your area',
    dati: [
      ['since age 10', 'on court, ever since'],
      ['N4 no. 81', 'best national ranking'],
      ['U14 no. 231', 'international, ITF'],
      ['C-Trainer', 'certified tennis teacher'],
    ],
    chiOcchiello: 'About',
    chiTitolo: ['Passion, quality', 'and lasting results'],
    chiTesto: [
      'Tennis has been with me since I was ten — and it is still my passion today.',
      'Until I was seventeen I worked hard towards a professional career. My best '
      + 'ranking was N4 no. 81, and no. 231 internationally in the under-14s.',
      'With solid training as a C-Trainer and a certified tennis teacher, I coach '
      + 'children, teenagers and adults along their own path in the game.',
      'My aim is to hold three things together: enjoyment of the game, technical '
      + 'development and personal attention — from the beginner to the ambitious '
      + 'competitor.',
    ],
    chiFirma: 'My tennis school stands for passion, quality and lasting results.',
    lezOcchiello: 'Training',
    lezTitolo: ['Three ways', 'onto the court'],
    lezTesto:
      'From the first rally to the tournament season. Prices apply at TC Kriens and '
      + 'TC Stansstad.',
    lezCarte: [
      {
        titolo: 'Juniors',
        testo:
          'Up to 18 and students. Modern methods, age-appropriate games — and '
          + 'enjoyment always at the centre.',
        voce: `Private lesson ${JUNIORES.durata}, court not included`,
        prezzo: `${VALUTA} ${JUNIORES.prezzo}`,
      },
      {
        titolo: 'Adults, summer 2026',
        testo:
          'Private lessons, groups of two, three and four, interclub preparation.',
        voce: `Private lesson ${PRIVATA.durata}, member`,
        prezzo: `${VALUTA} ${PRIVATA.socio}`,
      },
      {
        titolo: 'Competition',
        testo:
          'Match-oriented training, tournament and training planning, on-site '
          + 'tournament support, intensive weeks.',
        voce: 'By arrangement',
        prezzo: 'On request',
      },
    ],
    tabTitolo: 'Group prices',
    tabGruppo: 'Group',
    tabDurata: 'Duration',
    tabPersona: 'per person',
    tabCampo: 'Court, per hour',
    tabPrivata: 'Private lesson',
    tabSocio: 'Member',
    tabNonSocio: 'Non-member',
    lezNote: [
      `Court fee Fr. ${CAMPO} per hour, shared between the participants.`,
      'Private lessons must be cancelled 24 hours in advance, otherwise the full hour '
      + 'is charged.',
      'Insurance is the participants’ own responsibility.',
    ],
    incOcchiello: 'Stringing service',
    incTitolo: ['Strung the way', 'it is done in Basel'],
    incTesto:
      'Stringing for every level, from a first set of strings to a hybrid. The '
      + 'experience comes from the Swiss Indoors in Basel and from ITF under-18 '
      + 'tournaments — and every racket gets the same care.',
    incAlt: 'Levin Til Müller stringing a racket at the Swiss Indoors in Basel',
    incMarche: 'Brands',
    incColori: 'Colours: pink, black, silver, orange, green — depending on the string.',
    incCta: 'Racket to restring?',
    dovOcchiello: 'Locations',
    dovTitolo: ['Where the training happens'],
    luoghi: [
      { nome: 'Kriens', club: 'TC Kriens', nota: 'Club training from spring 2026' },
      { nome: 'Stansstad', club: 'TC Stansstad', nota: 'Official stringer of the club' },
      { nome: 'Aesch ZH', club: '', nota: 'Private and group lessons' },
    ],
    dovNota: 'We are glad to come to your area too — on request.',
    newsOcchiello: 'News',
    news: [
      {
        titolo: 'Tennisclub Kriens',
        testo:
          'From spring 2026 the school takes over club training at TC Kriens. If you '
          + 'want to be there from the first sessions, it is worth signing up now.',
      },
      {
        titolo: 'Tennisclub Stansstad',
        testo:
          'Competition Tennis GmbH is the new official sponsor of Tennisclub '
          + 'Stansstad. For the current season Levin Til Müller is also the club’s '
          + 'stringer.',
      },
    ],
    partOcchiello: 'Partners',
    partTitolo: 'Our valued partners',
    testimonianza:
      'Thanks to Levin Til Müller’s school I did not only improve my game, I also '
      + 'found the right racket. The advice was first class and I can only recommend '
      + 'the school.',
    testimonianzaChi: 'Anna Keller',
    faqOcchiello: 'Frequent questions',
    faq: [
      [
        'How do I book a lesson with Levin Til Müller?',
        `Just call to arrange a time: ${TEL}`,
      ],
      [
        'Why should my child come to this school?',
        'Here children train with modern methods and games suited to their age. And '
        + 'enjoyment is always at the centre.',
      ],
    ],
    contOcchiello: 'Contact',
    contTitolo: ['One call', 'and you are on court'],
    contTesto: 'A call or a message is all it takes to arrange a lesson.',
    contTel: 'Phone',
    contWa: 'WhatsApp',
    contIg: 'Instagram',
    piedeSito: 'The school website',
    piedeRf: 'Web space and booking platform:',
  },
};

// Le tre rotte, in un posto solo: le usano sia il selettore di lingua
// sia i metadati `alternates.languages`.
export const ROTTE: Record<Lingua, string> = {
  de: BASE,
  it: `${BASE}/it`,
  en: `${BASE}/en`,
};
export const LINGUE: Lingua[] = ['de', 'it', 'en'];
