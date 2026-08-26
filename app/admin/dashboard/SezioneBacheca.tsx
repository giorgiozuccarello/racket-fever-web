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
  GIORNI_AVVISO_PREDEFINITI, Categoria,
} from '../../../data/bacheca';
import { useLingua } from '../../../lib/lingua';
import { Traduttore } from '../../../data/testi';

// ⚠️ IL NOME DELLA CATEGORIA NON SI LEGGE PIÙ DA `c.nome`, e la ragione
// e' che `CATEGORIE_AVVISO` vive in `data/bacheca.ts`, un file condiviso
// con l'app che questa tornata non tocca: li' dentro `nome` resta
// italiano ed e' giusto cosi'. Quello che viaggia e' la CHIAVE —
// 'quote', 'chiusure', 'mercatino' — e la chiave e' un codice, non una
// parola: qui davanti la si trasforma in una frase tradotta.
// Il ripiego e' `c.nome`: se un giorno l'elenco di la' guadagna una
// categoria nuova e nessuno aggiunge la riga nel dizionario, a schermo
// esce il nome italiano invece di una chiave nuda.
function nomeCategoria(t: Traduttore, c: Categoria): string {
  const tradotto = t(`adm.bac.cat.${c.chiave}` as any);
  return tradotto === `adm.bac.cat.${c.chiave}` ? c.nome : tradotto;
}
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
  const { t } = useLingua();
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
      setErrore(e?.message ?? t('adm.bac.erroreCaricaVolantino'));
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
    // ⚠️ IL GIUDICE RESTA `cosaMancaPerPubblicare`, LA FRASE NO.
    // Quella funzione decide se si puo' pubblicare — e continua a
    // deciderlo lei, perche' la stessa regola vale sul sito e
    // sull'app — ma la frase che restituisce e' italiana e vive in
    // `data/bacheca.ts`, che questa tornata non tocca. Qui si guarda lo
    // stesso terzetto di condizioni, nello stesso ordine, solo per
    // scegliere quale frase tradotta mostrare. Se un giorno le
    // condizioni cambiano di la', vanno cambiate anche qui: sono tre
    // righe, e l'alternativa era rifare il controllo dentro la
    // dashboard e ritrovarsi due regole che divergono.
    const manca = cosaMancaPerPubblicare({ titolo, testo, volantinoUrl: volantino, visibileFinoA: fino });
    if (manca) {
      setErrore(!titolo.trim()
        ? t('adm.bac.mancaTitolo')
        : (!testo.trim() && !volantino)
          ? t('adm.bac.mancaTestoOVolantino')
          : t('adm.bac.mancaData'));
      return;
    }
    // ⚠️ Una data gia' passata non e' un errore di battitura innocuo:
    // l'avviso verrebbe scritto e non comparirebbe MAI a nessuno, e
    // l'Admin resterebbe convinto di aver comunicato.
    if (fino < oggiIso()) { setErrore(t('adm.bac.dataPassata')); return; }
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
          setErrore(t('adm.bac.pubblicatoSenzaNotifica'));
        }
      }

      setTitolo(''); setTesto(''); setLink('');
      setVolantino(null);
      setConNotifica(false);
      setFino(scadenzaPredefinita());
    } catch (e: any) {
      setErrore(e?.message ?? t('adm.bac.errorePubblica'));
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
      setErrore(e?.message ?? t('adm.bac.erroreSposta'));
    } finally {
      setSpostando(false);
    }
  };

  return (
    <div className="admin-card">
      <div className="admin-card-title">{t('adm.bac.titolo')}</div>
      <p className="admin-card-hint">
        {t('adm.bac.sottotitolo')}
      </p>

      {/* ⚠️ SI TRADUCE LA CORNICE, NON IL FOGLIO. Questi due campi
          restano vuoti e li riempie l'Admin: quello che ci scrive dentro
          — il titolo dell'avviso, il testo del volantino — e' suo, e non
          passa mai da `t(...)`. Tradotto e' solo l'invito grigio che
          sparisce al primo carattere. */}
      <input
        className="admin-input" value={titolo} onChange={(e) => setTitolo(e.target.value)}
        placeholder={t('adm.bac.phTitolo')} style={{ marginTop: '.6rem' }}
      />
      <textarea
        className="admin-input" value={testo} onChange={(e) => setTesto(e.target.value)}
        rows={4} placeholder={t('adm.bac.phTesto')} style={{ marginTop: '.5rem' }}
      />

      {/* ---- Il volantino ---- */}
      <div className="admin-card-hint" style={{ marginTop: '.8rem', fontWeight: 700 }}>{t('adm.bac.volantinoFacoltativo')}</div>
      {volantino ? (
        <div className="admin-list-row" style={{ alignItems: 'center' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={volantino} alt={t('adm.bac.altAnteprima')}
            style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 10, border: '1px solid #E4E0D5' }}
          />
          <div style={{ flex: 1 }}>
            <div className="admin-list-main">{t('adm.bac.volantinoAllegato')}</div>
            <div className="admin-list-sub">{t('adm.bac.volantinoSpiega')}</div>
          </div>
          <button className="admin-icon-btn danger" onClick={togliVolantino} aria-label={t('adm.bac.togliVolantino')}>🗑</button>
        </div>
      ) : (
        <div className="admin-list-row" style={{ alignItems: 'center' }}>
          <div style={{ flex: 1 }}>
            <input
              type="file" accept="image/*" disabled={caricando}
              onChange={(e) => scegliVolantino(e.target.files?.[0] ?? null)}
            />
            <div className="admin-list-sub">
              {caricando ? t('adm.bac.stoCaricando') : t('adm.bac.volantinoIstruzioni')}
            </div>
          </div>
        </div>
      )}

      {/* ---- Categoria ---- */}
      <div className="admin-card-hint" style={{ marginTop: '.8rem', fontWeight: 700 }}>{t('adm.bac.categoria')}</div>
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
            {nomeCategoria(t, c)}
          </button>
        ))}
      </div>

      <input
        className="admin-input" value={link} onChange={(e) => setLink(e.target.value)}
        placeholder={t('adm.bac.phLink')}
        style={{ marginTop: '.8rem' }}
      />

      {/* ---- Scadenza e PIN ---- */}
      <div className="admin-card-hint" style={{ marginTop: '.8rem', fontWeight: 700 }}>{t('adm.bac.finoAQuando')}</div>
      <div className="admin-row" style={{ alignItems: 'center', gap: '.6rem' }}>
        <input className="admin-input" type="date" value={fino} onChange={(e) => setFino(e.target.value)} style={{ maxWidth: 200 }} />
        <button
          className="admin-input" style={{ width: 'auto', padding: '.4rem .8rem', cursor: 'pointer' }}
          onClick={() => setFino(scadenzaPredefinita())}
        >
          {t('adm.bac.giorniPulsante', { n: GIORNI_AVVISO_PREDEFINITI })}
        </button>
      </div>
      {/* ⚠️ QUI C'ERA «Tienilo in cima alla bacheca», sparita insieme
          al pin: la posizione non si sceglie piu' scrivendo l'avviso,
          si sistema dopo con le frecce nell'elenco. */}
      <p className="admin-card-hint">
        {t('adm.bac.ordineSpiega')}
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
              {t('adm.bac.mandaNotifica')}
            </span>
            <span className="admin-card-hint">
              {t('adm.bac.notificaSpiega')}
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
          {/* ⚠️ DUE FRASI INTERE ACCOSTATE, e non piu' pezzi cuciti. La
              prima dice quanti hanno l'avviso in Home, la seconda quanti
              hanno sentito squillare: restano due periodi separati anche
              in tedesco, dove il verbo va in fondo e un pezzo di frase
              staccato non si sarebbe potuto incollare all'altro. */}
          {avvisati.inHome === 0
            ? t('adm.bac.nessunoDaAvvisare')
            : `${avvisati.inHome === 1
              ? t('adm.bac.inHomeUno', { n: avvisati.inHome })
              : t('adm.bac.inHomeTanti', { n: avvisati.inHome })} ${avvisati.sulTelefono === 0
              ? t('adm.bac.nessunTelefono')
              : avvisati.sulTelefono === avvisati.inHome
                ? t('adm.bac.notificaATutti')
                : avvisati.sulTelefono === 1
                  ? t('adm.bac.notificaVersoUno', { n: avvisati.sulTelefono })
                  : t('adm.bac.notificaVersoTanti', { n: avvisati.sulTelefono })}`}
        </div>
      )}

      <button className="admin-btn-full" onClick={pubblica} disabled={salvando || caricando}>
        {salvando ? t('com.attendi') : `+ ${t('adm.bac.appendi')}`}
      </button>

      {/* ---- Archivio ---- */}
      <div className="admin-card-title" style={{ marginTop: '1.4rem' }}>{t('adm.bac.archivioTitolo')}</div>
      {archivioRotto && (
        <div className="admin-error-text">
          {t('adm.bac.archivioRotto')}
        </div>
      )}
      {!archivioRotto && elenco.length === 0 && <p className="admin-card-hint">{t('adm.bac.bachecaVuota')}</p>}
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
              title={nomeCategoria(t, c)}
              style={{
                width: 10, alignSelf: 'stretch', borderRadius: 5,
                background: c.colore, flexShrink: 0,
              }}
            />
            <div style={{ flex: 1 }}>
              <div className="admin-list-main">
                <span className="admin-list-pos">{vivo ? posizioneViva : t('com.nessunDato')}</span> {a.titolo}
              </div>
              <div className="admin-list-sub">
                {nomeCategoria(t, c)}
                {a.volantinoUrl ? ` · ${t('adm.bac.conVolantino')}` : ''}
                {' · '}
                {vivo
                  ? `${t('adm.bac.inBachecaFinoAl', { data: dataNumerica(a.visibileFinoA) })}${giorni <= 3 ? ` (${giorni <= 0 ? t('adm.bac.ultimoGiorno') : giorni === 1 ? t('adm.bac.ancoraUnGiorno') : t('adm.bac.ancoraGiorni', { n: giorni })})` : ''}`
                  : t('adm.bac.scadutoIl', { data: dataNumerica(a.visibileFinoA) })}
              </div>
            </div>
            {/* Allunga di trenta giorni: e' il gesto piu' frequente su
                un avviso in scadenza, e farlo passare da un calendario
                per rimetterci una data e' tre tocchi invece di uno. */}
            <button
              className="admin-icon-btn"
              // ⚠️ Il «30» adesso arriva da `GIORNI_AVVISO_PREDEFINITI`,
              // che e' lo stesso numero che il tasto applica davvero:
              // era scritto a mano nel suggerimento, e il giorno che
              // quella costante cambia il tasto avrebbe promesso trenta
              // giorni e dato altro.
              title={t('adm.bac.allunga', { n: GIORNI_AVVISO_PREDEFINITI })}
              onClick={() => {
                setErrore('');
                aggiornaAvviso(a.id, {
                  visibileFinoA: fraGiorni(vivo ? a.visibileFinoA : oggiIso(), GIORNI_AVVISO_PREDEFINITI),
                }).catch(() => setErrore(t('adm.bac.erroreAllunga')));
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
                  title={t('adm.bac.spostaSu')}
                  aria-label={t('adm.bac.spostaSuAria')}
                  disabled={spostando || indice === 0}
                  onClick={() => sposta(indice, -1)}
                >
                  ↑
                </button>
                <button
                  type="button"
                  className="admin-icon-btn"
                  title={t('adm.bac.spostaGiu')}
                  aria-label={t('adm.bac.spostaGiuAria')}
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
                title={t('adm.bac.notificaQuesto')}
                aria-label={t('adm.bac.notificaQuesto')}
                disabled={notificando}
                onClick={() => { setErroreNotifica(''); setDaNotificare(a); }}
              >
                🔔
              </button>
            )}
            <button className="admin-icon-btn danger" onClick={() => setDaRimuovere(a)} aria-label={t('adm.bac.rimuovi')}>🗑</button>
          </div>
        );
      })}

      {daNotificare && (
        <div className="admin-modal-backdrop" onClick={() => { if (!notificando) setDaNotificare(null); }}>
          <div className="admin-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="admin-card-title">{t('adm.bac.mandareTitolo')}</div>
            {/* ⚠️ LE VIRGOLETTE STANNO DENTRO LA CHIAVE, non piu' qui
                come `&laquo;`/`&raquo;`: le caporali sono italiane,
                l'inglese usa le doppie alte e il tedesco apre in basso.
                Il titolo dentro resta quello che ha scritto l'Admin. */}
            <p className="admin-card-hint">
              {t('adm.bac.mandareSpiega', { titolo: daNotificare.titolo })}
            </p>
            {/* ⚠️ Un avviso scaduto si puo' comunque notificare, ma va
                detto: manderebbe duecento persone a cercare in bacheca
                un foglio che dalla bacheca e' gia' sparito. */}
            {!avvisoDaMostrare(daNotificare) && (
              <p className="admin-error-text">
                {t('adm.bac.avvisoScadutoNotifica', {
                  data: dataNumerica(daNotificare.visibileFinoA),
                  n: GIORNI_AVVISO_PREDEFINITI,
                })}
              </p>
            )}
            <div className="admin-row" style={{ marginTop: '.8rem' }}>
              <button
                className="admin-input" style={{ cursor: 'pointer' }}
                disabled={notificando}
                onClick={() => setDaNotificare(null)}
              >
                {t('com.indietro')}
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
                    setErroreNotifica(e?.message ?? t('adm.bac.notificaFallita'));
                  } finally {
                    setNotificando(false);
                  }
                }}
              >
                {notificando ? t('com.attendi') : t('adm.bac.siManda')}
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
            <div className="admin-card-title">{t('adm.bac.togliereTitolo')}</div>
            <p className="admin-card-hint">
              {t('adm.bac.togliereSpiega', { titolo: daRimuovere.titolo })}
            </p>
            <div className="admin-row" style={{ marginTop: '.8rem' }}>
              <button className="admin-input" style={{ cursor: 'pointer' }} onClick={() => setDaRimuovere(null)}>{t('com.indietro')}</button>
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
                    setErrore(t('adm.bac.erroreTogli'));
                  }
                }}
              >
                {t('adm.bac.siTogli')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
