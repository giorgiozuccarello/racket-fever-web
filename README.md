# 🎾 Racket Fever — Sito Web (Next.js)

Sito istituzionale + Dashboard Admin Circolo (PWA) + Dashboard Super
Admin. Stesso progetto Firebase dell'app mobile.

---

## Novità — Dashboard Super Admin (Layer 1)

- **`/superadmin/login`** — login separato, non collegato pubblicamente
  dal sito (accesso solo diretto via URL)
- **`/superadmin/dashboard`**:
  - **Nuovo circolo** — crea un circolo e il suo primo Admin Circolo,
    in sostituzione dello script `seed.js`. Al termine mostra le
    credenziali da comunicare al presidente
  - **Richieste di attivazione** — i lead dal form pubblico del sito,
    prima invisibili se non dalla Console Firebase
  - **Circoli attivi** — elenco in sola lettura di tutti i circoli

### Nota tecnica sull'onboarding

Creare un nuovo account Firebase Auth (l'Admin del nuovo circolo) con
la stessa istanza Firebase con cui il Super Admin ha fatto login
sostituirebbe automaticamente la sua sessione — comportamento nativo
di Firebase Auth. `data/onboarding.ts` risolve il problema creando
l'account su un'istanza Firebase secondaria "usa e getta": la sessione
del Super Admin non si muove mai.

---

## Avvio in locale

```
npm install
npm run dev
```

- **http://localhost:3000** — sito istituzionale
- **http://localhost:3000/admin** — Dashboard Admin Circolo
- **http://localhost:3000/superadmin** — Dashboard Super Admin

---

## Prima di pubblicare un aggiornamento

1. **Ripubblica le regole Firestore** (obbligatorio questa volta):
   sono state aggiunte la collezione `super_admin` e i permessi per il
   Super Admin su `circoli`, `responsabili`, `richieste_attivazione`.
   Copia `firestore.rules` (nel progetto `racket-fever`, l'app mobile
   — le regole sono uniche per tutto il progetto Firebase) → Firebase
   Console → Firestore Database → Rules → Pubblica.
2. **Riesegui lo script di seed** (crea il primo account Super Admin):
   ```
   cd racket-fever-seed
   node seed.js
   ```
   Le credenziali del Super Admin vengono stampate a fine script.
3. `npm install` se necessario, poi `git add .` → `git commit` →
   `git push`. Il deploy parte da solo.

---

## Struttura (novità evidenziate)

```
racket-fever-web/
├── app/
│   ├── admin/                   # Dashboard Admin Circolo (Layer 2)
│   └── superadmin/               # ⭐ Dashboard Super Admin (Layer 1)
│       ├── login/page.tsx
│       └── dashboard/
│           ├── page.tsx
│           ├── SezioneOnboarding.tsx   # Crea circolo + primo Admin
│           ├── SezioneRichieste.tsx    # Lead dal form del sito
│           └── SezioneCircoli.tsx      # Elenco circoli (sola lettura)
├── data/
│   ├── onboarding.ts             # ⭐ Crea circolo+admin (istanza Firebase secondaria)
│   ├── superadmin.ts             # ⭐ Profilo Super Admin
│   └── richiesteAttivazione.ts   # ⭐ Lead del sito
└── ...
```

## Prossimi passi
- [ ] Statistiche/analytics globali (utenti attivi, revenue, prenotazioni)
- [ ] Gestione contenuti sito pubblico (CMS Blog/News)
- [ ] Hardening sicurezza wallet (Cloud Function)
- [ ] Notifiche email/push reali
- [ ] Pubblicazione app mobile sugli store (EAS Build)
