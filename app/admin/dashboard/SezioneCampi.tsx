'use client';

import { useState } from 'react';
import { Campo, disciplinaDi } from '../../../data/circoli';
import { aggiungiCampo, rinominaCampo, rimuoviCampo } from '../../../data/circoliRepo';
import { useLingua } from '../../../lib/lingua';

export default function SezioneCampi({ circoloId, campi }: { circoloId: string; campi: Campo[] }) {
  const { t } = useLingua();
  const [nuovoNome, setNuovoNome] = useState('');
  // ⚠️ 'Tennis' NON si traduce: non è un'etichetta a schermo, è il
  // valore che finisce scritto sul campo se l'Admin non lo cambia — un
  // dato, e per di più una parola uguale in tutte e tre le lingue.
  const [nuovaDisciplina, setNuovaDisciplina] = useState('Tennis');
  const [modificaId, setModificaId] = useState<string | null>(null);
  const [modificaNome, setModificaNome] = useState('');
  const [modificaDisciplina, setModificaDisciplina] = useState('');

  const aggiungi = async () => {
    if (!nuovoNome.trim()) return;
    await aggiungiCampo(circoloId, nuovoNome.trim(), nuovaDisciplina.trim(), campi.length);
    setNuovoNome('');
  };

  const iniziaModifica = (c: Campo) => {
    setModificaId(c.id);
    setModificaNome(c.nome);
    setModificaDisciplina(disciplinaDi(c));
  };

  const salvaModifica = async () => {
    if (!modificaId || !modificaNome.trim()) return;
    await rinominaCampo(circoloId, modificaId, modificaNome.trim(), modificaDisciplina.trim());
    setModificaId(null);
  };

  return (
    <div className="admin-card">
      <div className="admin-card-title">{t('adm.cam.titolo')}</div>
      <p className="admin-card-hint">{t('adm.cam.hint')}</p>

      {campi.map((c) => (
        <div key={c.id} className="admin-list-row">
          {modificaId === c.id ? (
            <>
              {/* Una sopra l'altra e non affiancate: la disciplina e'
                  un testo libero come il nome — c'e' chi ci scrive
                  "Tennis - Terra Rossa" — e in centosessanta pixel non
                  ci stava. */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '.5rem' }}>
                <input className="admin-input" value={modificaNome} onChange={(e) => setModificaNome(e.target.value)} placeholder={t('adm.cam.phNome')} />
                <input className="admin-input" value={modificaDisciplina} onChange={(e) => setModificaDisciplina(e.target.value)} placeholder={t('adm.cam.phDisciplina')} />
              </div>
              <button className="admin-icon-btn" onClick={salvaModifica} aria-label={t('com.salva')}>✓</button>
            </>
          ) : (
            <>
              <div style={{ flex: 1 }}>
                <div className="admin-list-main">{c.nome}</div>
                <div className="admin-list-sub">{disciplinaDi(c) || t('com.nessunDato')}</div>
              </div>
              <button className="admin-icon-btn" onClick={() => iniziaModifica(c)} aria-label={t('adm.cam.rinomina')}>✎</button>
              <button className="admin-icon-btn danger" onClick={() => rimuoviCampo(circoloId, c.id)} aria-label={t('adm.cam.rimuovi')}>🗑</button>
            </>
          )}
        </div>
      ))}

      {/* Due righe, nell'ordine in cui compaiono sul bottone del campo:
          il nome sopra, la disciplina sotto. */}
      <div style={{ marginTop: '.8rem', display: 'flex', flexDirection: 'column', gap: '.5rem' }}>
        <input
          className="admin-input" value={nuovoNome} onChange={(e) => setNuovoNome(e.target.value)}
          placeholder={t('adm.cam.phNuovoNome')}
        />
        <input
          className="admin-input" value={nuovaDisciplina} onChange={(e) => setNuovaDisciplina(e.target.value)}
          placeholder={t('adm.cam.phNuovaDisciplina')}
        />
      </div>
      <button className="admin-btn-full" onClick={aggiungi}>{t('adm.cam.aggiungiCampo')}</button>
    </div>
  );
}
