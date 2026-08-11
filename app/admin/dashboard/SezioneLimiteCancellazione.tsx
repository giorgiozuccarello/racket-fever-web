'use client';

import { useEffect, useRef, useState } from 'react';
import { Circolo } from '../../../data/circoli';
import { aggiornaCircolo } from '../../../data/circoliRepo';
import { ORE_LIMITE_CANCELLAZIONE_MAX, oreLimiteDi } from '../../../data/cancellazione';

export default function SezioneLimiteCancellazione({ circolo }: { circolo: Circolo }) {
  // Il valore mostrato mentre si trascina sta QUI, non su Firestore.
  // React manda l'evento di un <input type="range"> a ogni scatto:
  // legandolo direttamente al salvataggio, una trascinata da 0 a 24
  // farebbe ventiquattro scritture, tutte rimbalzate in tempo reale a
  // ogni socio collegato. Si scrive quando si molla il dito.
  const [valore, setValore] = useState(oreLimiteDi(circolo));
  const [salvando, setSalvando] = useState(false);
  const [errore, setErrore] = useState('');
  // Vero mentre il puntatore e' sul pomello; vero dal primo spostamento
  // in poi. Servono a due cose diverse, vedi sotto.
  const trascinando = useRef(false);
  const toccato = useRef(false);
  // Il circolo del render corrente, leggibile dentro una callback
  // asincrona senza restare a quello catturato dalla closure.
  const circoloRef = useRef(circolo);
  circoloRef.current = circolo;

  // Il circolo arriva da un onSnapshot: se un altro Admin sposta il
  // limite mentre questa sezione e' aperta, senza questo riallineamento
  // lo slider resterebbe sul valore vecchio. Non mentre si trascina,
  // pero': il pomello salterebbe sotto il puntatore.
  useEffect(() => {
    if (!trascinando.current) setValore(oreLimiteDi(circolo));
  }, [circolo.oreLimiteCancellazione]);

  const salva = async (v: number) => {
    // Nessuno ha toccato niente: e' solo un fuoco arrivato col Tab, o un
    // click sul pomello senza spostarlo. Senza questa riga bastava
    // quello per riscrivere sopra la modifica di un collega.
    if (!toccato.current) return;
    toccato.current = false;
    // Confronto con il valore GREZZO, non con quello ripulito: se sul
    // documento finisse un numero fuori scala, lo slider mostrerebbe 24
    // e portarlo a 24 non scriverebbe nulla, lasciando li' il dato storto.
    if (v === Number(circolo.oreLimiteCancellazione ?? 0)) return;
    setSalvando(true);
    setErrore('');
    // ⚠️ updateDoc NON fallisce quando manca la rete: accoda la
    // scrittura e la promessa si scioglie solo con la conferma del
    // server. Senza questo timer, offline la scritta "Salvataggio…"
    // resterebbe appesa per sempre. La scrittura resta comunque in coda
    // e parte da sola al ritorno della rete.
    const spegni = setTimeout(() => setSalvando(false), 5000);
    try {
      await aggiornaCircolo(circolo.id, { oreLimiteCancellazione: v });
    } catch (e: any) {
      setErrore(`Non è stato possibile salvare: ${e?.message ?? 'errore sconosciuto'}`);
      setValore(oreLimiteDi(circoloRef.current));
    } finally {
      clearTimeout(spegni);
      setSalvando(false);
    }
  };

  return (
    <div className="admin-card">
      <div className="admin-card-title">Entro quando un socio può disdire</div>
      <p className="admin-card-hint">
        Quante ore prima dell&apos;inizio dello slot un socio può ancora cancellare la sua
        prenotazione. Superato il termine il pulsante di cancellazione si disattiva e il socio
        vede l&apos;orario entro cui avrebbe dovuto disdire. Vale solo per i soci: il circolo e i
        maestri possono cancellare sempre.
      </p>
      <div className="admin-slider-value">
        {valore === 0
          ? 'Nessun limite — si disdice fino all’orario di gioco'
          : `${valore} ${valore === 1 ? 'ora' : 'ore'} prima dell’inizio`}
      </div>
      {/* onPointerUp da solo non basta: su touch il browser puo'
          annullare il gesto (pointercancel) quando lo scorrimento della
          pagina prende il sopravvento, e il valore resterebbe a schermo
          senza mai finire su Firestore. onBlur copre la regolazione da
          tastiera interrotta da un click altrove. Le chiamate in piu'
          non fanno danni: le assorbe la guardia "toccato". */}
      <input
        className="admin-slider" type="range" min={0} max={ORE_LIMITE_CANCELLAZIONE_MAX} step={1}
        value={valore}
        onChange={(e) => { toccato.current = true; setValore(Number(e.target.value)); }}
        onPointerDown={() => { trascinando.current = true; }}
        onPointerUp={() => { trascinando.current = false; salva(valore); }}
        onPointerCancel={() => { trascinando.current = false; salva(valore); }}
        onKeyUp={() => salva(valore)}
        onBlur={() => salva(valore)}
      />
      {salvando && <div className="admin-saving">Salvataggio…</div>}
      {errore && <div className="admin-error-text">{errore}</div>}
    </div>
  );
}
