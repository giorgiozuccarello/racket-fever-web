// ============================================================
// INFORMATIVA PRIVACY.
//
// ⚠️ SCRITTA SU QUELLO CHE L'APP FA DAVVERO, non copiata. Il metodo è
// quello concordato: prima l'elenco di cosa raccogliamo e perché — letto
// riga per riga dal codice e dalle regole Firestore — poi il testo su
// quell'elenco. La regola è una sola: qui non c'è scritto niente che
// l'app non faccia, e l'app non fa niente che non sia scritto qui. È il
// punto in cui quasi tutti sbagliano, perché copiano un'informativa che
// parla di cose che non fanno.
//
// ⚠️ E VA LETTA DA UN AVVOCATO PRIMA DI PUBBLICARLA. Questo è un testo
// tecnico accurato, non un parere legale: i dati del titolare vanno
// compilati, e la forma va validata da chi di mestiere risponde di
// queste cose.
//
// ⚠️ La data in cima deve restare uguale a VERSIONE_DOCUMENTI in
// data/consenso.ts: sul profilo di ogni utente scriviamo quale versione
// ha accettato, e se le due divergono quel dato non prova più niente.
// ============================================================

import type { Metadata } from 'next';
import {
  VERSIONE_DOCUMENTI, EMAIL_CONTATTO, ETA_MINIMA_REGISTRAZIONE, SITO_NUDO,
} from '../../data/consenso';

export const metadata: Metadata = {
  title: 'Informativa privacy — Racket Fever',
  description: 'Quali dati raccoglie Racket Fever, perché, chi li vede e per quanto restano.',
};

const SCATOLA: React.CSSProperties = {
  maxWidth: 760, margin: '0 auto', padding: '3rem 1.5rem 5rem',
  color: '#141F1B', lineHeight: 1.65, fontSize: '1rem',
};
const H2: React.CSSProperties = { fontSize: '1.25rem', marginTop: '2.5rem' };
const TABELLA: React.CSSProperties = {
  width: '100%', borderCollapse: 'collapse', marginTop: '1rem', fontSize: '.92rem',
};
const TD: React.CSSProperties = {
  border: '1px solid #DDE3E0', padding: '.55rem .7rem', verticalAlign: 'top',
};

