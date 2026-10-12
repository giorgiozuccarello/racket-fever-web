'use client';

// ============================================================
// NUOVO SPAZIO — i quattro passi di «come si crea uno spazio», in uno.
//
// ⚠️ QUESTO MODULO SOSTITUISCE UN DOCUMENTO. Fino a oggi uno spazio si
// creava a mano dalla console Firebase seguendo
// `claude/COME_SI_CREA_UNO_SPAZIO.md`, e quel documento esiste perche'
// uno dei passi si dimentica: `titolari/{uid}`, che non serve a nessuna
// schermata e senza il quale un divieto sparisce IN SILENZIO. Qui non
// c'e' niente da ricordare: il server scrive i tre documenti nello
// stesso `batch`.
//
// ⚠️ DUE INTERRUTTORI SEMBRANO UGUALI E NON LO SONO, e la schermata deve
// dirlo:
//   • «insegna» cambia COSA e' lo spazio — il maestro indipendente,
//     oppure la societa' che amministra e basta. Uno spazio con insegna
//     spento resta INCOMPLETO finche' non invita il primo maestro:
//     senza nessuno che insegni, gli allievi non possono chiedere
//     lezioni.
//   • «dashboard unica» cambia solo cosa vede lui, e si cambia da solo
//     dall'app in Impostazioni → Dashboard. Costa niente sbagliarlo.
// Il primo si spiega, il secondo si consiglia.
//
// ⚠️ E LA PASSWORD NON SI SCEGLIE QUI. Vedi la nota in testa a
// `data/onboarding.ts`: il server restituisce un link, il maestro
// sceglie, noi non la sappiamo mai.
// ============================================================

import React, { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  creaSpazio, DatiNuovoSpazio, EsitoNuovoSpazio, eUnRifiuto, motivo,
} from '../../_dati/onboarding';
import { leggiRichieste, statoRichiesta } from '../../_dati/superadmin';
import { Capitoli, Capitolo, Pagina } from '../../_pezzi/Pezzi';

const VUOTO: DatiNuovoSpazio = {
  email: '',
  nome: '',
  cognome: '',
  nomeSpazio: '',
  tipo: 'persona',
  citta: '',
  zona: '',
  paese: 'CH',
  valuta: 'CHF',
  insegna: true,
  // ⚠️ ACCESA DI SERIE, ed e' la decisione del 15 settembre: «se il
  // maestro lavora da solo — cioe' il 70% dei casi — si scrive
  // dashboardUnica: true». Il valore giusto per la maggioranza va messo
  // dove non richiede di pensarci.
  dashboardUnica: true,
  visibile: true,
  tariffaOraCent: 0,
  telefono: '',
  emailPubblica: '',
};

