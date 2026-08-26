// ============================================================
// IL SELETTORE DELLA LINGUA — versione del sito.
//
// ⚠️ UNA TENDINA DI SISTEMA, non una finestra disegnata da noi come
// sull'app. Su un browser il controllo giusto per «scegli fra tre
// cose» e' `<select>`: lo sa aprire la tastiera, lo legge un lettore
// di schermo, e su un computer della segreteria si comporta come ogni
// altra tendina della dashboard (stessa classe `admin-select` dei
// prezzi e degli orari). Ricostruirlo a mano avrebbe voluto dire
// rifare da zero cose che il browser fa gia' meglio.
//
// ⚠️ BANDIERA E NOME NELLA LINGUA STESSA, come sull'app: «English»,
// non «Inglese». E se la bandiera non si disegna — succede su qualche
// Windows senza il font delle emoji — al suo posto compaiono le due
// lettere del paese e la riga resta leggibile, perche' il nome c'e'
// sempre accanto.
// ============================================================

'use client';

import { LINGUE, Lingua, linguaValida } from '../../../data/lingue';
import { useLingua } from '../../../lib/lingua';

export default function SelettoreLingua() {
  const { lingua, cambia, t } = useLingua();

  return (
    <div className="admin-lingua">
      <label className="admin-label" htmlFor="scelta-lingua">{t('com.lingua.titolo')}</label>
      <select
        id="scelta-lingua"
        className="admin-select"
        value={lingua}
        onChange={(e) => {
          const v = e.target.value;
          if (linguaValida(v)) cambia(v as Lingua);
        }}
      >
        {LINGUE.map((l) => (
          <option key={l.codice} value={l.codice}>{l.bandiera} {l.nome}</option>
        ))}
      </select>
      <div className="admin-hint-lingua">{t('com.lingua.descrizione')} {t('com.lingua.nota')}</div>
    </div>
  );
}
