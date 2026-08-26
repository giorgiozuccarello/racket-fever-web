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
import { avviso } from '../../../data/linguaDestinatario';
import { useLingua } from '../../../lib/lingua';
import { numeroPerWhatsApp } from './SezioneRichiesteTessera';
import Modal from './Modal';

// Quante righe del registro si mostrano sotto un nome. Il numero e'
// anche dentro la frase in fondo all'elenco: sta in una costante sola
// perche' non possano dire due cose diverse.
const RIGHE_STORIA = 30;

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
  const { t } = useLingua();
  const [movimenti, setMovimenti] = useState<Movimento[] | null>(null);

  useEffect(() => ascoltaMovimentiSocio(uid, circoloId, setMovimenti, RIGHE_STORIA), [uid, circoloId]);

  if (movimenti === null) return <p className="admin-card-hint">{t('adm.tes.caricoOperazioni')}</p>;
  if (movimenti.length === 0) {
    return <p className="admin-card-hint">{t('adm.tes.nessunaOperazione')}</p>;
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
              {importoDaMostrare(m.importo) ? `${m.importo > 0 ? '+' : ''}${euro(m.importo)}` : t('com.nessunDato')}
            </span>
            {/* Il debito residuo dopo ogni riga: è la colonna che
                risponde alla domanda «da dove nascono questi nove
                euro», senza dover sommare a mano. */}
            {/* Su una riga di Fido salgono insieme credito e debito:
                mostrarne uno solo nascondeva l'altro proprio dove
                serve capire il conto. */}
            <span className="admin-storia-saldo">
              {m.debitoDopo > 0 && m.saldoDopo > 0
                ? t('adm.tes.saldoDebitoECredito', { debito: euro(m.debitoDopo), credito: euro(m.saldoDopo) })
                : m.debitoDopo > 0
                  ? t('adm.tes.saldoDebito', { importo: euro(m.debitoDopo) })
                  : t('adm.tes.saldoCredito', { importo: euro(m.saldoDopo) })}
            </span>
          </div>
        );
      })}
      {movimenti.length >= RIGHE_STORIA && (
        <p className="admin-card-hint">{t('adm.tes.ultimeOperazioni', { quante: RIGHE_STORIA })}</p>
      )}
    </div>
  );
}

