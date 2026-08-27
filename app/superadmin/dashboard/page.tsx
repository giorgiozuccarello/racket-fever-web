'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import { auth } from '../../../lib/firebase';
import { leggiSuperAdmin, ProfiloSuperAdmin } from '../../../data/superadmin';
import { allineaEmailProfilo } from '../../../data/sicurezzaAccesso';
import SezioneSicurezzaAccesso from './SezioneSicurezzaAccesso';
import SezioneOnboarding from './SezioneOnboarding';
import SezioneRichieste from './SezioneRichieste';
import SezioneSegnalazioni from './SezioneSegnalazioni';
import SezioneCircoli from './SezioneCircoli';
import SezioneBannerRete from './SezioneBannerRete';
import SezioneFatturazione from './SezioneFatturazione';
import SezioneModelliRevenue from './SezioneModelliRevenue';

export default function SuperAdminDashboard() {
  const router = useRouter();
  const [profilo, setProfilo] = useState<ProfiloSuperAdmin | null>(null);
  // ⚠️ Serve l'oggetto utente, non solo il profilo: la sezione
  // «Sicurezza dell'accesso» mostra l'indirizzo VERO con cui si è
  // entrati e se è verificato, e quelle due cose stanno in Firebase
  // Auth, non nel documento Firestore. Prenderle dal profilo vorrebbe
  // dire mostrare una copia che, dopo un cambio email, resta indietro
  // — cioè proprio nella schermata che serve a cambiarla.
  const [utente, setUtente] = useState<User | null>(null);
  const [caricando, setCaricando] = useState(true);
  const [erroreAvvio, setErroreAvvio] = useState('');

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user: User | null) => {
      // ⚠️ SI AZZERA A OGNI GIRO. Senza, un guasto momentaneo diventava
      // definitivo: al tentativo successivo profilo e utente si
      // riempivano, ma la schermata rossa restava sopra a tutto e la
      // dashboard non si raggiungeva più se non ricaricando a mano.
      setErroreAvvio('');
      if (!user) {
        router.replace('/superadmin/login');
        return;
      }
      // ⚠️ SOTTO `try`, e prima non c'era. `leggiSuperAdmin` fa una
      // lettura: offline, o con le regole appena ripubblicate, può
      // essere respinta. Il rifiuto di una promise dentro un callback
      // `async` che nessuno attende non lo raccoglie nessuno — la
      // pagina restava su «Caricamento…» per sempre, senza una parola,
      // e chi guardava non aveva modo di sapere se stava caricando o
      // se era rotta.
      let p: ProfiloSuperAdmin | null = null;
      try {
        p = await leggiSuperAdmin(user.uid);
      } catch {
        setErroreAvvio(
          'Non riesco a leggere il tuo profilo Super Admin. Può essere la connessione, '
          + 'oppure un permesso: esci e rientra, e se il problema resta va guardato.',
        );
        setCaricando(false);
        return;
      }
      if (!p) {
        // ⚠️ ANCHE QUESTO `signOut` sotto try, e prima era scoperto.
        // Era l'altra `await` pericolosa della stessa funzione: se
        // rigetta — rete assente, cioè proprio lo scenario per cui il
        // try qui sopra è stato messo — il callback rigetta, nessuno
        // raccoglie il rifiuto e la pagina torna a «Caricamento…» per
        // sempre. Proteggerne una sola delle due voleva dire lasciare
        // aperta esattamente la stessa porta.
        try { await signOut(auth); } catch { /* si esce comunque */ }
        router.replace('/superadmin/login');
        return;
      }
      setProfilo(p);
      setUtente(user);
      setCaricando(false);

      // ⚠️ DOPO `setCaricando(false)`, e questo è il punto. L'`await`
      // qui sotto c'è, ma non trattiene più niente: la pagina è già
      // stata sbloccata. Prima stava sopra, e costava carissimo —
      // `updateDoc` non risolve finché il server non conferma, quindi
      // con la rete che va e viene la promise resta appesa (nessun
      // errore, nessun catch che scatta) e la dashboard non si apriva
      // più. E succedeva proprio al primo rientro dopo un cambio
      // email, cioè l'unico momento in cui questo blocco serve.
      //
      // ⚠️ E si guarda l'esito invece di ignorarlo: se la scrittura è
      // stata respinta, ritentare a ogni accesso per sempre senza che
      // nessuno lo sappia è peggio che non allineare affatto. Non è
      // per quello che si vede a schermo — l'indirizzo mostrato dalla
      // sezione Sicurezza viene da Firebase Auth, non da qui — è per
      // non nascondere un rifiuto che si ripete.
      if (user.email && p.email !== user.email) {
        const scritto = await allineaEmailProfilo(user.uid, user.email);
        if (scritto) setProfilo({ ...p, email: user.email });
      }
    });
    return unsub;
  }, [router]);

  const logout = async () => {
    // ⚠️ Sotto try: è anche l'unico pulsante della schermata di guasto,
    // e quella schermata la si vede proprio quando la rete non va. Un
    // «Esci» che non esce e non dice niente è peggio di nessun pulsante.
    try { await signOut(auth); } catch { /* si va al login comunque */ }
    router.replace('/superadmin/login');
  };

  // ⚠️ Il guasto si dice. «Caricamento…» che non finisce mai è la
  // schermata peggiore: non distingue una rete lenta da un permesso
  // negato, e manda ad aspettare qualcosa che non arriverà.
  if (erroreAvvio) {
    return (
      <div className="admin-splash">
        <div className="logo-mark" aria-hidden="true" />
        {/* ⚠️ Non `.admin-error-text`: quello è il rosso scuro pensato
            per stare dentro una card bianca, e qui il fondo è nero —
            l'unica schermata che deve spiegare un guasto era anche
            l'unica illeggibile. Rosso chiaro e corpo normale. */}
        <p style={{
          marginTop: '1rem', maxWidth: '32rem', color: '#FF8A80',
          fontSize: '.95rem', lineHeight: 1.5, textAlign: 'center',
        }}
        >
          {erroreAvvio}
        </p>
        <div style={{ display: 'flex', gap: '.6rem', marginTop: '1.2rem' }}>
          {/* ⚠️ «Riprova» prima di «Esci»: il guasto dichiarato è
              transitorio, e mandare fuori chi ha avuto un intoppo di
              rete gli fa rifare tutto il login per niente. */}
          <button className="btn" onClick={() => window.location.reload()}>Riprova</button>
          <button className="btn btn-outline" onClick={logout}>Esci</button>
        </div>
      </div>
    );
  }

  if (caricando || !profilo || !utente) {
    return (
      <div className="admin-splash">
        <div className="logo-mark" aria-hidden="true" />
        <p className="mono" style={{ marginTop: '1rem', opacity: 0.8 }}>Caricamento…</p>
      </div>
    );
  }

  return (
    <div className="admin-shell">
      <header className="admin-header">
        <div className="admin-header-brand">
          <div className="logo-mark admin-header-logo-mark" aria-hidden="true" />
          <div>
            <div className="mono" style={{ opacity: 0.75 }}>SUPER ADMIN</div>
            <h1 className="display" style={{ fontSize: '1.7rem', marginTop: '.2rem' }}>Ciao, {profilo.nome}</h1>
          </div>
        </div>
        <button className="btn btn-outline admin-logout-btn" onClick={logout}>Esci</button>
      </header>

      <main className="admin-main">
        {/* ⚠️ PRIMA DI TUTTO IL RESTO. Non perché sia la cosa che si usa
            più spesso — è il contrario, si usa una volta l'anno — ma
            perché una sezione sepolta sotto le altre non la apre mai
            nessuno, e questa è quella che il giorno che serve, serve
            in fretta. */}
        <SezioneSicurezzaAccesso utente={utente} />
        <SezioneOnboarding />
        <SezioneRichieste />
        <SezioneSegnalazioni />
        <SezioneCircoli />
        <SezioneBannerRete />
        <SezioneFatturazione />
        {/* Subito dopo la Fatturazione: sono le due sezioni che
            guardano la rete dal lato dei soldi, e chi apre l'una
            cerca quasi sempre anche l'altra. */}
        <SezioneModelliRevenue />
      </main>
    </div>
  );
}
