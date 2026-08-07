import { orarioFineSlot } from './circoli';

// Dati minimi per riconoscere due mezz'ore come parte della stessa
// prenotazione. Non serve il documento intero: bastano questi.
export interface DatiCard {
  id: string;
  campoId: string;
  data: string;
  utenteId: string;
  // Serve per gli ESTERNI, che non hanno un account: il loro utenteId
  // e' la stringa vuota, quindi senza il nome due allievi diversi
  // sarebbero indistinguibili.
  utenteNome?: string;
  // Campo e lezione vivono in due sezioni diverse della Home: non
  // possono finire nella stessa card nemmeno condividendo il cardId.
  tipo?: 'campo' | 'lezione';
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
// Quando c'e' un cardId, DECIDE lui. E' l'identita' scritta sul dato
// nel momento in cui l'utente ha scelto "Prolunga" o "prenotazione
// nuova", e vince su qualunque somiglianza dedotta a posteriori.
// Confrontare anche maestro e compagno, la' dove il cardId c'e' gia',
// spezzava in due card una prenotazione sola: basta prolungarne una e
// cambiare compagno perche' le mezz'ore smettano di somigliarsi, pur
// essendo — per esplicita scelta di chi ha prenotato — la stessa
// partita.
//
// Senza cardId — i dati nati prima che il campo esistesse — non resta
// che dedurre: stesso campo, stesso giorno, stessa persona, stesso
// maestro, stesso compagno. E' il criterio di sempre, tenuto solo per
// loro.
export function stessaCard(
  a: DatiCard | null | undefined,
  b: DatiCard | null | undefined
): boolean {
  if (!a || !b) return false;
  if (a.campoId !== b.campoId || a.data !== b.data || a.utenteId !== b.utenteId) return false;
  // Un esterno non ha account: l'utenteId e' vuoto per tutti. Senza il
  // nome, "Mario" delle 18:00 e "Luigi" delle 18:30 sullo stesso campo
  // risulterebbero la stessa persona.
  if (!a.utenteId && (a.utenteNome ?? '') !== (b.utenteNome ?? '')) return false;
  // Il tipo e' strutturale, non una somiglianza: la Home tiene i campi
  // e le lezioni in due elenchi separati, quindi una card mista non
  // potrebbe comunque esistere a schermo. Vale anche a cardId uguale.
  if ((a.tipo ?? 'campo') !== (b.tipo ?? 'campo')) return false;

  if (a.cardId != null || b.cardId != null) {
    // Il ripiego sull'id documento tiene separate le prenotazioni
    // distinte, e fa combaciare il prolungamento di una prenotazione
    // vecchia: il cardId che eredita E' l'id della mezz'ora prolungata.
    return (a.cardId ?? a.id) === (b.cardId ?? b.id);
  }

  return (a.maestroId ?? null) === (b.maestroId ?? null)
    && (a.compagnoId ?? null) === (b.compagnoId ?? null);
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
