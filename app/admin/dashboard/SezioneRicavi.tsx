'use client';

// ============================================================
// LE MEZZ'ORE DEL CIRCOLO — DUE CONTI, NON UNO.
//
// ⚠️ È LA COSA PIÙ IMPORTANTE DI QUESTA SCHERMATA, ed è per questo che
// i due gruppi hanno un titolo per uno e una riga che spiega la
// differenza. Senza, l'Admin legge lo stesso numero scritto due volte e
// conclude che uno dei due sbaglia.
//
//   - «Prenotato adesso» — quante mezz'ore risultano prenotate nel
//     momento in cui si guarda, comprese quelle di domani e del mese
//     prossimo. È la fotografia del presente: sale quando un socio
//     prenota, scende quando disdice.
//   - «Maturato» — quante mezz'ore sono state davvero giocate, con il
//     taglio a mezzanotte di ieri: entrano solo i giorni chiusi per
//     intero. È il numero che non cambia più una volta scritto.
//
// Una prenotazione per il mese prossimo è dentro il primo e fuori dal
// secondo, e ci resterà fuori fino al giorno dopo la partita. La
// spiegazione lunga sta in cima a `data/ricavi.ts`.
//
// Ogni gruppo mostra gli stessi cinque numeri — mezz'ore prenotate,
// annullate, il netto fra le due, quel netto detto in ore, e il totale
// incassato — e ha il suo pulsante, che NON fa la stessa cosa
// dell'altro: quello del live rilegge, quello del maturato chiama il
// server. Il perché sta in cima a `RiquadriConteggio.tsx`.
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
//
// ⚠️ E `data/commissione.ts` NON SI IMPORTA DA QUI. Questa schermata si
// apre con le credenziali di un Admin di circolo, e un revisore di App
// Store potrebbe averle: quanto il circolo paga a Racket Fever non deve
// comparirci nemmeno da spento. Quel file lo importa solo
// `app/superadmin/`.
// ============================================================
//
// ⚠️ I NUMERI NON SI CONTANO QUI. Li scrive il server
// (`functions/src/ricavi.ts`), la matematica sta in `data/ricavi.ts` e
// la lettura in `data/ricaviRepo.ts`. Questa è una cornice: titolo,
// spiegazione, e i due gruppi di riquadri — che stanno in
// `RiquadriConteggio.tsx` perché le stesse file di caselle compaiono
// anche nella scheda che il Super Admin apre su un circolo.
// ============================================================

import { useMemo } from 'react';
import { Circolo, attivazioneCircoloMs } from '../../../data/circoli';
import { Traduttore } from '../../../data/testi';
import { useLingua } from '../../../lib/lingua';
import RiquadriConteggio, {
  RigaAttivoDal, TestiAttivoDal, TestiConteggio, TestiMaturato,
} from './RiquadriConteggio';

// ============================================================
// LE PAROLE DELLA DASHBOARD, prese dal dizionario.
//
// ⚠️ I riquadri non chiamano `useLingua` da soli, e il motivo sta nel
// riquadro in cima a `RiquadriConteggio.tsx`: lo stesso componente lo
// monta anche il pannello Super Admin, che non è tradotto. Qui si
// traduce, di là si scrive italiano.
//
// ⚠️ E LE ETICHETTE DEI CINQUE NUMERI SONO LE STESSE nei due gruppi, di
// proposito: sono gli stessi cinque numeri contati su due periodi
// diversi. A distinguerli sono il titolo del gruppo e la riga che lo
// spiega, non cinque parole storpiate per farle sembrare diverse.
// ============================================================
function testiLive(t: Traduttore): TestiConteggio {
  return {
    aggiorna: t('adm.ric2.d.live.aggiorna'),
    attendi: t('com.attendi'),
    etPrenotate: t('adm.ric2.et.prenotate'),
    etAnnullate: t('adm.ric2.et.annullate'),
    etNette: t('adm.ric2.et.nette'),
    etOre: t('adm.ric2.et.ore'),
    etIncasso: t('adm.ric2.et.incasso'),
    nonTrovato: t('adm.ric2.d.live.nonTrovato'),
    erroreLettura: (motivo) => t('adm.ric2.errLettura', { motivo }),
    nota: t('adm.ric2.d.live.nota'),
  };
}

