'use client';

// ============================================================
// TESSERE DA SALDARE — le posizioni ancora aperte di chi e' uscito.
//
// ⚠️ IL PULSANTE NON DICE PIU' «SALDATO», e non e' una sfumatura di
// lessico: su una riga che mostra «Debito da recuperare: 9,00 €», la
// parola «Saldato» si legge come «questa persona ha gia' pagato» —
// cioe' l'esatto contrario di quello che il pulsante fa. Chi lo premeva
// per capire cosa fosse cancellava un credito del circolo. Adesso dice
// quello che fa: «Elimina debito» quando c'e' un debito, «Credito
// restituito» quando c'e' del credito da rendere.
//
// ⚠️ E SOTTO OGNI RIGA C'E' LA STORIA. Il saldo da solo non aiuta
// nessuno: chi in segreteria deve chiedere nove euro a una persona che
// non e' piu' socia vuole poter dire da dove vengono. Le righe del
// registro di quella persona in questo circolo stanno qui, a un tocco,
// invece che da cercare nella pagina dei movimenti filtrando per un
// nome che nel frattempo e' diventato «Socio rimosso».
// ============================================================

import { useEffect, useState } from 'react';
import { Circolo } from '../../../data/circoli';
import { ascoltaTessereDaSaldare, saldaTessera, Tessera } from '../../../data/tessere';
import {
  ascoltaMovimentiSocio, etichettaMovimento, dettaglioPrenotazione,
  importoDaMostrare, Movimento,
} from '../../../data/movimenti';
import { creaNotifica } from '../../../data/notifiche';
import { numeroPerWhatsApp } from './SezioneRichiesteTessera';
import Modal from './Modal';

const euro = (v: number) => `€ ${v.toFixed(2)}`;

function giorno(m: Movimento): string {
  if (!m.quando?.seconds) return '';
  return new Date(m.quando.seconds * 1000).toLocaleDateString('it-IT', {
    day: '2-digit', month: '2-digit', year: '2-digit',
  });
}

// La storia del conto: si monta solo quando la si apre, così la
// dashboard non tiene aperti tanti ascolti quante sono le posizioni.
function StoriaDelConto({ uid, circoloId }: { uid: string; circoloId: string }) {
  const [movimenti, setMovimenti] = useState<Movimento[] | null>(null);

  useEffect(() => ascoltaMovimentiSocio(uid, circoloId, setMovimenti, 30), [uid, circoloId]);

  if (movimenti === null) return <p className="admin-card-hint">Carico le operazioni…</p>;
  if (movimenti.length === 0) {
    return <p className="admin-card-hint">Nessuna operazione registrata per questa persona.</p>;
  }

  return (
    <div className="admin-storia-conto">
      {movimenti.map((m) => {
        const dettaglio = dettaglioPrenotazione(m);
        return (
          <div key={m.id} className="admin-storia-riga">
            <span className="admin-storia-giorno">{giorno(m)}</span>
            <span className="admin-storia-testo">
              <strong>{etichettaMovimento(m)}</strong>
              {dettaglio ? ` — ${dettaglio}` : ''}
              {!dettaglio && m.descrizione ? ` — ${m.descrizione}` : ''}
            </span>
            <span className={m.importo < 0 ? 'admin-storia-uscita' : 'admin-storia-entrata'}>
              {importoDaMostrare(m.importo) ? `${m.importo > 0 ? '+' : ''}${euro(m.importo)}` : '—'}
            </span>
            {/* Il debito residuo dopo ogni riga: è la colonna che
                risponde alla domanda «da dove nascono questi nove
                euro», senza dover sommare a mano. */}
            {/* Su una riga di Fido salgono insieme credito e debito:
                mostrarne uno solo nascondeva l'altro proprio dove
                serve capire il conto. */}
            <span className="admin-storia-saldo">
              {m.debitoDopo > 0 && m.saldoDopo > 0
                ? `debito ${euro(m.debitoDopo)} · credito ${euro(m.saldoDopo)}`
                : m.debitoDopo > 0 ? `debito ${euro(m.debitoDopo)}` : `credito ${euro(m.saldoDopo)}`}
            </span>
          </div>
        );
      })}
      {movimenti.length >= 30 && (
        <p className="admin-card-hint">Ultime 30 operazioni. Le precedenti stanno nella pagina Movimenti.</p>
      )}
    </div>
  );
}

