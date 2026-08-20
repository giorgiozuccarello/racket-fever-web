// ============================================================
// TERMINI DI SERVIZIO.
//
// ⚠️ SCRITTI SU QUELLO CHE L'APP FA, come l'informativa. Il punto che
// conta di più, e che va capito prima di leggere il resto: Racket Fever
// NON incassa denaro dai soci e non vende ore di campo. Il credito è
// denaro versato in segreteria al circolo, e il circolo è l'unico che
// lo tiene, lo restituisce e ne risponde. Scrivere il contrario — anche
// solo per sbaglio, con una formula copiata — ci renderebbe
// responsabili di un rapporto che non abbiamo, e agli store farebbe
// scattare l'obbligo dell'acquisto in-app.
//
// ⚠️ E VA LETTO DA UN AVVOCATO PRIMA DI PUBBLICARLO. Questo è un testo
// accurato su come funziona il servizio, non un parere legale.
// ============================================================

import type { Metadata } from 'next';
import { VERSIONE_DOCUMENTI, EMAIL_CONTATTO, SITO_NUDO, TITOLARE } from '../../data/consenso';

export const metadata: Metadata = {
  title: 'Termini di servizio — Racket Fever',
  description: 'Le regole d’uso di Racket Fever: account, prenotazioni, credito, comportamento.',
};

const SCATOLA: React.CSSProperties = {
  maxWidth: 760, margin: '0 auto', padding: '3rem 1.5rem 5rem',
  color: '#141F1B', lineHeight: 1.65, fontSize: '1rem',
};
const H2: React.CSSProperties = { fontSize: '1.25rem', marginTop: '2.5rem' };

