import { orarioFineSlot } from './circoli';

// Dati minimi per riconoscere due mezz'ore come parte della stessa
// prenotazione. Non serve il documento intero: bastano questi.
export interface DatiCard {
  id: string;
  campoId: string;
  data: string;
  utenteId: string;
  maestroId?: string;
  cardId?: string | null;
  compagnoId?: string | null;
}

// Vero se due mezz'ore appartengono alla STESSA prenotazione logica.
//
// E' l'unico criterio in tutta l'app: lo usano il raggruppamento delle
// card e il vincolo sulla mezz'ora centrale. Devono per forza dire la
// stessa cosa — altrimenti l'app disegna due card distinte e poi
// impedisce di cancellare l'estremita' di una perche' "sta in mezzo"
// all'altra.
//
// Il confronto sul cardId ha una via di mezzo: quando NESSUNA delle due
// lo porta si ricade sulla sola contiguita', per non perdere i dati
// nati prima che il campo esistesse. Quando almeno una ce l'ha, invece,
// deve corrispondere: il ripiego sull'id documento (sempre diverso)
// tiene giustamente separate le prenotazioni distinte.
export function stessaCard(
  a: DatiCard | null | undefined,
  b: DatiCard | null | undefined
): boolean {
  if (!a || !b) return false;
  const stessoIdentificativo = (a.cardId == null && b.cardId == null)
    ? true
    : (a.cardId ?? a.id) === (b.cardId ?? b.id);
  return a.campoId === b.campoId
    && a.data === b.data
    && a.utenteId === b.utenteId
    && (a.maestroId ?? null) === (b.maestroId ?? null)
    && (a.compagnoId ?? null) === (b.compagnoId ?? null)
    && stessoIdentificativo;
}

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
    const contiguo = !!precedente
      && orarioFineSlot(precedente.orario) === item.orario
      && stessaCard(precedente, item);
    if (contiguo) ultimo!.push(item);
    else gruppi.push([item]);
  }
  return gruppi;
}
