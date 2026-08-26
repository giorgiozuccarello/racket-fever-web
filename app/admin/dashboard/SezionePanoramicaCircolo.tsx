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
import SelettoreLingua from './SelettoreLingua';
// ⚠️ QUI NON C'È PIÙ `LinguaProvider`, ed è un cambio della tornata
// 106: l'involucro è salito su `page.tsx` e adesso copre tutta la
// dashboard. Rimetterlo qui creerebbe un secondo stato della lingua
// annidato dentro il primo — questa sezione cambierebbe lingua e le
// altre ventotto no.
import SezioneCollassabile from './SezioneCollassabile';
import SezioneSoci, { etichettaSoci } from './SezioneSoci';
import SezioneDebitiSoci, { etichettaDebiti } from './SezioneDebitiSoci';
import { SocioCircolo } from '../../../data/users';
import { useLingua } from '../../../lib/lingua';

export default function SezionePanoramicaCircolo({
  circoloId, statoCircolo, attivatoIlMs, puoAggiornare = true, soci, onSelezionaSocio,
}: {
  circoloId: string;
  // Ancora il periodo del conteggio all'anniversario del circolo.
  attivatoIlMs?: number | null;
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
  // Serve solo alle etichette delle due sottosezioni annidate: i testi
  // della scheda se li traduce `SchedaCircoloVista` per conto suo.
  const { t } = useLingua();

  return (
    // ============================================================
    // ⚠️ IL CONTENITORE DELLA LINGUA NON E' PIU' QUI: sta su
    // `page.tsx` e avvolge tutta la dashboard dell'Admin, perche' dalla
    // tornata 106 non e' piu' questa sola sezione a tradursi. Il
    // selettore invece resta qui, dove l'Admin lo ha sempre trovato:
    // e' il comando, non la memoria.
    //
    // ⚠️ 'admin' (il ruolo con cui `page.tsx` monta l'involucro): e' la
    // stessa preferenza che l'Admin trova nell'app sulla Panoramica del
    // telefono (chiave `rf.lingua.admin`), e sono due dispositivi
    // diversi con due memorie diverse. Il socio e il Maestro hanno le
    // loro, e non si parlano con questa.
    //
    // ⚠️ E `SchedaCircoloVista` fuori dalla dashboard dell'Admin resta
    // in italiano: e' il caso del Super Admin, che apre la stessa
    // scheda dal pannello di rete — li' l'involucro non c'e' e un
    // selettore non ce l'ha.
    // ============================================================
    <div className="admin-card">
      <SelettoreLingua />
      <SchedaCircoloVista
        circoloId={circoloId} perAdmin
        statoCircolo={statoCircolo}
        attivatoIlMs={attivatoIlMs}
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
      <SezioneCollassabile id="soci" {...etichettaSoci(t)}>
        <SezioneSoci soci={soci} onSelezionaSocio={onSelezionaSocio} />
      </SezioneCollassabile>

      <SezioneCollassabile id="debiti" {...etichettaDebiti(t)}>
        <SezioneDebitiSoci soci={soci} onSelezionaSocio={onSelezionaSocio} />
      </SezioneCollassabile>
    </div>
  );
}
