// ============================================================
// CANCELLAZIONE DELL'ACCOUNT — la pagina pubblica.
//
// ⚠️ ESISTE PERCHE' GOOGLE LA PRETENDE, e la pretende PUBBLICA: un
// indirizzo raggiungibile senza installare l'app e senza fare l'accesso,
// dichiarato in Play Console. Apple invece vuole la cancellazione dentro
// l'app — che c'e' — e questa pagina non gliela sostituisce. Servono
// tutte e due, e fanno due lavori diversi.
//
// ⚠️ E SERVE ANCHE A NOI, per un motivo che non c'entra con gli store:
// Admin e Maestri non si sono registrati da soli — l'account glielo ha
// creato qualcun altro — e la cancellazione in-app e' spenta per loro
// apposta, perche' portare via un Maestro vuol dire decidere cosa ne e'
// delle sue lezioni gia' prenotate e dei conti aperti con il circolo.
// Quella e' una conversazione fra persone, non un pulsante.
// ============================================================

import type { Metadata } from 'next';
import { EMAIL_CONTATTO, SITO_NUDO, VERSIONE_DOCUMENTI } from '../../data/consenso';

export const metadata: Metadata = {
  title: 'Cancellazione dell’account — Racket Fever',
  description:
    'Come cancellare il proprio account Racket Fever: cosa viene eliminato, cosa resta e in quanto tempo.',
};

const SCATOLA: React.CSSProperties = {
  maxWidth: 760, margin: '0 auto', padding: '3rem 1.5rem 5rem',
  color: '#141F1B', lineHeight: 1.65, fontSize: '1rem',
};

