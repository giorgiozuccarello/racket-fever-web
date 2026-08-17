'use client';

// ============================================================
// BANNER MARKETING — gli sponsor che vendiamo noi.
//
// Compaiono nella fascia dei circoli coperti SENZA che il circolo li
// carichi, li ordini o li possa togliere. E' il senso della sezione, ed
// e' anche quello che va detto a chi la usa: quello che si pubblica
// qui arriva sui telefoni dei soci di ogni circolo che sta nella zona
// scelta, entro pochi secondi.
//
// ⚠️ LA POSIZIONE NELLA ROTAZIONE NON SI SCEGLIE. Un circolo puo' aver
// promesso al proprio Main Sponsor di stare per primo: un banner
// nostro che si mettesse davanti romperebbe quell'accordo senza che
// nessuno dei due lo sappia. Qui si decide DOVE e PER QUANTO; il posto
// lo decide l'alternanza — uno del circolo, uno nostro, e cosi' via.
// ============================================================

import { useEffect, useMemo, useRef, useState } from 'react';
import { REGIONI_ITALIA, PROVINCE_PER_REGIONE, TUTTE_LE_PROVINCE } from '../../../data/tornei';
import {
  BannerRete, CoperturaTipo, DURATE_BANNER_RETE, DURATA_BANNER_RETE_PREDEFINITA,
  MAX_BANNER_RETE, zoneDi, bannerInCorso,
} from '../../../data/bannerRete';
import {
  ascoltaTuttiBannerRete, creaBannerRete, aggiornaBannerRete, rimuoviBannerRete,
  ascoltaNoteRete, scriviNotaRete, rimuoviNotaRete,
} from '../../../data/bannerReteRepo';
import { caricaBannerRete } from '../../../data/storage';
import { Circolo, statoCircolo } from '../../../data/circoli';
// ⚠️ La data di oggi si chiede a data/giorni, non si ricalcola qui: e'
// lo stesso «oggi» che usa il repo per decidere se un banner e' in
// corso, e due versioni divergerebbero al primo fuso orario.
import { oggiIso } from '../../../data/giorni';
import { ascoltaCircoli } from '../../../data/circoliRepo';

