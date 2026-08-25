'use client';

import { useEffect, useRef, useState } from 'react';
import { Circolo } from '../../../data/circoli';
import {
  DatiBonifico, ascoltaBonifico, salvaBonifico, cancellaBonifico,
  ibanValido, ibanNormalizzato, ibanLeggibile,
} from '../../../data/bonifico';

// ⚠️ GEMELLA della SezioneBonifico nella dashboard mobile.
//
// I dati NON stanno sul documento del circolo: stanno in
// `riservato/bonifico`, che leggono solo i membri del circolo. Il
// documento del circolo lo legge chiunque sia autenticato, e l'IBAN di
// un'associazione vera non si regala a chiunque abbia scaricato l'app.
// Vedi il riquadro in `data/bonifico.ts`.
export default function SezioneBonifico({ circolo }: { circolo: Circolo }) {
  const [dati, setDati] = useState<DatiBonifico | null>(null);
  const [intestatario, setIntestatario] = useState('');
  const [iban, setIban] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [salvato, setSalvato] = useState(false);
  const [errore, setErrore] = useState('');
  // Vero appena si tocca un campo: fino a quel momento la schermata
  // segue il documento, dopo segue le dita. Senza, l'arrivo di uno
  // snapshot in mezzo alla digitazione riscriveva sopra quello che si
  // stava scrivendo.
  const toccato = useRef(false);

  useEffect(() => {
    return ascoltaBonifico(circolo.id, (d) => {
      setDati(d);
      if (toccato.current) return;
      setIntestatario(d?.intestatario ?? '');
      setIban(d ? ibanLeggibile(d.iban) : '');
    });
  }, [circolo.id]);

  const ibanPulito = ibanNormalizzato(iban);
  // ⚠️ Tre stati e non due: vuoto non è sbagliato. Segnare in rosso un
  // campo che nessuno ha ancora compilato fa sembrare rotto qualcosa che
  // nessuno ha ancora toccato.
  const ibanInErrore = ibanPulito.length > 0 && !ibanValido(ibanPulito);
  const completo = intestatario.trim().length > 0 && ibanValido(ibanPulito);

  const salva = async () => {
    if (!completo) return;
    setSalvando(true);
    setErrore('');
    try {
      await salvaBonifico(circolo.id, { intestatario: intestatario.trim(), iban: ibanPulito });
      toccato.current = false;
      setIban(ibanLeggibile(ibanPulito));
      setSalvato(true);
      setTimeout(() => setSalvato(false), 2000);
    } catch {
      setErrore('Non è stato possibile salvare. Controlla la connessione e riprova.');
    } finally {
      setSalvando(false);
    }
  };

  const togli = async () => {
    setSalvando(true);
    setErrore('');
    try {
      await cancellaBonifico(circolo.id);
      toccato.current = false;
      setIntestatario('');
      setIban('');
    } catch {
      setErrore('Non è stato possibile togliere i dati. Riprova.');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="admin-card">
      <div className="admin-card-title">Dati per il bonifico</div>
      <p className="admin-card-hint">
        Il conto del circolo su cui i soci versano per ricaricare il credito. Finché questi
        due campi sono vuoti, nell&apos;app dei soci non compare nessun pulsante «Ricarica».
        Il credito NON si carica da solo: lo carichi tu dalla scheda del socio quando vedi
        l&apos;accredito sul conto.
      </p>

      <label className="admin-label">Intestatario del conto</label>
      <input
        className="admin-input"
        value={intestatario}
        onChange={(e) => { toccato.current = true; setIntestatario(e.target.value); }}
        placeholder="ASD Tennis Milazzo"
      />

      <label className="admin-label" style={{ marginTop: '.8rem', display: 'block' }}>IBAN</label>
      <input
        className="admin-input"
        value={iban}
        onChange={(e) => { toccato.current = true; setIban(e.target.value); }}
        autoCapitalize="characters"
        autoCorrect="off"
        spellCheck={false}
        placeholder="IT60 X054 2811 1010 0000 0123 456"
        style={ibanInErrore ? { borderColor: '#B3261E' } : undefined}
      />
      {ibanInErrore && (
        // ⚠️ Il controllo non è sulla lunghezza: un IBAN porta due cifre
        // di controllo calcolate su tutto il resto, e una cifra sbagliata
        // o due invertite le fanno saltare. Questo numero si scrive una
        // volta sola, e l'errore lo scoprirebbe un socio settimane dopo
        // con un bonifico rifiutato dalla banca.
        <div style={{ fontSize: '.8rem', color: '#B3261E', marginTop: '.4rem' }}>
          Questo IBAN non è valido: ricontrolla le cifre.
        </div>
      )}

      <button
        className="admin-btn"
        style={{ marginTop: '.9rem', opacity: completo ? 1 : 0.4 }}
        onClick={salva}
        disabled={!completo || salvando}
      >
        {salvato ? 'Salvato ✓' : 'Salva'}
      </button>

      {dati && (
        <button
          className="admin-btn-link"
          style={{ marginTop: '.8rem', display: 'block', color: '#B3261E', fontWeight: 700, background: 'none', border: 0, padding: 0, cursor: 'pointer' }}
          onClick={togli}
          disabled={salvando}
        >
          Togli i dati (il pulsante «Ricarica» sparisce dall&apos;app dei soci)
        </button>
      )}

      {errore && <div className="admin-saving" style={{ color: '#B3261E' }}>{errore}</div>}
    </div>
  );
}
