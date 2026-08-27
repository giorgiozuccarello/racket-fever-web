'use client';

// ============================================================
// CONTEGGIO DELLE MEZZ'ORE — quanto campo ha venduto il Circolo.
//
// Cinque numeri e basta, tutti del Circolo: mezz'ore prenotate,
// mezz'ore annullate, il netto fra le due, quel netto detto in ore, e
// il totale incassato. Dalla creazione del circolo a oggi, un totale
// unico che cresce.
//
// ============================================================
// ⚠️ QUI NON CI SONO COMMISSIONI, E NON CI DEVONO TORNARE.
//
// La versione precedente di questa schermata metteva a confronto
// quanto incassava il Circolo e quanto tratteneva Racket Fever, con
// periodi, incidenza, proiezioni e il dettaglio riga per riga. È stata
// buttata via il 27 agosto 2026 per decisione di Giorgio: il conto fra
// le due aziende si fa altrove, e questa sezione risponde a una domanda
// sola — quanto campo ha venduto il circolo.
//
// Gli euro che si vedono qui sono i SOLDI DEL CIRCOLO: il prezzo che il
// circolo stesso ha messo in griglia, congelato nell'istante della
// prenotazione. Non un prezzo che noi gli facciamo. Vale ancora la
// ragione scritta in cima a `data/fatturazione.ts`: un listino scritto
// nel codice diventa un listino pubblicato.
// ============================================================
//
// ⚠️ I NUMERI NON SI CONTANO QUI. Li scrive il server
// (`functions/src/ricavi.ts`), la matematica sta in `data/ricavi.ts` e
// la lettura in `data/ricaviRepo.ts`. Questa è una cornice: titolo,
// spiegazione, e i cinque riquadri — che stanno in
// `RiquadriConteggio.tsx` perché la stessa fila di caselle compare
// anche nella scheda che il Super Admin apre su un circolo.
// ============================================================

import { useMemo } from 'react';
import { Circolo, attivazioneCircoloMs } from '../../../data/circoli';
import { Traduttore } from '../../../data/testi';
import { useLingua } from '../../../lib/lingua';
import RiquadriConteggio, { TestiConteggio } from './RiquadriConteggio';

// ============================================================
// LE PAROLE DELLA DASHBOARD, prese dal dizionario.
//
// ⚠️ I riquadri non chiamano `useLingua` da soli, e il motivo sta nel
// riquadro in cima a `RiquadriConteggio.tsx`: lo stesso componente lo
// monta anche il pannello Super Admin, che non è tradotto. Qui si
// traduce, di là si scrive italiano.
// ============================================================
export function testiConteggioTradotti(t: Traduttore): TestiConteggio {
  return {
    aggiorna: t('adm.ric2.aggiorna'),
    attendi: t('com.attendi'),
    etPrenotate: t('adm.ric2.et.prenotate'),
    etAnnullate: t('adm.ric2.et.annullate'),
    etNette: t('adm.ric2.et.nette'),
    etOre: t('adm.ric2.et.ore'),
    etIncasso: t('adm.ric2.et.incasso'),
    etAttivoDal: t('adm.ric2.et.attivoDal'),
    attivoDal: (data) => t('adm.ric2.attivoDal', { data }),
    attivoDalIgnoto: t('adm.ric2.attivoDalIgnoto'),
    finoA: (ora, data) => t('adm.ric2.finoA', { ora, data }),
    oraInCorso: t('adm.ric2.oraInCorso'),
    nonTrovato: t('adm.ric2.nonTrovato'),
    incompleto: t('adm.ric2.incompleto'),
    erroreAggiornamento: (motivo) => t('adm.ric2.errAggiorna', { motivo }),
    erroreLettura: (motivo) => t('adm.ric2.errLettura', { motivo }),
    notaIncasso: t('adm.ric2.notaIncasso'),
  };
}

export default function SezioneRicavi({ circolo }: { circolo: Circolo }) {
  const { t } = useLingua();

  // ⚠️ `useMemo` e non un oggetto composto al volo: `RiquadriConteggio`
  // lo riceve come prop, e un oggetto nuovo a ogni disegno è un oggetto
  // che cambia identità senza che sia cambiata una parola. Oggi non fa
  // danno — l'effetto dei riquadri dipende dal solo `circoloId` — ma è
  // la trappola che scatta il giorno che qualcuno mette `testi` fra le
  // dipendenze: una chiamata al server a ogni ridisegno.
  const testi = useMemo(() => testiConteggioTradotti(t), [t]);

  return (
    <div className="admin-card">
      <div className="admin-card-title">{t('adm.ric2.titolo')}</div>
      <p className="admin-card-hint">{t('adm.ric2.intro')}</p>

      <RiquadriConteggio
        circoloId={circolo.id}
        attivatoIlMs={attivazioneCircoloMs(circolo)}
        testi={testi}
      />
    </div>
  );
}