export default function SezioneBannerRete() {
  const [banner, setBanner] = useState<BannerRete[]>([]);
  // Le note stanno in una collezione a parte, che leggono solo i Super
  // Admin: sul banner sarebbero state pubbliche dentro l'app.
  const [note, setNote] = useState<Record<string, string>>({});
  const [circoli, setCircoli] = useState<Circolo[]>([]);
  const [errore, setErrore] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [daRimuovere, setDaRimuovere] = useState<BannerRete | null>(null);

  // Il modulo del banner nuovo.
  const [immagineUrl, setImmagineUrl] = useState('');
  const [inCarico, setInCarico] = useState(false);
  const [durata, setDurata] = useState(DURATA_BANNER_RETE_PREDEFINITA);
  const [copertura, setCopertura] = useState<CoperturaTipo>('italia');
  const [regioni, setRegioni] = useState<string[]>([]);
  const [province, setProvince] = useState<string[]>([]);
  const [daGiorno, setDaGiorno] = useState('');
  const [aGiorno, setAGiorno] = useState('');
  const [nota, setNota] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => ascoltaTuttiBannerRete(setBanner, () => setErrore('Non riesco a leggere i banner.')), []);
  useEffect(() => ascoltaCircoli(setCircoli), []);
  useEffect(() => ascoltaNoteRete(setNote), []);


  // Le province fra cui scegliere: se sono state selezionate delle
  // regioni si mostrano solo le loro, altrimenti tutte. Cosi' chi
  // vende «Sicilia, province di Messina e Catania» non scorre
  // centosette voci.
  const provinceDisponibili = useMemo(() => {
    if (regioni.length === 0) return TUTTE_LE_PROVINCE;
    return regioni.flatMap((r) => PROVINCE_PER_REGIONE[r] ?? []);
  }, [regioni]);

  // ⚠️ Una provincia scelta e poi finita fuori elenco resterebbe
  // VENDUTA senza che si veda piu': deselezionando la sua regione, il
  // suo riquadro sparisce dal modulo ma la provincia era ancora nello
  // stato, e finiva nelle zone del banner.
  useEffect(() => {
    setProvince((p) => p.filter((x) => provinceDisponibili.includes(x)));
  }, [provinceDisponibili]);

  const zone = zoneDi(copertura, regioni, province);

  // ⚠️ Quanti banner coprono GIA' questa zona. Oltre il massimo il
  // repo taglia in silenzio: l'undicesimo si pubblicherebbe, si
  // fatturerebbe, e non comparirebbe mai a nessuno. Meglio dirlo prima
  // di venderlo.
  const giaSullaZona = useMemo(() => {
    if (zone.length === 0) return 0;
    return banner.filter((b) => bannerInCorso(b, oggiIso()))
      .filter((b) => (b.zone ?? []).some((z) => z === 'ITALIA' || zone.includes(z)))
      .length;
  }, [banner, zone]);

  // ⚠️ Quanti circoli vedra' DAVVERO questo banner, e quanti restano
  // fuori perche' non hanno l'anagrafica completa. E' il numero che
  // evita la telefonata dello sponsor che chiede perche' a Messina non
  // lo vede nessuno: senza provincia scritta sul circolo, un banner
  // provinciale non lo raggiunge.
  // ⚠️ Solo i circoli ATTIVI: un sospeso o un chiuso non mostra niente
  // a nessuno, e contarlo vorrebbe dire promettere a uno sponsor una
  // copertura che non esiste.
  const attivi = useMemo(() => circoli.filter((c) => statoCircolo(c) === 'attivo'), [circoli]);

  const copertiOra = useMemo(() => {
    if (copertura === 'italia') return attivi.length;
    if (copertura === 'regioni') return attivi.filter((c) => c.regione && regioni.includes(c.regione)).length;
    return attivi.filter((c) => c.provincia && province.includes(c.provincia)).length;
  }, [attivi, copertura, regioni, province]);

  const senzaAnagrafica = useMemo(() => {
    if (copertura === 'regioni') return attivi.filter((c) => !c.regione).length;
    if (copertura === 'province') return attivi.filter((c) => !c.provincia).length;
    return 0;
  }, [attivi, copertura]);

  const cambia = (elenco: string[], voce: string): string[] =>
    (elenco.includes(voce) ? elenco.filter((x) => x !== voce) : [...elenco, voce]);

  const gestisciFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setErrore('');
    setInCarico(true);
    try {
      setImmagineUrl(await caricaBannerRete(file));
    } catch (err: any) {
      setErrore(err?.message ?? 'Caricamento non riuscito. Riprova.');
    } finally {
      setInCarico(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const pubblica = async () => {
    setErrore('');
    if (!immagineUrl) { setErrore("Carica prima l'immagine del banner."); return; }
    if (zone.length === 0) {
      setErrore(copertura === 'regioni' ? 'Scegli almeno una regione.' : 'Scegli almeno una provincia.');
      return;
    }
    if (daGiorno && aGiorno && aGiorno < daGiorno) { setErrore('La data di fine viene prima di quella di inizio.'); return; }
    setSalvando(true);
    try {
      // ⚠️ `undefined` e non `null` sui facoltativi. `ripulisci` scarta
      // gli undefined e il campo non viene proprio scritto; con un null
      // il campo esiste, vale null, e una regola che lo controlla con
      // .get(campo, '') non riceve la stringa vuota ma il null — che
      // non e' «vuoto», e' un errore di valutazione, cioe' scrittura
      // respinta. Sarebbe fallita ogni pubblicazione.
      const id = await creaBannerRete({
        immagineUrl,
        durata,
        copertura,
        regioni: copertura === 'regioni' ? regioni : undefined,
        province: copertura === 'province' ? province : undefined,
        zone,
        daGiorno: daGiorno || undefined,
        aGiorno: aGiorno || undefined,
      });
      if (nota.trim()) {
        // Non blocca: il banner e' pubblicato, la nota e' roba nostra.
        try { await scriviNotaRete(id, nota); }
        catch { setErrore('Il banner è pubblicato, ma la nota interna non si è salvata.'); }
      }
      setImmagineUrl(''); setNota(''); setDaGiorno(''); setAGiorno('');
      setRegioni([]); setProvince([]); setCopertura('italia');
      setDurata(DURATA_BANNER_RETE_PREDEFINITA);
    } catch (err: any) {
      setErrore(err?.message ?? 'Non sono riuscito a pubblicare il banner.');
    } finally {
      setSalvando(false);
    }
  };

  const oggi = oggiIso();

  return (
    <div className="admin-card">
      <div className="admin-card-title">Banner marketing</div>
      <p className="admin-card-hint">
        Questi banner entrano nella fascia sponsor dei circoli coperti, in mezzo ai loro:
        uno del circolo, uno nostro, e così via. Il circolo non li vede nel suo pannello e non
        può toglierli. La posizione non si sceglie apposta — così non si scavalcano gli accordi
        che il circolo ha preso con i propri sponsor. Al massimo ne compaiono
        {' '}{MAX_BANNER_RETE} per circolo.
      </p>

      <div className="admin-row" style={{ alignItems: 'center', gap: '.6rem', marginTop: '.8rem' }}>
        <button type="button" className="admin-input" style={{ width: 'auto', cursor: 'pointer' }}
          onClick={() => inputRef.current?.click()} disabled={inCarico}>
          {inCarico ? 'Carico…' : immagineUrl ? 'Cambia immagine' : 'Carica immagine'}
        </button>
        <span className="admin-card-hint" style={{ margin: 0 }}>
          JPEG, PNG, WebP o GIF animata. Proporzione 3:1 (1200×400).
        </span>
      </div>
      <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif"
        style={{ display: 'none' }} onChange={gestisciFile} />

      {immagineUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={immagineUrl} alt="Anteprima del banner"
          style={{ width: '100%', maxWidth: 420, aspectRatio: '3 / 1', objectFit: 'cover', borderRadius: 10, marginTop: '.6rem' }} />
      )}

      <div className="admin-card-hint" style={{ marginTop: '.9rem', fontWeight: 700 }}>Dove si vede</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '.4rem', marginBottom: '.5rem' }}>
        {([['italia', 'Tutta Italia'], ['regioni', 'Regioni'], ['province', 'Province']] as [CoperturaTipo, string][])
          .map(([valore, etichetta]) => (
            <button key={valore} type="button"
              className={copertura === valore ? 'admin-btn-full' : 'admin-input'}
              style={{ flex: '0 0 auto', minWidth: 0, marginTop: 0, width: 'auto', padding: '.35rem .7rem', fontSize: '.85rem', cursor: 'pointer' }}
              onClick={() => setCopertura(valore)}>
              {etichetta}
            </button>
          ))}
      </div>

      {copertura !== 'italia' && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '.35rem', marginBottom: '.5rem' }}>
          {REGIONI_ITALIA.map((r) => (
            <button key={r} type="button"
              className={regioni.includes(r) ? 'admin-btn-full' : 'admin-input'}
              style={{ flex: '0 0 auto', minWidth: 0, marginTop: 0, width: 'auto', padding: '.3rem .6rem', fontSize: '.78rem', cursor: 'pointer' }}
              onClick={() => setRegioni((e) => cambia(e, r))}>
              {r}
            </button>
          ))}
        </div>
      )}

      {copertura === 'province' && (
        <>
          <div className="admin-card-hint" style={{ marginTop: '.2rem' }}>
            {regioni.length === 0
              ? 'Scegli una regione qui sopra per accorciare l’elenco, oppure prendi le province direttamente da tutte e centosette.'
              : 'Le province delle regioni che hai scelto:'}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '.35rem', marginBottom: '.5rem', maxHeight: 220, overflowY: 'auto' }}>
            {provinceDisponibili.map((pr) => (
              <button key={pr} type="button"
                className={province.includes(pr) ? 'admin-btn-full' : 'admin-input'}
                style={{ flex: '0 0 auto', minWidth: 0, marginTop: 0, width: 'auto', padding: '.3rem .6rem', fontSize: '.78rem', cursor: 'pointer' }}
                onClick={() => setProvince((e) => cambia(e, pr))}>
                {pr}
              </button>
            ))}
          </div>
        </>
      )}

      <p className="admin-card-hint">
        Lo vedrebbero <strong>{copertiOra}</strong> circoli attivi su {attivi.length}.
        {senzaAnagrafica > 0 && (
          <>
            {' '}⚠️ {senzaAnagrafica} {senzaAnagrafica === 1 ? 'circolo non ha' : 'circoli non hanno'}
            {copertura === 'province' ? ' la provincia' : ' la regione'} nell’anagrafica: a
            {senzaAnagrafica === 1 ? ' quello' : ' quelli'} non arriverà.
          </>
        )}
      </p>

      <div className="admin-row" style={{ alignItems: 'center', gap: '.6rem', marginTop: '.6rem' }}>
        <span style={{ fontWeight: 700, fontSize: '.9rem' }}>Durata:</span>
        {DURATE_BANNER_RETE.map((d) => (
          <button key={d} type="button"
            className={durata === d ? 'admin-btn-full' : 'admin-input'}
            style={{ flex: '0 0 auto', minWidth: 0, marginTop: 0, width: 'auto', padding: '.3rem .65rem', fontSize: '.85rem', cursor: 'pointer' }}
            onClick={() => setDurata(d)}>
            {d}s
          </button>
        ))}
      </div>

      <div className="admin-row" style={{ gap: '.6rem', marginTop: '.6rem' }}>
        <div style={{ flex: 1 }}>
          <label className="admin-card-hint" htmlFor="rete-da">Dal (facoltativo)</label>
          <input id="rete-da" className="admin-input" type="date" value={daGiorno} onChange={(e) => setDaGiorno(e.target.value)} />
        </div>
        <div style={{ flex: 1 }}>
          <label className="admin-card-hint" htmlFor="rete-a">Al (facoltativo)</label>
          <input id="rete-a" className="admin-input" type="date" value={aGiorno} onChange={(e) => setAGiorno(e.target.value)} />
        </div>
      </div>

      <input className="admin-input" style={{ marginTop: '.6rem' }} value={nota}
        onChange={(e) => setNota(e.target.value)} maxLength={2000}
        placeholder="Nota interna: sponsor, importo, referente (non esce da qui)" />

      {giaSullaZona >= MAX_BANNER_RETE && (
        <p className="admin-card-hint" style={{ color: '#B3261E' }}>
          ⚠️ Su questa zona ci sono già {giaSullaZona} banner in rotazione, e il massimo per
          circolo è {MAX_BANNER_RETE}: questo non comparirebbe. Togline uno prima di venderlo.
        </p>
      )}

      {!!errore && <div className="admin-error-text" style={{ marginTop: '.6rem' }}>{errore}</div>}
      <button className="admin-btn-full" onClick={pubblica} disabled={salvando || inCarico}>
        {salvando ? 'Pubblico…' : '+ Pubblica banner'}
      </button>

      <div className="admin-card-title" style={{ marginTop: '1.4rem' }}>Banner pubblicati</div>
      {banner.length === 0 && <p className="admin-card-hint">Non ce n’è ancora nessuno.</p>}
      {banner.map((b) => {
        const inCorso = bannerInCorso(b, oggi);
        const dove = b.copertura === 'italia'
          ? 'Tutta Italia'
          : b.copertura === 'regioni'
            ? (b.regioni ?? []).join(', ')
            : (b.province ?? []).join(', ');
        return (
          <div key={b.id} className="admin-list-row">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={b.immagineUrl} alt="" style={{ width: 96, aspectRatio: '3 / 1', objectFit: 'cover', borderRadius: 6, flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div className="admin-list-main">{dove || '— nessuna zona —'}</div>
              <div className="admin-list-sub">
                {b.durata}s · {inCorso ? 'in rotazione' : 'fuori periodo, non si vede'}
                {b.daGiorno || b.aGiorno ? ` · ${b.daGiorno || '…'} → ${b.aGiorno || '…'}` : ''}
                {note[b.id] ? ` · ${note[b.id]}` : ''}
              </div>
            </div>
            <select className="admin-input" style={{ width: 'auto', flex: '0 0 auto', minWidth: 0 }}
              value={b.durata}
              onChange={(e) => aggiornaBannerRete(b.id, { durata: Number(e.target.value) })
                .catch(() => setErrore('Non sono riuscito a cambiare la durata.'))}>
              {DURATE_BANNER_RETE.map((d) => <option key={d} value={d}>{d}s</option>)}
            </select>
            <button className="admin-icon-btn danger" onClick={() => setDaRimuovere(b)} aria-label="Rimuovi">🗑</button>
          </div>
        );
      })}

      {daRimuovere && (
        <div className="admin-modal-backdrop" onClick={() => setDaRimuovere(null)}>
          <div className="admin-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="admin-card-title">Togliere questo banner?</div>
            <p className="admin-card-hint">
              Sparisce subito da tutti i circoli che lo stanno mostrando. L’immagine resta sul
              nostro archivio, ma nessuno la vedrà più.
            </p>
            <div className="admin-row" style={{ gap: '.6rem', marginTop: '.8rem' }}>
              <button className="admin-input" style={{ cursor: 'pointer' }} onClick={() => setDaRimuovere(null)}>Indietro</button>
              <button className="admin-btn-full" style={{ background: '#B3261E' }} onClick={async () => {
                const b = daRimuovere;
                setDaRimuovere(null);
                try { await rimuoviBannerRete(b.id); await rimuoviNotaRete(b.id); }
                catch { setErrore('Non sono riuscito a togliere il banner.'); }
              }}>Togli</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
