'use client';

// ============================================================
// PERSONALIZZA DASHBOARD — versione del circolo.
//
// ⚠️ LA SCELTA È DEL CIRCOLO, NON DI CHI ENTRA. Si salva in
// `circoli/{id}/impostazioni/dashboard`, quindi responsabile e
// Collaboratore vedono lo stesso pannello. A salvare però è solo il
// responsabile: se potessero entrambi, due persone che lavorano insieme
// si cambierebbero i colori a vicenda senza capire perché. Il divieto è
// scritto due volte, qui e nelle regole Firestore — quello del client
// serve a non far premere un tasto che verrà respinto, quello delle
// regole è l'unico che conta davvero.
//
// ⚠️ QUI I TESTI SONO TRADOTTI, e il gemello Super Admin no. La
// differenza non è una svista: questa Dashboard parla tre lingue perché
// la aprono i presidenti dei circoli, il pannello della rete lo apriamo
// noi. Le chiavi stanno in `data/traduzioni/admin.ts` sotto
// `adm.temaDash.*`, ed è un file gemello identico fra questo progetto e
// quello dell'app: si modifica in tutti e due o in nessuno.
// ============================================================

import { useState } from 'react';
import SezioneCollassabile from './SezioneCollassabile';
import PersonalizzaDashboard, { TestiTema } from './PersonalizzaDashboard';
import { useLingua } from '../../../lib/lingua';
import { TemaDashboard, TEMA_ADMIN_DI_PARTENZA } from '../../../data/temaDashboard';
import { salvaTemaCircolo, salvaTemaLocale } from '../../../data/temaDashboardRepo';

export default function SezionePersonalizzaDashboard({
  circoloId, tema, setTema, puoSalvare,
}: {
  circoloId: string;
  tema: TemaDashboard;
  setTema: (t: TemaDashboard) => void;
  puoSalvare: boolean;
  // ⚠️ NON SI USANO QUI DENTRO, e non sono un residuo: le legge
  // `SezioniOrdinate` dal di fuori, per sapere dove mettere questa
  // sezione nell'ordine alfabetico e con quale chiave. Il titolo vero
  // lo prende comunque il collassabile qui sotto, dal dizionario.
  id?: string;
  titolo?: string;
}) {
  const { t } = useLingua();
  const [salvando, setSalvando] = useState(false);
  const [messaggio, setMessaggio] = useState('');
  const [errore, setErrore] = useState('');

  const testi: TestiTema = {
    titolo: t('adm.temaDash.titolo'),
    intro: t('adm.temaDash.intro'),
    testata: t('adm.temaDash.testata'),
    testataNota: t('adm.temaDash.testataNota'),
    sfondo: t('adm.temaDash.sfondo'),
    sfondoNota: t('adm.temaDash.sfondoNota'),
    colore: t('adm.temaDash.colore'),
    saturazione: t('adm.temaDash.saturazione'),
    luminosita: t('adm.temaDash.luminosita'),
    notaLeggibilita: t('adm.temaDash.notaLeggibilita'),
    salva: t('adm.temaDash.salva'),
    salvando: t('adm.temaDash.salvando'),
    ripristina: t('adm.temaDash.ripristina'),
    soloResponsabile: t('adm.temaDash.soloResponsabile'),
  };

  const cambia = (nuovo: TemaDashboard) => {
    setTema(nuovo);
    setMessaggio('');
    setErrore('');
  };

  const salva = async () => {
    setSalvando(true);
    setMessaggio('');
    setErrore('');
    // ⚠️ Prima il browser, poi il database. Se la scrittura non passa,
    // almeno chi ha appena scelto i colori se li ritrova ricaricando —
    // e il messaggio qui sotto dice chiaramente che gli altri no.
    salvaTemaLocale(`circolo.${circoloId}`, tema);
    const fatto = await salvaTemaCircolo(circoloId, tema);
    setSalvando(false);
    if (fatto) setMessaggio(t('adm.temaDash.salvato'));
    else setErrore(t('adm.temaDash.erroreSalvataggio'));
  };

  return (
    <SezioneCollassabile
      id="personalizzaDashboard"
      titolo={t('adm.gen.sez.temaDash.titolo')}
      descrizione={t('adm.gen.sez.temaDash.descrizione')}
    >
      <PersonalizzaDashboard
        tema={tema}
        temaDiPartenza={TEMA_ADMIN_DI_PARTENZA}
        cambia={cambia}
        salva={salva}
        ripristina={() => cambia(TEMA_ADMIN_DI_PARTENZA)}
        salvando={salvando}
        messaggio={messaggio}
        errore={errore}
        puoSalvare={puoSalvare}
        testi={testi}
      />
    </SezioneCollassabile>
  );
}
