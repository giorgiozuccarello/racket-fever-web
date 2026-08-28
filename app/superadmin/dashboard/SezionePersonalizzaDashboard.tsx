'use client';

// ============================================================
// PERSONALIZZA DASHBOARD — versione Super Admin.
//
// ⚠️ SI SALVA SULL'ACCOUNT, non «per tutti» come nel circolo: il
// pannello della rete è uno solo e chi ci entra è chi l'ha scelto.
// Finisce in `super_admin/{uid}`, in aggiunta al profilo — con `merge`,
// mai sovrascrivendo il documento (dentro ci sono nome, cognome ed
// email, e cancellarli vorrebbe dire non rientrare più).
//
// ⚠️ I TESTI SONO IN ITALIANO E SCRITTI QUI, come in tutto il resto del
// pannello. Non è una traduzione mancante: questo pannello lo apriamo
// noi, e le chiavi di `adm.temaDash.*` esistono per la Dashboard dei
// circoli, che invece parla tre lingue. Il componente dei cursori è lo
// stesso per tutti e due e riceve le parole da fuori proprio per questo.
// ============================================================

import { useState } from 'react';
import SezioneCollassabile from '../../admin/dashboard/SezioneCollassabile';
import PersonalizzaDashboard, { TestiTema } from '../../admin/dashboard/PersonalizzaDashboard';
import { TemaDashboard, TEMA_SUPERADMIN_DI_PARTENZA } from '../../../data/temaDashboard';
import { salvaTemaSuperAdmin, salvaTemaLocale } from '../../../data/temaDashboardRepo';

const TESTI: TestiTema = {
  titolo: 'Colori della dashboard',
  intro: 'Il colore della testata e quello del fondo pagina. Si vedono subito, mentre muovi i '
    + 'cursori, ma restano solo su questo schermo finché non premi «Salva».',
  testata: 'Testata',
  testataNota: 'La fascia in alto, con il nome e il tasto Esci',
  sfondo: 'Sfondo',
  sfondoNota: 'Il fondo della pagina, dietro le sezioni',
  colore: 'Colore',
  saturazione: 'Saturazione',
  luminosita: 'Luminosità',
  notaLeggibilita: 'Le scritte della testata passano da sole da chiaro a scuro quando il colore '
    + 'che scegli è troppo luminoso, così restano sempre leggibili.',
  salva: 'Salva',
  salvando: 'Salvo…',
  ripristina: 'Rimetti i colori di partenza',
  // Nel pannello della rete non si vede mai: `puoSalvare` è sempre
  // vero. Sta qui perché l'oggetto dei testi è uno solo per tutti e due
  // i pannelli, e un campo mancante sarebbe un buco a schermo il giorno
  // che quella condizione diventasse possibile anche qui.
  soloResponsabile: '',
};

export default function SezionePersonalizzaDashboardSuperAdmin({
  uid, tema, setTema,
}: {
  uid: string;
  tema: TemaDashboard;
  setTema: (t: TemaDashboard) => void;
}) {
  const [salvando, setSalvando] = useState(false);
  const [messaggio, setMessaggio] = useState('');
  const [errore, setErrore] = useState('');

  const cambia = (nuovo: TemaDashboard) => {
    setTema(nuovo);
    setMessaggio('');
    setErrore('');
  };

  const salva = async () => {
    setSalvando(true);
    setMessaggio('');
    setErrore('');
    salvaTemaLocale(`superadmin.${uid}`, tema);
    const fatto = await salvaTemaSuperAdmin(uid, tema);
    setSalvando(false);
    if (fatto) setMessaggio('Colori salvati: li ritrovi da qualunque computer entri.');
    else {
      setErrore(
        'Non sono riuscito a salvare: per ora i colori restano solo su questo computer. '
        + 'Riprova fra poco, e se il problema resta va guardato.',
      );
    }
  };

  return (
    <SezioneCollassabile
      id="saPersonalizzaDashboard"
      titolo="Personalizza dashboard"
      descrizione="I colori della testata e dello sfondo di questo pannello"
    >
      <PersonalizzaDashboard
        tema={tema}
        temaDiPartenza={TEMA_SUPERADMIN_DI_PARTENZA}
        cambia={cambia}
        salva={salva}
        ripristina={() => cambia(TEMA_SUPERADMIN_DI_PARTENZA)}
        salvando={salvando}
        messaggio={messaggio}
        errore={errore}
        puoSalvare
        testi={TESTI}
      />
    </SezioneCollassabile>
  );
}
