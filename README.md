# 🎾 Racket Fever — Sito Web (Next.js)

Sito istituzionale + Dashboard Admin Circolo (installabile come app
desktop, PWA) + presto Dashboard Super Admin. Stesso progetto Firebase
dell'app mobile: stessi utenti, stessi circoli, stesso database.

---

## Novità — Dashboard Admin (primo pezzo) + installabilità PWA

- **`/admin`** — verifica la sessione e smista a login o dashboard
- **`/admin/login`** — login Admin Circolo (stesse credenziali dell'app mobile)
- **`/admin/dashboard`** — guscio funzionante; le sezioni vere (Campi,
  Prezzi, Orari riservati, Soci & Wallet, Prenotazioni) arrivano nel
  prossimo passaggio
- **Installabile come app desktop** (PWA): su Chrome/Edge appare un
  banner con pulsante "Installa" che crea un'icona vera sul
  desktop/menu Start; su Safari (Mac) le istruzioni guidano verso
  "Aggiungi al Dock". Una volta installata, aprendo l'icona si va
  dritti alla Dashboard se la sessione è già attiva, altrimenti al login.

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

## Prima di pubblicarlo online

1. **Piano Blaze su Firebase** — obbligatorio per App Hosting (gira su
   Cloud Run). Già fatto ✓
2. **Ripubblica le regole Firestore** — invariate rispetto all'ultima
   versione già pubblicata: la Dashboard Admin usa le stesse regole
   già attive per l'app mobile, nessuna modifica necessaria.
3. **Repository GitHub** collegato a Firebase App Hosting — già fatto ✓,
   ogni `git push` su `main` pubblica automaticamente una nuova versione.
4. **IMPORTANTE**: prima di ogni push assicurati che `package-lock.json`
   sia aggiornato e incluso nel commit — senza quel file la build di
   Cloud Build fallisce con "File di blocco della dipendenza mancante"
   (già successo una volta, si risolve con `npm install` + commit del file).
5. **Dominio** `racketfever.com` (+ `www.racketfever.com` in redirect) —
   già in fase di collegamento ✓

---

## Struttura

```
racket-fever-web/
├── app/
│   ├── manifest.ts            # Manifest PWA (icona, nome, finestra standalone)
│   ├── layout.tsx             # Font + metadata + icone
│   ├── globals.css            # Palette sito + stili sezione admin
│   ├── page.tsx                # Home istituzionale
│   └── admin/
│       ├── page.tsx           # Ingresso: verifica sessione e smista
│       ├── InstallPrompt.tsx  # Banner "Installa sul desktop"
│       ├── login/page.tsx     # Login Admin Circolo
│       └── dashboard/page.tsx # Dashboard (guscio, sezioni in arrivo)
├── public/
│   ├── sw.js                  # Service worker minimo (solo installabilità)
│   └── icons/                 # Icone PWA brandizzate (192/512/180px)
├── lib/
│   └── firebase.ts            # Stesso progetto Firebase dell'app mobile
└── next.config.js
```

## Prossimi passi
- [ ] Sezioni vere della Dashboard Admin: Campi, Prezzi, Orari
      riservati, Soci & Wallet, Prenotazioni (riuso della logica già
      scritta per l'app mobile)
- [ ] Dashboard Super Admin (onboarding circoli, in sostituzione dello
      script `seed.js`)
- [ ] Pagine separate per Blog/News, Privacy, Termini di servizio
