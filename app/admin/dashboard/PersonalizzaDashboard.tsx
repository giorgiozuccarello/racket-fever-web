'use client';

// ============================================================
// PERSONALIZZA DASHBOARD — i sei cursori.
//
// ⚠️ QUESTO PEZZO NON SA DOVE SI SALVA E NON SA CHE LINGUA PARLA, ed è
// il motivo per cui esiste separato. Lo montano due pannelli diversi:
// il circolo, che scrive nella propria sottocollezione e parla tre
// lingue, e il Super Admin, che scrive sul proprio account ed è in
// italiano diretto. Le uniche due cose che cambiano fra i due sono la
// funzione `salva` e l'oggetto `testi`, e arrivano tutte e due da
// fuori. Tenendo i cursori qui, il giorno che si aggiunge un colore lo
// si aggiunge una volta sola invece di due, e i due pannelli non
// possono divergere.
//
// ⚠️ I TESTI ARRIVANO GIÀ SCELTI, non tradotti qui dentro. Chiamando
// `useLingua` in questo file, il pannello Super Admin — che non ha
// nessuna preferenza di lingua e non deve averla — si ritroverebbe i
// cursori in inglese il giorno che qualcuno cambia lingua da un'altra
// parte.
//
// ⚠️ IL COLORE SI VEDE SUBITO, MA SI SALVA SOLO SU «SALVA». Il cursore
// che si muove aggiorna la pagina viva — è l'unico modo di scegliere un
// colore, guardandolo grande e non in un quadratino — ma non scrive
// niente. Trascinare un cursore genera un evento ogni pochi millesimi:
// scrivendo a ogni evento, un solo aggiustamento sarebbero decine di
// scritture sul database.
//
// ⚠️ E C'È SEMPRE LA VIA DEL RITORNO. «Rimetti i colori di partenza» non
// è un ornamento: sei cursori liberi permettono di arrivare a
// combinazioni in cui non si legge più niente, e da lì senza un tasto
// di ritorno si esce solo indovinando.
// ============================================================

import {
  TemaDashboard, Tinta, css, esadecimale, uguali,
} from '../../../data/temaDashboard';

export interface TestiTema {
  titolo: string;
  intro: string;
  testata: string;
  testataNota: string;
  sfondo: string;
  sfondoNota: string;
  colore: string;
  saturazione: string;
  luminosita: string;
  notaLeggibilita: string;
  salva: string;
  salvando: string;
  ripristina: string;
  soloResponsabile: string;
}

const ARCOBALENO = 'linear-gradient(90deg,'
  + ' hsl(0,90%,50%), hsl(60,90%,50%), hsl(120,90%,50%),'
  + ' hsl(180,90%,50%), hsl(240,90%,50%), hsl(300,90%,50%), hsl(360,90%,50%))';

function Cursore({
  nome, valore, massimo, fondo, scritto, cambia,
}: {
  nome: string; valore: number; massimo: number;
  fondo: string; scritto: string; cambia: (n: number) => void;
}) {
  return (
    <div className="tema-riga">
      <div className="tema-riga-testa">
        <span>{nome}</span>
        <span className="tema-riga-valore">{scritto}</span>
      </div>
      <input
        type="range"
        className="tema-cursore"
        min={0}
        max={massimo}
        step={1}
        value={valore}
        onChange={(e) => cambia(parseInt(e.target.value, 10))}
        style={{ background: fondo }}
        aria-label={nome}
      />
    </div>
  );
}

