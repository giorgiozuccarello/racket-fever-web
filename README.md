# 🎾 Racket Fever — Sito Web (Next.js)

Sito istituzionale + (presto) Dashboard Admin Circolo e Super Admin.
Stesso progetto Firebase dell'app mobile: stessi utenti, stessi circoli,
stesso database Firestore.

---

## Avvio in locale

Requisiti: Node.js LTS (lo stesso che usi già per il progetto Expo).

```
npm install
npm run dev
```

Apri **http://localhost:3000** nel browser: dovresti vedere la home
identica al prototipo che avevi approvato, ma ora dentro un vero
progetto Next.js — con il form "Richiedi l'attivazione" che scrive
davvero su Firestore.

---

## Prima di pubblicarlo online

1. **Piano Blaze su Firebase** — obbligatorio per App Hosting (gira su
   Cloud Run). Firebase Console → Upgrade → Blaze.
2. **Ripubblica le regole Firestore** — è stata aggiunta la collezione
   `richieste_attivazione` per il form del sito. Copia il contenuto di
   `firestore.rules` (nel progetto `racket-fever`, la cartella
   dell'app mobile — le regole sono uniche per tutto il progetto
   Firebase) → Firebase Console → Firestore Database → Rules → Pubblica.
3. **Un repository GitHub** — Firebase App Hosting si collega
   direttamente a GitHub e pubblica automaticamente ad ogni push sul
   ramo principale. Se non l'hai già, crea un repository (anche
   privato) e caricaci questa cartella.
4. Su **Firebase Console → App Hosting → Crea backend**, segui la
   procedura guidata: autorizza l'app Firebase su GitHub, seleziona il
   repository e il ramo. Da quel momento ogni `git push` pubblica una
   nuova versione del sito automaticamente.
5. Una volta live, in **App Hosting → Domini personalizzati** collega
   `racketfever.com` e `racketfever.com` (registrati su Cloudflare):
   Firebase ti mostra i record DNS esatti da aggiungere sul pannello
   Cloudflare del dominio.

---

## Struttura

```
racket-fever-web/
├── app/
│   ├── layout.tsx       # Font (Archivo, Spline Sans Mono) + metadata
│   ├── globals.css      # Palette e stili, portati dal prototipo
│   └── page.tsx         # Home — identica al layout approvato
├── lib/
│   └── firebase.ts      # Stesso progetto Firebase dell'app mobile
└── next.config.js
```

## Prossimi passi
- [ ] Dashboard Admin Circolo (login + le stesse funzionalità già
      costruite nell'app mobile: campi, tariffe, blocchi, wallet, soci)
- [ ] Dashboard Super Admin (onboarding circoli, in sostituzione dello
      script `seed.js`)
- [ ] Pagine separate per Blog/News, Privacy, Termini di servizio