function Modulo() {
  const router = useRouter();
  const richiestaId = useSearchParams().get('richiesta') ?? '';
  const [d, setD] = useState<DatiNuovoSpazio>(VUOTO);
  const [daRichiesta, setDaRichiesta] = useState('');
  const [tariffa, setTariffa] = useState('');
  const [guasto, setGuasto] = useState('');
  // ⚠️ Vero solo quando a rifiutare e' stata la funzione: vedi
  // `eUnRifiuto`. Su un errore di rete o di tempo scaduto lo spazio puo'
  // essere stato creato lo stesso, e dire «non e' stato creato niente»
  // sarebbe una bugia detta in grassetto.
  const [rifiutato, setRifiutato] = useState(false);
  const [fatto, setFatto] = useState<EsitoNuovoSpazio | null>(null);
  const [lavoro, setLavoro] = useState(false);

  const cambia = (pezzo: Partial<DatiNuovoSpazio>) => setD((v) => ({ ...v, ...pezzo }));

  // ⚠️ LA VALUTA SEGUE IL PAESE finche' nessuno la tocca a mano: in
  // Svizzera si incassa in franchi, e un cliente svizzero creato in euro
  // e' un listino sbagliato su una scheda pubblica.
  const cambiaPaese = (paese: 'CH' | 'IT') => cambia({
    paese, valuta: paese === 'CH' ? 'CHF' : 'EUR',
  });

  // ============================================================
  // ⚠️ DA UNA RICHIESTA DEL SITO — 12 ottobre 2026. «Crea lo spazio» nella
  // pagina Richieste arriva qui con `?richiesta=…`, e i dati che il maestro
  // ha gia' scritto entrano nel modulo: riscriverli a mano e' il modo in cui
  // un'email si sbaglia. Il Super Admin li controlla e li corregge prima di
  // creare.
  // ============================================================
  useEffect(() => {
    if (!richiestaId) return;
    let vivo = true;
    leggiRichieste().then((tutte) => {
      const r = tutte.find((x) => x.id === richiestaId);
      if (!vivo || !r) return;
      const paese = r.paese === 'IT' ? 'IT' : 'CH';
      setD((v) => ({
        ...v,
        email: r.email,
        nome: r.nome,
        cognome: r.cognome,
        nomeSpazio: r.tipo === 'scuola' ? '' : `${r.nome} ${r.cognome}`.trim(),
        tipo: r.tipo === 'scuola' ? 'scuola' : 'persona',
        citta: r.citta,
        paese,
        valuta: paese === 'CH' ? 'CHF' : 'EUR',
        telefono: r.telefono,
      }));
      setDaRichiesta(`${r.nome} ${r.cognome}`.trim());
    }).catch(() => { /* il modulo resta vuoto: si scrive a mano */ });
    return () => { vivo = false; };
  }, [richiestaId]);

  async function manda(e: React.FormEvent) {
    e.preventDefault();
    setGuasto('');
    // ⚠️ UN CAMPO CHE ACCETTA SPAZZATURA E LA TRASFORMA IN SILENZIO IN UN
    // VALORE LEGITTIMO e' peggio di un campo che rifiuta: «80.-», «80
    // CHF» e «8o» diventavano tutti zero, e zero vuol dire «tariffa non
    // impostata» — indistinguibile da chi l'ha lasciata vuota apposta.
    const scritto = tariffa.trim().replace(',', '.');
    if (scritto !== '' && !/^\d+(\.\d{1,2})?$/.test(scritto)) {
      setGuasto('La tariffa va scritta in cifre, per esempio 80 oppure 87.50.');
      setRifiutato(true);
      return;
    }
    setLavoro(true);
    try {
      // ⚠️ LA TARIFFA E' IN CENTESIMI E INTERA. Il campo sul modulo e'
      // in franchi o euro perche' e' cosi' che la dice il cliente; la
      // conversione sta qui, in un posto solo, e con l'arrotondamento —
      // «80.5» scritto a mano diventa 8050, non 8049,99999.
      const cent = Math.max(0, Math.round((Number(scritto) || 0) * 100));
      const esito = await creaSpazio({ ...d, email: d.email.trim(), tariffaOraCent: cent });
      setFatto(esito);
      // ⚠️ LA RICHIESTA PASSA DA SOLA AD «ATTIVATA», con lo spazio nato. Se
      // questo passo cade lo spazio c'e' lo stesso: la richiesta si segna a
      // mano dalla sua pagina, e non vale la pena di dire «non e' andata»
      // sopra uno spazio creato.
      if (richiestaId) {
        statoRichiesta(richiestaId, 'attivata', esito.spazioId).catch(() => { /* si segna a mano */ });
      }
    } catch (e2) {
      setGuasto(motivo(e2));
      setRifiutato(eUnRifiuto(e2));
    }
    setLavoro(false);
  }

  // ============================================================
  // ⚠️ IL RIEPILOGO NON E' UNA CORTESIA: porta il link, e il link e'
  // l'unica cosa di tutta questa schermata che non si puo' ritrovare
  // altrove con un colpo d'occhio. Per questo il modulo sparisce e
  // resta solo questo — e per questo si dice anche cosa fare adesso.
  // ============================================================
  if (fatto) {
    return (
      <Pagina titolo="Lo spazio c’e’" sotto={`${d.nomeSpazio} — ${d.citta}`}>

        <Capitoli>
        <Capitolo titolo="Cosa e’ stato scritto" largo>
          <p>
            Lo spazio, la tessera del titolare e il segnale <code>titolari</code> sono
            stati scritti insieme. Identificativo dello spazio: <b>{fatto.spazioId}</b>.
          </p>
          {fatto.nuovoAccount ? (
            <div className="avviso attenzione">
              <b>L’account e’ nuovo, e la password non l’abbiamo scelta noi.</b>
              Manda questo link a {d.email}: sceglie la password da se’, e cosi’ verifica
              anche l’indirizzo. Il link scade — se arriva tardi, se ne rigenera un altro
              dalla scheda dello spazio.
              <input className="link-consegna" readOnly value={fatto.link} onFocus={(e) => e.target.select()} />
            </div>
          ) : (
            <>
              <div className="avviso bene">
                <b>L’account esisteva gia’.</b>
                Questa persona ha gia’ un account per {d.email} — probabilmente perche’ e’
                socio di un circolo su Racket Fever. Entra con quello: non ne serve un altro,
                e non gli e’ stata cambiata nessuna password.
              </div>
              {/* ⚠️ E SE NON HA MAI VERIFICATO L'INDIRIZZO, entra e non
                  riesce a fare niente: le regole pretendono `verificato()`
                  per quasi ogni scrittura, a cominciare dalla creazione del
                  proprio profilo. Un riquadro verde qui era la schermata
                  che tace proprio dove doveva parlare. */}
              {fatto.daVerificare ? (
                <div className="avviso attenzione">
                  <b>Ma non ha mai verificato quell’indirizzo.</b>
                  Finche’ non lo fa, entra e non riesce a salvare niente — nemmeno il
                  proprio profilo. Dalla scheda dello spazio, «Genera un link» produce
                  per lui un link di verifica da mandargli.
                </div>
              ) : null}
            </>
          )}
          <div className="avviso attenzione">
            <b>Deve chiudere e riaprire l’app.</b>
            Chi era gia’ dentro resta nella ricerca degli spazi finche’ l’app non riparte:
            lo smistamento decide dove mandare la persona all’avvio.
          </div>

          <div className="azioni">
            <button type="button" className="bottone acceso" onClick={() => router.push(`/rfcoach/superadmin/spazi?id=${fatto.spazioId}`)}>
              Apri lo spazio
            </button>
            <button
              type="button"
              className="bottone leggero"
              onClick={() => { setFatto(null); setD(VUOTO); setTariffa(''); setDaRichiesta(''); router.replace('/rfcoach/superadmin/nuovo'); }}
            >
              Creane un altro
            </button>
          </div>
        </Capitolo>
        </Capitoli>
      </Pagina>
    );
  }

  return (
    <Pagina
      titolo="Nuovo spazio"
      sotto="Mettere in attivita’ un maestro o una scuola. Tutto quello che serve sta qui: non resta nessun passo da fare in console."
    >

      {daRichiesta ? (
        <div className="avviso attenzione">
          <b>{`Dalla richiesta di ${daRichiesta}`}</b>
          I dati sono quelli che ha scritto lui: controllali prima di creare.
        </div>
      ) : null}

      {guasto ? (
        <div className="avviso male">
          {rifiutato ? (
            <><b>Non e’ stato creato niente.</b>{guasto}</>
          ) : (
            <>
              <b>Non so com’e’ andata.</b>
              {guasto}
              <div style={{ marginTop: 6 }}>
                La chiamata non e’ arrivata a destinazione, oppure ci ha messo troppo:
                lo spazio potrebbe essere stato creato lo stesso. Guarda negli Spazi
                prima di riprovare.
              </div>
            </>
          )}
        </div>
      ) : null}

      <form onSubmit={manda}>
        <Capitoli>
        <Capitolo titolo="La persona che comanda">
          <div className="campi">
            <div className="campo largo">
              <label htmlFor="email">Indirizzo di posta</label>
              <input
                id="email" type="email" value={d.email} required
                onChange={(e) => cambia({ email: e.target.value })}
              />
              <div className="aiuto">
                Se ha gia’ un account — anche solo su Racket Fever — si riusa quello:
                una persona ha un solo account per tutte e due le app.
              </div>
            </div>
            <div className="campo">
              <label htmlFor="nome">Nome</label>
              <input id="nome" value={d.nome} required onChange={(e) => cambia({ nome: e.target.value })} />
            </div>
            <div className="campo">
              <label htmlFor="cognome">Cognome</label>
              <input id="cognome" value={d.cognome} required onChange={(e) => cambia({ cognome: e.target.value })} />
            </div>
          </div>
        </Capitolo>

        <Capitolo titolo="Lo spazio">
          <div className="campi">
            <div className="campo largo">
              <label htmlFor="nomeSpazio">Nome dello spazio</label>
              <input
                id="nomeSpazio" value={d.nomeSpazio} required
                onChange={(e) => cambia({ nomeSpazio: e.target.value })}
              />
              <div className="aiuto">
                Per un maestro, nome e cognome. Per una scuola, la ragione sociale:
                e’ quello che l’allievo legge cercando.
              </div>
            </div>
            <div className="campo">
              <label htmlFor="tipo">Tipo</label>
              <select id="tipo" value={d.tipo} onChange={(e) => cambia({ tipo: e.target.value as 'persona' | 'scuola' })}>
                <option value="persona">Persona</option>
                <option value="scuola">Scuola</option>
              </select>
              <div className="aiuto">Cambia solo come si presenta, non come funziona.</div>
            </div>
            <div className="campo">
              <label htmlFor="paese">Paese</label>
              <select id="paese" value={d.paese} onChange={(e) => cambiaPaese(e.target.value as 'CH' | 'IT')}>
                <option value="CH">Svizzera</option>
                <option value="IT">Italia</option>
              </select>
            </div>
            <div className="campo">
              <label htmlFor="citta">Citta’</label>
              <input id="citta" value={d.citta} required onChange={(e) => cambia({ citta: e.target.value })} />
            </div>
            <div className="campo">
              <label htmlFor="zona">Zona</label>
              <input id="zona" value={d.zona} onChange={(e) => cambia({ zona: e.target.value })} />
              <div className="aiuto">Quartiere o regione: e’ la riga sotto il nome.</div>
            </div>
            <div className="campo">
              <label htmlFor="valuta">Valuta</label>
              <select id="valuta" value={d.valuta} onChange={(e) => cambia({ valuta: e.target.value as 'CHF' | 'EUR' })}>
                <option value="CHF">CHF</option>
                <option value="EUR">EUR</option>
              </select>
            </div>
            <div className="campo">
              <label htmlFor="tariffa">Tariffa oraria</label>
              <input
                id="tariffa" inputMode="decimal" value={tariffa} placeholder="80"
                onChange={(e) => setTariffa(e.target.value)}
              />
              <div className="aiuto">
                Si puo’ lasciare vuoto: la mette lui dall’app. Zero vuol dire
                «non impostata», non «gratis».
              </div>
            </div>
          </div>
        </Capitolo>

        <Capitolo titolo="Come lavora" largo>

          <label className="interruttore">
            <input
              type="checkbox" checked={d.insegna}
              onChange={(e) => cambia({ insegna: e.target.checked, dashboardUnica: e.target.checked && d.dashboardUnica })}
            />
            <span>
              <b>Insegna</b>
              <small>
                Il caso normale. Se lo spegni, questo spazio amministra e basta: resta
                incompleto — gli allievi non possono chiedere lezioni — finche’ non
                invita il primo maestro.
              </small>
            </span>
          </label>

          <label className="interruttore" style={{ opacity: d.insegna ? 1 : 0.45 }}>
            <input
              type="checkbox" checked={d.dashboardUnica} disabled={!d.insegna}
              onChange={(e) => cambia({ dashboardUnica: e.target.checked })}
            />
            <span>
              <b>Dashboard unica</b>
              <small>
                Da accendere se lavora da solo — il 70% dei casi: una Home sola, senza
                interruttore fra Admin e Dashboard Maestro. La cambia lui dall’app,
                in Impostazioni → Dashboard.
              </small>
            </span>
          </label>

          <label className="interruttore">
            <input type="checkbox" checked={d.visibile} onChange={(e) => cambia({ visibile: e.target.checked })} />
            <span>
              <b>Si fa trovare</b>
              <small>
                Spento, lo spazio e’ attivo ma non compare nella ricerca degli allievi:
                si usa per chi lavora solo su presentazione, o per preparare tutto prima
                dell’annuncio.
              </small>
            </span>
          </label>
        </Capitolo>
        </Capitoli>

        <div className="azioni">
          <button type="submit" className="bottone acceso" disabled={lavoro}>
            {lavoro ? 'Sto scrivendo…' : 'Crea lo spazio'}
          </button>
        </div>
      </form>
    </Pagina>
  );
}

// ⚠️ IL `Suspense` NON E' DECORAZIONE: `useSearchParams` obbliga a una
// frontiera, e senza il `build` si ferma.
export default function NuovoSpazio() {
  return (
    <Suspense fallback={<div className="vuoto">Un momento…</div>}>
      <Modulo />
    </Suspense>
  );
}
