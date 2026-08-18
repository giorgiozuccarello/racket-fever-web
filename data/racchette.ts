// ============================================================
// RACCHETTE — l'elenco fra cui scegliere, al posto del testo libero.
//
// ⚠️ ERA L'ULTIMO CAMPO LIBERO CHE UN SOCIO POTEVA RIEMPIRE COME
// VOLEVA, e si vedeva nella scheda che ogni altro socio del circolo può
// aprire. Tolte le chat, restava lui: un posto dove scrivere qualunque
// cosa, visibile a tutti, senza che nessuno lo guardi mai. Un elenco
// chiuso lo chiude.
//
// ⚠️ E SERVIVA COMUNQUE. Scritta a mano, la stessa racchetta finisce
// in quattro gruppi diversi — «Babolat Pure Aero», «babolat pure
// aero», «Pure Aero», «Babolat» — e qualunque statistica su cosa gioca
// il circolo diventa impossibile. Questo elenco è la marca, non il
// modello: il modello cambia ogni anno, la marca no, ed è quello che
// interessa a chi vende.
//
// File gemello, identico nei due progetti, senza import.
// ============================================================

// «Altra» in fondo, e non è un ripiego: chi gioca con una marca che
// non c'è deve poter dire qualcosa, altrimenti sceglie a caso la più
// vicina e il dato diventa peggiore di niente.
export const MARCHE_RACCHETTE: string[] = [
  'Babolat',
  'Wilson',
  'Head',
  'Yonex',
  'Dunlop',
  'Prince',
  'Tecnifibre',
  'Volkl',
  'Slazenger',
  'Artengo',
  'Adidas',
  'Bullpadel',
  'Nox',
  'Siux',
  'Altra',
];

// ⚠️ I valori scritti prima di oggi sono testo libero e NON stanno in
// questo elenco. Non si cancellano: si continuano a mostrare come sono
// finché la persona non ne sceglie uno nuovo. Cancellarli avrebbe
// voluto dire svuotare la scheda di mezzo circolo per una modifica
// tecnica che non riguarda i soci.
export function racchettaNota(valore: string | null | undefined): boolean {
  return !!valore && MARCHE_RACCHETTE.includes(valore);
}
