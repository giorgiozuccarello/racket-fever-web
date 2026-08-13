'use client';

import { useState } from 'react';
import { Campo, disciplinaDi } from '../../../data/circoli';
import { aggiungiCampo, rinominaCampo, rimuoviCampo } from '../../../data/circoliRepo';

export default function SezioneCampi({ circoloId, campi }: { circoloId: string; campi: Campo[] }) {
  const [nuovoNome, setNuovoNome] = useState('');
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
      <div className="admin-card-title">Campi del circolo</div>
      <p className="admin-card-hint">
        Aggiungi, rinomina o rimuovi i campi in base a quelli reali della struttura. Di ogni
        campo si scrivono due righe: il nome e la disciplina che ci si pratica. Sono due testi
        liberi e compaiono così come li scrivi sul bottone del campo, nell&apos;app.
      </p>

      {campi.map((c) => (
        <div key={c.id} className="admin-list-row">
          {modificaId === c.id ? (
            <>
              {/* Una sopra l'altra e non affiancate: la disciplina e'
                  un testo libero come il nome — c'e' chi ci scrive
                  "Tennis - Terra Rossa" — e in centosessanta pixel non
                  ci stava. */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '.5rem' }}>
                <input className="admin-input" value={modificaNome} onChange={(e) => setModificaNome(e.target.value)} placeholder="Nome del campo" />
                <input className="admin-input" value={modificaDisciplina} onChange={(e) => setModificaDisciplina(e.target.value)} placeholder="Disciplina (es. Tennis)" />
              </div>
              <button className="admin-icon-btn" onClick={salvaModifica} aria-label="Salva">✓</button>
            </>
          ) : (
            <>
              <div style={{ flex: 1 }}>
                <div className="admin-list-main">{c.nome}</div>
                <div className="admin-list-sub">{disciplinaDi(c) || '—'}</div>
              </div>
              <button className="admin-icon-btn" onClick={() => iniziaModifica(c)} aria-label="Rinomina">✎</button>
              <button className="admin-icon-btn danger" onClick={() => rimuoviCampo(circoloId, c.id)} aria-label="Rimuovi">🗑</button>
            </>
          )}
        </div>
      ))}

      {/* Due righe, nell'ordine in cui compaiono sul bottone del campo:
          il nome sopra, la disciplina sotto. */}
      <div style={{ marginTop: '.8rem', display: 'flex', flexDirection: 'column', gap: '.5rem' }}>
        <input
          className="admin-input" value={nuovoNome} onChange={(e) => setNuovoNome(e.target.value)}
          placeholder="Nome nuovo campo"
        />
        <input
          className="admin-input" value={nuovaDisciplina} onChange={(e) => setNuovaDisciplina(e.target.value)}
          placeholder="Disciplina (es. Tennis, Padel)"
        />
      </div>
      <button className="admin-btn-full" onClick={aggiungi}>+ Aggiungi campo</button>
    </div>
  );
}
