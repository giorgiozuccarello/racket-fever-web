// ============================================================
// UTILITY SETTIMANA
// Serve per il limite di ore settimanali: dato un giorno, calcola
// l'intervallo lunedì–domenica in cui cade, per poter sommare le
// prenotazioni esistenti in quella stessa settimana.
// ============================================================

export function settimanaDi(data: Date): { inizio: string; fine: string } {
  const d = new Date(data);
  const giorno = d.getDay(); // 0=Domenica...6=Sabato
  const offsetLunedi = giorno === 0 ? -6 : 1 - giorno;

  const lunedi = new Date(d);
  lunedi.setDate(d.getDate() + offsetLunedi);

  const domenica = new Date(lunedi);
  domenica.setDate(lunedi.getDate() + 6);

  return { inizio: formatISO(lunedi), fine: formatISO(domenica) };
}

export function formatISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
