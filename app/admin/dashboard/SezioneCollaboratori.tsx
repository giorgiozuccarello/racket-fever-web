'use client';

import { useEffect, useState } from 'react';
import { ascoltaPasswordCollaboratore, impostaPasswordCollaboratore } from '../../../data/circoliRepo';
import { sessioniAperteDelCircolo, revocaSessioniDelCircolo } from '../../../data/collaboratori';

export default function SezioneCollaboratori({ circoloId }: { circoloId: string }) {
  const [passwordAttuale, setPasswordAttuale] = useState<string | null>(null);
  const [pass, setPass] = useState('');
  const [caricato, setCaricato] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [ok, setOk] = useState(false);
  const [aperte, setAperte] = useState<number | null>(null);
  const [revocando, setRevocando] = useState(false);
  const [confermaRevoca, setConfermaRevoca] = useState(false);

  // Quante sessioni sono attive adesso. Non e' un ascolto in tempo
  // reale: e' un dato che si guarda quando si apre la sezione, non un
  // cruscotto — e un onSnapshot su questa collezione la terrebbe
  // aperta in lettura per tutta la durata della Dashboard.
  const contaSessioni = () => {
    sessioniAperteDelCircolo(circoloId)
      .then((elenco) => setAperte(elenco.length))
      // Un Collaboratore non ha il permesso di leggerle: e' voluto, e
      // qui vuol dire semplicemente non mostrare il riquadro.
      .catch(() => setAperte(null));
  };
  useEffect(contaSessioni, [circoloId]);

  useEffect(() => {
    const unsub = ascoltaPasswordCollaboratore(circoloId, (p) => {
      setPasswordAttuale(p);
      setCaricato((giaCaricato) => {
        if (!giaCaricato) setPass(p ?? '');
        return true;
      });
    });
    return unsub;
  }, [circoloId]);

  const salva = async () => {
    if (!pass.trim()) return;
    setSalvando(true);
    await impostaPasswordCollaboratore(circoloId, pass);
    setSalvando(false);
    setOk(true);
    setTimeout(() => setOk(false), 2000);
  };

  return (
    <div className="admin-card">
      <div className="admin-card-title">Accesso Collaboratori</div>
      <p className="admin-card-hint">
        Una seconda password, distinta da quella dei soci, per far entrare nella
        Dashboard Admin chi ti aiuta in segreteria — senza dovergli dare le tue
        credenziali personali. Ogni accesso dura 12 ore: passate quelle, la password
        va ridigitata, ed è lì che una password cambiata fa effetto.
      </p>
      <div className="admin-row">
        <input
          className="admin-input" value={pass}
          onChange={(e) => setPass(e.target.value)} autoCapitalize="none"
          placeholder="Imposta una password"
        />
        <button className="admin-btn-small" onClick={salva} disabled={salvando}>
          {ok ? 'Salvato ✓' : passwordAttuale ? 'Aggiorna' : 'Attiva'}
        </button>
      </div>
      {!passwordAttuale && caricato && (
        <p className="admin-card-hint" style={{ marginTop: '.5rem' }}>
          Non ancora attivata: finché non imposti una password, nessuno può entrare come Collaboratore.
        </p>
      )}

      {aperte !== null && (
        <>
          <div className="superadmin-subtitolo">Accessi in corso</div>
          <p className="admin-card-hint">
            {aperte === 0
              ? 'Nessuno è collegato come Collaboratore in questo momento.'
              : `${aperte === 1 ? 'C’è 1 accesso aperto' : `Ci sono ${aperte} accessi aperti`} in questo momento.`}
            {' '}Ogni accesso dura 12 ore, poi la password va ridigitata. Se qualcuno non deve
            più entrare, cambia la password qui sopra e chiudi subito gli accessi aperti: la
            password nuova vale dal prossimo ingresso, questi restano validi fino a scadenza.
          </p>
          <button
            className="admin-btn-full admin-btn-danger"
            onClick={() => setConfermaRevoca(true)}
            disabled={revocando || aperte === 0}
          >
            {revocando ? 'Chiusura…' : 'Chiudi subito tutti gli accessi'}
          </button>
        </>
      )}

      {confermaRevoca && (
        <div className="admin-modal-backdrop" onClick={() => setConfermaRevoca(false)}>
          <div className="admin-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="admin-modal-title">Chiudere tutti gli accessi?</div>
            <p className="admin-modal-sub">
              Chi sta usando la Dashboard come Collaboratore verrà rimandato alla schermata di
              accesso. Potrà rientrare solo con la password attuale — quindi se l&apos;hai appena
              cambiata, con quella nuova. Tu non vieni toccato.
            </p>
            <div className="admin-modal-btn-row">
              <button className="admin-modal-btn-cancel" onClick={() => setConfermaRevoca(false)}>Indietro</button>
              <button
                className="admin-modal-btn-confirm danger"
                onClick={async () => {
                  setConfermaRevoca(false);
                  setRevocando(true);
                  try { await revocaSessioniDelCircolo(circoloId); } finally {
                    setRevocando(false);
                    contaSessioni();
                  }
                }}
              >
                Chiudi tutti
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
