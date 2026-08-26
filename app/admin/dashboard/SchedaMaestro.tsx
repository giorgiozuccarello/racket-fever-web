'use client';

// ============================================================
// SCHEDA DEL MAESTRO — l'anagrafica che compila l'Admin.
//
// Quattro gruppi, e ognuno risponde a una domanda diversa:
//   1. Contatti e foto        — come lo raggiungo, che faccia ha
//   2. Qualifica e discipline — che titolo ha, cosa insegna
//   3. Tariffe                — quanto chiede (promemoria, non listino)
//   4. Biografia              — le due righe che leggono i soci
//
// ⚠️ I DUE GRUPPI NON VANNO NELLO STESSO POSTO, e non e' un dettaglio
// tecnico da nascondere: foto, qualifica, discipline e biografia
// stanno sul documento del Maestro, che OGNI SOCIO del circolo puo'
// leggere (gli serve per scegliere a chi chiedere una lezione).
// Telefono e tariffe stanno in una sottocollezione privata, che legge
// solo chi comanda sul circolo (il responsabile e la segreteria che
// entra con la password del Collaboratore), il Super Admin e il
// Maestro stesso. Firestore non sa nascondere un singolo campo: o e'
// di la', o lo vedono tutti.
// Per questo ogni gruppo, qui sotto, dice a chiare lettere chi lo
// legge — chi compila deve saperlo mentre scrive, non dopo.
//
// ⚠️ I CONTEGGI DELLE LEZIONI NON SI COMPILANO. Non sono campi:
// escono dalle prenotazioni con questo maestroId e dalla traccia che
// il server lascia a ogni disdetta. Un contatore scritto a mano
// sarebbe sbagliato dal primo annullamento in poi, e in silenzio.
// ============================================================

import { useEffect, useState } from 'react';
import {
  MaestroConUid, SchedaPrivataMaestro, QUALIFICHE_SUGGERITE, DISCIPLINE,
  MAX_BIO_MAESTRO, MAX_QUALIFICA_MAESTRO, anniDiEsperienza,
  leggiSchedaPrivata, salvaAnagraficaMaestro, salvaSchedaPrivata,
} from '../../../data/maestriRepo';
import { caricaFotoMaestro, rimuoviFotoMaestro } from '../../../data/storage';
import { ContiMaestro } from '../../../data/contiMaestro';
import { useLingua } from '../../../lib/lingua';

