// ============================================================
// STORAGE — caricamento del logo circolo (web).
//
// Non essendoci un selettore nativo con ritaglio come su mobile,
// qui il ritaglio quadrato avviene in automatico: prendiamo il
// quadrato più grande centrato nell'immagine caricata, poi lo
// ridimensioniamo a 512x512 e lo comprimiamo — così qualsiasi
// immagine scelta dall'admin diventa sempre quadrata e leggera,
// senza bisogno di un'interfaccia di ritaglio manuale.
// ============================================================

import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { doc, updateDoc, getDoc, runTransaction } from 'firebase/firestore';
import { storage, db } from '../lib/firebase';
import {
  Circolo, immaginiSponsor, MAX_IMMAGINI_SPONSOR,
  durateSponsor, DURATA_SPONSOR_MINIMA, DURATA_SPONSOR_PREDEFINITA,
} from './circoli';

const LATO = 512;
// Lo sponsor delle Sfide e' una fascia 3:1: nel browser non c'e' un
// selettore con ritaglio, quindi si prende il rettangolo 3:1 piu'
// grande centrato nell'immagine, esattamente come per il logo si
// prende il quadrato piu' grande.
const SPONSOR_LARGHEZZA = 1200;
const SPONSOR_ALTEZZA = 400;

function caricaImmagine(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Immagine non valida'));
    img.src = URL.createObjectURL(file);
  });
}

async function prepara(file: File): Promise<Blob> {
  const img = await caricaImmagine(file);
  const lato = Math.min(img.width, img.height);
  const offsetX = (img.width - lato) / 2;
  const offsetY = (img.height - lato) / 2;

  const canvas = document.createElement('canvas');
  canvas.width = LATO;
  canvas.height = LATO;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error("Impossibile elaborare l'immagine");
  ctx.drawImage(img, offsetX, offsetY, lato, lato, 0, 0, LATO, LATO);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Errore di conversione'))),
      'image/jpeg',
      0.85
    );
  });
}

export async function caricaLogoCircolo(circoloId: string, file: File): Promise<string> {
  const blob = await prepara(file);
  const riferimento = ref(storage, `loghi_circoli/${circoloId}/logo.jpg`);
  // ⚠️ Il tipo si DICHIARA. Le regole dello Storage adesso accettano
  // solo image/*, e il blob che esce da fetch() su un file locale
  // arriva spesso senza tipo o come application/octet-stream: senza
  // questa riga il caricamento verrebbe respinto, e l'unica cosa che
  // l'utente vedrebbe e' un errore generico. Il file e' sempre un JPEG
  // — lo produce il ritaglio qui sopra.
  await uploadBytes(riferimento, blob, { contentType: 'image/jpeg' });
  const url = await getDownloadURL(riferimento);
  await updateDoc(doc(db, 'circoli', circoloId), { logoUrl: url });
  return url;
}

// ============================================================
// FOTO DEL MAESTRO — la carica l'Admin dalla scheda del Maestro.
//
// ⚠️ NON finisce sotto foto_profilo/{uid}. Li' le regole dello Storage
// consentono la scrittura al solo proprietario dell'identificativo, e
// qui a caricare e' l'Admin: sarebbe stato respinto sempre. Sta invece
// sotto foto_maestri/{circoloId}, dove comanda chi comanda sul
// circolo, esattamente come per logo e sponsor.
//
// ⚠️ E il nome del file porta l'istante. Storage rigenera il token di
// download a ogni scrittura sullo stesso percorso: con un nome fisso,
// un caricamento andato a buon fine seguito da un salvataggio fallito
// avrebbe lasciato sulla scheda un indirizzo morto — foto rotta, e
// nessun modo di capire perche'.
export async function caricaFotoMaestro(circoloId: string, uid: string, file: File): Promise<string> {
  const blob = await prepara(file);
  const riferimento = ref(storage, `foto_maestri/${circoloId}/${uid}_${Date.now()}.jpg`);
  await uploadBytes(riferimento, blob, { contentType: 'image/jpeg' });
  return await getDownloadURL(riferimento);
}

