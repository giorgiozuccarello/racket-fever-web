// ============================================================
// GLI AVVISI — e con loro le notifiche push, perché sono la stessa
// scrittura.
//
// ⚠️ QUESTO BLOCCO NON PARLA A CHI GUARDA LO SCHERMO: parla a
// QUALCUN ALTRO. Tutte le altre schermate le legge la stessa persona
// che le ha aperte, quindi «la lingua» è una sola e la sa il telefono.
// Qui no: chi scrive è un socio, un Maestro o il circolo, e chi legge
// è un'altra persona — con un altro telefono e un'altra lingua.
//
// Da qui la regola che vale in tutto questo file:
//
//   > la lingua è quella di CHI RICEVE, e si legge dal suo profilo
//   > (`utenti/{uid}.lingua`, `maestri/{uid}.lingua`) un istante prima
//   > di comporre la frase.
//
// ⚠️ E SI COMPONE AL MOMENTO DELLA SCRITTURA, non alla lettura. È la
// decisione di Giorgio del 26 agosto 2026, ed è quella giusta: un
// avviso già arrivato resta com'era. Se invece si salvasse la chiave e
// si traducesse aprendo la Home, cambiare lingua riscriverebbe
// all'indietro anche gli avvisi di sei mesi fa — e le push già
// consegnate resterebbero comunque nella lingua vecchia, perché una
// notifica consegnata non si può più toccare. Due metà che non
// combaciano. Componendo alla scrittura, invece, avviso e push dicono
// sempre la stessa cosa nella stessa lingua, e il passato non si
// riscrive mai.
//
// ⚠️ IL RIPIEGO È L'ITALIANO, SEMPRE. Se il profilo del destinatario
// non si riesce a leggere — permessi, rete, un campo che non c'è
// ancora — la frase esce in italiano. Un avviso nella lingua sbagliata
// è un fastidio; un avviso che non parte è un socio che non sa che la
// sua partita è saltata.
//
// ⚠️ IL DETTAGLIO NON SI TRADUCE, E NON PUÒ. Dentro molte di queste
// frasi entra una riga già composta altrove — «Campo 2 · Lunedì 3 set,
// ore 18:00-19:00» — che nasce dai dati della prenotazione. Resta
// com'è: sono nomi propri, date e orari, cioè le uniche cose che si
// leggono uguali in tutte e tre le lingue.
// ============================================================

import { blocco } from '../testi';