export default function Termini() {
  return (
    <main style={SCATOLA}>
      <p style={{ margin: 0 }}>
        <a href="/" style={{ color: '#0E3B2E', fontWeight: 700, textDecoration: 'none' }}>
          ← Racket Fever
        </a>
      </p>

      <h1 style={{ fontSize: '2rem', margin: '1.5rem 0 .5rem', lineHeight: 1.2 }}>
        Termini di servizio
      </h1>
      <p style={{ color: '#5A625E', marginTop: 0 }}>
        Versione del {VERSIONE_DOCUMENTI}. Valgono per l’app Racket Fever e per il sito{' '}
        {SITO_NUDO}.
      </p>

      {/* Chi fornisce il servizio: stessi dati dell'informativa, stessa
          fonte (data/consenso.ts). */}
      <p>
        Racket Fever è fornita da <strong>{TITOLARE.nome}</strong>, con domicilio in{' '}
        <strong>{TITOLARE.indirizzo}</strong>, codice fiscale{' '}
        <strong>{TITOLARE.codiceFiscale}</strong>
        {TITOLARE.telefono ? <>, telefono <strong>{TITOLARE.telefono}</strong></> : null}. Per
        contattarci:{' '}
        <a href={`mailto:${EMAIL_CONTATTO}`} style={{ color: '#0E3B2E' }}>{EMAIL_CONTATTO}</a>.
      </p>

      <h2 style={H2}>Che cos’è Racket Fever</h2>
      <p>
        Racket Fever è lo strumento con cui un circolo di tennis o padel gestisce i propri campi
        e i propri soci: prenotazioni, lezioni, classifica sociale, sfide, bacheca, credito di
        segreteria. Lo forniamo al circolo; tu lo usi perché sei socio o ospite di un circolo
        che lo ha adottato.
      </p>
      <p>
        <strong>Per te l’app è gratuita.</strong> Non ti chiediamo nessun abbonamento e non
        vendiamo nulla dentro l’app.
      </p>

      <h2 style={H2}>Il tuo account</h2>
      <p>
        Per registrarti servono nome, cognome, un indirizzo email valido, una password e la tua
        <strong> data di nascita</strong>, e devi avere <strong>almeno sedici anni
        compiuti</strong>. L’età la verifichiamo: non è una casella da spuntare, è un controllo
        che fa l’app e che rifà anche il nostro server. Sotto quell’età non ci si può iscrivere —
        un genitore può registrarsi con il proprio account e prenotare il campo su cui il figlio
        giocherà.
      </p>
      <p>
        L’account è personale: la password non si presta. Se pensi che qualcuno stia usando il
        tuo accesso, cambiala e scrivici. Sei responsabile di quello che viene fatto dal tuo
        account.
      </p>
      <p>
        Registrarti non ti mette dentro nessun circolo: devi chiedere di entrare, e{' '}
        <strong>è il circolo a decidere</strong> se accettarti. Allo stesso modo, il circolo può
        sospendere o chiudere la tua tessera. Sono decisioni sue, prese sulle sue regole
        interne; noi non le sindachiamo.
      </p>

      <h2 style={H2}>Prenotazioni, lezioni e denaro</h2>
      <p>
        ⚠️ <strong>Il denaro non passa da noi.</strong> Il credito che vedi nell’app è quello che
        hai versato in segreteria al tuo circolo, e il circolo è l’unico che lo custodisce, lo
        scala e lo restituisce. Racket Fever non incassa, non vende ore di campo e non tiene
        conti per conto tuo: l’app è il registro su cui il circolo scrive quello che succede in
        segreteria.
      </p>
      <p>
        Le regole di prezzo, di preavviso per disdire e di rimborso <strong>le decide il
        circolo</strong>, e possono cambiare. Le trovi applicate dentro l’app: quanto costa
        un’ora, entro quando puoi annullare senza perdere niente, quante prenotazioni puoi
        avere aperte insieme. Se non sei d’accordo con una di queste regole, la persona con cui
        parlarne è la segreteria del tuo circolo.
      </p>
      <p>
        Il «fido» è un anticipo che il circolo può concederti per prenotare quando il credito
        non basta: è un debito verso il circolo, e va saldato in segreteria.
      </p>

      <h2 style={H2}>Come ci si comporta</h2>
      <p>
        Nell’app non si scrive testo libero: nelle chat si scelgono frasi già pronte e proposte
        di orario. Restano però il tuo nome, la tua foto e la tua scheda, e su quelli vale una
        regola semplice: <strong>niente che non diresti a voce nello spogliatoio del tuo
        circolo</strong>. Niente foto offensive, niente identità false, niente insistenza verso
        chi non vuole essere contattato.
      </p>
      <p>
        Ogni socio può <strong>segnalare</strong> un altro socio — dalla sua scheda o
        direttamente dalla chat — e la segnalazione arriva al circolo e a noi. E può{' '}
        <strong>bloccare</strong> un altro socio: da quel momento non potranno più sfidarsi né
        scriversi, e chi blocca non deve dare spiegazioni a nessuno. Chi viene bloccato non
        riceve nessun avviso.
      </p>
      <p>
        Se una segnalazione è fondata, il circolo può sospenderti o toglierti la tessera, e noi
        possiamo sospendere o chiudere l’account. Nei casi gravi lo facciamo senza preavviso.
      </p>

      <h2 style={H2}>Quello che non promettiamo</h2>
      <p>
        Facciamo il possibile perché l’app funzioni sempre, ma non possiamo garantirlo: dipende
        anche da servizi di terzi, dalla rete e dal telefono che hai in mano. Non rispondiamo
        dei danni indiretti — una partita saltata, un campo trovato occupato per un errore del
        circolo, un avviso che non arriva perché le notifiche sono spente sul tuo telefono.
      </p>
      <p>
        Non rispondiamo del rapporto fra te e il tuo circolo: iscrizione, quote, tariffe, stato
        dei campi, tesseramento federale e assicurazione sono cose sue.
      </p>
      <p>
        I dati che vedi — classifica FITP, racchetta, età — li scrivono i soci stessi e noi non
        li verifichiamo.
      </p>

      <h2 style={H2}>Chiudere l’account</h2>
      <p>
        Quando vuoi, dall’app: Impostazioni, sezione «Uscire da Racket Fever». Trovi cosa
        succede ai tuoi dati nella{' '}
        <a href="/cancellazione-account" style={{ color: '#0E3B2E' }}>pagina dedicata</a> e
        nella <a href="/privacy" style={{ color: '#0E3B2E' }}>informativa privacy</a>. Uscire da
        un circolo e cancellare l’account sono due cose diverse, e nell’app sono due pulsanti
        diversi.
      </p>
      <p>
        Anche noi possiamo chiudere un account, se viene usato per fare male ad altri o in modo
        contrario a questi termini.
      </p>

      <h2 style={H2}>Se questi termini cambiano</h2>
      <p>
        La data in cima cambia insieme al testo, e sul tuo profilo resta scritta la versione che
        hai accettato. Quando cambia, al primo avvio successivo l’app te lo dice e ti chiede di
        accettarla di nuovo.
      </p>

      <h2 style={H2}>Legge applicabile</h2>
      <p>
        Vale la legge italiana. Per le controversie con i consumatori è competente il giudice
        del luogo di residenza o domicilio del consumatore, se in Italia.
      </p>

      <p style={{ marginTop: '3rem', color: '#5A625E', fontSize: '.9rem' }}>
        Domande su questi termini:{' '}
        <a href={`mailto:${EMAIL_CONTATTO}`} style={{ color: '#0E3B2E' }}>{EMAIL_CONTATTO}</a>
      </p>
    </main>
  );
}