// Toglie dal bucket una foto di Maestro che non serve piu' (sostituita
// o rimossa dalla scheda).
// ⚠️ Non fa fallire niente se non ci riesce: si chiama sempre DOPO che
// la scheda e' stata salvata, e a quel punto il file non e' piu'
// raggiungibile da nessuna schermata. Un errore qui e' un file
// dimenticato, non un dato perso.
// ⚠️ Ma va chiamata: senza, ogni "cambia foto" lasciava nel bucket una
// copia a pagamento, e il volto di un Maestro allontanato dal circolo
// restava scaricabile da chi si era salvato l'indirizzo.
export async function rimuoviFotoMaestro(url?: string | null): Promise<void> {
  if (!url) return;
  try {
    await deleteObject(ref(storage, url));
  } catch (e) {
    console.warn('Foto del Maestro non rimossa dallo storage:', (e as any)?.message ?? e);
  }
}

// Sponsor mostrato in cima alla Classifica Sfide, lato pannello web.
export async function caricaSponsorSfide(circoloId: string, file: File, indice: number): Promise<string> {
  const img = await caricaImmagine(file);
  // Rettangolo 3:1 piu' grande che ci sta dentro, centrato.
  const proporzione = SPONSOR_LARGHEZZA / SPONSOR_ALTEZZA;
  let larghezza = img.width;
  let altezza = larghezza / proporzione;
  if (altezza > img.height) {
    altezza = img.height;
    larghezza = altezza * proporzione;
  }
  const offsetX = (img.width - larghezza) / 2;
  const offsetY = (img.height - altezza) / 2;

  const canvas = document.createElement('canvas');
  canvas.width = SPONSOR_LARGHEZZA;
  canvas.height = SPONSOR_ALTEZZA;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error("Impossibile elaborare l'immagine");
  ctx.drawImage(img, offsetX, offsetY, larghezza, altezza, 0, 0, SPONSOR_LARGHEZZA, SPONSOR_ALTEZZA);

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('Errore di conversione'))),
      'image/jpeg',
      0.85
    );
  });

  // Nome UNICO, non legato alla posizione. Numerandolo per posizione,
  // togliendo lo sponsor 1 le immagini scalano di uno ma i file no: il
  // caricamento successivo riscriverebbe un file ancora in uso da
  // un'altra posizione, e quell'altra si ritroverebbe l'indirizzo
  // morto — Storage rigenera il token a ogni scrittura.
  const riferimento = ref(storage, `sponsor_sfide/${circoloId}/sponsor_${Date.now()}.jpg`);
  // ⚠️ Il tipo si DICHIARA. Le regole dello Storage adesso accettano
  // solo image/*, e il blob che esce da fetch() su un file locale
  // arriva spesso senza tipo o come application/octet-stream: senza
  // questa riga il caricamento verrebbe respinto, e l'unica cosa che
  // l'utente vedrebbe e' un errore generico. Il file e' sempre un JPEG
  // — lo produce il ritaglio qui sopra.
  await uploadBytes(riferimento, blob, { contentType: 'image/jpeg' });
  const url = await getDownloadURL(riferimento);

  // La lista si rilegge dal documento vero, non da quella che aveva in
  // mano la schermata: due caricamenti ravvicinati da due postazioni si
  // sovrascriverebbero a vicenda.
  const riferimentoCircolo = doc(db, 'circoli', circoloId);
  const istantanea = await getDoc(riferimentoCircolo);
  const dati = istantanea.data() as Circolo | undefined;
  const elenco = immaginiSponsor(dati);
  const nuovo = [...elenco];
  if (indice >= nuovo.length) nuovo.push(url);
  else nuovo[indice] = url;
  const sostituito = indice < elenco.length ? elenco[indice] : null;

  const modifiche: Record<string, unknown> = {
    sponsorSfideUrls: nuovo.slice(0, MAX_IMMAGINI_SPONSOR),
    // Il campo a immagine singola si svuota qui: da adesso quel circolo
    // e' passato alla lista, e leggerli entrambi darebbe un doppione.
    sponsorSfideUrl: null,
  };
  // Le durate seguono le immagini, posizione per posizione. Un banner
  // nuovo nasce con la durata predefinita; se un altro si e' preso la
  // scena (durata zero) il nuovo entra comunque, ma resta invisibile
  // finche' quello zero non viene tolto — ed e' esattamente quello che
  // l'Admin ha chiesto mettendolo a zero.
  const durateAttuali = durateSponsor(dati);
  const nuoveDurate = [...durateAttuali];
  while (nuoveDurate.length < nuovo.length) nuoveDurate.push(DURATA_SPONSOR_PREDEFINITA);
  modifiche.sponsorSfideDurate = nuoveDurate.slice(0, MAX_IMMAGINI_SPONSOR);
  await updateDoc(riferimentoCircolo, modifiche);

  // Il file sostituito non serve piu' a nessuno. Si cancella DOPO aver
  // salvato, e senza far fallire niente se non ci si riesce: un file
  // dimenticato non si vede, una lista salvata a meta' si.
  if (sostituito && sostituito !== url) {
    try {
      await deleteObject(ref(storage, sostituito));
    } catch {
      // gia' cancellato, o e' il file del campo vecchio: non blocca.
    }
  }
  return url;
}