const it = {
  // ---------- prenotazioni fra soci ----------
  'avv.aggiunto': '{chi} ti ha aggiunto alla sua prenotazione.',
  'avv.tolto': '{chi} ti ha tolto dalla sua prenotazione.{quandoDove}\nLa tua quota è stata riaccreditata.',
  'avv.quotaRiaccreditata': '\nLa tua quota è stata riaccreditata.',
  'avv.quotaRiaccreditataCifra': '\nLa tua quota è stata riaccreditata: € {importo}.',
  'avv.socioModificaPren': '{chi} ha modificato la prenotazione.',
  'avv.socioCancellaPren': '{chi} ha cancellato la prenotazione.',
  'avv.socioProlungaPren': '{chi} ha modificato la prenotazione.\nAggiunte le mezz’ore: {orari}.',

  // ---------- lezioni: dal socio al Maestro ----------
  'avv.mae.chiestaLezione': '{chi} ti ha chiesto una lezione.\nVai alla chat.',
  'avv.mae.accettataProposta': '{chi} ha accettato la tua proposta.',
  'avv.mae.cancellataRichiesta': '{chi} ha cancellato la sua richiesta di lezione.',
  'avv.mae.socioModificaLezione': '{chi} ha modificato la lezione.',
  'avv.mae.socioCancellaLezione': '{chi} ha cancellato la lezione.',

  // ---------- lezioni: dal Maestro al socio ----------
  'avv.socio.confermataDaMe': 'Hai confermato la lezione con il Maestro {maestro}.',
  'avv.socio.maestroConferma': 'Il Maestro {maestro} ha confermato la lezione.',
  'avv.socio.maestroCancellaRichiesta': 'Il Maestro {maestro} ha cancellato la tua richiesta di lezione per {quando}.',
  'avv.socio.maestroPropone': 'Il Maestro {maestro} ti ha proposto altri orari per la lezione.\nVai alla chat per scegliere.',
  'avv.socio.maestroPrenota': 'Il Maestro {maestro} ti ha prenotato una lezione.',
  'avv.socio.maestroModificaLezione': 'Il Maestro {maestro} ha modificato la lezione.\nAggiunte le mezz’ore: {orari}.',
  'avv.socio.maestroModificaTolte': 'Il Maestro {maestro} ha modificato la lezione.\nTolte le mezz’ore: {orari}.',
  'avv.socio.maestroCancellaLezione': 'Il Maestro {maestro} ha cancellato la lezione.',

  // ---------- lezioni: quel che succede a tutti e due ----------
  'avv.campiOccupati': 'I campi sono stati occupati prima della conferma.\nRichiesta di lezione annullata.',
  'avv.chatScritto': '{chi} ti ha scritto nella chat della lezione.\nVai alla chat per leggere.',
  'avv.circoloCancellaLezione': 'Il circolo ha cancellato la lezione.',
  'avv.eseguitoDa': '\nEseguito da {chi}.',

  // ---------- il circolo al socio ----------
  'avv.cir.benvenutoSocio': 'Benvenuto in {circolo}! La tua iscrizione come Socio è stata approvata: ora puoi prenotare i campi.',
  'avv.cir.benvenutoOspite': 'Sei stato accettato come Ospite presso {circolo}: ora puoi prenotare anche lì.',
  'avv.cir.rifiutoSocio': '{circolo} non ha accolto la tua richiesta di iscrizione. Puoi contattare la segreteria del circolo per saperne di più.',
  'avv.cir.rifiutoOspite': '{circolo} non ha accolto la tua richiesta di accesso come Ospite. Puoi contattare la segreteria del circolo per saperne di più.',
  'avv.cir.fuoriDaiSoci': 'Non fai più parte dei soci del circolo.',
  'avv.cir.chiusaOspite': 'Il circolo ha chiuso la tua posizione di Ospite.',
  'avv.cir.creditoDaRitirare': ' Hai € {importo} di credito da ritirare in segreteria.',
  'avv.cir.debitoDaSaldare': ' Risulta un debito di € {importo} da saldare in segreteria.',
  'avv.cir.prenotazioniCancellate': ' Le tue {n} prenotazioni future sono state cancellate e rimborsate.',
  'avv.cir.creditoAzzerato': 'Il circolo ha azzerato il tuo credito.\n(Era € {importo}).\nSe hai dubbi al riguardo, rivolgiti alla segreteria.',
  'avv.cir.creditoAzzeratoSito': 'Il circolo ha azzerato il tuo credito wallet (era € {importo}). Se non ti torna, rivolgiti alla segreteria.',
  'avv.cir.contoSaldato': '{circolo} ha registrato la chiusura del tuo conto: la posizione è saldata.',
  'avv.cir.prenotaPerTe': 'Il circolo ha prenotato per te.',
  'avv.cir.modificaPren': 'Il circolo ha modificato la tua prenotazione.',
  'avv.cir.compagnoModifica': 'Il circolo ha modificato una prenotazione nella quale eri stato aggiunto.',
  'avv.cir.aggiunte': 'Aggiunte: ',
  'avv.cir.senzaAddebito': '\nNessun addebito sul tuo credito.',
  'avv.cir.tuaModificata': 'Il circolo ha modificato la tua prenotazione.',
  'avv.cir.tuaCancellata': 'Il circolo ha cancellato la tua prenotazione.',
  'avv.cir.compagnoModificata': 'Il circolo ha modificato una prenotazione nella quale eri stato aggiunto.',
  'avv.cir.compagnoCancellata': 'Il circolo ha cancellato una prenotazione nella quale eri stato aggiunto.',
  'avv.cir.creditoRimborsato': '\nCredito rimborsato: € {importo}.',

  // ---------- lista compagni ----------
  'avv.comp.richiesta': '{chi} ti chiede di entrare nella sua lista compagni. Accettando gli permetti di aggiungerti alle sue prenotazioni, di cambiarti o toglierti, e di addebitare la tua quota sul tuo credito. Vale anche al contrario: potrai fare lo stesso con lui. Si può togliere in qualsiasi momento.',
  'avv.comp.accettata': '{chi} ha accettato: ora siete nella Lista Compagni l’uno dell’altro.',

  'avv.copertaFido': '\nCoperta con il Fido — salda in segreteria.',
  'avv.aggiuntoCoda': '{chi} ti ha aggiunto alla sua prenotazione.{coda}',
  'avv.prolungaCoda': '{chi} ha modificato la prenotazione.\nAggiunte le mezz’ore: {orari}.{coda}',
  'avv.socio.modificaPrenCompagno': '{chi} ha modificato la prenotazione.\n{dettaglio}\nLa tua quota è stata riaccreditata: € {importo}.',
  'avv.socio.cancellaPrenCompagno': '{chi} ha cancellato la prenotazione.\n{dettaglio}\nLa tua quota è stata riaccreditata: € {importo}.',
  'avv.mae.socioModificaLezioneDett': '{chi} ha modificato la lezione.\n{dettaglio}',
  'avv.mae.socioCancellaLezioneDett': '{chi} ha cancellato la lezione.\n{dettaglio}',
  'avv.socio.maestroModificaDett': 'Il Maestro {maestro} ha modificato la lezione.\n{dettaglio}',
  'avv.socio.maestroCancellaDett': 'Il Maestro {maestro} ha cancellato la lezione.\n{dettaglio}',
  'avv.cir.prenotaPerTeDett': 'Il circolo ha prenotato per te.\n{dettaglio}{coda}',
  'avv.cir.modificaPrenDett': 'Il circolo ha modificato la tua prenotazione.\nAggiunte: {dettaglio}{coda}',
  'avv.cir.compagnoModificaDett': 'Il circolo ha modificato una prenotazione nella quale eri stato aggiunto.\n{dettaglio}{coda}',
  'avv.cir.compagnoProlungaDett': 'Il circolo ha modificato una prenotazione nella quale eri stato aggiunto.\nAggiunte: {dettaglio}{coda}',
  'avv.cir.tuaModificataDett': 'Il circolo ha modificato la tua prenotazione.\n{dettaglio}{coda}',
  'avv.cir.tuaCancellataDett': 'Il circolo ha cancellato la tua prenotazione.\n{dettaglio}{coda}',
  'avv.cir.compagnoModificataDett': 'Il circolo ha modificato una prenotazione nella quale eri stato aggiunto.\n{dettaglio}{coda}',
  'avv.cir.compagnoCancellataDett': 'Il circolo ha cancellato una prenotazione nella quale eri stato aggiunto.\n{dettaglio}{coda}',
  'avv.cir.fuoriDaiSociCoda': 'Non fai più parte dei soci del circolo.{saldo}{coda}',
  'avv.cir.chiusaOspiteCoda': 'Il circolo ha chiuso la tua posizione di Ospite.{saldo}{coda}',
  'avv.circoloCancellaLezioneDett': 'Il circolo ha cancellato la lezione.\n{dettaglio}',
  'avv.mae.circoloCancellaLezione': 'Il circolo ha cancellato la lezione.\n{dettaglio}\nEseguito da {chi}.',

  // ---------- sfide ----------
  'avv.sfida.inCorso': 'Sfida in Corso: {campo}, {quando} ore {ora}.',

  // ---------- rifiniture della tornata 108 (secondo giro) ----------
  'avv.unSocio': 'Un socio',
};

