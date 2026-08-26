'use client';

import { useEffect, useState } from 'react';
import { Circolo } from '../../../data/circoli';
import { ascoltaRichiesteInSospeso, approvaTessera, rifiutaTessera, Tessera } from '../../../data/tessere';
import { creaNotifica } from '../../../data/notifiche';
import { avviso } from '../../../data/linguaDestinatario';
import { useLingua } from '../../../lib/lingua';

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
  const { t } = useLingua();
  const [richieste, setRichieste] = useState<Tessera[]>([]);
  const [elaborando, setElaborando] = useState<string | null>(null);

  useEffect(() => {
    if (!circolo?.id) return;
    return ascoltaRichiesteInSospeso(circolo.id, setRichieste);
  }, [circolo?.id]);

  // ⚠️ Il parametro si chiamava `t` come la tessera. Ora `t` è il
  // traduttore del componente, e un parametro con lo stesso nome glielo
  // avrebbe coperto proprio qui dentro: rinominato in `richiesta`.
  const approva = async (richiesta: Tessera) => {
    setElaborando(richiesta.uid);
    try {
      await approvaTessera(richiesta.uid, circolo.id, approvatore);
      // Il messaggio cambia in base al RUOLO: un nuovo socio non deve
      // leggere "accettato come Ospite", ne' viceversa.
      // ⚠️ NON passa da `t()` ma da `avviso()`, come gia' faceva il
      // rifiuto qui sotto: questa frase la legge il richiedente, non
      // l'Admin, e va composta nella lingua di CHI la riceve. Con `t()`
      // sarebbe arrivata nella lingua di chi era in segreteria.
      const messaggio = richiesta.ruolo === 'socio_tesserato'
        ? avviso('avv.cir.benvenutoSocio', { circolo: circolo.nome })
        : avviso('avv.cir.benvenutoOspite', { circolo: circolo.nome });
      await creaNotifica(richiesta.uid, messaggio, undefined, circolo.id, true);
    } catch {
      alert(t('adm.ric.erroreApprova'));
    } finally {
      setElaborando(null);
    }
  };

  const rifiuta = async (richiesta: Tessera) => {
    setElaborando(richiesta.uid);
    try {
      await rifiutaTessera(richiesta.uid, circolo.id);
      // Senza questo avviso il richiedente resterebbe in attesa senza
      // sapere l'esito.
      await creaNotifica(
        richiesta.uid,
        richiesta.ruolo === 'socio_tesserato'
          ? avviso('avv.cir.rifiutoSocio', { circolo: circolo.nome })
          : avviso('avv.cir.rifiutoOspite', { circolo: circolo.nome }),
        undefined,
        circolo.id,
        true
      );
    } catch {
      alert(t('adm.ric.erroreRifiuta'));
    } finally {
      setElaborando(null);
    }
  };

  return (
    <div className="admin-card">
      <div className="admin-card-title">{t('adm.ric.titolo')}</div>
      <p className="admin-card-hint">{t('adm.ric.hint')}</p>

      {richieste.length === 0 && <p className="admin-empty-text">{t('adm.ric.nessunaRichiesta')}</p>}

      {/* ⚠️ La riga scorreva su `t`, che ora è il traduttore: qui la
          tessera si chiama `richiesta`. */}
      {richieste.map((richiesta) => {
        const numero = numeroPerWhatsApp(richiesta.telefono);
        // ⚠️ Questo lo scrive l'Admin di suo pugno su WhatsApp, non lo
        // scrive il server: è testo che parte dalla sua tastiera e che
        // può correggere prima di inviarlo. Perciò segue la lingua della
        // Dashboard, come tutto il resto della schermata.
        const messaggio = t('adm.ric.messaggioWhatsApp', {
          nome: richiesta.nome, circolo: circolo.nome,
        });
        return (
          <div key={richiesta.id} className="admin-list-row">
            <div style={{ flex: 1 }}>
              <div className="admin-list-main">
                {richiesta.nome} {richiesta.cognome}
                <span className="admin-etichetta-ospite">
                  {' '}{richiesta.ruolo === 'socio_tesserato' ? t('adm.ric.nuovoSocio') : t('adm.ric.ospite')}
                </span>
              </div>
              <div className="admin-list-sub">{richiesta.email}</div>
              {richiesta.telefono ? (
                <a
                  className="admin-link-whatsapp"
                  href={numero
                    ? `https://wa.me/${numero}?text=${encodeURIComponent(messaggio)}`
                    : undefined}
                  target="_blank"
                  rel="noreferrer"
                >
                  {richiesta.telefono} · {t('adm.ric.avvisaWhatsApp')}
                </a>
              ) : (
                <div className="admin-list-sub" style={{ fontStyle: 'italic' }}>{t('adm.ric.nessunNumero')}</div>
              )}
            </div>
            <div style={{ display: 'flex', gap: '.5rem' }}>
              <button
                className="admin-btn-piccolo-rosso"
                onClick={() => rifiuta(richiesta)}
                disabled={!!elaborando}
              >
                {t('adm.ric.rifiuta')}
              </button>
              <button
                className="admin-btn-piccolo-verde"
                onClick={() => approva(richiesta)}
                disabled={!!elaborando}
              >
                {t('adm.ric.approva')}
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