// Toglie l'immagine in una posizione. Le successive scalano di uno: la
// lista non deve avere buchi, o la rotazione mostrerebbe il vuoto.
export async function rimuoviImmagineSponsor(circoloId: string, indice: number): Promise<void> {
  const riferimentoCircolo = doc(db, 'circoli', circoloId);
  await runTransaction(db, async (tx) => {
    const istantanea = await tx.get(riferimentoCircolo);
    const dati = istantanea.data() as Circolo | undefined;
    const elenco = immaginiSponsor(dati);
    if (indice < 0 || indice >= elenco.length) return;
    const nuovo = elenco.filter((_, i) => i !== indice);
    // La durata se ne va insieme alla sua immagine, o da qui in poi
    // ogni banner erediterebbe il tempo di quello prima.
    const nuoveDurate = durateSponsor(dati).filter((_, i) => i !== indice);
    tx.update(riferimentoCircolo, {
      sponsorSfideUrls: nuovo,
      sponsorSfideUrl: null,
      sponsorSfideDurate: nuoveDurate,
    });
  });
}

// ⚠️ La durata di UN banner, in secondi. Zero vuol dire "solo questo,
// e fisso": in quel caso tutti gli altri tornano al valore minimo e i
// loro comandi si spengono, cosi' l'Admin vede subito che sono fuori
// gioco e sa come rimetterli dentro (togliere lo zero). Senza questa
// regola due zeri avrebbero significati contraddittori.
export async function impostaDurataSponsor(
  circoloId: string, indice: number, secondi: number,
): Promise<void> {
  const riferimentoCircolo = doc(db, 'circoli', circoloId);
  // ⚠️ Dentro una transazione, e riscrivendo ANCHE l'elenco delle
  // immagini. Leggendo e scrivendo in due tempi, bastava che nel
  // frattempo qualcuno togliesse un banner — dall'altro pannello, o
  // dall'altro dispositivo — per lasciare un elenco di durate piu'
  // lungo di quello delle immagini: da li' in poi ogni banner
  // ereditava il tempo di un altro.
  await runTransaction(db, async (tx) => {
    const istantanea = await tx.get(riferimentoCircolo);
    const dati = istantanea.data() as Circolo | undefined;
    const urls = immaginiSponsor(dati);
    const durate = durateSponsor(dati);
    if (indice < 0 || indice >= durate.length) return;

    const valore = secondi <= 0 ? 0 : Math.max(DURATA_SPONSOR_MINIMA, Math.round(secondi));
    const nuove = valore === 0
      ? durate.map((_, i) => (i === indice ? 0 : DURATA_SPONSOR_PREDEFINITA))
      : durate.map((d, i) => (i === indice ? valore : d));
    tx.update(riferimentoCircolo, { sponsorSfideUrls: urls, sponsorSfideUrl: null, sponsorSfideDurate: nuove });
  });
}