const en: Record<keyof typeof it, string> = {
  'avv.aggiunto': '{chi} has added you to their booking.',
  'avv.tolto': '{chi} has removed you from their booking.{quandoDove}\nYour share has been credited back.',
  'avv.quotaRiaccreditata': '\nYour share has been credited back.',
  'avv.quotaRiaccreditataCifra': '\nYour share has been credited back: € {importo}.',
  'avv.socioModificaPren': '{chi} has changed the booking.',
  'avv.socioCancellaPren': '{chi} has cancelled the booking.',
  'avv.socioProlungaPren': '{chi} has changed the booking.\nHalf hours added: {orari}.',

  'avv.mae.chiestaLezione': '{chi} has asked you for a lesson.\nGo to the chat.',
  'avv.mae.accettataProposta': '{chi} has accepted your proposal.',
  'avv.mae.cancellataRichiesta': '{chi} has cancelled their lesson request.',
  'avv.mae.socioModificaLezione': '{chi} has changed the lesson.',
  'avv.mae.socioCancellaLezione': '{chi} has cancelled the lesson.',

  'avv.socio.confermataDaMe': 'You confirmed the lesson with coach {maestro}.',
  'avv.socio.maestroConferma': 'Coach {maestro} has confirmed the lesson.',
  'avv.socio.maestroCancellaRichiesta': 'Coach {maestro} has cancelled your lesson request for {quando}.',
  'avv.socio.maestroPropone': 'Coach {maestro} has proposed other times for the lesson.\nGo to the chat to choose.',
  'avv.socio.maestroPrenota': 'Coach {maestro} has booked a lesson for you.',
  'avv.socio.maestroModificaLezione': 'Coach {maestro} has changed the lesson.\nHalf hours added: {orari}.',
  'avv.socio.maestroModificaTolte': 'Coach {maestro} has changed the lesson.\nHalf hours removed: {orari}.',
  'avv.socio.maestroCancellaLezione': 'Coach {maestro} has cancelled the lesson.',

  'avv.campiOccupati': 'The courts were taken before the confirmation.\nLesson request cancelled.',
  'avv.chatScritto': '{chi} has written to you in the lesson chat.\nGo to the chat to read it.',
  'avv.circoloCancellaLezione': 'The club has cancelled the lesson.',
  'avv.eseguitoDa': '\nDone by {chi}.',

  'avv.cir.benvenutoSocio': 'Welcome to {circolo}! Your membership has been approved: you can now book courts.',
  'avv.cir.benvenutoOspite': 'You have been accepted as a guest at {circolo}: you can now book there too.',
  'avv.cir.rifiutoSocio': '{circolo} did not accept your membership request. You can contact the club’s front desk to find out more.',
  'avv.cir.rifiutoOspite': '{circolo} did not accept your request for guest access. You can contact the club’s front desk to find out more.',
  'avv.cir.fuoriDaiSoci': 'You are no longer a member of the club.',
  'avv.cir.chiusaOspite': 'The club has closed your guest position.',
  'avv.cir.creditoDaRitirare': ' You have € {importo} of credit to collect at the front desk.',
  'avv.cir.debitoDaSaldare': ' There is a debt of € {importo} to settle at the front desk.',
  'avv.cir.prenotazioniCancellate': ' Your {n} future bookings have been cancelled and refunded.',
  'avv.cir.creditoAzzerato': 'The club has cleared your credit.\n(It was € {importo}).\nIf you have any doubts, please ask at the front desk.',
  'avv.cir.creditoAzzeratoSito': 'The club has cleared your wallet credit (it was € {importo}). If that doesn’t look right, please ask at the front desk.',
  'avv.cir.contoSaldato': '{circolo} has recorded the closing of your account: the position is settled.',
  'avv.cir.prenotaPerTe': 'The club has made a booking for you.',
  'avv.cir.modificaPren': 'The club has changed your booking.',
  'avv.cir.compagnoModifica': 'The club has changed a booking you had been added to.',
  'avv.cir.aggiunte': 'Added: ',
  'avv.cir.senzaAddebito': '\nNothing has been charged to your credit.',
  'avv.cir.tuaModificata': 'The club has changed your booking.',
  'avv.cir.tuaCancellata': 'The club has cancelled your booking.',
  'avv.cir.compagnoModificata': 'The club has changed a booking you had been added to.',
  'avv.cir.compagnoCancellata': 'The club has cancelled a booking you had been added to.',
  'avv.cir.creditoRimborsato': '\nCredit refunded: € {importo}.',

  'avv.comp.richiesta': '{chi} is asking to be on your partners list. By accepting, you let them add you to their bookings, swap you or remove you, and charge your share to your credit. It works both ways: you will be able to do the same with them. It can be undone at any time.',
  'avv.comp.accettata': '{chi} has accepted: you are now on each other’s partners list.',

  'avv.copertaFido': '\nCovered by the club credit line — settle at the front desk.',
  'avv.aggiuntoCoda': '{chi} has added you to their booking.{coda}',
  'avv.prolungaCoda': '{chi} has changed the booking.\nHalf hours added: {orari}.{coda}',
  'avv.socio.modificaPrenCompagno': '{chi} has changed the booking.\n{dettaglio}\nYour share has been credited back: € {importo}.',
  'avv.socio.cancellaPrenCompagno': '{chi} has cancelled the booking.\n{dettaglio}\nYour share has been credited back: € {importo}.',
  'avv.mae.socioModificaLezioneDett': '{chi} has changed the lesson.\n{dettaglio}',
  'avv.mae.socioCancellaLezioneDett': '{chi} has cancelled the lesson.\n{dettaglio}',
  'avv.socio.maestroModificaDett': 'Coach {maestro} has changed the lesson.\n{dettaglio}',
  'avv.socio.maestroCancellaDett': 'Coach {maestro} has cancelled the lesson.\n{dettaglio}',
  'avv.cir.prenotaPerTeDett': 'The club has made a booking for you.\n{dettaglio}{coda}',
  'avv.cir.modificaPrenDett': 'The club has changed your booking.\nAdded: {dettaglio}{coda}',
  'avv.cir.compagnoModificaDett': 'The club has changed a booking you had been added to.\n{dettaglio}{coda}',
  'avv.cir.compagnoProlungaDett': 'The club has changed a booking you had been added to.\nAdded: {dettaglio}{coda}',
  'avv.cir.tuaModificataDett': 'The club has changed your booking.\n{dettaglio}{coda}',
  'avv.cir.tuaCancellataDett': 'The club has cancelled your booking.\n{dettaglio}{coda}',
  'avv.cir.compagnoModificataDett': 'The club has changed a booking you had been added to.\n{dettaglio}{coda}',
  'avv.cir.compagnoCancellataDett': 'The club has cancelled a booking you had been added to.\n{dettaglio}{coda}',
  'avv.cir.fuoriDaiSociCoda': 'You are no longer a member of the club.{saldo}{coda}',
  'avv.cir.chiusaOspiteCoda': 'The club has closed your guest position.{saldo}{coda}',
  'avv.circoloCancellaLezioneDett': 'The club has cancelled the lesson.\n{dettaglio}',
  'avv.mae.circoloCancellaLezione': 'The club has cancelled the lesson.\n{dettaglio}\nDone by {chi}.',

  'avv.sfida.inCorso': 'Challenge on: {campo}, {quando} at {ora}.',

  // ---------- rifiniture della tornata 108 (secondo giro) ----------
  'avv.unSocio': 'A member',
};

