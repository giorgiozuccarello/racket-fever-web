'use client';

// ============================================================
// LEZIONI PRENOTATE — non più un elenco da guardare.
//
// È il posto da cui il circolo annulla una lezione, ed è l'unico: dalla
// griglia le mezz'ore di una lezione non si toccano più. La ragione sta
// per esteso in data/lezioniAdmin.ts, e in breve è questa — una lezione
// è un accordo fra due persone, non tre mezz'ore di campo. Cancellandone
// una alla volta i campi tornavano liberi, ma la conversazione fra
// Maestro e allievo restava aperta su una lezione che non esisteva più,
// e il socio continuava a vedersi in Home la card «lezione confermata,
// campi non occupati».
//
// ⚠️ UNA RIGA = UNA LEZIONE. Prima ogni mezz'ora era una riga a sé: una
// lezione di un'ora compariva due volte, e niente diceva che fossero la
// stessa cosa.
// ============================================================

import { useMemo, useState } from 'react';
import { PrenotazioneAdmin } from '../../../data/prenotazioniRepo';
import { orarioFineSlot } from '../../../data/circoli';
import {
  RigaLezione, raggruppaLezioni, annullaLezioneIntera,
  LEZIONE_ANNULLATA_A_META, CONVERSAZIONE_NON_CHIUSA,
} from '../../../data/lezioniAdmin';
import { oggiIso } from '../../../data/giorni';
import Modal from './Modal';

// ⚠️ orarioFineSlot arriva da data/circoli.ts, la stessa che usano la
// griglia e il registro: riscriverne una copia qui voleva dire avere
// due modi di calcolare la stessa ora, destinati a divergere al primo
// caso limite.
function fascia(orari: string[]): string {
  if (orari.length === 0) return '';
  return `${orari[0]} - ${orarioFineSlot(orari[orari.length - 1])}`;
}