// Ex soci con un conto ancora aperto: credito da restituire o debito
// da recuperare. La regolazione avviene in segreteria — qui si
// registra soltanto che e' stata fatta.
export default function SezioneTessereDaSaldare({ circolo }: { circolo: Circolo }) {
  const [tessere, setTessere] = useState<Tessera[]>([]);
  const [daSaldare, setDaSaldare] = useState<Tessera | null>(null);
  const [elaborando, setElaborando] = useState(false);
  const [storiaAperta, setStoriaAperta] = useState<string | null>(null);

  useEffect(() => {
    if (!circolo?.id) return;
    return ascoltaTessereDaSaldare(circolo.id, setTessere);
  }, [circolo?.id]);

  const conferma = async () => {
    if (!daSaldare) return;
    setElaborando(true);
    try {
      await saldaTessera(daSaldare.uid, circolo.id);
      await creaNotifica(
        daSaldare.uid,
        `${circolo.nome} ha registrato la chiusura del tuo conto: la posizione è saldata.`,
        undefined,
        circolo.id,
        true
      );
      setDaSaldare(null);
    } catch {
      alert('Non è stato possibile registrare il saldo. Riprova.');
    } finally {
      setElaborando(false);
    }
  };

  const debitoDi = (t: Tessera | null) => t?.sosUtilizzato ?? 0;
  const creditoDi = (t: Tessera | null) => t?.credito ?? 0;
  // ⚠️ QUANDO CI SONO TUTTI E DUE, IL PULSANTE NON PUO' NOMINARNE UNO
  // SOLO. La chiusura della posizione azzera credito e debito insieme —
  // lo fa il server, in un colpo — quindi un pulsante che dice «elimina
  // debito» su una persona che ha anche venti euro di credito da
  // riavere fa sparire quei venti euro senza averli mai nominati. E'
  // esattamente il difetto per cui questa sezione e' stata riscritta,
  // su un altro ramo.
  const etichettaAzione = (t: Tessera | null) => {
    const d = debitoDi(t);
    const c = creditoDi(t);
    if (d > 0 && c > 0) return 'Chiudi la posizione';
    return d > 0 ? 'Elimina debito' : 'Credito restituito';
  };

  return (
    <div className="admin-card">
      <div className="admin-card-title">Tessere da saldare</div>
      <p className="admin-card-hint">
        Persone uscite dal circolo con un conto ancora aperto. Restituisci il credito o recupera
        il debito in segreteria, poi chiudi la posizione qui. Sotto ogni nome trovi le operazioni
        da cui nasce il saldo.
      </p>

      {tessere.length === 0 && <p className="admin-empty-text">Nessuna posizione da regolare.</p>}

      {tessere.map((t) => {
        const credito = t.credito ?? 0;
        const debito = t.sosUtilizzato ?? 0;
        const numero = numeroPerWhatsApp(t.telefono);
        const aperta = storiaAperta === t.id;
        const messaggio = credito > 0
          ? `Ciao ${t.nome}, hai € ${credito.toFixed(2)} di credito da ritirare presso ${circolo.nome}.`
          : `Ciao ${t.nome}, risulta un debito di € ${debito.toFixed(2)} da saldare presso ${circolo.nome}.`;
        return (
          <div key={t.id}>
            <div className="admin-list-row">
              <div style={{ flex: 1 }}>
                <div className="admin-list-main">{t.nome} {t.cognome}</div>
                <div className="admin-list-sub">{t.email}</div>
                {credito > 0 && (
                  <div className="admin-saldo-credito">Credito da restituire: € {credito.toFixed(2)}</div>
                )}
                {debito > 0 && (
                  <div className="admin-saldo-debito">Debito da recuperare: € {debito.toFixed(2)}</div>
                )}
                {!!numero && (
                  <a
                    className="admin-link-whatsapp"
                    href={`https://wa.me/${numero}?text=${encodeURIComponent(messaggio)}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {t.telefono} · contatta
                  </a>
                )}
                <button
                  type="button"
                  className="admin-btn-small"
                  style={{ marginTop: '.5rem' }}
                  onClick={() => setStoriaAperta(aperta ? null : t.id)}
                >
                  {aperta ? 'Nascondi le operazioni' : 'Da dove nasce'}
                </button>
              </div>
              <button className="admin-btn-piccolo-verde" onClick={() => setDaSaldare(t)}>
                {etichettaAzione(t)}
              </button>
            </div>
            {aperta && <StoriaDelConto uid={t.uid} circoloId={circolo.id} />}
          </div>
        );
      })}

      <Modal visible={!!daSaldare} onClose={() => setDaSaldare(null)}>
        <div className="admin-modal-title">
          {debitoDi(daSaldare) > 0 && creditoDi(daSaldare) > 0
            ? 'Chiudere la posizione?'
            : debitoDi(daSaldare) > 0 ? 'Eliminare il debito?' : 'Credito restituito?'}
        </div>
        <p className="admin-modal-sub">{daSaldare?.nome} {daSaldare?.cognome}</p>
        <p className="admin-modal-sub" style={{ marginTop: '.5rem' }}>
          {debitoDi(daSaldare) > 0 && creditoDi(daSaldare) > 0
            ? `Questa persona ha ${euro(creditoDi(daSaldare))} di credito da riavere E ${euro(debitoDi(daSaldare))} di debito da restituire. Confermando, il conto va a zero da tutte e due le parti: fai prima la compensazione in segreteria.`
            : debitoDi(daSaldare) > 0
              ? `Confermi di aver recuperato ${euro(debitoDi(daSaldare))}? Il debito sparisce dal conto e la posizione si chiude.`
              : `Confermi di aver restituito ${euro(creditoDi(daSaldare))}? La posizione si chiude.`}
        </p>
        <div className="admin-modal-btn-row">
          <button className="admin-modal-btn-cancel" onClick={() => setDaSaldare(null)} disabled={elaborando}>
            Annulla
          </button>
          <button className="admin-modal-btn-confirm" onClick={conferma} disabled={elaborando}>
            {elaborando ? 'Attendere…' : etichettaAzione(daSaldare)}
          </button>
        </div>
      </Modal>
    </div>
  );
}