export default function CancellazioneAccount() {
  return (
    <main style={SCATOLA}>
      <p style={{ margin: 0 }}>
        <a href="/" style={{ color: '#0E3B2E', fontWeight: 700, textDecoration: 'none' }}>
          ← Racket Fever
        </a>
      </p>

      <h1 style={{ fontSize: '2rem', margin: '1.5rem 0 .5rem', lineHeight: 1.2 }}>
        Cancellare il proprio account
      </h1>
      <p style={{ color: '#5A625E', marginTop: 0 }}>
        Racket Fever — {SITO_NUDO}. Ultimo aggiornamento: {VERSIONE_DOCUMENTI}.
      </p>

      <h2 style={{ fontSize: '1.25rem', marginTop: '2.5rem' }}>Se sei un socio</h2>
      <p>
        Puoi farlo da solo, dall’app, in qualsiasi momento: apri Racket Fever, entra in{' '}
        <strong>Impostazioni</strong>, apri la sezione <strong>Uscire da Racket Fever</strong> e
        scegli <strong>Cancella l’account</strong>. Ti verrà chiesta la password: serve a essere
        sicuri che davanti al telefono ci sia tu e non chi l’ha trovato sulla panchina dello
        spogliatoio.
      </p>
      <p>
        Se non sei ancora entrato in nessun circolo, o stai aspettando che il circolo ti approvi,
        trovi lo stesso pulsante direttamente nella schermata dove ti trovi: l’account esiste da
        quando ti sei registrato, quindi si può cancellare da subito.
      </p>
      <p>
        Nella stessa sezione trovi anche <strong>Esci dal circolo</strong>, che è un’altra cosa:
        chiude la tua tessera con quel circolo e lascia in piedi l’account. Se stai cambiando club,
        è quello che ti serve.
      </p>

      <h2 style={{ fontSize: '1.25rem', marginTop: '2.5rem' }}>
        Se sei un responsabile di circolo o un maestro
      </h2>
      <p>
        Il tuo account non l’hai creato tu: te l’ha creato il circolo o il team di Racket Fever, ed
        è legato a lezioni, prenotazioni e conti che riguardano altre persone. Scrivici a{' '}
        <a href={`mailto:${EMAIL_CONTATTO}`} style={{ color: '#0E3B2E' }}>{EMAIL_CONTATTO}</a>{' '}
        dall’indirizzo email con cui accedi, scrivendo «cancellazione account» nell’oggetto. Ti
        rispondiamo entro pochi giorni e ce ne occupiamo noi.
      </p>
      <p>
        Vale lo stesso se sei un socio e non riesci più ad accedere all’app: scrivici dallo stesso
        indirizzo email dell’account e facciamo noi.
      </p>

      <h2 style={{ fontSize: '1.25rem', marginTop: '2.5rem' }}>Che cosa viene eliminato</h2>
      <p>
        Il tuo profilo (nome, cognome, email, anno di nascita, foto, preferenze e impostazioni), la
        foto del profilo, gli avvisi che ti erano arrivati, i collegamenti con i tuoi compagni di
        gioco, i dispositivi registrati per le notifiche e l’accesso stesso: da quel momento con
        quella email non si entra più. Le prenotazioni future che erano <strong>solo tue</strong>{' '}
        vengono annullate e i campi tornano liberi. Quelle che dividevi con qualcuno restano in
        piedi: c’è dentro la quota di un’altra persona, e non è il caso di cancellargliela.
      </p>

      <h2 style={{ fontSize: '1.25rem', marginTop: '2.5rem' }}>Che cosa resta, e perché</h2>
      <p>
        <strong>Il registro dei movimenti del circolo resta, senza più il tuo nome.</strong> È un
        libro contabile: ricariche, addebiti e rimborsi sono incassi e uscite che il circolo ha
        avuto davvero, e se sparissero non potrebbe più rispondere di quei conti — né verso di te,
        né verso nessun altro. Restano quindi gli importi e le date, mentre al posto del nome
        compare «Socio rimosso».
      </p>
      <p>
        Per la stessa ragione restano, senza il tuo nome, le partite e le lezioni già giocate:
        appartengono anche all’altra persona, e cancellarle vorrebbe dire togliere a lei un pezzo
        della sua storia per una decisione che non ha preso. In qualche riga di quel registro il
        nome può restare scritto dentro la descrizione di un’operazione — per esempio «quota
        divisa con…» — perché quelle righe sono immutabili per costruzione: è il modo in cui un
        libro contabile fa il suo mestiere.
      </p>
      <p>
        <strong>C’è una sola eccezione.</strong> Se al momento della cancellazione hai un conto
        aperto con un circolo — credito che il circolo ti deve restituire, oppure Fido che devi
        restituire tu — il tuo nome e la tua email restano sulla tessera di quel circolo finché il
        conto non è chiuso. Non è un modo per trattenerti: è che una partita aperta è fra due
        persone, e farne sparire una delle due significherebbe cancellare il credito di qualcuno.
        L’app te lo dice, con la cifra, prima che tu confermi.
      </p>

      <h2 style={{ fontSize: '1.25rem', marginTop: '2.5rem' }}>In quanto tempo</h2>
      <p>
        Dall’app è immediato: quando la schermata si chiude, l’account non c’è più. Per le richieste
        via email rispondiamo entro pochi giorni lavorativi e completiamo la cancellazione entro
        trenta giorni. Le copie di sicurezza dei nostri archivi si sovrascrivono da sole entro lo
        stesso periodo.
      </p>

      <h2 style={{ fontSize: '1.25rem', marginTop: '2.5rem' }}>Prima di cancellare</h2>
      <p>
        Se hai credito in segreteria, fattelo restituire dal circolo: la cancellazione dell’account
        non muove denaro, e nessuno può restituirtelo al posto loro. Se hai prenotazioni future e
        vuoi il rimborso, annullale prima dall’app: cancellando l’account vengono annullate senza
        rimborso, perché il rimborso segue le regole di preavviso che ogni circolo decide da sé.
      </p>

      <p style={{ marginTop: '3rem', color: '#5A625E', fontSize: '.9rem' }}>
        Per qualsiasi domanda su questa pagina o sui tuoi dati:{' '}
        <a href={`mailto:${EMAIL_CONTATTO}`} style={{ color: '#0E3B2E' }}>{EMAIL_CONTATTO}</a>
      </p>
    </main>
  );
}