// Ex soci con un conto ancora aperto: credito da restituire o debito
// da recuperare. La regolazione avviene in segreteria — qui si
// registra soltanto che e' stata fatta.
export default function SezioneTessereDaSaldare({ circolo }: { circolo: Circolo }) {
  const { t } = useLingua();
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
        avviso('avv.cir.contoSaldato', { circolo: circolo.nome }),
        undefined,
        circolo.id,
        true
      );
      setDaSaldare(null);
    } catch {
      alert(t('adm.tes.erroreChiusura'));
    } finally {
      setElaborando(false);
    }
  };

  // ⚠️ LA TESSERA NON SI CHIAMA PIU' `t`, e non e' un capriccio: `t` e'
  // il traduttore, e una tessera con quel nome lo copriva proprio dentro
  // le funzioni che devono tradurre.
  const debitoDi = (tessera: Tessera | null) => tessera?.sosUtilizzato ?? 0;
  const creditoDi = (tessera: Tessera | null) => tessera?.credito ?? 0;
  // ⚠️ QUANDO CI SONO TUTTI E DUE, IL PULSANTE NON PUO' NOMINARNE UNO
  // SOLO. La chiusura della posizione azzera credito e debito insieme —
  // lo fa il server, in un colpo — quindi un pulsante che dice «elimina
  // debito» su una persona che ha anche venti euro di credito da
  // riavere fa sparire quei venti euro senza averli mai nominati. E'
  // esattamente il difetto per cui questa sezione e' stata riscritta,
  // su un altro ramo.
  const etichettaAzione = (tessera: Tessera | null) => {
    const d = debitoDi(tessera);
    const c = creditoDi(tessera);
    if (d > 0 && c > 0) return t('adm.tes.chiudiPosizione');
    return d > 0 ? t('adm.tes.eliminaDebito') : t('adm.tes.creditoRestituito');
  };

  return (
    <div className="admin-card">
      <div className="admin-card-title">{t('adm.tes.titolo')}</div>
      <p className="admin-card-hint">{t('adm.tes.intro')}</p>

      {tessere.length === 0 && <p className="admin-empty-text">{t('adm.tes.nessunaPosizione')}</p>}

      {tessere.map((tessera) => {
        const credito = tessera.credito ?? 0;
        const debito = tessera.sosUtilizzato ?? 0;
        const numero = numeroPerWhatsApp(tessera.telefono);
        const aperta = storiaAperta === tessera.id;
        // ⚠️ QUESTO MESSAGGIO NON PASSA DA `t()`, E NON E' UNA
        // DIMENTICANZA. Non lo legge l'Admin: lo legge la persona a cui
        // viene mandato su WhatsApp, e la sua lingua e' scritta nel suo
        // profilo, non in quello di chi sta in segreteria. Tradurlo con
        // `t()` vorrebbe dire spedire un messaggio in tedesco a un ex
        // socio italiano solo perche' quel giorno la dashboard era in
        // tedesco. La strada giusta e' `avviso('chiave', {...})` di
        // `data/linguaDestinatario.ts` — che pero' e' asincrona, e
        // l'indirizzo `wa.me` qui si compone mentre si disegna la riga.
        // Finche' resta cosi', il ripiego onesto e' l'italiano.
        const messaggio = credito > 0
          ? `Ciao ${tessera.nome}, hai € ${credito.toFixed(2)} di credito da ritirare presso ${circolo.nome}.`
          : `Ciao ${tessera.nome}, risulta un debito di € ${debito.toFixed(2)} da saldare presso ${circolo.nome}.`;
        return (
          <div key={tessera.id}>
            <div className="admin-list-row">
              <div style={{ flex: 1 }}>
                <div className="admin-list-main">{tessera.nome} {tessera.cognome}</div>
                <div className="admin-list-sub">{tessera.email}</div>
                {credito > 0 && (
                  <div className="admin-saldo-credito">
                    {t('adm.tes.creditoDaRestituire', { importo: credito.toFixed(2) })}
                  </div>
                )}
                {debito > 0 && (
                  <div className="admin-saldo-debito">
                    {t('adm.tes.debitoDaRecuperare', { importo: debito.toFixed(2) })}
                  </div>
                )}
                {!!numero && (
                  <a
                    className="admin-link-whatsapp"
                    href={`https://wa.me/${numero}?text=${encodeURIComponent(messaggio)}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {tessera.telefono} · {t('adm.tes.contatta')}
                  </a>
                )}
                <button
                  type="button"
                  className="admin-btn-small"
                  style={{ marginTop: '.5rem' }}
                  onClick={() => setStoriaAperta(aperta ? null : tessera.id)}
                >
                  {aperta ? t('adm.tes.nascondiOperazioni') : t('adm.tes.daDoveNasce')}
                </button>
              </div>
              <button className="admin-btn-piccolo-verde" onClick={() => setDaSaldare(tessera)}>
                {etichettaAzione(tessera)}
              </button>
            </div>
            {aperta && <StoriaDelConto uid={tessera.uid} circoloId={circolo.id} />}
          </div>
        );
      })}

      <Modal visible={!!daSaldare} onClose={() => setDaSaldare(null)}>
        <div className="admin-modal-title">
          {debitoDi(daSaldare) > 0 && creditoDi(daSaldare) > 0
            ? t('adm.tes.chiuderePosizione')
            : debitoDi(daSaldare) > 0 ? t('adm.tes.eliminareDebito') : t('adm.tes.creditoRestituitoDomanda')}
        </div>
        <p className="admin-modal-sub">{daSaldare?.nome} {daSaldare?.cognome}</p>
        <p className="admin-modal-sub" style={{ marginTop: '.5rem' }}>
          {debitoDi(daSaldare) > 0 && creditoDi(daSaldare) > 0
            ? t('adm.tes.spiegaEntrambi', {
              credito: euro(creditoDi(daSaldare)),
              debito: euro(debitoDi(daSaldare)),
            })
            : debitoDi(daSaldare) > 0
              ? t('adm.tes.spiegaDebito', { importo: euro(debitoDi(daSaldare)) })
              : t('adm.tes.spiegaCredito', { importo: euro(creditoDi(daSaldare)) })}
        </p>
        <div className="admin-modal-btn-row">
          <button className="admin-modal-btn-cancel" onClick={() => setDaSaldare(null)} disabled={elaborando}>
            {t('com.annulla')}
          </button>
          <button className="admin-modal-btn-confirm" onClick={conferma} disabled={elaborando}>
            {elaborando ? t('com.attendi') : etichettaAzione(daSaldare)}
          </button>
        </div>
      </Modal>
    </div>
  );
}
