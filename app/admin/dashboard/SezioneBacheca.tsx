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
import { pubblicaAvviso, aggiornaAvviso, rimuoviAvviso, ascoltaBachecaAdmin } from '../../../data/bachecaRepo';
import { caricaVolantino, rimuoviVolantino } from '../../../data/storage';
import { oggiIso, fraGiorni, dataNumerica } from '../../../data/giorni';

export default function SezioneBacheca({ circolo, autoreNome }: { circolo: Circolo; autoreNome: string }) {
  const [titolo, setTitolo] = useState('');
  const [testo, setTesto] = useState('');
  const [categoria, setCategoria] = useState(CATEGORIE_AVVISO[0].chiave);
  const [volantino, setVolantino] = useState<string | null>(null);
  const [link, setLink] = useState('');
  const [fino, setFino] = useState(scadenzaPredefinita());
  const [inEvidenza, setInEvidenza] = useState(false);
  const [caricando, setCaricando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [errore, setErrore] = useState('');
  const [archivio, setArchivio] = useState<Avviso[]>([]);
  const [daRimuovere, setDaRimuovere] = useState<Avviso | null>(null);
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
    const manca = cosaMancaPerPubblicare({ titolo, testo, volantinoUrl: volantino, visibileFinoA: fino });
    if (manca) { setErrore(manca); return; }
    // ⚠️ Una data gia' passata non e' un errore di battitura innocuo:
    // l'avviso verrebbe scritto e non comparirebbe MAI a nessuno, e
    // l'Admin resterebbe convinto di aver comunicato.
    if (fino < oggiIso()) { setErrore('La data di scadenza è già passata: l’avviso non lo vedrebbe nessuno.'); return; }
    setSalvando(true);
    try {
      await pubblicaAvviso({
        circoloId: circolo.id,
        categoria,
        titolo: titolo.trim(),
        testo: testo.trim() || undefined,
        volantinoUrl: volantino ?? undefined,
        link: link.trim() || undefined,
        inEvidenza,
        visibileFinoA: fino,
        autoreNome,
      });
      setTitolo(''); setTesto(''); setLink('');
      setVolantino(null); setInEvidenza(false);
      setFino(scadenzaPredefinita());
    } catch (e: any) {
      setErrore(e?.message ?? 'Non sono riuscito a pubblicare. Riprova.');
    } finally {
      setSalvando(false);
    }
  };

  const elenco = ordinaAvvisi(archivio);

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
      <label style={{ display: 'flex', alignItems: 'center', gap: '.5rem', marginTop: '.6rem' }}>
        <input type="checkbox" checked={inEvidenza} onChange={(e) => setInEvidenza(e.target.checked)} />
        <span style={{ fontWeight: 700 }}>Tienilo in cima alla bacheca</span>
      </label>
      <p className="admin-card-hint">
        Il &laquo;in cima&raquo; decide la posizione, la data decide la vita: anche un avviso in
        cima scade, e qui sotto vedi quando. È quello che evita di ritrovarsi a dicembre il
        foglio appeso a marzo.
      </p>

      {!!errore && <div className="admin-error-text" style={{ marginTop: '.6rem' }}>{errore}</div>}

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
      {elenco.map((a) => {
        const c = categoriaDi(a.categoria);
        const vivo = avvisoDaMostrare(a);
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
                {a.inEvidenza ? '📌 ' : ''}{a.titolo}
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
            <button
              className="admin-icon-btn"
              title={a.inEvidenza ? 'Togli dalla cima' : 'Tieni in cima'}
              onClick={() => {
                setErrore('');
                aggiornaAvviso(a.id, { inEvidenza: !a.inEvidenza })
                  .catch(() => setErrore('Non sono riuscito a cambiare la posizione dell’avviso. Riprova.'));
              }}
            >
              📌
            </button>
            <button className="admin-icon-btn danger" onClick={() => setDaRimuovere(a)} aria-label="Rimuovi">🗑</button>
          </div>
        );
      })}

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
