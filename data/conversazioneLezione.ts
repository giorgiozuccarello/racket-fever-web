// ============================================================
// CHIUDERE LA CONVERSAZIONE DI UNA LEZIONE — la chiede il server.
//
// ⚠️ QUESTO GIRO NON SI FA PIU' DAL BROWSER, e la ragione è un caso
// vero, costato due tornate. Farlo qui voleva dire tre permessi larghi
// sull'Admin: CERCARE fra le conversazioni del circolo, LEGGERE i
// messaggi di due persone, CANCELLARLI. Tre permessi su dati che il
// progetto ha deciso altrove di non far leggere nemmeno al team Racket
// Fever — e ogni volta che uno dei tre non tornava, il risultato era lo
// stesso, «permesso negato», senza modo di sapere quale. Ci abbiamo
// perso due giri interi, con la lezione annullata e la chat viva.
//
// Adesso lo fa una Cloud Function con l'Admin SDK, che le regole le
// scavalca: quei tre permessi non servono più a nessuno, e il controllo
// è uno solo e in un posto solo — che chi chiama comandi davvero su
// quel circolo. È lo stesso ragionamento per cui il denaro è passato di
// là: la regola difende, il server esegue.
//
// ⚠️ Il file resta a sé, minuscolo, perché lo chiamano due posti che
// non possono importarsi a vicenda: data/lezioniAdmin.ts (il circolo
// annulla una lezione) e data/tessere.ts (il circolo rimuove un socio,
// e le sue lezioni future se ne vanno con lui).
// ============================================================

import { httpsCallable } from 'firebase/functions';
import { functions } from '../lib/firebase';

// La conversazione non si è chiusa. È diverso da «la lezione non si è
// annullata», e chi chiama deve poterlo dire.
export const CONVERSAZIONE_NON_CHIUSA = 'CONVERSAZIONE_NON_CHIUSA';

export async function chiudiConversazioneLezione(cardId: string, circoloId: string): Promise<void> {
  // Senza uno dei due non c'è niente da chiudere: una lezione senza
  // card non ha una conversazione collegata.
  if (!cardId || !circoloId) return;
  try {
    const chiama = httpsCallable(functions, 'chiudiConversazioneLezione');
    await chiama({ cardId, circoloId });
  } catch (e) {
    // ⚠️ Il codice vero viaggia INSIEME al marcatore, non al posto suo.
    // La prima versione lo sostituiva, e per capire perché una chat non
    // si chiudeva sono serviti due giri di prove sul telefono di
    // qualcun altro.
    const codice = (e as { code?: string })?.code ?? 'sconosciuto';
    console.warn('Conversazione della lezione non chiusa:', e);
    throw new Error(`${CONVERSAZIONE_NON_CHIUSA}:${codice}`);
  }
}
