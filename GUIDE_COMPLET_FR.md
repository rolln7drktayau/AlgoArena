# AlgoArena - Tutoriel Complet (Pas a Pas)

Ce guide explique comment utiliser AlgoArena de A a Z:

- demarrage local rapide
- mode web-first (lien public)
- creation/utilisation du launcher `.exe`
- usage de la competition et de la simulation
- plan propose pour changement de theme et de langue

---

## 1) Prerequis

Sur Windows:

1. Python 3.11+ (avec `python` dans le `PATH`)
2. Node.js 20+ et npm
3. Git
4. (Optionnel pour mode web-first) `cloudflared`

Verification rapide:

```powershell
python --version
node --version
npm --version
git --version
cloudflared --version
```

Si `cloudflared` n'est pas installe:

```powershell
winget install --id Cloudflare.cloudflared -e
```

---

## 2) Cloner le projet

```powershell
cd E:\
git clone <URL_DU_REPO>
cd E:\AlgoArena
```

Si le projet est deja present:

```powershell
cd E:\AlgoArena
git pull
```

---

## 3) Demarrage local (methode la plus simple)

Commande unique:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\start_windows.ps1
```

Ce script fait:

1. creation du venv Python (`.venv`) si absent
2. installation des dependances backend
3. installation `frontend/node_modules` si absent
4. ouverture de 2 fenetres PowerShell:
   - backend FastAPI sur `http://localhost:8000`
   - frontend Vite sur `http://localhost:5173`
5. affichage d'un toast Windows de statut

URL utiles:

- Frontend: `http://localhost:5173`
- API: `http://localhost:8000`
- Docs API: `http://localhost:8000/docs`

---

## 4) Demarrage local manuel (2 terminaux)

Utile si tu veux controler finement les logs.

### Terminal 1 - Backend

```powershell
cd E:\AlgoArena
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r backend\requirements.txt
uvicorn backend.app.main:app --host 0.0.0.0 --port 8000
```

### Terminal 2 - Frontend

```powershell
cd E:\AlgoArena\frontend
npm install
npm run dev -- --host 0.0.0.0 --port 5173
```

---

## 5) Mode web-first (partage public gratuit)

Le mode web-first lance l'app localement + ouvre un tunnel Cloudflare.

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\start_windows.ps1 -WebFirst
```

Resultat attendu:

1. backend et frontend demarrent localement
2. `cloudflared` s'ouvre dans une nouvelle fenetre
3. une URL publique `https://...trycloudflare.com` apparait
4. un toast affiche cette URL

Important:

- ton PC doit rester allume
- la fenetre `cloudflared` doit rester ouverte
- ce lien est pratique pour demo/prof, mais pas une infra prod

---

## 6) Construire et utiliser le launcher `.exe`

### Build de l'executable

```powershell
cd E:\AlgoArena
powershell -ExecutionPolicy Bypass -File .\scripts\build_launcher_exe.ps1
```

Executable genere:

`E:\AlgoArena\dist\AlgoArenaLauncher.exe`

### Lancer l'app via EXE

Mode local:

```powershell
.\dist\AlgoArenaLauncher.exe
```

Mode web-first:

```powershell
.\dist\AlgoArenaLauncher.exe -WebFirst
```

Astuce:

- `-NoToast` pour desactiver les notifications
- `-SkipInstall` pour accelerer si dependances deja installees

---

## 7) Utilisation de l'application (workflow conseille)

## 7.1 Benchmarks / Competition

1. Ouvre `http://localhost:5173`
2. Va dans la partie benchmark/competition
3. Selectionne le probleme (ex: `ZDT1`)
4. Ajoute 2+ algorithmes
5. Clique Run
6. Surveille:
   - pareto en temps reel
   - courbes (HV, IGD, etc.)
   - classement live
   - radar final (et radar live selon dispo)

## 7.2 Scenario Simulator

1. Ouvre l'onglet Scenario
2. Definis les tiers (Edge/Fog/Cloud)
3. Charge un workflow preset (optionnel)
4. Definis les objectifs (latency/cost/energy/etc.)
5. Lance la simulation
6. Observe la vue dynamique + replay

---

## 8) Depannage rapide

## 8.1 Port deja occupe

Si `8000` ou `5173` est deja pris:

```powershell
Get-NetTCPConnection -LocalPort 8000,5173 -State Listen
```

Ferme le process en conflit ou change le port.

## 8.2 Frontend inaccessible mais backend OK

Dans `frontend`:

```powershell
npm install
npm run dev -- --host 0.0.0.0 --port 5173
```

## 8.3 Backend inaccessible

```powershell
cd E:\AlgoArena
.\.venv\Scripts\Activate.ps1
uvicorn backend.app.main:app --host 0.0.0.0 --port 8000
```

## 8.4 `cloudflared` non trouve

Installe:

```powershell
winget install --id Cloudflare.cloudflared -e
```

---

## 9) Propositions de changement de theme et de langue

Tu as deja Dark/Light. Voici une proposition concrete pour monter en gamme.

## 9.1 Proposition Theme (v2)

Ajouter 2 themes en plus:

1. `lab-dark` (fond anthracite, accents cyan/vert)
2. `paper-light` (fond creme clair, accents bleu/orange)

Zone de code cible:

- `frontend/src/index.css`
- `frontend/src/store/useAppStore.ts`
- `frontend/src/App.tsx`

Approche:

1. Etendre le type `ThemeMode` (`dark`, `light`, `lab-dark`, `paper-light`)
2. Ajouter classes `body.theme-lab-dark` et `body.theme-paper-light`
3. Remplacer les couleurs hardcodees restantes par variables CSS

Exemple de variables:

```css
/* lab-dark */
--bg: #0b1118;
--surface: #121b26;
--text: #e8f1ff;
--accent: #29dba6;
--accent-2: #5cc8ff;

/* paper-light */
--bg: #f7f4ec;
--surface: #fffdf8;
--text: #1a1c1f;
--accent: #1f6feb;
--accent-2: #d97706;
```

## 9.2 Proposition Langue (FR/EN)

Objectif: interface bilingue avec bascule instantanee.

Stack recommande:

- `react-i18next`
- `i18next`

Plan:

1. Installer les libs
2. Creer:
   - `frontend/src/i18n/index.ts`
   - `frontend/src/i18n/locales/fr.json`
   - `frontend/src/i18n/locales/en.json`
3. Initialiser i18n dans `frontend/src/main.tsx`
4. Remplacer progressivement les libelles par `t("...")`
5. Ajouter selecteur de langue dans la toolbar
6. Persister la langue en `localStorage`

Priorite de traduction (fort impact):

1. barre de navigation + boutons Run/Stop/Replay
2. panneaux benchmark
3. panneaux scenario
4. messages d'erreur API

---

## 10) Bonnes pratiques pour demo prof

1. Lance d'abord en local pour verifier
2. Lance ensuite `-WebFirst` pour obtenir une URL publique
3. Teste benchmark + scenario avant partage
4. Garde les 3 fenetres ouvertes:
   - backend
   - frontend
   - cloudflared

---

## 11) Commandes resume

```powershell
# Local
powershell -ExecutionPolicy Bypass -File .\scripts\start_windows.ps1

# Web-first
powershell -ExecutionPolicy Bypass -File .\scripts\start_windows.ps1 -WebFirst

# Build EXE
powershell -ExecutionPolicy Bypass -File .\scripts\build_launcher_exe.ps1

# Run EXE
.\dist\AlgoArenaLauncher.exe -WebFirst
```

Fin du guide.