function Gruppo({
  titolo, nota, tinta, cambia, testi,
}: {
  titolo: string; nota: string; tinta: Tinta; cambia: (t: Tinta) => void; testi: TestiTema;
}) {
  return (
    <div className="tema-gruppo">
      {/* ⚠️ LA NOTA STA SOTTO, SU UNA RIGA SUA, e non accanto alla
          pastiglia. Stretta in mezzo all'anteprima e al codice colore
          aveva una decina di caratteri di larghezza: in italiano
          reggeva, in tedesco «Das Band ganz oben, mit dem Namen des
          Clubs und der Abmelde-Schaltfläche» diventava una colonna di
          parole spezzate alta quanto i tre cursori. Le tre lingue non
          hanno la stessa lunghezza e il posto della nota si decide
          sulla più lunga. */}
      <div className="tema-gruppo-testa">
        {/* L'anteprima è il colore vero, non una sua approssimazione:
            è lo stesso valore che finisce nel foglio di stile. */}
        <span className="tema-pastiglia" style={{ background: css(tinta) }} aria-hidden="true" />
        <div className="tema-gruppo-titolo">{titolo}</div>
        {/* ⚠️ Il codice esadecimale non si traduce e non deve: è lo
            stesso in ogni lingua, e serve a chi il colore lo deve
            comunicare a qualcun altro o ritrovare altrove. */}
        <span className="tema-codice">{esadecimale(tinta)}</span>
      </div>
      <div className="tema-gruppo-nota">{nota}</div>

      <Cursore
        nome={testi.colore}
        valore={tinta.h}
        massimo={360}
        fondo={ARCOBALENO}
        scritto={`${tinta.h}°`}
        cambia={(h) => cambia({ ...tinta, h })}
      />
      <Cursore
        nome={testi.saturazione}
        valore={tinta.s}
        massimo={100}
        fondo={`linear-gradient(90deg, hsl(${tinta.h},0%,${tinta.l}%), hsl(${tinta.h},100%,${tinta.l}%))`}
        scritto={`${tinta.s}%`}
        cambia={(s) => cambia({ ...tinta, s })}
      />
      <Cursore
        nome={testi.luminosita}
        valore={tinta.l}
        massimo={100}
        fondo={`linear-gradient(90deg, #000, hsl(${tinta.h},${tinta.s}%,50%), #fff)`}
        scritto={`${tinta.l}%`}
        cambia={(l) => cambia({ ...tinta, l })}
      />
    </div>
  );
}

export default function PersonalizzaDashboard({
  tema, temaDiPartenza, cambia, salva, ripristina, salvando, messaggio, errore, puoSalvare, testi,
}: {
  tema: TemaDashboard;
  temaDiPartenza: TemaDashboard;
  cambia: (t: TemaDashboard) => void;
  salva: () => void;
  ripristina: () => void;
  salvando: boolean;
  messaggio: string;
  errore: string;
  // Il Collaboratore guarda e non tocca: i colori sono del circolo, e
  // cambiarli è una decisione del responsabile.
  puoSalvare: boolean;
  testi: TestiTema;
}) {
  const alleOrigini = uguali(tema, temaDiPartenza);

  return (
    <div className="admin-card">
      <div className="admin-card-title">{testi.titolo}</div>
      <p className="admin-card-hint">{testi.intro}</p>

      <div className="tema-griglia">
        <Gruppo
          titolo={testi.testata}
          nota={testi.testataNota}
          tinta={tema.testata}
          cambia={(testata) => cambia({ ...tema, testata })}
          testi={testi}
        />
        <Gruppo
          titolo={testi.sfondo}
          nota={testi.sfondoNota}
          tinta={tema.sfondo}
          cambia={(sfondo) => cambia({ ...tema, sfondo })}
          testi={testi}
        />
      </div>

      {/* ⚠️ Detto qui e non lasciato scoprire. Il testo della testata si
          scurisce da solo quando il fondo diventa chiaro, altrimenti
          alzando la luminosità si perderebbero nome e tasto per uscire
          — ma chi muove il cursore lo vede cambiare e senza una riga di
          spiegazione sembra un difetto. */}
      <p className="admin-card-hint" style={{ marginTop: '1rem', marginBottom: '.9rem' }}>
        {testi.notaLeggibilita}
      </p>

      <div className="admin-row" style={{ alignItems: 'center' }}>
        <button
          type="button"
          className="btn"
          style={{ flex: '0 0 auto', borderRadius: 8 }}
          onClick={salva}
          disabled={salvando || !puoSalvare}
        >
          {salvando ? testi.salvando : testi.salva}
        </button>
        <button
          type="button"
          className="admin-input"
          style={{ flex: '0 0 auto', width: 'auto', cursor: 'pointer' }}
          onClick={ripristina}
          disabled={salvando || alleOrigini}
        >
          {testi.ripristina}
        </button>
      </div>

      {!puoSalvare && (
        <p className="admin-card-hint" style={{ marginTop: '.8rem', marginBottom: 0 }}>
          {testi.soloResponsabile}
        </p>
      )}
      {messaggio && (
        <p className="admin-card-hint" style={{ marginTop: '.8rem', marginBottom: 0, color: '#1F7A45' }}>
          {messaggio}
        </p>
      )}
      {errore && (
        <p className="admin-error-text" style={{ marginTop: '.8rem' }}>{errore}</p>
      )}
    </div>
  );
}
