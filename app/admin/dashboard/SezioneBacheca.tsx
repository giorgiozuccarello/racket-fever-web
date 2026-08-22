'use client';

// ============================================================
// BACHECA — la sezione con cui l'Admin appende i fogli.
//
// Prende il posto della Chat del circolo, che non c'e' mai stata
// davvero. La differenza con i Tornei di poco sotto e' la portata:
// un torneo esce dal circolo e finisce sul telefono di soci mai
// visti, un avviso di bacheca resta dentro casa. Per questo qui non
// si sceglie nessuna copertura — c'e' un destinatario solo, i propri
// soci — e le regole chiudono la lettura a chiunque altro.
//
// Un avviso puo' essere di tre forme: titolo e testo, titolo e
// volantino, oppure tutti e tre insieme. Quello che NON puo' essere e'
// un titolo e basta: sarebbe una riga che non dice niente e non si
// puo' approfondire.
// ============================================================

import { useEffect, useState } from 'react';
import { Circolo } from '../../../data/circoli';
import {
  Avviso, CATEGORIE_AVVISO, categoriaDi, scadenzaPredefinita,
  ordinaAvvisi, avvisoDaMostrare, giorniAllaScadenza, cosaMancaPerPubblicare,
  GIORNI_AVVISO_PREDEFINITI,
} from '../../../data/bacheca';
import { pubblicaAvviso, aggiornaAvviso, rimuoviAvviso, ascoltaBachecaAdmin, spostaAvviso } from '../../../data/bachecaRepo';
import { caricaVolantino, rimuoviVolantino } from '../../../data/storage';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../../lib/firebase';
import { oggiIso, fraGiorni, dataNumerica } from '../../../data/giorni';