// Sposta un banner di una posizione, su o giu'. L'ordine conta due
// volte: e' quello di rotazione, ed e' quello che decide chi vince se
// piu' banner sono a zero. Immagine e durata viaggiano insieme.
export async function spostaImmagineSponsor(
  circoloId: string, indice: number, verso: -1 | 1,
): Promise<void> {
  const riferimentoCircolo = doc(db, 'circoli', circoloId);
  await runTransaction(db, async (tx) => {
    const istantanea = await tx.get(riferimentoCircolo);
    const dati = istantanea.data() as Circolo | undefined;
    const elenco = immaginiSponsor(dati);
    const destinazione = indice + verso;
    if (indice < 0 || indice >= elenco.length) return;
    if (destinazione < 0 || destinazione >= elenco.length) return;

    const urls = [...elenco];
    const durate = durateSponsor(dati);
    [urls[indice], urls[destinazione]] = [urls[destinazione], urls[indice]];
    [durate[indice], durate[destinazione]] = [durate[destinazione], durate[indice]];
    tx.update(riferimentoCircolo, {
      sponsorSfideUrls: urls,
      sponsorSfideUrl: null,
      sponsorSfideDurate: durate,
    });
  });
}

// ============================================================
// VOLANTINO DELLA BACHECA — l'unica immagine dell'app che NON viene
// ritagliata.
//
// Il logo e' un quadrato, lo sponsor e' una fascia 3:1: di quelli si
// prende il ritaglio piu' grande centrato e si butta il resto. Un
// volantino no — e' un A4 verticale, e ritagliarlo a quadrato vuol
// dire buttare via meta' del foglio, che di solito e' proprio la
// meta' con l'orario e il numero di telefono. Qui si tengono le
// proporzioni originali e si limita solo il LATO PIU' LUNGO, cosi'
// un A4, una locandina orizzontale e una foto scattata al volo
// arrivano tutte leggere senza perdere niente.
// ============================================================
const VOLANTINO_LATO_MAX = 1400;

export async function caricaVolantino(circoloId: string, file: File): Promise<string> {
  const img = await caricaImmagine(file);
  const piuLungo = Math.max(img.width, img.height);
  // Non si ingrandisce mai: una locandina gia' piccola sgranata a
  // 1400 pesa di piu' e si legge peggio dell'originale.
  const fattore = piuLungo > VOLANTINO_LATO_MAX ? VOLANTINO_LATO_MAX / piuLungo : 1;

  const canvas = document.createElement('canvas');
  canvas.width = Math.round(img.width * fattore);
  canvas.height = Math.round(img.height * fattore);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error("Impossibile elaborare l'immagine");
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('Errore di conversione'))),
      'image/jpeg',
      0.85,
    );
  });

  // ⚠️ Il nome del file porta l'istante: senza, due volantini caricati
  // per lo stesso circolo finivano sullo stesso indirizzo, e il
  // secondo sostituiva il primo — con l'avviso di ieri che da un
  // momento all'altro mostrava la locandina di oggi.
  const nome = `${Date.now()}.jpg`;
  const riferimento = ref(storage, `bacheca/${circoloId}/${nome}`);
  // ⚠️ Il tipo si DICHIARA. Le regole dello Storage adesso accettano
  // solo image/*, e il blob che esce da fetch() su un file locale
  // arriva spesso senza tipo o come application/octet-stream: senza
  // questa riga il caricamento verrebbe respinto, e l'unica cosa che
  // l'utente vedrebbe e' un errore generico. Il file e' sempre un JPEG
  // — lo produce il ritaglio qui sopra.
  await uploadBytes(riferimento, blob, { contentType: 'image/jpeg' });
  return await getDownloadURL(riferimento);
}

// Il file resta orfano se l'avviso viene tolto: qui si toglie anche
// quello. Fallisce in silenzio — un volantino orfano non fa danno, un
// errore a schermo mentre si cancella un avviso si'.
export async function rimuoviVolantino(url?: string | null): Promise<void> {
  if (!url) return;
  try {
    await deleteObject(ref(storage, url));
  } catch (e) {
    console.warn('Volantino non rimosso dallo storage:', (e as any)?.message ?? e);
  }
}
