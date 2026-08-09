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

import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { doc, updateDoc } from 'firebase/firestore';
import { storage, db } from '../lib/firebase';

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
export async function caricaSponsorSfide(circoloId: string, file: File): Promise<string> {
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

  const riferimento = ref(storage, `sponsor_sfide/${circoloId}/sponsor.jpg`);
  await uploadBytes(riferimento, blob);
  const url = await getDownloadURL(riferimento);
  await updateDoc(doc(db, 'circoli', circoloId), { sponsorSfideUrl: url });
  return url;
}
