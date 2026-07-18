// ============================================================
// CALCOLO PREZZO
// Il prezzo appartiene al campo: prezzo base, eventualmente
// sostituito dalla tariffa speciale se giorno+orario corrispondono.
// Non restituisce mai null: se l'admin non ha ancora impostato un
// prezzo base, lo slot resta comunque prenotabile a €0,00 (nessuno
// stato "non impostato" bloccante nella griglia dei soci).
// ============================================================

import { Campo, TariffaSpeciale } from './circoli';

export function trovaTariffaApplicabile(
  campo: Campo, giorno: Date, orario: string
): TariffaSpeciale | null {
  const t = campo.tariffaSpeciale;
  if (!t) return null;
  const oraInRange = orario >= t.orarioInizio && orario < t.orarioFine;
  const giornoOk = !t.giorni || t.giorni.length === 0 || t.giorni.includes(giorno.getDay());
  return oraInRange && giornoOk ? t : null;
}

export function calcolaPrezzo(campo: Campo, giorno: Date, orario: string): number {
  const t = trovaTariffaApplicabile(campo, giorno, orario);
  if (t) return t.prezzo;
  return campo.prezzoOraDefault ?? 0;
}
