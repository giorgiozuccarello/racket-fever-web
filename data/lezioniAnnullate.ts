// ============================================================
// LEZIONI ANNULLATE — sola lettura.
//
// Questa collezione la scrive SOLO il server, dentro la Cloud
// Function annullaPrenotazione (functions/src/index.ts). Le regole
// dicono "allow write: if false", e non e' una formalita': il campo
// oltreIlTermine dice se la disdetta e' arrivata fuori tempo massimo,
// ed e' esattamente la riga che chi l'ha disdetta avrebbe interesse a
// ritoccare. Da qui, quindi, si legge e basta — non esiste una
// funzione di scrittura, e non deve comparirne una.
//
// ⚠️ UN DOCUMENTO = UNA LEZIONE, non una mezz'ora. Una lezione di
// un'ora sono due prenotazioni da mezz'ora, cancellate una dopo
// l'altra: e' il server a farle confluire nello stesso documento
// (l'identificativo e' la card, non la prenotazione), quindi qui si
// contano i documenti senza raggruppare niente. Le mezz'ore restano
// contate a parte, nel campo "mezzore".
// ============================================================

import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../lib/firebase';

export interface LezioneAnnullata {
  id: string;
  circoloId: string;
  maestroId: string | null;
  maestroNome: string | null;
  allievoUid: string | null;
  allievoNome: string | null;
  allievoEsterno: boolean;
  data: string | null;
  dataLabel: string | null;
  campoNome: string | null;
  orario: string | null;
  mezzore: number;
  // Vero se la disdetta e' arrivata oltre il termine deciso dal
  // Maestro (o, se non l'ha scelto, dal circolo). Per il socio e' una
  // cosa che non puo' succedere — il server lo ferma — quindi qui
  // dentro si trova quasi sempre una disdetta fatta dall'Admin o dal
  // Maestro stesso, che il termine possono scavalcarlo.
  oltreIlTermine: boolean;
  oreLimite: number;
  // Istante in cui la lezione sarebbe cominciata. Distingue una
  // disdetta arrivata tardi da una griglia ripulita il giorno dopo:
  // senza, le due finiscono nello stesso numero.
  inizioMs: number | null;
  annullataDaNome: string | null;
  annullataDaRuolo: string | null;
  quandoMs: number;
}

// ⚠️ onErrore, come per l'elenco dei Maestri. Un ascolto respinto e un
// ascolto lento si assomigliano troppo: senza distinguerli, una scheda
// mostrerebbe "0 lezioni annullate" — che e' un'informazione, e
// sbagliata — invece di dire che il dato non e' arrivato.
export function ascoltaLezioniAnnullate(
  circoloId: string,
  callback: (elenco: LezioneAnnullata[]) => void,
  onErrore?: () => void,
) {
  const q = query(collection(db, 'lezioni_annullate'), where('circoloId', '==', circoloId));
  return onSnapshot(
    q,
    (snap) => callback(snap.docs.map((d) => {
      const v = d.data() as any;
      return {
        id: d.id,
        circoloId: v.circoloId ?? '',
        maestroId: v.maestroId ?? null,
        maestroNome: v.maestroNome ?? null,
        allievoUid: v.allievoUid ?? null,
        allievoNome: v.allievoNome ?? null,
        allievoEsterno: v.allievoEsterno === true,
        data: v.data ?? null,
        dataLabel: v.dataLabel ?? null,
        campoNome: v.campoNome ?? null,
        orario: v.orario ?? null,
        mezzore: typeof v.mezzore === 'number' ? v.mezzore : 0,
        oltreIlTermine: v.oltreIlTermine === true,
        oreLimite: typeof v.oreLimite === 'number' ? v.oreLimite : 0,
        inizioMs: typeof v.inizioMs === 'number' ? v.inizioMs : null,
        annullataDaNome: v.annullataDaNome ?? null,
        annullataDaRuolo: v.annullataDaRuolo ?? null,
        quandoMs: typeof v.quandoMs === 'number' ? v.quandoMs : 0,
      } as LezioneAnnullata;
    })),
    (errore) => {
      console.warn('Ascolto lezioni annullate interrotto:', errore?.message ?? errore);
      onErrore?.();
    },
  );
}