// ⚠️ Il tedesco qui si distende: sono frasi intere in una notifica, non
// etichette dentro una pastiglia. Le abbreviazioni servono nella
// griglia, non qui — e una notifica abbreviata si legge come un
// telegramma.
const de: Record<keyof typeof it, string> = {
  'avv.aggiunto': '{chi} hat dich zu seiner Buchung hinzugefügt.',
  'avv.tolto': '{chi} hat dich aus seiner Buchung entfernt.{quandoDove}\nDein Anteil wurde dir wieder gutgeschrieben.',
  'avv.quotaRiaccreditata': '\nDein Anteil wurde dir wieder gutgeschrieben.',
  'avv.quotaRiaccreditataCifra': '\nDein Anteil wurde dir wieder gutgeschrieben: € {importo}.',
  'avv.socioModificaPren': '{chi} hat die Buchung geändert.',
  'avv.socioCancellaPren': '{chi} hat die Buchung storniert.',
  'avv.socioProlungaPren': '{chi} hat die Buchung geändert.\nHinzugefügte halbe Stunden: {orari}.',

  'avv.mae.chiestaLezione': '{chi} hat dich um ein Training gebeten.\nGeh zum Chat.',
  'avv.mae.accettataProposta': '{chi} hat deinen Vorschlag angenommen.',
  'avv.mae.cancellataRichiesta': '{chi} hat seine Trainingsanfrage zurückgezogen.',
  'avv.mae.socioModificaLezione': '{chi} hat das Training geändert.',
  'avv.mae.socioCancellaLezione': '{chi} hat das Training abgesagt.',

  'avv.socio.confermataDaMe': 'Du hast das Training mit Trainer {maestro} bestätigt.',
  'avv.socio.maestroConferma': 'Trainer {maestro} hat das Training bestätigt.',
  'avv.socio.maestroCancellaRichiesta': 'Trainer {maestro} hat deine Trainingsanfrage für {quando} abgesagt.',
  'avv.socio.maestroPropone': 'Trainer {maestro} hat dir andere Zeiten für das Training vorgeschlagen.\nGeh zum Chat, um zu wählen.',
  'avv.socio.maestroPrenota': 'Trainer {maestro} hat ein Training für dich gebucht.',
  'avv.socio.maestroModificaLezione': 'Trainer {maestro} hat das Training geändert.\nHinzugefügte halbe Stunden: {orari}.',
  'avv.socio.maestroModificaTolte': 'Trainer {maestro} hat das Training geändert.\nGestrichene halbe Stunden: {orari}.',
  'avv.socio.maestroCancellaLezione': 'Trainer {maestro} hat das Training abgesagt.',

  'avv.campiOccupati': 'Die Plätze wurden vor der Bestätigung belegt.\nTrainingsanfrage storniert.',
  'avv.chatScritto': '{chi} hat dir im Trainings-Chat geschrieben.\nGeh zum Chat, um zu lesen.',
  'avv.circoloCancellaLezione': 'Der Verein hat das Training abgesagt.',
  'avv.eseguitoDa': '\nAusgeführt von {chi}.',

  'avv.cir.benvenutoSocio': 'Willkommen bei {circolo}! Deine Mitgliedschaft wurde freigegeben: du kannst jetzt Plätze buchen.',
  'avv.cir.benvenutoOspite': 'Du wurdest als Gast bei {circolo} aufgenommen: du kannst jetzt auch dort buchen.',
  'avv.cir.rifiutoSocio': '{circolo} hat deinen Aufnahmeantrag nicht angenommen. Für Näheres wende dich ans Sekretariat des Vereins.',
  'avv.cir.rifiutoOspite': '{circolo} hat deinen Antrag auf Gastzugang nicht angenommen. Für Näheres wende dich ans Sekretariat des Vereins.',
  'avv.cir.fuoriDaiSoci': 'Du bist nicht mehr Mitglied des Vereins.',
  'avv.cir.chiusaOspite': 'Der Verein hat deinen Gaststatus beendet.',
  'avv.cir.creditoDaRitirare': ' Du hast € {importo} Guthaben, das du im Sekretariat abholen kannst.',
  'avv.cir.debitoDaSaldare': ' Es besteht eine Schuld von € {importo}, die im Sekretariat zu begleichen ist.',
  'avv.cir.prenotazioniCancellate': ' Deine {n} künftigen Buchungen wurden storniert und erstattet.',
  'avv.cir.creditoAzzerato': 'Der Verein hat dein Guthaben auf null gesetzt.\n(Es waren € {importo}).\nBei Zweifeln wende dich ans Sekretariat.',
  'avv.cir.creditoAzzeratoSito': 'Der Verein hat dein Wallet-Guthaben auf null gesetzt (es waren € {importo}). Falls das nicht stimmt, wende dich ans Sekretariat.',
  'avv.cir.contoSaldato': '{circolo} hat den Abschluss deines Kontos verbucht: die Position ist ausgeglichen.',
  'avv.cir.prenotaPerTe': 'Der Verein hat für dich gebucht.',
  'avv.cir.modificaPren': 'Der Verein hat deine Buchung geändert.',
  'avv.cir.compagnoModifica': 'Der Verein hat eine Buchung geändert, zu der du hinzugefügt worden warst.',
  'avv.cir.aggiunte': 'Hinzugefügt: ',
  'avv.cir.senzaAddebito': '\nDeinem Guthaben wurde nichts belastet.',
  'avv.cir.tuaModificata': 'Der Verein hat deine Buchung geändert.',
  'avv.cir.tuaCancellata': 'Der Verein hat deine Buchung storniert.',
  'avv.cir.compagnoModificata': 'Der Verein hat eine Buchung geändert, zu der du hinzugefügt worden warst.',
  'avv.cir.compagnoCancellata': 'Der Verein hat eine Buchung storniert, zu der du hinzugefügt worden warst.',
  'avv.cir.creditoRimborsato': '\nGuthaben erstattet: € {importo}.',

  'avv.comp.richiesta': '{chi} möchte in deine Partnerliste aufgenommen werden. Wenn du zustimmst, darf er dich zu seinen Buchungen hinzufügen, dich austauschen oder entfernen und deinen Anteil deinem Guthaben belasten. Das gilt auch umgekehrt: du darfst dasselbe bei ihm. Es lässt sich jederzeit wieder aufheben.',
  'avv.comp.accettata': '{chi} hat zugestimmt: ihr steht jetzt gegenseitig auf der Partnerliste.',

  'avv.copertaFido': '\nÜber den Kreditrahmen gedeckt — im Sekretariat begleichen.',
  'avv.aggiuntoCoda': '{chi} hat dich zu seiner Buchung hinzugefügt.{coda}',
  'avv.prolungaCoda': '{chi} hat die Buchung geändert.\nHinzugefügte halbe Stunden: {orari}.{coda}',
  'avv.socio.modificaPrenCompagno': '{chi} hat die Buchung geändert.\n{dettaglio}\nDein Anteil wurde dir wieder gutgeschrieben: € {importo}.',
  'avv.socio.cancellaPrenCompagno': '{chi} hat die Buchung storniert.\n{dettaglio}\nDein Anteil wurde dir wieder gutgeschrieben: € {importo}.',
  'avv.mae.socioModificaLezioneDett': '{chi} hat das Training geändert.\n{dettaglio}',
  'avv.mae.socioCancellaLezioneDett': '{chi} hat das Training abgesagt.\n{dettaglio}',
  'avv.socio.maestroModificaDett': 'Trainer {maestro} hat das Training geändert.\n{dettaglio}',
  'avv.socio.maestroCancellaDett': 'Trainer {maestro} hat das Training abgesagt.\n{dettaglio}',
  'avv.cir.prenotaPerTeDett': 'Der Verein hat für dich gebucht.\n{dettaglio}{coda}',
  'avv.cir.modificaPrenDett': 'Der Verein hat deine Buchung geändert.\nHinzugefügt: {dettaglio}{coda}',
  'avv.cir.compagnoModificaDett': 'Der Verein hat eine Buchung geändert, zu der du hinzugefügt worden warst.\n{dettaglio}{coda}',
  'avv.cir.compagnoProlungaDett': 'Der Verein hat eine Buchung geändert, zu der du hinzugefügt worden warst.\nHinzugefügt: {dettaglio}{coda}',
  'avv.cir.tuaModificataDett': 'Der Verein hat deine Buchung geändert.\n{dettaglio}{coda}',
  'avv.cir.tuaCancellataDett': 'Der Verein hat deine Buchung storniert.\n{dettaglio}{coda}',
  'avv.cir.compagnoModificataDett': 'Der Verein hat eine Buchung geändert, zu der du hinzugefügt worden warst.\n{dettaglio}{coda}',
  'avv.cir.compagnoCancellataDett': 'Der Verein hat eine Buchung storniert, zu der du hinzugefügt worden warst.\n{dettaglio}{coda}',
  'avv.cir.fuoriDaiSociCoda': 'Du bist nicht mehr Mitglied des Vereins.{saldo}{coda}',
  'avv.cir.chiusaOspiteCoda': 'Der Verein hat deinen Gaststatus beendet.{saldo}{coda}',
  'avv.circoloCancellaLezioneDett': 'Der Verein hat das Training abgesagt.\n{dettaglio}',
  'avv.mae.circoloCancellaLezione': 'Der Verein hat das Training abgesagt.\n{dettaglio}\nAusgeführt von {chi}.',

  'avv.sfida.inCorso': 'Duell läuft: {campo}, {quando} um {ora}.',

  // ---------- rifiniture della tornata 108 (secondo giro) ----------
  'avv.unSocio': 'Ein Mitglied',
};

export const avvisi = blocco(it, en, de);
