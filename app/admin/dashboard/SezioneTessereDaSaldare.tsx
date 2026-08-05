'use client';

import { useEffect, useState } from 'react';
import { Circolo } from '../../../data/circoli';
import { ascoltaTessereDaSaldare, saldaTessera, Tessera } from '../../../data/tessere';
import { creaNotifica } from '../../../data/notifiche';
import { numeroPerWhatsApp } from './SezioneRichiesteTessera';
import Modal from './Modal';

// Ex soci con un conto ancora aperto: credito da restituire o debito
// da recuperare. La regolazione avviene in segreteria — qui si
// registra soltanto che e' stata fatta.
export default function SezioneTessereDaSaldare({ circolo }: { circolo: Circolo }) {
  const [tessere, setTessere] = useState<Tessera[]>([]);
  const [daSaldare, setDaSaldare] = useState<Tessera | null>(null);
  const [elaborando, setElaborando] = useState(false);

  useEffect(() => {
    if (!circolo?.id) return;
    return ascoltaTessereDaSaldare(circolo.id, setTessere);
  }, [circolo?.id]);

  const conferma = async () => {
    if (!daSaldare) return;
    setElaborando(true);
    try {
      await saldaTessera(daSaldare.uid, circolo.id);
      await creaNotifica(
        daSaldare.uid,
        `${circolo.nome} ha registrato la chiusura del tuo conto: la posizione è saldata.`,
        undefined,
        circolo.id,
        true
      );
      setDaSaldare(null);
    } catch {
      alert('Non è stato possibile registrare il saldo. Riprova.');
    } finally {
      setElaborando(false);
    }
  };

  return (
    <div className="admin-card">
      <div className="admin-card-title">Tessere da saldare</div>
      <p className="admin-card-hint">
        Persone uscite dal circolo con un conto ancora aperto. Restituisci il
        credito o recupera il debito in segreteria, poi tocca &quot;Saldato&quot;
        per chiudere la posizione.
      </p>

      {tessere.length === 0 && <p className="admin-empty-text">Nessuna posizione da regolare.</p>}

      {tessere.map((t) => {
        const credito = t.credito ?? 0;
        const debito = t.sosUtilizzato ?? 0;
        const numero = numeroPerWhatsApp(t.telefono);
        const messaggio = credito > 0
          ? `Ciao ${t.nome}, hai € ${credito.toFixed(2)} di credito da ritirare presso ${circolo.nome}.`
          : `Ciao ${t.nome}, risulta un debito di € ${debito.toFixed(2)} da saldare presso ${circolo.nome}.`;
        return (
          <div key={t.id} className="admin-list-row">
            <div style={{ flex: 1 }}>
              <div className="admin-list-main">{t.nome} {t.cognome}</div>
              <div className="admin-list-sub">{t.email}</div>
              {credito > 0 && (
                <div className="admin-saldo-credito">Credito da restituire: € {credito.toFixed(2)}</div>
              )}
              {debito > 0 && (
                <div className="admin-saldo-debito">Debito da recuperare: € {debito.toFixed(2)}</div>
              )}
              {!!numero && (
                <a
                  className="admin-link-whatsapp"
                  href={`https://wa.me/${numero}?text=${encodeURIComponent(messaggio)}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  {t.telefono} · contatta
                </a>
              )}
            </div>
            <button className="admin-btn-piccolo-verde" onClick={() => setDaSaldare(t)}>
              Saldato
            </button>
          </div>
        );
      })}

      <Modal visible={!!daSaldare} onClose={() => setDaSaldare(null)}>
        <div className="admin-modal-title">Confermi il saldo?</div>
        <p className="admin-modal-sub">{daSaldare?.nome} {daSaldare?.cognome}</p>
        <p className="admin-modal-sub" style={{ marginTop: '.5rem' }}>
          {(daSaldare?.credito ?? 0) > 0
            ? `Confermi di aver restituito € ${(daSaldare?.credito ?? 0).toFixed(2)}?`
            : `Confermi di aver recuperato € ${(daSaldare?.sosUtilizzato ?? 0).toFixed(2)}?`}
        </p>
        <div className="admin-modal-btn-row">
          <button className="admin-modal-btn-cancel" onClick={() => setDaSaldare(null)} disabled={elaborando}>
            Annulla
          </button>
          <button className="admin-modal-btn-confirm" onClick={conferma} disabled={elaborando}>
            {elaborando ? 'Attendere…' : 'Saldato'}
          </button>
        </div>
      </Modal>
    </div>
  );
}
