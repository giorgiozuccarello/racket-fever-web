// ============================================================
// LA LINGUA SUL SITO — gemello di racket-fever/theme/LinguaContext.tsx.
//
// ⚠️ IL CONTENITORE NON STA SULLA RADICE, e qui e' giusto cosi'. Sul
// telefono la lingua serve in quattro schermate sparse, e il posto era
// la radice. Sul sito serve in UN punto solo: la Panoramica circolo
// della dashboard dell'Admin, dove il selettore e la scheda che
// traduce vivono dentro lo stesso involucro. Montarlo sul
// `layout.tsx` della radice vorrebbe dire trasformare in componente
// client il guscio dell'intero sito — pagine pubbliche comprese — per
// una preferenza che riguarda una sezione sola.
//
// ⚠️ E C'E' UN SECONDO EFFETTO, VOLUTO. `SchedaCircoloVista` e' lo
// stesso componente che il Super Admin apre su un circolo qualunque:
// li' il contenitore non c'e', quindi `useLingua` risponde con la
// lingua di serie e il pannello di rete resta in italiano. Il team
// Racket Fever non ha un selettore e non deve trovarsi la scheda in
// tedesco perche' l'Admin di un circolo ha scelto cosi'.
// ============================================================

'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  Lingua, LINGUA_DI_SERIE, RuoloLingua, leggiLinguaSalvata, linguaDelTelefono, salvaLingua,
} from '../data/lingue';
import { ChiaveTesto, Traduttore, ValoriTesto, traduci } from '../data/testi';

type Contesto = {
  lingua: Lingua;
  imposta: (l: Lingua) => void;
};

const LinguaCtx = createContext<Contesto>({
  lingua: LINGUA_DI_SERIE,
  imposta: () => {},
});

export function LinguaProvider({ ruolo, children }: { ruolo: RuoloLingua; children: React.ReactNode }) {
  // ⚠️ SI PARTE DALL'ITALIANO ANCHE QUANDO IL BROWSER DICE ALTRO, e
  // non e' una svista: Next.js disegna questa pagina una prima volta
  // sul SERVER, dove `localStorage` e `navigator` non esistono. Se il
  // primo disegno del browser partisse gia' in tedesco, non
  // combacerebbe con quello del server e React lo direbbe con un
  // errore di idratazione — sostituendo l'intero albero. Si parte
  // uguali e si corregge subito dopo, dentro l'effetto: quello gira
  // solo nel browser.
  const [lingua, setLingua] = useState<Lingua>(LINGUA_DI_SERIE);

  useEffect(() => {
    let vivo = true;
    (async () => {
      const salvata = await leggiLinguaSalvata(ruolo);
      if (!vivo) return;
      setLingua(salvata ?? linguaDelTelefono());
    })();
    return () => { vivo = false; };
  }, [ruolo]);

  const imposta = useCallback((l: Lingua) => {
    // Prima a schermo, poi in memoria: la scrittura non deve far
    // aspettare il tocco.
    setLingua(l);
    salvaLingua(ruolo, l);
  }, [ruolo]);

  const valore = useMemo(() => ({ lingua, imposta }), [lingua, imposta]);
  return <LinguaCtx.Provider value={valore}>{children}</LinguaCtx.Provider>;
}

export type UsoLingua = {
  lingua: Lingua;
  cambia: (l: Lingua) => void;
  t: Traduttore;
};

export function useLingua(): UsoLingua {
  const { lingua, imposta } = useContext(LinguaCtx);
  const t = useCallback(
    (chiave: ChiaveTesto, valori?: ValoriTesto) => traduci(lingua, chiave, valori),
    [lingua],
  );
  return { lingua, cambia: imposta, t };
}
