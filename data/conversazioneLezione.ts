// ============================================================
// CHIUDERE LA CONVERSAZIONE DI UNA LEZIONE.
//
// Sta in un file suo, minuscolo e senza dipendenze, per un motivo
// preciso: lo chiamano due posti che non possono importarsi a vicenda —
// data/lezioniAdmin.ts (il circolo annulla una lezione) e
// data/tessere.ts (il circolo rimuove un socio, e le sue lezioni
// future se ne vanno con lui). Mettendolo in uno dei due si sarebbe
// creato un giro di importazioni fra tessere, prenotazioni e lezioni.
//
// ⚠️ E soprattutto: deve esserci UNA sola versione di questo giro. Il
// progetto ne ha già avute tre, e quella che stava dentro la griglia
// dell'Admin era l'unica che, se restavano messaggi, non lo diceva a
// nessuno.
// ============================================================

import { collection, deleteDoc, doc, getDocs, query, where } from 'firebase/firestore';
import { db } from '../lib/firebase';

// I messaggi sono rimasti: la richiesta non è stata cancellata, e la
// conversazione è ancora aperta. Chi chiama deve poterlo dire.
export const CONVERSAZIONE_NON_CHIUSA = 'CONVERSAZIONE_NON_CHIUSA';

// ⚠️ Il documento padre si cancella per ULTIMO e solo a
// sottocollezione vuota: le regole per arrivare ai messaggi passano dal
// padre, quindi senza padre quei messaggi non li può più né leggere né
// cancellare nessuno — nemmeno il Super Admin.
//
// Il giro sui messaggi si ripete qualche volta perché una singola
// cancellazione può fallire da sola, non perché ne arrivino di nuovi.
export async function chiudiConversazioneLezione(cardId: string): Promise<void> {
  if (!cardId) return;
  const snap = await getDocs(query(collection(db, 'richieste_lezione'), where('cardId', '==', cardId)));
  for (const d of snap.docs) {
    const messaggi = collection(db, 'richieste_lezione', d.id, 'messaggi');
    for (let giro = 0; giro < 4; giro++) {
      const msg = await getDocs(messaggi);
      if (msg.empty) break;
      let qualcunoTolto = false;
      for (const m of msg.docs) {
        try { await deleteDoc(m.ref); qualcunoTolto = true; } catch { /* si riprova */ }
      }
      if (!qualcunoTolto) break;
    }
    const rimasti = await getDocs(messaggi);
    // ⚠️ SI ALZA LA VOCE. La versione che stava dentro la griglia
    // dell'Admin qui non faceva niente: se restavano messaggi, la
    // richiesta non veniva cancellata e la funzione rispondeva comunque
    // "fatto". Il pop-up si chiudeva, la riga spariva dall'elenco — che
    // è fatto di prenotazioni, e quelle erano già state cancellate — e
    // la conversazione restava aperta per sempre, senza nessuna
    // schermata da cui riprovare. Silenzioso e irreversibile.
    if (!rimasti.empty) {
      throw new Error(`${CONVERSAZIONE_NON_CHIUSA}:${rimasti.size}`);
    }
    await deleteDoc(doc(db, 'richieste_lezione', d.id));
  }
}