const DATI: { dato: string; obbligatorio: string; perche: string; chi: string }[] = [
  {
    dato: 'Nome e cognome',
    obbligatorio: 'Sì',
    perche: 'Ti identificano dentro il circolo: sulle prenotazioni, in classifica, nelle sfide.',
    chi: 'I soci del tuo circolo, il circolo, Racket Fever',
  },
  {
    dato: 'Indirizzo email',
    obbligatorio: 'Sì',
    perche: 'È il tuo accesso, e serve al circolo per ricontattarti.',
    // ⚠️ Stessa nota del telefono, e per la stessa ragione: la copia
    // dell'email sta sulla tessera, che l'app scarica anche sugli altri
    // telefoni del circolo. Nessuna schermata la mostra a un socio.
    chi:
      'Il circolo, il maestro, Racket Fever. Come il telefono, una copia viaggia sulla tua '
      + 'tessera: nessuna schermata la mostra agli altri soci.',
  },
  {
    dato: 'Password',
    obbligatorio: 'Sì',
    perche: 'Protegge il tuo accesso. È custodita dal servizio di autenticazione in forma cifrata.',
    chi: 'Nessuno: non è leggibile né da noi né dal circolo',
  },
  {
    dato: 'Numero di telefono',
    obbligatorio: 'No',
    perche:
      'Lo lasci quando chiedi di entrare in un circolo, e permette alla segreteria di '
      + 'richiamarti sull’esito. Ogni circolo vede solo il numero che hai dato a lui.',
    // ⚠️ ERA SCRITTO «solo il responsabile del circolo», e non era vero.
    // Il numero sta sulla tessera, e la tessera è il documento che
    // l'app scarica anche sui telefoni degli altri soci del circolo —
    // le serve per la classifica e per dividere il costo di un campo.
    // Nessuna schermata glielo mostra, ma un'informativa non può
    // descrivere quello che si vede: deve descrivere quello a cui si
    // può arrivare.
    chi:
      'La segreteria del circolo, che ti richiama. Tecnicamente viaggia sulla tua tessera, '
      + 'che l’app scarica anche sui telefoni degli altri soci: nessuna schermata lo mostra loro.',
  },
  {
    dato: 'Anno di nascita',
    obbligatorio: 'No',
    perche: 'Mostra la tua età nella scheda, utile per organizzare partite fra pari.',
    chi: 'I soci del tuo circolo',
  },
  {
    dato: 'Foto del profilo',
    obbligatorio: 'No',
    perche: 'Ti fa riconoscere in classifica e nelle sfide. La scegli dalla galleria o la scatti.',
    // ⚠️ ERA «i soci del tuo circolo». La foto si mostra attraverso un
    // indirizzo con token, che per costruzione funziona per chiunque lo
    // abbia: è il modo in cui funziona l'archivio immagini, non un
    // difetto nostro, ma dirlo è l'unica versione onesta.
    chi:
      'Chi ha fatto l’accesso all’app. Non è pubblica sul web, ma l’indirizzo che la mostra '
      + 'funziona per chiunque lo abbia: resta valido anche dopo che sei uscito dal circolo.',
  },
  {
    dato: 'Racchetta e classifica FITP dichiarata',
    obbligatorio: 'No',
    perche: 'Le scrivi tu nella tua scheda. Non le verifichiamo.',
    chi: 'I soci del tuo circolo',
  },
  {
    dato: 'Prenotazioni e lezioni',
    obbligatorio: '—',
    perche: 'Sono il servizio: campo, giorno, ora, con chi giochi.',
    chi: 'Il circolo e i soci che vedono la griglia',
  },
  {
    dato: 'Messaggi nelle chat',
    obbligatorio: '—',
    perche: 'Servono ad accordarsi su un orario. Non si scrive testo libero: si scelgono frasi già pronte e proposte di orario.',
    chi: 'Solo le due persone della conversazione',
  },
  {
    dato: 'Credito, fido e movimenti',
    obbligatorio: '—',
    perche: 'Sono il registro contabile del circolo: quanto hai versato in segreteria e quanto hai speso.',
    // ⚠️ MANCAVANO I COMPAGNI DI GIOCO, ed è una cosa che si vede a
    // schermo: quando dividi il costo di un campo, l'app avvisa chi
    // prenota se la quota di uno degli altri finirà sul Fido. È una
    // funzione voluta — serve a non far partire una prenotazione che
    // lascia un debito a sorpresa — ma è una informazione sul denaro
    // di una persona mostrata a un'altra, e va dichiarata.
    chi:
      'Tu, il circolo, Racket Fever. Chi divide un campo con te vede se la tua quota andrà a '
      + 'Fido, perché è lui a prenotare — e per lo stesso motivo saldo e fido viaggiano sulla '
      + 'tua tessera, che l’app scarica sui telefoni dei soci del circolo. I movimenti, no: '
      + 'quelli li leggono solo tu e il circolo.',
  },
  {
    dato: 'Segnalazioni e blocchi',
    obbligatorio: '—',
    perche: 'Se segnali qualcuno o lo blocchi, registriamo chi ha segnalato chi, quando e il motivo scelto.',
    // ⚠️ «solo tu (i blocchi)» ERA FALSO, e per una ragione che è
    // giusta: il telefono di chi è bloccato deve poterlo sapere,
    // altrimenti gli lascia lanciare una sfida che il server rifiuta e
    // gli mostra un «permesso negato» a una persona che non ha fatto
    // niente di male. Non riceve nessun avviso, ma il dato lo raggiunge.
    chi:
      'Le segnalazioni: il circolo e Racket Fever. I blocchi: tu e la persona bloccata — non '
      + 'riceve nessun avviso, ma la sua app sa che non può sfidarti.',
  },
  {
    // ⚠️ MANCAVA DEL TUTTO, e l'informativa dichiara di essere completa.
    // Il modulo pubblico del sito raccoglie dati di persone che un
    // account non ce l'hanno e non lo avranno mai: è il caso in cui
    // l'informativa serve di più, non di meno.
    dato: 'Il modulo «voglio essere contattato» del sito',
    obbligatorio: 'No',
    perche:
      'Se sei un circolo e ci chiedi di essere ricontattato, teniamo il nome del circolo, '
      + 'regione e provincia, il tuo nome, il tuo ruolo nel circolo, l’email e — se lo lasci — '
      + 'il telefono. Servono a richiamarti, e a nient’altro: nessuna domanda sul tuo circolo, '
      + 'nessuna profilazione.',
    chi: 'Solo il team Racket Fever',
  },
  {
    dato: 'Identificativo per le notifiche',
    obbligatorio: '—',
    perche: 'Serve a far arrivare al tuo telefono l’avviso di una prenotazione o di una sfida.',
    chi: 'Nessuno lo legge: lo usa il sistema, e sparisce quando esci dall’account',
  },
];

