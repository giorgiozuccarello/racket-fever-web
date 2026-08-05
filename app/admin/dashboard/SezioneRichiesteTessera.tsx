'use client';

import { useEffect, useState } from 'react';
import { Circolo } from '../../../data/circoli';
import { ascoltaRichiesteInSospeso, approvaTessera, rifiutaTessera, Tessera } from '../../../data/tessere';
import { creaNotifica } from '../../../data/notifiche';

// Il collegamento wa.me vuole il numero in formato internazionale
// senza spazi ne' simboli: "393331234567", non "+39 333 123 4567".
export function numeroPerWhatsApp(grezzo?: string | null): string | null {
  if (!grezzo) return null;
  let n = grezzo.replace(/[^\d+]/g, '');
  if (n.startsWith('+')) n = n.slice(1);
  else if (n.startsWith('00')) n = n.slice(2);
  else if (n.startsWith('3') || n.startsWith('0')) n = '39' + n.replace(/^0+/, '');
  return n.length >= 10 ? n : null;
}

// Richieste di accesso inviate da chi vuole entrare nel circolo: nuovi
// Soci/Tesserati oppure Ospiti gia' tesserati in un altro circolo.
export default function SezioneRichiesteTessera({ circolo, approvatore }: {
  circolo: Circolo; approvatore: string;
}) {
  const [richieste, setRichieste] = useState<Tessera[]>([]);
  const [elaborando, setElaborando] = useState<string | null>(null);

  useEffect(() => {
    if (!circolo?.id) return;
    return ascoltaRichiesteInSospeso(circolo.id, setRichieste);
  }, [circolo?.id]);

  const approva = async (t: Tessera) => {
    setElaborando(t.uid);
    try {
      await approvaTessera(t.uid, circolo.id, approvatore);
      // Il messaggio cambia in base al RUOLO: un nuovo socio non deve
      // leggere "accettato come Ospite", ne' viceversa.
      const messaggio = t.ruolo === 'socio_tesserato'
        ? `Benvenuto in ${circolo.nome}! La tua iscrizione come Socio è stata approvata: ora puoi prenotare i campi.`
        : `Sei stato accettato come Ospite presso ${circolo.nome}: ora puoi prenotare anche lì.`;
      await creaNotifica(t.uid, messaggio, undefined, circolo.id, true);
    } catch {
      alert('Non è stato possibile approvare la richiesta. Riprova.');
    } finally {
      setElaborando(null);
    }
  };

  const rifiuta = async (t: Tessera) => {
    setElaborando(t.uid);
    try {
      await rifiutaTessera(t.uid, circolo.id);
      // Senza questo avviso il richiedente resterebbe in attesa senza
      // sapere l'esito.
      await creaNotifica(
        t.uid,
        t.ruolo === 'socio_tesserato'
          ? `${circolo.nome} non ha accolto la tua richiesta di iscrizione. Puoi contattare la segreteria del circolo per saperne di più.`
          : `${circolo.nome} non ha accolto la tua richiesta di accesso come Ospite. Puoi contattare la segreteria del circolo per saperne di più.`,
        undefined,
        circolo.id,
        true
      );
    } catch {
      alert('Non è stato possibile rifiutare la richiesta. Riprova.');
    } finally {
      setElaborando(null);
    }
  };

  return (
    <div className="admin-card">
      <div className="admin-card-title">Richieste in sospeso</div>
      <p className="admin-card-hint">
        Chi ha chiesto di entrare nel circolo, come Socio/Tesserato o come Ospite.
        Approvandoli potranno prenotare i tuoi campi, con un portafoglio dedicato
        a questo circolo.
      </p>

      {richieste.length === 0 && <p className="admin-empty-text">Nessuna richiesta in attesa.</p>}

      {richieste.map((t) => {
        const numero = numeroPerWhatsApp(t.telefono);
        const messaggio = `Ciao ${t.nome}, ti ho approvato su Racket Fever: ora puoi entrare nell'app e prenotare i campi di ${circolo.nome} 🎾`;
        return (
          <div key={t.id} className="admin-list-row">
            <div style={{ flex: 1 }}>
              <div className="admin-list-main">
                {t.nome} {t.cognome}
                <span className="admin-etichetta-ospite">
                  {t.ruolo === 'socio_tesserato' ? ' (nuovo socio)' : ' (ospite)'}
                </span>
              </div>
              <div className="admin-list-sub">{t.email}</div>
              {t.telefono ? (
                <a
                  className="admin-link-whatsapp"
                  href={numero
                    ? `https://wa.me/${numero}?text=${encodeURIComponent(messaggio)}`
                    : undefined}
                  target="_blank"
                  rel="noreferrer"
                >
                  {t.telefono} · avvisa su WhatsApp
                </a>
              ) : (
                <div className="admin-list-sub" style={{ fontStyle: 'italic' }}>Nessun numero fornito</div>
              )}
            </div>
            <div style={{ display: 'flex', gap: '.5rem' }}>
              <button
                className="admin-btn-piccolo-rosso"
                onClick={() => rifiuta(t)}
                disabled={!!elaborando}
              >
                Rifiuta
              </button>
              <button
                className="admin-btn-piccolo-verde"
                onClick={() => approva(t)}
                disabled={!!elaborando}
              >
                Approva
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