export default function SezioneLezioniPrenotate({ prenotazioni, circoloId, nomeEsecutore }: {
  prenotazioni: PrenotazioneAdmin[];
  circoloId: string;
  nomeEsecutore: string;
}) {
  const [daAnnullare, setDaAnnullare] = useState<RigaLezione | null>(null);
  const [elaborando, setElaborando] = useState(false);
  const [errore, setErrore] = useState('');

  // ⚠️ oggiIso() e non toISOString(): quello dà la data UTC, e fra
  // mezzanotte e le due di notte in Italia restituisce IERI — l'elenco
  // avrebbe mostrato, e lasciato annullare, le lezioni già giocate.
  const oggi = oggiIso();
  const lezioni = useMemo(
    () => raggruppaLezioni(prenotazioni, oggi, circoloId),
    [prenotazioni, oggi, circoloId],
  );

  const apri = (l: RigaLezione) => { setErrore(''); setDaAnnullare(l); };

  const conferma = async () => {
    if (!daAnnullare) return;
    setErrore('');
    setElaborando(true);
    try {
      const { nonAvvisati } = await annullaLezioneIntera(daAnnullare, nomeEsecutore);
      // ⚠️ Riuscito, ma non del tutto: la lezione e' annullata e la chat
      // chiusa, e pero' qualcuno non l'ha saputo. Chiudere il pop-up in
      // silenzio avrebbe lasciato all'Admin l'impressione che fossero
      // stati avvisati tutti.
      if (nonAvvisati.length > 0) {
        setErrore(`Lezione annullata, ma l'avviso non è arrivato a ${nonAvvisati.join(' e ')}. Avvisali tu.`);
      } else {
        setDaAnnullare(null);
      }
    } catch (e: any) {
      // ⚠️ Un annullamento riuscito a metà va detto per quello che è: le
      // mezz'ore liberate sono libere davvero, ma la lezione è ancora lì
      // e la conversazione non è stata chiusa. Chi legge deve sapere che
      // deve riprovare, non che non è successo niente.
      const messaggio = String(e?.message ?? '');
      // ⚠️ Tre esiti diversi, tre frasi diverse. «Non è riuscito» e
      // «i campi sono liberi ma la chat è rimasta aperta» sono cose
      // opposte per chi legge: la prima invita a riprovare, la seconda
      // dice che riprovare da qui non serve — la riga è già sparita.
      if (messaggio.startsWith(CONVERSAZIONE_NON_CHIUSA)) {
        // ⚠️ Riprovare da qui FUNZIONA: le mezz'ore già cancellate
        // rispondono "già fatto" e si ritenta la chiusura. Costa una
        // seconda coppia di avvisi, quindi si dice, invece di
        // scoraggiarlo come faceva la prima versione.
        setErrore('Le mezz\'ore sono state liberate e i due sono stati avvisati, ma la conversazione non si è chiusa. Puoi ritentare da questa riga finché c\'è, oppure chiedere al Maestro di chiuderla dalla sua dashboard.');
      } else if (messaggio.startsWith(LEZIONE_ANNULLATA_A_META)) {
        const [, fatte, totali, codice] = messaggio.split(':');
        const coda = codice ? ` (${codice})` : '';
        // ⚠️ «Zero su due» e «una su due» sono due situazioni diverse:
        // nella prima non è successo niente e il problema è a monte —
        // tipicamente una sessione scaduta — nella seconda metà lezione
        // è già stata liberata e riprovare completa davvero.
        setErrore(
          fatte === '0'
            ? `Nessuna mezz'ora è stata annullata${coda}: la lezione è ancora al suo posto. Se sei entrato con la password di segreteria, la sessione potrebbe essere scaduta — rientra e riprova.`
            : `Annullate ${fatte} di ${totali} mezz'ore${coda}: riprova per completare. La conversazione non è stata chiusa.`,
        );
      } else if (String(e?.code ?? '').includes('failed-precondition')) {
        // Un rifiuto motivato del server: la frase è già scritta per
        // essere letta.
        setErrore(messaggio);
      } else {
        // ⚠️ Il codice dell'errore si mostra, non si butta. Con il solo
        // «annullamento non riuscito» un permesso mancante e una rete
        // caduta erano indistinguibili, e la frase diceva la cosa più
        // sbagliata di tutte: che non fosse successo niente, mentre le
        // mezz'ore erano già state liberate.
        const codice = String(e?.code ?? '');
        console.warn('Annullamento lezione: errore non riconosciuto', e);
        setErrore(
          codice
            ? `Le mezz'ore sono state liberate, ma qualcosa dopo non è riuscito (${codice}). Controlla la chat fra Maestro e allievo.`
            : 'Le mezz\'ore sono state liberate, ma qualcosa dopo non è riuscito. Controlla la chat fra Maestro e allievo.',
        );
      }
    } finally {
      setElaborando(false);
    }
  };

  return (
    <div className="admin-card">
      <div className="admin-card-title">Lezioni Prenotate</div>
      <p className="admin-card-hint">
        Le lezioni con un Maestro, separate dalle prenotazioni di solo campo. Tocca una riga per
        annullarla: sparisce da qui, dall&apos;app del socio e dalla dashboard del Maestro,
        insieme alla loro conversazione.
      </p>

      {lezioni.length === 0 && <p className="admin-empty-text">Nessuna lezione prenotata.</p>}

      {lezioni.map((l) => (
        <div
          key={l.cardId}
          className="admin-list-row admin-list-row-clickable"
          onClick={() => apri(l)}
          role="button" tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); apri(l); }
          }}
        >
          <div style={{ flex: 1 }}>
            <div className="admin-list-main">
              {l.allievoNome}{l.esterno ? ' (esterno)' : ''} — Maestro {l.maestroNome}
            </div>
            {!l.conCard && (
              <div className="admin-list-sub">Mezz&apos;ora singola, senza conversazione collegata</div>
            )}
            <div className="admin-list-sub">
              {l.campoNome} · {l.dataLabel} {fascia(l.orari)} · {l.orari.length * 0.5}h
            </div>
          </div>
        </div>
      ))}

      <Modal visible={!!daAnnullare} onClose={() => setDaAnnullare(null)}>
        <div className="admin-modal-title" style={{ textTransform: 'none', fontSize: '1rem' }}>
          {daAnnullare?.allievoNome} — Maestro {daAnnullare?.maestroNome}
        </div>
        <div className="admin-modal-sub">
          {daAnnullare?.campoNome} · {daAnnullare?.dataLabel} {daAnnullare ? fascia(daAnnullare.orari) : ''}
        </div>
        <p className="admin-modal-sub" style={{ marginTop: '.8rem', fontWeight: 700 }}>
          Vuoi annullare questa lezione?
        </p>
        {/* Si dice tutto quello che succede, prima che succeda: sono tre
            effetti su tre persone diverse, e due non stanno in questa
            schermata. */}
        {/* ⚠️ La promessa cambia se la lezione non ha una card. Sono le
            lezioni nate prima che il cardId esistesse: mezz'ore sciolte,
            senza nessuna conversazione collegata. Promettere di
            chiuderla sarebbe stato falso proprio nel caso in cui non
            succede. */}
        <p className="mov-nota-rimborso">
          {daAnnullare?.conCard
            ? `Si liberano tutte e ${daAnnullare.orari.length} le mezz'ore. La lezione sparisce dall'app del socio e dalla dashboard del Maestro, e la loro conversazione viene chiusa. Nessun rimborso: le lezioni non hanno addebito in app.`
            : `Si libera questa mezz'ora. È una lezione registrata prima che le mezz'ore venissero collegate fra loro: non ha una conversazione associata, e le altre sue mezz'ore — se ce ne sono — vanno annullate una per una. Nessun rimborso: le lezioni non hanno addebito in app.`}
        </p>
        {errore && <div className="admin-error-text">{errore}</div>}
        <div className="admin-modal-btn-row">
          <button className="admin-modal-btn-cancel" onClick={() => setDaAnnullare(null)}>Indietro</button>
          <button className="admin-modal-btn-confirm danger" onClick={conferma} disabled={elaborando}>
            {elaborando ? 'Attendere…' : 'Annulla lezione'}
          </button>
        </div>
      </Modal>
    </div>
  );
}
