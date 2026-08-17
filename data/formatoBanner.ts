// ============================================================
// IL FORMATO DI UN BANNER SPONSOR.
//
// ⚠️ STA IN UN FILE SUO, senza nessun import, per due motivi. Il primo:
// lo usano tutti e due i progetti, e prima erano due copie — due copie
// di una tabella di formati divergono al primo formato aggiunto. Il
// secondo: e' una funzione pura, e in un file che tira dentro React
// Native o il DOM non si sarebbe potuta provare.
//
// ⚠️ E la distinzione che fa non e' «bello/brutto», e' QUESTA: ci sono
// formati che possono contenere un'animazione, e formati che no. Sui
// primi non si puo' ritagliare niente — chi ritaglia legge un
// fotogramma solo e restituisce una figurina ferma, cioe' esattamente
// il contrario di quello che lo sponsor ha comprato.
// ============================================================

export interface FormatoBanner {
  estensione: string;
  tipo: string;
  animabile: boolean;
}

const CONOSCIUTI = ['gif', 'webp', 'png', 'jpg', 'jpeg'];

// `nome` puo' essere un percorso di file, un indirizzo o il nome
// scelto dall'utente: si guarda solo quello che c'e' dopo l'ultimo
// punto, tolte query e frammento. Se non dice niente di utile decide
// il tipo dichiarato. Sconosciuto = JPEG, che e' la strada di sempre e
// non rompe niente.
export function formatoBanner(nome: string, mime?: string | null): FormatoBanner {
  const dalNome = (nome.split('?')[0].split('#')[0].split('.').pop() ?? '').toLowerCase();
  const dalMime = (mime ?? '').toLowerCase().replace('image/', '').split(';')[0].trim();
  const grezzo = CONOSCIUTI.includes(dalNome) ? dalNome : dalMime;
  if (grezzo === 'gif') return { estensione: 'gif', tipo: 'image/gif', animabile: true };
  if (grezzo === 'webp') return { estensione: 'webp', tipo: 'image/webp', animabile: true };
  if (grezzo === 'png') return { estensione: 'png', tipo: 'image/png', animabile: false };
  return { estensione: 'jpg', tipo: 'image/jpeg', animabile: false };
}