export default function Privacy() {
  return (
    <main style={SCATOLA}>
      <p style={{ margin: 0 }}>
        <a href="/" style={{ color: '#0E3B2E', fontWeight: 700, textDecoration: 'none' }}>
          ← Racket Fever
        </a>
      </p>

      <h1 style={{ fontSize: '2rem', margin: '1.5rem 0 .5rem', lineHeight: 1.2 }}>
        Informativa privacy
      </h1>
      <p style={{ color: '#5A625E', marginTop: 0 }}>
        Versione del {VERSIONE_DOCUMENTI}. Riguarda l’app Racket Fever e il sito {SITO_NUDO}.
      </p>

      {/* ⚠️ SENZA QUESTI DATI L'INFORMATIVA NON VALE NIENTE, e Play
          Console e App Store Connect la rifiutano: un'informativa
          privacy deve dire chi risponde del trattamento. */}
      <div style={{
        border: '2px solid #B3261E', borderRadius: 10, padding: '1rem 1.2rem',
        margin: '1.5rem 0', background: '#FCF3F2',
      }}>
        <strong>Da compilare prima della pubblicazione:</strong> titolare del trattamento
        (denominazione, sede, partita IVA, PEC). Senza questi dati l’informativa non è valida e
        gli store la rifiutano.
      </div>

      <h2 style={H2}>Chi tratta i tuoi dati</h2>
      <p>
        Il titolare del trattamento è <strong>[denominazione]</strong>, con sede in{' '}
        <strong>[indirizzo]</strong>, partita IVA <strong>[numero]</strong>. Per qualsiasi
        questione riguardante i tuoi dati puoi scrivere a{' '}
        <a href={`mailto:${EMAIL_CONTATTO}`} style={{ color: '#0E3B2E' }}>{EMAIL_CONTATTO}</a>.
      </p>
      <p>
        Il circolo a cui sei iscritto è titolare autonomo per i dati che tratta nella gestione
        del proprio club — le tue prenotazioni, il tuo credito in segreteria, la tua tessera.
        Racket Fever gli fornisce lo strumento e conserva i dati per suo conto.
      </p>

      <h2 style={H2}>Quali dati raccogliamo, e perché</h2>
      <p>
        Questo elenco è completo: l’app non raccoglie nulla che non sia scritto qui. In
        particolare <strong>non raccogliamo la tua posizione</strong>, non accediamo alla
        rubrica, al microfono e al calendario. I permessi che l’app chiede al telefono sono
        tre: le <strong>notifiche</strong>, al primo accesso, per farti arrivare l’avviso di una
        prenotazione o di una sfida — puoi negarle e continuare a usare tutto il resto; e{' '}
        <strong>galleria e fotocamera</strong>, solo nel momento in cui scegli o scatti la foto
        del profilo — se non la metti, non te li chiediamo mai. E{' '}
        <strong>non c’è nessun sistema di pubblicità o di tracciamento</strong> di terze parti:
        i banner che vedi sono immagini caricate dal tuo circolo o da noi, non sanno chi sei e
        non registrano cosa guardi.
      </p>

      <table style={TABELLA}>
        <thead>
          <tr>
            <th style={{ ...TD, textAlign: 'left' }}>Dato</th>
            <th style={{ ...TD, textAlign: 'left' }}>Obbligatorio</th>
            <th style={{ ...TD, textAlign: 'left' }}>Perché</th>
            <th style={{ ...TD, textAlign: 'left' }}>Chi lo vede</th>
          </tr>
        </thead>
        <tbody>
          {DATI.map((r) => (
            <tr key={r.dato}>
              <td style={TD}><strong>{r.dato}</strong></td>
              <td style={TD}>{r.obbligatorio}</td>
              <td style={TD}>{r.perche}</td>
              <td style={TD}>{r.chi}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* ============================================================
          ⚠️ QUESTA SEZIONE È NATA DA UN CONTROLLO RIGA PER RIGA delle
          regole Firestore, e serve perché la colonna «chi lo vede» della
          tabella risponde alla domanda un dato alla volta, mentre la
          domanda che una persona si fa davvero è un'altra: «se apro
          l'app, cosa sa di me quello che gioca nel campo accanto?».
          ============================================================ */}
      <h2 style={H2}>Cosa vedono gli altri soci del tuo circolo</h2>
      <p>
        Un socio del tuo stesso circolo, aprendo l’app, vede di te: <strong>nome e cognome</strong>,
        la <strong>foto</strong> se l’hai messa, la tua <strong>posizione in classifica sociale</strong>,
        se sei socio o ospite, e i dati della tua scheda che hai compilato tu — anno di nascita,
        racchetta, classifica FITP. Se dividete il costo di un campo, vede anche se la tua quota
        finirà sul Fido.
      </p>
      <p>
        Non vede le tue <strong>conversazioni</strong>: le chat delle sfide le leggono solo i due
        che si sfidano, quella della lezione solo tu e il maestro. Non vede le{' '}
        <strong>segnalazioni</strong> che hai fatto o ricevuto, né il registro dei tuoi{' '}
        <strong>movimenti</strong> di credito.
      </p>
      {/* ⚠️ QUESTO PARAGRAFO È SCOMODO E VA SCRITTO LO STESSO. La
          tessera è un documento solo, e le regole di Firestore
          proteggono i documenti, non i singoli campi: per mostrare la
          classifica e per dividere un campo l'app deve scaricare la
          tessera degli altri soci, e dentro quella tessera ci sono
          anche email, telefono, saldo e fido. Nessuna schermata li
          mostra, ma un'informativa deve descrivere ciò a cui si può
          arrivare, non ciò che si vede. Separare i due documenti è un
          lavoro a sé, ed è nell'elenco delle cose da fare. */}
      <p>
        <strong>Una precisazione tecnica, perché è giusto darla.</strong> Per mostrarti la
        classifica e per dividere il costo di un campo, l’app scarica sul telefono di ogni socio
        la <em>tessera</em> degli altri soci del circolo, e dentro quella tessera stanno anche
        email, telefono, saldo e fido. Nessuna schermata li mostra a un socio, ma tecnicamente
        arrivano sul suo dispositivo. Stiamo separando i dati di contatto e di conto dal resto
        della tessera; nel frattempo preferiamo scriverlo che tacerlo.
      </p>
      <p>
        <strong>Il circolo vede di più</strong>, ed è il suo mestiere: tessera, credito, fido,
        movimenti, telefono, email, prenotazioni e lezioni. Il <strong>maestro</strong> vede i
        soci del circolo e le lezioni che lo riguardano. Il team Racket Fever accede ai dati di
        servizio e di contabilità per assistenza e manutenzione, <strong>ma non alle chat</strong>.
      </p>

      <h2 style={H2}>Su quale base giuridica</h2>
      <p>
        I dati che servono a farti usare l’app — nome, email, prenotazioni, credito — li
        trattiamo per <strong>eseguire il contratto</strong> che nasce quando ti registri e
        chiedi di entrare in un circolo: senza, il servizio non può funzionare. Il registro
        contabile e le segnalazioni li conserviamo per un <strong>legittimo interesse</strong>
        del circolo e nostro: poter rispondere di incassi e di comportamenti se qualcuno
        contesta. I dati facoltativi — telefono, anno di nascita, foto, racchetta, classifica —
        li tratti <strong>tu, scegliendo di compilarli</strong>.
      </p>

      <h2 style={H2}>A chi li comunichiamo</h2>
      <p>
        Ai fornitori tecnici che ci permettono di far funzionare il servizio, e a nessun altro.
        Non vendiamo dati, non li cediamo a inserzionisti, non li usiamo per profilarti.
      </p>
      <p>
        L’infrastruttura è <strong>Google Firebase</strong> (Google Ireland Limited), che ospita
        autenticazione, archivio, immagini e notifiche; il sito è ospitato da{' '}
        <strong>Vercel Inc.</strong>; le notifiche passano dal servizio di consegna di{' '}
        <strong>Expo</strong>. Tutti trattano i dati come responsabili, su nostre istruzioni, e
        sono tenuti alle stesse garanzie che ti diamo noi. Alcuni di loro hanno server anche
        fuori dall’Unione Europea: i trasferimenti avvengono sulla base delle clausole
        contrattuali standard approvate dalla Commissione Europea.
      </p>

      <h2 style={H2}>Per quanto tempo li teniamo</h2>
      {/* ⚠️ QUI C'ERA SCRITTO «tessere ... spariscono subito», e le
          tessere NON spariscono: la Cloud Function che cancella
          l'account le marca e ne toglie il nome, ma il documento resta,
          perché è la riga contabile del circolo. Elencare le tessere
          fra le cose che si cancellano era, di tutte le imprecisioni
          trovate, quella che un utente poteva smentire da solo
          chiedendo al proprio circolo. */}
      <p>
        Finché hai un account. Quando lo cancelli — dall’app, in qualsiasi momento — spariscono
        <strong> subito e per davvero</strong>: il tuo profilo, la foto, i tuoi avvisi, i
        dispositivi registrati per le notifiche, le coppie di gioco salvate e l’accesso stesso.
        Da quel momento con quella email non entra più nessuno.
      </p>
      <p>
        <strong>Le tue tessere restano, senza il tuo nome.</strong> Una tessera è la riga con cui
        il circolo tiene il conto di un socio: al posto di nome e cognome resta «Socio rimosso»,
        e telefono ed email vengono svuotati. Le prenotazioni future che erano solo tue vengono
        annullate; quelle già giocate restano, anonime.
      </p>
      <p>
        ⚠️ <strong>Il registro dei movimenti resta, senza il tuo nome.</strong> È un libro
        contabile: ricariche, addebiti e rimborsi sono incassi e uscite che il circolo ha avuto
        davvero, e se sparissero non potrebbe più rispondere di quei conti — né verso di te né
        verso nessun altro. Restano gli importi e le date, mentre al posto del nome compare
        «Socio rimosso». Per la stessa ragione restano, senza il tuo nome, le partite e le
        lezioni già giocate, che appartengono anche all’altra persona.
      </p>
      <p>
        <strong>Una sola eccezione.</strong> Se al momento della cancellazione hai un conto
        aperto con un circolo — credito da riavere o fido da restituire — nome ed email restano
        sulla tessera di quel circolo finché il conto non è chiuso: è una partita aperta fra
        due persone, e farne sparire una significherebbe cancellare il credito di qualcuno.
      </p>
      {/* ⚠️ QUI C'ERA UNA PROMESSA SU UNA MISURA CHE NESSUNO HA
          PREDISPOSTO: «le copie di sicurezza si sovrascrivono da sole
          entro trenta giorni». Non c'è nessun backup programmato di
          Firestore, e il ripristino a un istante precedente, se acceso,
          ha una finestra di sette giorni, non trenta. Dichiarare una
          misura organizzativa inesistente è la cosa più facile da
          smentire di tutta l'informativa: basta chiederci di
          dimostrarla. */}
      <p>
        Quando una copia di sicurezza dei nostri archivi sarà attiva, la conserveremo per un
        tempo limitato e lo scriveremo qui, con la durata esatta.
      </p>

      <h2 style={H2}>Chi può iscriversi</h2>
      {/* ⚠️ IL TESTO PROMETTEVA UNA STRADA CHE NON ESISTE: «sotto
          quell'età la posizione la crea il circolo, collegandola a un
          genitore». Nel codice non c'è nessun modo per un circolo di
          creare l'account di qualcun altro — il socio si registra da sé,
          e il circolo lo approva. Descrivere una funzione assente in
          un'informativa è il modo più diretto per trasformare un limite
          in una bugia. */}
      <p>
        Da <strong>{ETA_MINIMA_REGISTRAZIONE} anni compiuti</strong>. Al momento della
        registrazione lo dichiari, e non è una casella già segnata: devi toccarla tu. Sotto
        quell’età <strong>non ci si può iscrivere</strong>, e non c’è nessun’altra strada: un
        genitore può registrarsi con il proprio account e prenotare il campo su cui il figlio
        giocherà.
      </p>
      <p>
        Se ci accorgiamo che un account è di un minore di {ETA_MINIMA_REGISTRAZIONE} anni lo
        chiudiamo. Se sei un genitore e pensi che sia il caso di tuo figlio, scrivici a{' '}
        <a href={`mailto:${EMAIL_CONTATTO}`} style={{ color: '#0E3B2E' }}>{EMAIL_CONTATTO}</a>.
      </p>

      <h2 style={H2}>I tuoi diritti</h2>
      <p>
        Puoi chiederci in qualsiasi momento di accedere ai tuoi dati, correggerli, cancellarli,
        limitarne il trattamento, riceverli in formato leggibile da una macchina, oppure opporti
        a un trattamento fondato sul legittimo interesse. La cancellazione dell’account puoi
        farla da solo dall’app, in Impostazioni; per tutto il resto scrivi a{' '}
        <a href={`mailto:${EMAIL_CONTATTO}`} style={{ color: '#0E3B2E' }}>{EMAIL_CONTATTO}</a> e
        ti rispondiamo entro trenta giorni.
      </p>
      <p>
        Se pensi che stiamo trattando i tuoi dati in modo scorretto puoi rivolgerti al Garante
        per la protezione dei dati personali (www.garanteprivacy.it).
      </p>

      <h2 style={H2}>Come revochi il consenso</h2>
      {/* ⚠️ IL TESTO PROMETTEVA DUE BOTTONI CHE NON ESISTONO. Anno di
          nascita, racchetta e classifica si svuotano davvero dalle
          Impostazioni; la FOTO si può solo sostituire (non c'è nessun
          percorso che rimetta `fotoUrl` a nullo) e il TELEFONO sta sulla
          tessera, dove l'unico a poterlo cancellare è il circolo quando
          rifiuta una richiesta. Finché i due bottoni non ci sono, la
          strada onesta è dire a chi legge quella vera: scriverci. */}
      <p>
        Anno di nascita, racchetta e classifica FITP li svuoti quando vuoi dalle Impostazioni
        dell’app, e spariscono. Le notifiche le spegni dalle impostazioni del telefono. Per{' '}
        <strong>togliere la foto del profilo o il numero di telefono</strong> scrivici a{' '}
        <a href={`mailto:${EMAIL_CONTATTO}`} style={{ color: '#0E3B2E' }}>{EMAIL_CONTATTO}</a>:
        oggi dall’app si possono solo sostituire, e ce ne occupiamo noi finché non ci sarà il
        pulsante. Per non usare più il servizio, cancella l’account: trovi come si fa nella{' '}
        <a href="/cancellazione-account" style={{ color: '#0E3B2E' }}>pagina dedicata</a>.
      </p>

      <h2 style={H2}>Come proteggiamo i tuoi dati</h2>
      <p>
        L’accesso è protetto da password, che non è leggibile né da noi né dal circolo, e le
        comunicazioni fra l’app e i nostri archivi sono cifrate. Chi può leggere cosa non è
        deciso dall’app che hai in mano ma dai nostri archivi, che rifiutano ogni richiesta
        fuori posto: è la ragione per cui un socio non riesce a leggere le conversazioni di un
        altro nemmeno provandoci.
      </p>
      {/* ⚠️ VA DETTO, anche se non è bello: gli accessi Admin e Maestro
          hanno un «ricorda questo account» che tiene la password sul
          telefono, in chiaro. È una comodità di servizio per chi lavora
          in segreteria; tacerla in un'informativa che promette che la
          password non è leggibile da nessuno sarebbe una dichiarazione
          falsa su un dato di sicurezza. */}
      <p>
        <strong>Un’eccezione, dichiarata.</strong> Gli accessi di servizio — responsabile del
        circolo e maestro — possono scegliere «ricorda questo account» sul telefono della
        segreteria: in quel caso la password resta salvata su quel telefono, per non doverla
        ridigitare a ogni cambio di utente. Vale solo per quei due ruoli, mai per i soci, e si
        toglie dalla stessa schermata in cui si è messa.
      </p>

      <h2 style={H2}>Se questa informativa cambia</h2>
      <p>
        La data in cima cambia insieme al testo, e sul tuo profilo resta scritta la versione che
        hai accettato. Quando cambia, <strong>al primo avvio successivo l’app te lo dice e ti
        chiede di accettarla di nuovo</strong>: non diamo per accettato un testo che non hai
        visto.
      </p>

      <p style={{ marginTop: '3rem', color: '#5A625E', fontSize: '.9rem' }}>
        Domande su questa informativa:{' '}
        <a href={`mailto:${EMAIL_CONTATTO}`} style={{ color: '#0E3B2E' }}>{EMAIL_CONTATTO}</a>
      </p>
    </main>
  );
}