// Un campo importo: mostra la stringa che sta scrivendo l'Admin e
// restituisce il numero solo quando ha senso.
// ⚠️ Tenere il testo e non il numero non e' un capriccio: con uno
// stato numerico, cancellare l'ultima cifra di "30" fa passare il
// campo per NaN e la casella si svuota da sola sotto le dita, oppure
// ci ricompare uno zero che nessuno ha scritto.
function numeroDaTesto(testo: string): number | null {
  const pulito = testo.replace(',', '.').trim();
  if (pulito === '') return null;
  const n = Number(pulito);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function testoDaNumero(n: number | null | undefined): string {
  return typeof n === 'number' ? String(n) : '';
}

export default function SchedaMaestro({ maestro, conti, contiIncerti }: {
  maestro: MaestroConUid;
  conti: ContiMaestro;
  // Vero quando l'elenco delle lezioni annullate non e' arrivato.
  // "0 annullate" e "non lo so" sono due cose diverse, e mostrare la
  // prima al posto della seconda e' il modo piu' facile per far
  // credere all'Admin che un Maestro non abbia mai disdetto niente.
  contiIncerti: boolean;
}) {
  const { t } = useLingua();

  const [fotoUrl, setFotoUrl] = useState<string | null>(maestro.fotoUrl ?? null);
  const [qualifica, setQualifica] = useState(maestro.qualifica ?? '');
  const [discipline, setDiscipline] = useState<string[]>(maestro.discipline ?? []);
  const [insegnaDal, setInsegnaDal] = useState(testoDaNumero(maestro.insegnaDal));
  const [bio, setBio] = useState(maestro.bio ?? '');

  const [telefono, setTelefono] = useState('');
  const [tariffaIndividuale, setTariffaIndividuale] = useState('');
  const [tariffaCoppia, setTariffaCoppia] = useState('');
  const [tariffaGruppo, setTariffaGruppo] = useState('');
  const [notaTariffe, setNotaTariffe] = useState('');

  const [privataArrivata, setPrivataArrivata] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [caricandoFoto, setCaricandoFoto] = useState(false);
  const [errore, setErrore] = useState('');
  const [salvato, setSalvato] = useState(false);

  // ⚠️ La parte pubblica arriva dall'ascolto dell'elenco Maestri, che
  // e' vivo: se la scheda viene modificata altrove mentre e' aperta,
  // il campo sotto le dita cambierebbe da solo. Questo effetto
  // riallinea SOLO al cambio di Maestro (l'identificativo), non a ogni
  // istantanea.
  useEffect(() => {
    setFotoUrl(maestro.fotoUrl ?? null);
    setQualifica(maestro.qualifica ?? '');
    setDiscipline(maestro.discipline ?? []);
    setInsegnaDal(testoDaNumero(maestro.insegnaDal));
    setBio(maestro.bio ?? '');
    setSalvato(false);
    setErrore('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [maestro.uid]);

  // La scheda privata non sta nell'elenco: si legge quando si apre.
  useEffect(() => {
    let vivo = true;
    setPrivataArrivata(false);
    leggiSchedaPrivata(maestro.uid)
      .then((s: SchedaPrivataMaestro | null) => {
        if (!vivo) return;
        setTelefono(s?.telefono ?? '');
        setTariffaIndividuale(testoDaNumero(s?.tariffaIndividuale));
        setTariffaCoppia(testoDaNumero(s?.tariffaCoppia));
        setTariffaGruppo(testoDaNumero(s?.tariffaGruppo));
        setNotaTariffe(s?.notaTariffe ?? '');
        setPrivataArrivata(true);
      })
      .catch(() => {
        if (!vivo) return;
        // ⚠️ Non si finge che sia vuota. Se la lettura non riesce e i
        // campi restano in bianco, il primo salvataggio cancella un
        // telefono che c'era — l'Admin non ha modo di accorgersene.
        setErrore(t('adm.mae.erroreLetturaPrivata'));
      });
    return () => { vivo = false; };
    // ⚠️ `t` NON sta fra le dipendenze apposta: cambia a ogni cambio di
    // lingua, e metterlo qui farebbe rileggere la scheda privata da
    // Firestore solo perché l'Admin ha spostato il selettore. L'avviso
    // resta nella lingua in cui è comparso, il che è quello che si
    // vuole: se cambia lingua, la scheda si richiude e si riapre.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [maestro.uid]);

  const anni = anniDiEsperienza({ insegnaDal: numeroDaTesto(insegnaDal) });

  const scegliFoto = async (file: File | null) => {
    if (!file) return;
    // ⚠️ Stessa cautela del salvataggio: se l'avviso a schermo dice che
    // contatti e tariffe non sono stati letti, caricare una foto non
    // deve farlo sparire. Spegnendolo qui, l'unico presidio contro la
    // sovrascrittura di un telefono se ne andava con un gesto che con
    // quel telefono non c'entra niente.
    if (privataArrivata) setErrore('');
    setCaricandoFoto(true);
    try {
      const url = await caricaFotoMaestro(maestro.circoloId, maestro.uid, file);
      setFotoUrl(url);
      setSalvato(false);
    } catch {
      setErrore(t('adm.mae.erroreCaricamentoFoto'));
    } finally {
      setCaricandoFoto(false);
    }
  };

  const alterna = (d: string) => {
    setDiscipline((prec) => (prec.includes(d) ? prec.filter((x) => x !== d) : [...prec, d]));
    setSalvato(false);
  };

  const salva = async () => {
    // ⚠️ L'avviso "non ho letto contatti e tariffe" NON si spegne qui.
    // Spegnendolo, un salvataggio della sola biografia lasciava a
    // schermo "Salvato ✓" e nient'altro: l'Admin usciva convinto che la
    // scheda fosse completa e che quel Maestro non avesse ne' telefono
    // ne' tariffe, mentre quei campi non erano mai stati letti.
    if (privataArrivata) setErrore('');
    setSalvando(true);
    try {
      const fotoPrecedente = maestro.fotoUrl ?? null;
      await salvaAnagraficaMaestro(maestro.uid, {
        fotoUrl,
        qualifica,
        discipline,
        insegnaDal: numeroDaTesto(insegnaDal),
        bio,
      });
      // ⚠️ DOPO il salvataggio, mai prima. Il nome del file porta
      // l'istante, quindi la foto nuova non sovrascrive la vecchia: se
      // si cancellasse per prima e il salvataggio fallisse, la scheda
      // resterebbe a puntare su un file che non c'e' piu'. E non
      // blocca niente se non riesce: un file dimenticato nel bucket non
      // si vede, un salvataggio a metà si.
      if (fotoPrecedente && fotoPrecedente !== fotoUrl) {
        await rimuoviFotoMaestro(fotoPrecedente);
      }
      // ⚠️ La parte privata si salva solo se e' stata letta. Salvandola
      // comunque, una lettura fallita diventerebbe una cancellazione:
      // campi vuoti a schermo, campi vuoti su Firestore.
      if (privataArrivata) {
        await salvaSchedaPrivata(maestro.uid, {
          telefono,
          tariffaIndividuale: numeroDaTesto(tariffaIndividuale),
          tariffaCoppia: numeroDaTesto(tariffaCoppia),
          tariffaGruppo: numeroDaTesto(tariffaGruppo),
          notaTariffe,
        });
      }
      setSalvato(true);
    } catch {
      // Stessa frase di tutte le altre schermate: sta nel dizionario
      // comune, e da lì la prendono anche gli altri salvataggi.
      setErrore(t('com.errore.salvataggio'));
      setSalvato(false);
    } finally {
      setSalvando(false);
    }
  };

  const iniziali = `${maestro.nome?.[0] ?? ''}${maestro.cognome?.[0] ?? ''}`.toUpperCase();

  return (
    <div className="scheda-maestro">
      {/* ---------- CONTEGGI RICAVATI ---------- */}
      <div className="scheda-conti">
        <div className="scheda-conto">
          <span className="scheda-conto-n">{conti.fatte}</span>
          <span className="scheda-conto-et">{t('adm.mae.lezioniDate')}</span>
        </div>
        <div className="scheda-conto">
          <span className="scheda-conto-n">{conti.inProgramma}</span>
          <span className="scheda-conto-et">{t('adm.mae.lezioniInProgramma')}</span>
        </div>
        <div className="scheda-conto">
          <span className="scheda-conto-n">{contiIncerti ? '—' : conti.annullate}</span>
          <span className="scheda-conto-et">
            {t('adm.mae.lezioniAnnullate')}
            {!contiIncerti && conti.tardive > 0 && ` · ${t('adm.mae.lezioniInRitardo', { n: conti.tardive })}`}
          </span>
        </div>
      </div>
      <p className="admin-card-hint scheda-nota-conti">
        {contiIncerti
          ? t('adm.mae.annullateNonCaricate')
          : t('adm.mae.notaConti')}
      </p>

      {/* ---------- 1. CONTATTI E FOTO ---------- */}
      <div className="scheda-gruppo">
        <div className="scheda-gruppo-titolo">{t('adm.mae.gruppoContatti')}</div>
        <div className="scheda-foto-riga">
          <div className="scheda-foto">
            {fotoUrl
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={fotoUrl} alt={`${maestro.nome} ${maestro.cognome}`} />
              : <span className="scheda-foto-iniziali">{iniziali || '—'}</span>}
          </div>
          <div className="scheda-foto-comandi">
            <label className="admin-btn-small scheda-file">
              {caricandoFoto ? t('com.caricamento') : (fotoUrl ? t('adm.mae.cambiaFoto') : t('adm.mae.caricaFoto'))}
              <input
                type="file" accept="image/*" disabled={caricandoFoto}
                onChange={(e) => { scegliFoto(e.target.files?.[0] ?? null); e.target.value = ''; }}
              />
            </label>
            {fotoUrl && (
              <button
                className="admin-icon-btn danger" aria-label={t('adm.mae.togliFoto')}
                onClick={() => { setFotoUrl(null); setSalvato(false); }}
              >🗑</button>
            )}
            <p className="admin-card-hint scheda-hint-foto">{t('adm.mae.notaFoto')}</p>
          </div>
        </div>

        <label className="admin-label">{t('adm.mae.emailAccesso')}</label>
        <input className="admin-input" value={maestro.email} disabled readOnly />

        <label className="admin-label">{t('adm.mae.telefono')}</label>
        <input
          className="admin-input" value={telefono} inputMode="tel"
          onChange={(e) => { setTelefono(e.target.value); setSalvato(false); }}
          placeholder={t('adm.mae.esempioTelefono')}
          disabled={!privataArrivata}
        />
        <p className="admin-card-hint scheda-riservato">🔒 {t('adm.mae.notaRiservato')}</p>
      </div>

      {/* ---------- 2. QUALIFICA E DISCIPLINE ---------- */}
      <div className="scheda-gruppo">
        <div className="scheda-gruppo-titolo">{t('adm.mae.gruppoQualifica')}</div>

        <label className="admin-label">{t('adm.mae.qualifica')}</label>
        {/* ⚠️ Il titolo dentro l'esempio resta in italiano in tutte e tre
            le lingue: «Istruttore di 2º grado» è il titolo FITP, ed è
            quello che l'elenco dei suggerimenti qui sotto propone. Solo
            la parolina «Es.» cambia lingua. */}
        <input
          className="admin-input" value={qualifica} list={`qualifiche-${maestro.uid}`}
          maxLength={MAX_QUALIFICA_MAESTRO}
          onChange={(e) => { setQualifica(e.target.value); setSalvato(false); }}
          placeholder={t('adm.mae.esempioQualifica')}
        />
        <datalist id={`qualifiche-${maestro.uid}`}>
          {QUALIFICHE_SUGGERITE.map((q) => <option key={q} value={q} />)}
        </datalist>

        <label className="admin-label">{t('adm.mae.insegnaDal')}</label>
        <div className="scheda-anno-riga">
          <input
            className="admin-input" value={insegnaDal} inputMode="numeric" maxLength={4}
            onChange={(e) => { setInsegnaDal(e.target.value.replace(/\D/g, '')); setSalvato(false); }}
            placeholder={t('adm.mae.esempioAnno')}
          />
          {/* L'anno non invecchia, il numero di anni sì: si mostra
              ricavato, così non può restare indietro. */}
          <span className="scheda-anni">
            {anni === null ? '' : anni === 0 ? t('adm.mae.primoAnno') : t('adm.mae.anniInsegnamento', { n: anni })}
          </span>
        </div>

        <label className="admin-label">{t('adm.mae.discipline')}</label>
        <div className="admin-chip-row">
          {DISCIPLINE.map((d) => (
            <button
              key={d} type="button"
              className={`admin-chip${discipline.includes(d) ? ' selected' : ''}`}
              aria-pressed={discipline.includes(d)}
              onClick={() => alterna(d)}
            >{d}</button>
          ))}
        </div>
      </div>

      {/* ---------- 3. TARIFFE ---------- */}
      <div className="scheda-gruppo">
        <div className="scheda-gruppo-titolo">{t('adm.mae.gruppoTariffe')}</div>
        {/* ⚠️ Questo avviso non è decorativo. Scritto un numero qui, la
            cosa più naturale da aspettarsi è che le lezioni comincino a
            costare quella cifra — e non succede: in app la lezione
            costa zero, il Maestro chiede un importo unico fuori
            piattaforma e regola il campo con la segreteria. Senza
            questa riga, il primo che compila il campo si aspetta un
            incasso che non arriverà mai. */}
        <p className="admin-card-hint">{t('adm.mae.notaTariffe')}</p>
        <div className="admin-row">
          <div>
            <label className="admin-label">{t('adm.mae.tariffaIndividuale')}</label>
            <input
              className="admin-input" value={tariffaIndividuale} inputMode="decimal"
              onChange={(e) => { setTariffaIndividuale(e.target.value); setSalvato(false); }}
              placeholder="0" disabled={!privataArrivata}
            />
          </div>
          <div>
            <label className="admin-label">{t('adm.mae.tariffaCoppia')}</label>
            <input
              className="admin-input" value={tariffaCoppia} inputMode="decimal"
              onChange={(e) => { setTariffaCoppia(e.target.value); setSalvato(false); }}
              placeholder="0" disabled={!privataArrivata}
            />
          </div>
          <div>
            <label className="admin-label">{t('adm.mae.tariffaGruppo')}</label>
            <input
              className="admin-input" value={tariffaGruppo} inputMode="decimal"
              onChange={(e) => { setTariffaGruppo(e.target.value); setSalvato(false); }}
              placeholder="0" disabled={!privataArrivata}
            />
          </div>
        </div>
        <label className="admin-label">{t('adm.mae.etichettaNotaTariffe')}</label>
        <input
          className="admin-input" value={notaTariffe}
          onChange={(e) => { setNotaTariffe(e.target.value); setSalvato(false); }}
          placeholder={t('adm.mae.esempioNotaTariffe')}
          disabled={!privataArrivata}
        />
      </div>

      {/* ---------- 4. BIOGRAFIA ---------- */}
      <div className="scheda-gruppo">
        <div className="scheda-gruppo-titolo">{t('adm.mae.gruppoBio')}</div>
        <p className="admin-card-hint scheda-pubblico">👁 {t('adm.mae.notaBioPubblica')}</p>
        <textarea
          className="admin-input" rows={4} value={bio}
          onChange={(e) => { setBio(e.target.value.slice(0, MAX_BIO_MAESTRO)); setSalvato(false); }}
          placeholder={t('adm.mae.esempioBio')}
        />
        <div className="scheda-contatore">{bio.length}/{MAX_BIO_MAESTRO}</div>
      </div>

      {errore && <div className="admin-error-text">{errore}</div>}

      <button className="admin-btn-full" onClick={salva} disabled={salvando || caricandoFoto}>
        {salvando ? t('com.salvataggio')
          : salvato ? (privataArrivata ? t('adm.mae.salvato') : t('adm.mae.salvatoSoloPubblico'))
            : t('adm.mae.salvaScheda')}
      </button>
    </div>
  );
}