function testiMaturato(t: Traduttore): TestiMaturato {
  return {
    aggiorna: t('adm.ric2.d.mat.aggiorna'),
    attendi: t('com.attendi'),
    etPrenotate: t('adm.ric2.et.prenotate'),
    etAnnullate: t('adm.ric2.et.annullate'),
    etNette: t('adm.ric2.et.nette'),
    etOre: t('adm.ric2.et.ore'),
    etIncasso: t('adm.ric2.et.incasso'),
    nonTrovato: t('adm.ric2.d.mat.nonTrovato'),
    erroreLettura: (motivo) => t('adm.ric2.errLettura', { motivo }),
    nota: t('adm.ric2.d.mat.nota'),
    erroreAggiornamento: (motivo) => t('adm.ric2.errAggiorna', { motivo }),
    incompleto: t('adm.ric2.incompleto'),
    finoAl: (data) => t('adm.ric2.d.mat.finoAl', { data }),
    finoANiente: t('adm.ric2.d.mat.finoANiente'),
  };
}

function testiAttivoDal(t: Traduttore): TestiAttivoDal {
  return {
    etichetta: t('adm.ric2.et.attivoDal'),
    attivoDal: (data) => t('adm.ric2.attivoDal', { data }),
    ignoto: t('adm.ric2.attivoDalIgnoto'),
  };
}

export default function SezioneRicavi({ circolo }: { circolo: Circolo }) {
  const { t } = useLingua();

  // ⚠️ `useMemo` e non oggetti composti al volo: `RiquadriConteggio` li
  // riceve come prop, e un oggetto nuovo a ogni disegno è un oggetto che
  // cambia identità senza che sia cambiata una parola. Oggi non fa danno
  // — l'effetto dei riquadri dipende dal solo `circoloId` e dal modo —
  // ma è la trappola che scatta il giorno che qualcuno mette `testi` fra
  // le dipendenze: una chiamata al server a ogni ridisegno.
  const perLive = useMemo(() => testiLive(t), [t]);
  const perMaturato = useMemo(() => testiMaturato(t), [t]);
  const perAttivoDal = useMemo(() => testiAttivoDal(t), [t]);

  return (
    <div className="admin-card">
      <div className="admin-card-title">{t('adm.ric2.d.titolo')}</div>
      {/* ⚠️ LA DIFFERENZA FRA I DUE CONTI SI DICE QUI, PRIMA DEI NUMERI.
          Sotto si leggerebbe come una nota a piè di pagina, e i due
          gruppi si sarebbero già presi per lo stesso conto scritto due
          volte. */}
      <p className="admin-card-hint">{t('adm.ric2.d.intro')}</p>

      {/* Da quando si conta: una volta sola, perché la data di ingresso
          in rete vale per tutti e due i conti. */}
      <RigaAttivoDal
        attivatoIlMs={attivazioneCircoloMs(circolo)}
        testi={perAttivoDal}
      />

      {/* ---------- PRENOTATO ADESSO (live) ----------
          ⚠️ STA PER PRIMO, ed è la domanda che l'Admin si fa ogni
          giorno: «come sta andando il circolo in questo momento». Il
          maturato serve a fare i conti, e i conti si fanno dopo. */}
      <div className="scheda-gruppo">
        <div className="scheda-gruppo-titolo">{t('adm.ric2.d.live.titolo')}</div>
        <p className="admin-card-hint">{t('adm.ric2.d.live.spiega')}</p>
        <RiquadriConteggio modo="live" circoloId={circolo.id} testi={perLive} />
      </div>

      {/* ---------- MATURATO ---------- */}
      <div className="scheda-gruppo">
        <div className="scheda-gruppo-titolo">{t('adm.ric2.d.mat.titolo')}</div>
        <p className="admin-card-hint">{t('adm.ric2.d.mat.spiega')}</p>
        <RiquadriConteggio modo="maturato" circoloId={circolo.id} testi={perMaturato} />
      </div>

      {/* Che cosa sono quegli euro. Una volta sola in fondo: la frase
          vale identica per tutti e due i totali, e ripeterla sotto ogni
          gruppo insegna a saltarla. */}
      <p className="admin-card-hint scheda-nota">{t('adm.ric2.notaIncasso')}</p>
    </div>
  );
}
