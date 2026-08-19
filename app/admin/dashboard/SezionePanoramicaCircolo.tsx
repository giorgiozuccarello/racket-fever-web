// ============================================================
// PANORAMICA CIRCOLO — quello che il team Racket Fever vede di un
// circolo, messo in mano al circolo stesso.
//
// ⚠️ NON E' UNA SCHERMATA NUOVA: E' LA STESSA. `SchedaCircoloVista` e'
// il riquadro che il Super Admin apre su un circolo qualunque, e qui
// viene montato tale e quale. Riscriverne una versione «per l'Admin»
// avrebbe voluto dire due schermate che rispondono alla stessa
// domanda: il giorno che un numero cambia definizione, una delle due
// resta indietro e nessuno se ne accorge — e sono i numeri con cui il
// circolo si giudica.
//
// L'unica cosa che e' servita e' un permesso, e va aperto in DUE
// posti, non uno: la fotografia notturna era leggibile dal solo Super
// Admin, e il tasto «Aggiorna adesso» chiamabile dal solo Super Admin.
//
// ⚠️ E OGGI LE DUE PORTE NON SONO PIU' SIMMETRICHE, che e' proprio la
// cosa che questo commento esiste per dire. LEGGERE la fotografia lo
// puo' fare chiunque apra la Dashboard del circolo, Collaboratore
// compreso (firestore.rules, `isAdminDiCircolo` su match /fotografie):
// li' dentro non c'e' un dato che non legga gia' dalle tessere che
// maneggia alla cassa. RIFARLA no: `fotografiaCircolo` in
// functions/src/index.ts resta al solo responsabile, perche' uno
// scatto rilegge tutto lo storico del circolo. Di qui la prop
// `puoAggiornare`.
//
// ⚠️ E LE DUE SOTTOSEZIONI STANNO DENTRO. «Soci» e «Debiti dei Soci»
// erano due sezioni sciolte in mezzo alla dashboard, lontane dai
// numeri che le riassumono: si leggeva «14 soci tesserati» in cima e
// si cercava l'elenco trenta righe piu' sotto. Sono le stesse due
// schermate di prima, spostate — non copiate.
// ============================================================

'use client';

import SchedaCircoloVista from '../../superadmin/dashboard/SchedaCircoloVista';
import SezioneCollassabile from './SezioneCollassabile';
import SezioneSoci, { ETICHETTA_SOCI } from './SezioneSoci';
import SezioneDebitiSoci, { ETICHETTA_DEBITI } from './SezioneDebitiSoci';
import { SocioCircolo } from '../../../data/users';

export default function SezionePanoramicaCircolo({
  circoloId, statoCircolo, puoAggiornare = true, soci, onSelezionaSocio,
}: {
  circoloId: string;
  // Falso per il Collaboratore: legge i numeri come tutti, ma non ha il
  // tasto che li rifà — quello rilegge tutto lo storico del circolo, ed
  // è lavoro pesante che non si mette in mano a una password condivisa.
  puoAggiornare?: boolean;
  // Serve solo a spegnere l'avviso «fotografia rimasta indietro» sui
  // circoli non attivi, che il giro notturno non fotografa piu'.
  statoCircolo?: string;
  soci: SocioCircolo[];
  onSelezionaSocio: (uid: string) => void;
}) {
  return (
    <div className="admin-card">
      <SchedaCircoloVista
        circoloId={circoloId} perAdmin
        statoCircolo={statoCircolo}
        puoAggiornare={puoAggiornare}
      />

      {/* ⚠️ Annidate, e questo e' l'unico punto del progetto in cui
          succede: il contenitore collassabile nasce per stare in cima
          alla pagina, dentro la griglia a colonne. Dentro un altro
          collassabile i suoi margini e il suo bordo si sommano a quelli
          del padre — la regola `.admin-collassa-contenuto
          .admin-collassa-wrapper` in globals.css toglie il doppio
          incolonnamento. Gli identificativi restano distinti, quindi
          ognuna si ricorda da sola se era aperta. */}
      <SezioneCollassabile id="soci" {...ETICHETTA_SOCI}>
        <SezioneSoci soci={soci} onSelezionaSocio={onSelezionaSocio} />
      </SezioneCollassabile>

      <SezioneCollassabile id="debiti" {...ETICHETTA_DEBITI}>
        <SezioneDebitiSoci soci={soci} onSelezionaSocio={onSelezionaSocio} />
      </SezioneCollassabile>
    </div>
  );
}
