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
import { doc, updateDoc, getDoc } from 'firebase/firestore';
import { storage, db } from '../lib/firebase';
import {
  Circolo, immaginiSponsor, MAX_IMMAGINI_SPONSOR, INTERVALLO_SPONSOR_MINIMO,
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
  await uploadBytes(riferimento, blob);
  const url = await getDownloadURL(riferimento);
  await updateDoc(doc(db, 'circoli', circoloId), { logoUrl: url });
  return url;
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
  await uploadBytes(riferimento, blob);
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
  // Con piu' di un'immagine il cambio non puo' restare su "fisso", o il
  // secondo sponsor non comparirebbe mai. Si alza al minimo, e l'Admin
  // se lo vede spostare sotto gli occhi.
  const intervalloAttuale = dati?.sponsorSfideIntervallo ?? 0;
  if (nuovo.length > 1 && intervalloAttuale <= 0) {
    modifiche.sponsorSfideIntervallo = INTERVALLO_SPONSOR_MINIMO;
  }
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
  const istantanea = await getDoc(riferimentoCircolo);
  const dati = istantanea.data() as Circolo | undefined;
  const elenco = immaginiSponsor(dati);
  if (indice < 0 || indice >= elenco.length) return;
  const nuovo = elenco.filter((_, i) => i !== indice);
  await updateDoc(riferimentoCircolo, { sponsorSfideUrls: nuovo, sponsorSfideUrl: null });
}

// Tempo di cambio fra uno sponsor e l'altro, in secondi. Zero = fisso.
export async function impostaIntervalloSponsor(circoloId: string, secondi: number): Promise<void> {
  await updateDoc(doc(db, 'circoli', circoloId), { sponsorSfideIntervallo: secondi });
}
