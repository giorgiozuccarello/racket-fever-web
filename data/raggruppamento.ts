import { orarioFineSlot } from './circoli';

// Raggruppa in "blocchi" le prenotazioni che formano mezz'ore
// consecutive sullo stesso campo, stesso giorno, stesso titolare
// (e stesso Maestro, per le lezioni) — così una prenotazione fatta
// con la multiselezione compare come UNA card, non una per mezz'ora.
// Puramente a schermo: i documenti restano quelli di sempre, uno per
// mezz'ora — se se ne cancella uno solo, al render successivo i
// rimanenti si ricompongono da soli nel gruppo (o nei gruppi) giusti.
// Condivisa tra Profilo Socio e Dashboard Maestro — un'unica fonte di
// verità invece di due copie della stessa logica.
export function raggruppaConsecutive<T extends {
  id: string; campoId: string; data: string; orario: string; utenteId: string;
  maestroId?: string;
  // Identificativo della prenotazione logica: le mezz'ore prolungate
  // lo ereditano, una prenotazione nuova ne riceve uno proprio.
  cardId?: string | null;
  compagnoId?: string | null;
}>(
  items: T[]
): T[][] {
  const ordinati = [...items].sort((a, b) => {
    if (a.campoId !== b.campoId) return a.campoId.localeCompare(b.campoId);
    if (a.data !== b.data) return a.data.localeCompare(b.data);
    if (a.utenteId !== b.utenteId) return a.utenteId.localeCompare(b.utenteId);
    return a.orario.localeCompare(b.orario);
  });
  const gruppi: T[][] = [];
  for (const item of ordinati) {
    const ultimo = gruppi[gruppi.length - 1];
    const precedente = ultimo ? ultimo[ultimo.length - 1] : null;
    // Due mezz'ore finiscono nella stessa card solo se appartengono
    // alla STESSA prenotazione. La contiguita' oraria da sola non
    // basta: prenotando alle 18:30 accanto a una gia' esistente delle
    // 19:00, ma scegliendo "prenotazione nuova", sono due partite
    // distinte e vanno mostrate separate — anche con compagni diversi.
    // Quando NESSUNA delle due mezz'ore porta un cardId si torna al
    // criterio di prima — la sola contiguita'. Serve per i dati nati
    // prima che il cardId esistesse e per le prenotazioni scritte da
    // percorsi che non lo valorizzano: senza questa via di mezzo il
    // confronto ricadrebbe sull'id del documento, sempre diverso, e
    // ogni mezz'ora diventerebbe una card a se'.
    const stessaPrenotazione = !!precedente && (
      (precedente.cardId == null && item.cardId == null)
        ? true
        : (precedente.cardId ?? precedente.id) === (item.cardId ?? item.id)
    );

    const contiguo = !!precedente
      && precedente.campoId === item.campoId
      && precedente.data === item.data
      && precedente.utenteId === item.utenteId
      && (precedente.maestroId ?? null) === (item.maestroId ?? null)
      && (precedente.compagnoId ?? null) === (item.compagnoId ?? null)
      && orarioFineSlot(precedente.orario) === item.orario
      && stessaPrenotazione;
    if (contiguo) ultimo!.push(item);
    else gruppi.push([item]);
  }
  return gruppi;
}