export default function SezioneBacheca({
  circolo, autoreNome, puoNotificare,
}: {
  circolo: Circolo;
  autoreNome: string;
  // ⚠️ Falso per il Collaboratore. `avvisaBacheca` pretende il
  // responsabile — il Collaboratore e' un accesso con password
  // condivisa e senza nome, va bene per la segreteria e non per far
  // squillare i telefoni di tutto il circolo — quindi il comando non
  // gli si mostra nemmeno: un pulsante destinato a essere respinto e'
  // peggio di un pulsante che non c'e'.
  puoNotificare: boolean;
}) {
  const [titolo, setTitolo] = useState('');
  const [testo, setTesto] = useState('');
  const [categoria, setCategoria] = useState(CATEGORIE_AVVISO[0].chiave);
  const [volantino, setVolantino] = useState<string | null>(null);
  const [link, setLink] = useState('');
  const [fino, setFino] = useState(scadenzaPredefinita());
  const [caricando, setCaricando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  // ⚠️ Bloccato mentre una freccia lavora: ogni spostamento rinumera
  // l'elenco intero, e due che si accavallano rinumerano ciascuno la
  // versione letta prima — uno dei due movimenti sparisce.
  const [spostando, setSpostando] = useState(false);
  const [errore, setErrore] = useState('');
  const [archivio, setArchivio] = useState<Avviso[]>([]);
  const [daRimuovere, setDaRimuovere] = useState<Avviso | null>(null);
  // ⚠️ LA NOTIFICA C'ERA SOLO SULL'APP, e questa dashboard e' quella su
  // cui l'Admin lavora davvero: pubblicava l'avviso e non aveva nessun
  // modo di farlo sapere. Due dashboard che fanno cose diverse sullo
  // stesso oggetto sono la ragione per cui un circolo finisce per
  // usarne una sola.
  const [conNotifica, setConNotifica] = useState(false);
  const [avvisati, setAvvisati] = useState<{ inHome: number; sulTelefono: number } | null>(null);
  const [daNotificare, setDaNotificare] = useState<Avviso | null>(null);
  const [notificando, setNotificando] = useState(false);
  // ⚠️ UN ERRORE SUO, e non quello del modulo. Con lo stesso stato, un
  // Admin che aveva appena letto «la notifica non è partita, puoi
  // rimandarla con la campanella» apriva la campanella e si ritrovava
  // quella stessa frase stampata DENTRO la finestra di conferma, come
  // se riguardasse il tentativo nuovo — e l'errore di un'altra
  // operazione, tipo uno spostamento fallito, compariva li' identico.
  const [erroreNotifica, setErroreNotifica] = useState('');

  // Una funzione sola per i due percorsi — l'interruttore alla
  // pubblicazione e la campanella dell'elenco — cosi' i due non possono
  // raccontare l'esito in due modi diversi.
  const mandaNotifica = async (avvisoId: string) => {
    const manda = httpsCallable<
      { circoloId: string; avvisoId: string },
      { avvisati: number; notificati?: number }
    >(functions, 'avvisaBacheca');
    const esito = await manda({ circoloId: circolo.id, avvisoId });
    setAvvisati({
      inHome: esito.data?.avvisati ?? 0,
      sulTelefono: esito.data?.notificati ?? 0,
    });
  };
  // ⚠️ "Vuoto" e "non riesco a leggere" non sono la stessa cosa, e
  // qui la differenza costa cara: con le regole non ancora pubblicate
  // l'Admin leggeva «La bacheca è ancora vuota» e ripubblicava gli
  // stessi avvisi in doppio, o credeva riuscita una cancellazione che
  // non era passata.
  const [archivioRotto, setArchivioRotto] = useState(false);

  useEffect(
    () => ascoltaBachecaAdmin(circolo.id, (elenco) => {
      setArchivioRotto(false);
      setArchivio(elenco);
    }, () => setArchivioRotto(true)),
    [circolo.id],
  );

  const scegliVolantino = async (file: File | null) => {
    if (!file) return;
    setErrore('');
    setCaricando(true);
    try {
      // Si carica subito, non al momento di pubblicare: cosi' l'Admin
      // vede l'anteprima e sa che il file e' passato PRIMA di aver
      // scritto tutto il resto. Se poi abbandona resta un file
      // orfano — non e' referenziato da nessuna parte e non fa danno.
      const url = await caricaVolantino(circolo.id, file);
      setVolantino(url);
    } catch (e: any) {
      setErrore(e?.message ?? 'Non sono riuscito a caricare il volantino.');
    } finally {
      setCaricando(false);
    }
  };

  const togliVolantino = async () => {
    const url = volantino;
    setVolantino(null);
    await rimuoviVolantino(url);
  };

  const pubblica = async () => {
    setErrore('');
    // ⚠️ Si azzera PRIMA. Restando acceso, il conteggio della
    // pubblicazione precedente comparirebbe sotto il modulo di quella
    // dopo — anche di una pubblicata senza notifica.
    setAvvisati(null);
    const manca = cosaMancaPerPubblicare({ titolo, testo, volantinoUrl: volantino, visibileFinoA: fino });
    if (manca) { setErrore(manca); return; }
    // ⚠️ Una data gia' passata non e' un errore di battitura innocuo:
    // l'avviso verrebbe scritto e non comparirebbe MAI a nessuno, e
    // l'Admin resterebbe convinto di aver comunicato.
    if (fino < oggiIso()) { setErrore('La data di scadenza è già passata: l’avviso non lo vedrebbe nessuno.'); return; }
    setSalvando(true);
    try {
      const nuovoId = await pubblicaAvviso({
        circoloId: circolo.id,
        categoria,
        titolo: titolo.trim(),
        testo: testo.trim() || undefined,
        volantinoUrl: volantino ?? undefined,
        link: link.trim() || undefined,
        visibileFinoA: fino,
        autoreNome,
      });

      // ⚠️ LA NOTIFICA DOPO, E SEPARATA. Se l'invio fallisce, l'avviso
      // resta in bacheca: la pubblicazione e' la cosa che conta. Legarle
      // in un'operazione sola vorrebbe dire perdere l'avviso per un
      // problema di rete sulla parte accessoria.
      if (conNotifica && puoNotificare) {
        try {
          await mandaNotifica(nuovoId);
        } catch {
          setErrore('L’avviso è stato pubblicato, ma la notifica non è partita. Puoi rimandarla con la campanella, nell’elenco qui sotto.');
        }
      }

      setTitolo(''); setTesto(''); setLink('');
      setVolantino(null);
      setConNotifica(false);
      setFino(scadenzaPredefinita());
    } catch (e: any) {
      setErrore(e?.message ?? 'Non sono riuscito a pubblicare. Riprova.');
    } finally {
      setSalvando(false);
    }
  };

  const elenco = ordinaAvvisi(archivio);
  const idsInOrdine = elenco.map((a) => a.id);

  const sposta = async (indice: number, verso: -1 | 1) => {
    setErrore('');
    setSpostando(true);
    try {
      await spostaAvviso(idsInOrdine, indice, verso);
    } catch (e: any) {
      // Il messaggio vero, quando c'e': «si riordina fra i primi 60» e
      // «qualcuno ha tolto questo avviso» dicono due cose diverse, e si
      // curano in modo diverso da «riprova».
      setErrore(e?.message ?? 'Non sono riuscito a spostare l’avviso. Riprova.');
    } finally {
      setSpostando(false);
    }
  };

  return (
    <div className="admin-card">
      <div className="admin-card-title">Bacheca del circolo</div>
      <p className="admin-card-hint">
        Quello che pubblichi qui compare nella pagina Bacheca dei tuoi soci, e solo dei tuoi.
        Un avviso può avere titolo e testo, titolo e volantino, o tutte e tre le cose insieme.
      </p>

      <input
        className="admin-input" value={titolo} onChange={(e) => setTitolo(e.target.value)}
        placeholder="Titolo dell'avviso" style={{ marginTop: '.6rem' }}
      />
      <textarea
        className="admin-input" value={testo} onChange={(e) => setTesto(e.target.value)}
        rows={4} placeholder="Testo dell'avviso" style={{ marginTop: '.5rem' }}
      />

      {/* ---- Il volantino ---- */}
      <div className="admin-card-hint" style={{ marginTop: '.8rem', fontWeight: 700 }}>Volantino (facoltativo)</div>
      {volantino ? (
        <div className="admin-list-row" style={{ alignItems: 'center' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={volantino} alt="Anteprima del volantino"
            style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 10, border: '1px solid #E4E0D5' }}
          />
          <div style={{ flex: 1 }}>
            <div className="admin-list-main">Volantino allegato</div>
            <div className="admin-list-sub">Nella mattonella si vede ritagliato, nel dettaglio per intero.</div>
          </div>
          <button className="admin-icon-btn danger" onClick={togliVolantino} aria-label="Togli il volantino">🗑</button>
        </div>
      ) : (
        <div className="admin-list-row" style={{ alignItems: 'center' }}>
          <div style={{ flex: 1 }}>
            <input
              type="file" accept="image/*" disabled={caricando}
              onChange={(e) => scegliVolantino(e.target.files?.[0] ?? null)}
            />
            <div className="admin-list-sub">
              {caricando ? 'Sto caricando…' : 'Una foto o una locandina. Non viene ritagliata: un A4 resta un A4.'}
            </div>
          </div>
        </div>
      )}

      {/* ---- Categoria ---- */}
      <div className="admin-card-hint" style={{ marginTop: '.8rem', fontWeight: 700 }}>Categoria</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '.4rem' }}>
        {CATEGORIE_AVVISO.map((c) => (
          <button
            key={c.chiave}
            className="admin-input"
            style={{
              width: 'auto', padding: '.4rem .8rem', fontSize: '.85rem', cursor: 'pointer',
              // Il colore della categoria si vede gia' qui: e' lo stesso
              // che il socio si trovera' sulla mattonella, e sceglierlo
              // alla cieca voleva dire scoprirlo dopo aver pubblicato.
              background: categoria === c.chiave ? c.colore : undefined,
              color: categoria === c.chiave ? '#fff' : undefined,
              borderColor: categoria === c.chiave ? c.colore : undefined,
              fontWeight: categoria === c.chiave ? 800 : 400,
            }}
            onClick={() => setCategoria(c.chiave)}
          >
            {c.nome}
          </button>
        ))}
      </div>

      <input
        className="admin-input" value={link} onChange={(e) => setLink(e.target.value)}
        placeholder="Link (facoltativo), es. la pagina per pagare la quota"
        style={{ marginTop: '.8rem' }}
      />

      {/* ---- Scadenza e PIN ---- */}
      <div className="admin-card-hint" style={{ marginTop: '.8rem', fontWeight: 700 }}>Fino a quando si vede</div>
      <div className="admin-row" style={{ alignItems: 'center', gap: '.6rem' }}>
        <input className="admin-input" type="date" value={fino} onChange={(e) => setFino(e.target.value)} style={{ maxWidth: 200 }} />
        <button
          className="admin-input" style={{ width: 'auto', padding: '.4rem .8rem', cursor: 'pointer' }}
          onClick={() => setFino(scadenzaPredefinita())}
        >
          {GIORNI_AVVISO_PREDEFINITI} giorni
        </button>
      </div>
      {/* ⚠️ QUI C'ERA «Tienilo in cima alla bacheca», sparita insieme
          al pin: la posizione non si sceglie piu' scrivendo l'avviso,
          si sistema dopo con le frecce nell'elenco. */}
      <p className="admin-card-hint">
        L&apos;ordine lo decidi qui sotto con le frecce, la data decide la vita: anche il
        primo avviso della bacheca scade, e qui sotto vedi quando. È quello che evita di
        ritrovarsi a dicembre il foglio appeso a marzo.
      </p>

      {!!errore && <div className="admin-error-text" style={{ marginTop: '.6rem' }}>{errore}</div>}

      {/* ============================================================
          ⚠️ L'INTERRUTTORE CHE FA SQUILLARE DUECENTO TELEFONI.
          Sta qui, subito sopra il pulsante di pubblicazione e non
          sepolto fra i campi, perche' non riguarda COSA si scrive ma CHI
          viene disturbato. Ed e' spento di partenza, e va lasciato
          spento: acceso di serie diventerebbe la cosa che ci si
          dimentica di togliere, e anche «campo 3 bagnato» sveglierebbe
          tutto il circolo.
          ============================================================ */}
      {puoNotificare && (
        <label
          className="admin-row"
          style={{ alignItems: 'flex-start', gap: '.6rem', marginTop: '.9rem', cursor: 'pointer' }}
        >
          <input
            type="checkbox"
            checked={conNotifica}
            onChange={(e) => setConNotifica(e.target.checked)}
            disabled={salvando}
            style={{ marginTop: '.2rem' }}
          />
          <span>
            <span className="admin-card-hint" style={{ fontWeight: 800, display: 'block' }}>
              Manda anche una notifica
            </span>
            <span className="admin-card-hint">
              Arriva sul telefono di tutti i soci del circolo. Non la riceve chi ha spento gli
              avvisi del circolo dalle proprie impostazioni, né — fra le 22 e le 8 — chi ha
              lasciato acceso il «Non disturbare la notte». Per loro l&apos;avviso resta comunque
              in bacheca e in Home: salta il suono, non l&apos;avviso.
            </span>
          </span>
        </label>
      )}

      {/* ⚠️ DUE NUMERI, e la differenza va detta. «Inviata a 200 soci»
          quando ne hanno sentito squillare il telefono 140 e' una bugia
          che l'Admin scopre da solo, e da quel momento non crede piu' a
          nessun numero. */}
      {avvisati !== null && (
        <div className="admin-card-hint" style={{ color: '#1C5F06', fontWeight: 800, marginTop: '.6rem' }}>
          {avvisati.inHome === 0
            ? 'Nessun altro socio da avvisare: nel circolo, per ora, ci sei solo tu.'
            : `L’avviso è in Home di ${avvisati.inHome} ${avvisati.inHome === 1 ? 'socio' : 'soci'}.`
              + (avvisati.sulTelefono === 0
                ? ' Nessuno di loro ha il telefono pronto a riceverla: o non hanno ancora installato l’app, o hanno negato il permesso alle notifiche, o hanno spento gli avvisi del circolo, o sono le ore del «Non disturbare».'
                : avvisati.sulTelefono === avvisati.inHome
                  ? ' La notifica è partita verso tutti.'
                  : ` La notifica è partita verso ${avvisati.sulTelefono} ${avvisati.sulTelefono === 1 ? 'socio' : 'soci'}: gli altri non hanno l’app installata, hanno negato il permesso alle notifiche, hanno spento gli avvisi del circolo, o sono nelle ore del «Non disturbare».`)}
        </div>
      )}

      <button className="admin-btn-full" onClick={pubblica} disabled={salvando || caricando}>
        {salvando ? 'Attendere…' : '+ Appendi in bacheca'}
      </button>

      {/* ---- Archivio ---- */}
      <div className="admin-card-title" style={{ marginTop: '1.4rem' }}>Quello che hai appeso</div>
      {archivioRotto && (
        <div className="admin-error-text">
          Non riesco a leggere quello che hai appeso. Ricarica la pagina fra poco: se pubblichi
          adesso rischi di mettere in bacheca due volte lo stesso avviso.
        </div>
      )}
      {!archivioRotto && elenco.length === 0 && <p className="admin-card-hint">La bacheca è ancora vuota.</p>}
      {elenco.map((a, indice) => {
        const c = categoriaDi(a.categoria);
        const vivo = avvisoDaMostrare(a);
        // ⚠️ Il numero conta SOLO gli avvisi ancora appesi: qui dentro
        // ci sono anche gli scaduti, che il socio non vede, e
        // numerandoli tutti «1» poteva finire su un foglio sparito.
        const posizioneViva = elenco.slice(0, indice + 1).filter((x) => avvisoDaMostrare(x)).length;
        const giorni = giorniAllaScadenza(a);
        return (
          <div key={a.id} className="admin-list-row">
            <span
              title={c.nome}
              style={{
                width: 10, alignSelf: 'stretch', borderRadius: 5,
                background: c.colore, flexShrink: 0,
              }}
            />
            <div style={{ flex: 1 }}>
              <div className="admin-list-main">
                <span className="admin-list-pos">{vivo ? posizioneViva : '—'}</span> {a.titolo}
              </div>
              <div className="admin-list-sub">
                {c.nome}
                {a.volantinoUrl ? ' · con volantino' : ''}
                {' · '}
                {vivo
                  ? `in bacheca fino al ${dataNumerica(a.visibileFinoA)}${giorni <= 3 ? ` (${giorni <= 0 ? 'ultimo giorno' : giorni === 1 ? 'ancora un giorno' : `ancora ${giorni} giorni`})` : ''}`
                  : `scaduto il ${dataNumerica(a.visibileFinoA)} — non lo vedono più`}
              </div>
            </div>
            {/* Allunga di trenta giorni: e' il gesto piu' frequente su
                un avviso in scadenza, e farlo passare da un calendario
                per rimetterci una data e' tre tocchi invece di uno. */}
            <button
              className="admin-icon-btn"
              title="Allunga di 30 giorni"
              onClick={() => {
                setErrore('');
                aggiornaAvviso(a.id, {
                  visibileFinoA: fraGiorni(vivo ? a.visibileFinoA : oggiIso(), GIORNI_AVVISO_PREDEFINITI),
                }).catch(() => setErrore('Non sono riuscito ad allungare la scadenza. Riprova.'));
              }}
            >
              +30
            </button>
            {/* ⚠️ Le frecce hanno preso il posto della puntina, e non
                e' lo stesso gesto con un'altra faccia: la puntina era
                un si'/no, e fra due avvisi appuntati decideva la data.
                Il numero accanto al titolo dice la posizione, e il
                primo e' quello che i soci vedono a tutta larghezza. */}
            {elenco.length > 1 && (
              <>
                <button
                  type="button"
                  className="admin-icon-btn"
                  title="Sposta più in alto"
                  aria-label="Sposta questo avviso più in alto"
                  disabled={spostando || indice === 0}
                  onClick={() => sposta(indice, -1)}
                >
                  ↑
                </button>
                <button
                  type="button"
                  className="admin-icon-btn"
                  title="Sposta più in basso"
                  aria-label="Sposta questo avviso più in basso"
                  disabled={spostando || indice >= elenco.length - 1}
                  onClick={() => sposta(indice, 1)}
                >
                  ↓
                </button>
              </>
            )}
            {puoNotificare && (
              <button
                type="button"
                className="admin-icon-btn"
                title="Manda una notifica per questo avviso"
                aria-label="Manda una notifica per questo avviso"
                disabled={notificando}
                onClick={() => { setErroreNotifica(''); setDaNotificare(a); }}
              >
                🔔
              </button>
            )}
            <button className="admin-icon-btn danger" onClick={() => setDaRimuovere(a)} aria-label="Rimuovi">🗑</button>
          </div>
        );
      })}

      {daNotificare && (
        <div className="admin-modal-backdrop" onClick={() => { if (!notificando) setDaNotificare(null); }}>
          <div className="admin-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="admin-card-title">Mandare la notifica?</div>
            <p className="admin-card-hint">
              &laquo;{daNotificare.titolo}&raquo; arriverà sul telefono di tutti i soci del
              circolo. Non la riceve chi ha spento gli avvisi del circolo dalle proprie
              impostazioni, né — fra le 22 e le 8 — chi ha lasciato acceso il «Non disturbare la
              notte». Puoi rimandarla: in bacheca e in Home resta un avviso solo, quello di prima
              si aggiorna — ma il telefono di tutti squilla di nuovo.
            </p>
            {/* ⚠️ Un avviso scaduto si puo' comunque notificare, ma va
                detto: manderebbe duecento persone a cercare in bacheca
                un foglio che dalla bacheca e' gia' sparito. */}
            {!avvisoDaMostrare(daNotificare) && (
              <p className="admin-error-text">
                Attenzione: questo avviso è scaduto il {dataNumerica(daNotificare.visibileFinoA)} e
                dalla bacheca dei soci non si vede più. Chi tocca la notifica non lo troverebbe:
                allungalo con «+30» prima di mandarla.
              </p>
            )}
            <div className="admin-row" style={{ marginTop: '.8rem' }}>
              <button
                className="admin-input" style={{ cursor: 'pointer' }}
                disabled={notificando}
                onClick={() => setDaNotificare(null)}
              >
                Indietro
              </button>
              <button
                className="admin-btn-full"
                disabled={notificando}
                onClick={async () => {
                  const a = daNotificare;
                  setNotificando(true);
                  setErroreNotifica('');
                  try {
                    await mandaNotifica(a.id);
                    setDaNotificare(null);
                  } catch (e: any) {
                    // ⚠️ La finestra resta aperta: chiudendosi, l'Admin
                    // non saprebbe se ritentare, e la volta dopo
                    // manderebbe un doppione per sicurezza.
                    setErroreNotifica(e?.message ?? 'La notifica non è partita. Riprova.');
                  } finally {
                    setNotificando(false);
                  }
                }}
              >
                {notificando ? 'Attendere…' : 'Sì, manda'}
              </button>
            </div>
            {!!erroreNotifica && (
              <div className="admin-error-text" style={{ marginTop: '.6rem' }}>{erroreNotifica}</div>
            )}
          </div>
        </div>
      )}

      {daRimuovere && (
        <div className="admin-modal-backdrop" onClick={() => setDaRimuovere(null)}>
          <div className="admin-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="admin-card-title">Togliere l&apos;avviso?</div>
            <p className="admin-card-hint">
              &laquo;{daRimuovere.titolo}&raquo; sparirà dalla bacheca dei soci e da questo elenco.
              Non si può annullare: se ti serve ancora l&apos;anno prossimo, conviene lasciarlo
              scadere invece di toglierlo.
            </p>
            <div className="admin-row" style={{ marginTop: '.8rem' }}>
              <button className="admin-input" style={{ cursor: 'pointer' }} onClick={() => setDaRimuovere(null)}>Indietro</button>
              <button
                className="admin-btn-full"
                style={{ background: '#B3261E' }}
                onClick={async () => {
                  const a = daRimuovere;
                  setDaRimuovere(null);
                  setErrore('');
                  try {
                    await rimuoviAvviso(a.id);
                    // Il volantino se ne va con l'avviso: altrimenti
                    // resta nello storage per sempre, pagato e mai piu'
                    // visto.
                    await rimuoviVolantino(a.volantinoUrl);
                  } catch {
                    setErrore('Non sono riuscito a togliere l’avviso. Riprova.');
                  }
                }}
              >
                Sì, togli
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
