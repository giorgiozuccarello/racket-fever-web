# 🎾 Racket Fever — Sito Web (Next.js)

Sito istituzionale + Dashboard Admin Circolo (installabile come app
desktop, PWA) + presto Dashboard Super Admin. Stesso progetto Firebase
dell'app mobile: stessi utenti, stessi circoli, stesso database.

---

## Novità — Dashboard Admin completa + installabilità PWA

- **`/admin`** — verifica la sessione e smista a login o dashboard
- **`/admin/login`** — login Admin Circolo (stesse credenziali dell'app mobile)
- **`/admin/dashboard`** — Dashboard completa, stesse funzionalità già
  operative nell'app mobile: Password del circolo, Campi, Limite ore
  settimanali, Prezzi delle ore (per campo + tariffa speciale), Orari
  riservati, Soci & Wallet, Prenotazioni del circolo (con annullo e
  rimborso automatico)
- **Installabile come app desktop** (PWA): su Chrome/Edge appare un
  banner con pulsante "Installa" che crea un'icona vera sul
  desktop/menu Start; su Safari (Mac) le istruzioni guidano verso
  "Aggiungi al Dock". Una volta installata, aprendo l'icona si va
  dritti alla Dashboard se la sessione è già attiva, altrimenti al login.
- **Pulsante "Accedi"** in home page, per chi ha bisogno di entrare da
  un dispositivo diverso da quello con la PWA installata

---

## Avvio in locale

```
npm install
npm run dev
```

Poi apri:
- **http://localhost:3000** — sito istituzionale
- **http://localhost:3000/admin** — Dashboard Admin (serve un account
  admin già esistente su Firebase, es. quello creato dallo script di seed)

> Il banner "Installa" e il service worker richiedono **https**: in
> locale (http) non compariranno. Si testano solo dopo il deploy.

---

## Prima di pubblicare un aggiornamento

1. **`npm install`** se hai aggiunto pacchetti (non è il caso di questo
   aggiornamento: nessun nuovo pacchetto).
2. **Regole Firestore**: invariate, nessuna azione richiesta.
3. **Assicurati che `package-lock.json` sia aggiornato** e incluso nel
   commit — senza quel file la build fallisce.
4. `git add .` → `git commit -m "..."` → `git push`. Il deploy parte
   da solo.

---

## Struttura

```
racket-fever-web/
├── app/
│   ├── manifest.ts             # Manifest PWA
│   ├── layout.tsx              # Font + metadata + icone
│   ├── globals.css             # Palette sito + stili sezione admin
│   ├── page.tsx                 # Home istituzionale (+ pulsante Accedi)
│   └── admin/
│       ├── page.tsx            # Ingresso: verifica sessione e smista
│       ├── InstallPrompt.tsx   # Banner "Installa sul desktop"
│       ├── login/page.tsx      # Login Admin Circolo
│       └── dashboard/
│           ├── page.tsx               # Orchestratore: carica dati, mostra sezioni
│           ├── Modal.tsx              # Modale riutilizzabile
│           ├── SezionePassword.tsx
│           ├── SezioneCampi.tsx
│           ├── SezioneLimite.tsx
│           ├── SezionePrezzi.tsx
│           ├── SezioneBlocchi.tsx
│           ├── SezioneSoci.tsx
│           └── SezionePrenotazioni.tsx
├── data/                        # Stesso strato dati dell'app mobile
│   ├── circoli.ts               # Tipi: Circolo, Campo, Blocco, TariffaSpeciale
│   ├── circoliRepo.ts           # CRUD Firestore circoli/campi/blocchi
│   ├── prezzi.ts                # Calcolo prezzo per giorno/orario
│   ├── prenotazioniRepo.ts      # Transazioni: prenota/cancella/ricarica
│   ├── notifiche.ts             # Avvisi in-app
│   ├── users.ts                 # Profilo utente, elenco soci circolo
│   └── responsabili.ts          # Auth e profilo Admin Circolo
├── public/
│   ├── sw.js                    # Service worker minimo (solo installabilità)
│   └── icons/                   # Icone PWA brandizzate (192/512/180px)
├── lib/
│   └── firebase.ts              # Stesso progetto Firebase dell'app mobile
└── next.config.js
```

## Prossimi passi
- [ ] Dashboard Super Admin (onboarding circoli, in sostituzione dello
      script `seed.js`)
- [ ] Pagine separate per Blog/News, Privacy, Termini di servizio
- [ ] Spostare la scrittura del credito su Cloud Function (sicurezza,
      già annotato in `firestore.rules`)
