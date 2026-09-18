# AlgoArena

Local studio for multi-objective optimization and edge/fog/cloud scheduling.
React + TypeScript frontend, FastAPI + pymoo backend, optional Electron desktop shell.
Authors: AST & RCT.

## Studio 3

A shared experiment across **Apprendre / Explorer / Recherche**, with a presentation view.
The desktop workspace follows [the visual reference](image.png): navigation, Pareto canvas,
convergence, selected solution, inspector and execution status. Long forms scroll inside their
panel; smaller screens retain normal scrolling for readability.

- Real benchmark populations, selectable objectives and keyboard-accessible solution selection.
- Scenario solution selection linked to placement and a decoded per-device Gantt.
- Independent benchmark campaigns across problems, configurations and seeds, with actual
  evaluation counts, descriptive summaries, Mann-Whitney tests and Holm correction.
- Cancellable worker processes, bounded event queues, persistent SQLite manifests and events.
- Campaign resume reuses completed samples under the exact original configuration.
- Existing `.algoarena` projects retained, with optional Studio configuration metadata.
- CSV, PDF, LaTeX, manifest and campaign JSON exports.

[Implementation and limitations (French)](docs/STUDIO_V3_FR.md) |
[Initial audit and proposal](docs/AUDIT_ET_REFONTE_FR.md) |
[Historical guides](docs/guides/GUIDE_COMPLET_FR.md)

## Run locally

### Application Windows : démarrer et arrêter

Installez la version 3 avec `dist-electron/AlgoArena Desktop Setup 3.0.0.exe`,
puis ouvrez AlgoArena depuis son raccourci. Le lanceur propose **Application PC**
(fenêtre dédiée) ou **Navigateur** (onglet local). Les calculs et les résultats
sauvegardés sont les mêmes ; les réglages non sauvegardés restent propres à chaque fenêtre.
Le runtime Python est intégré : aucun terminal ni installation Python n’est nécessaire.
Gardez le lanceur ouvert pendant le travail. **Tout arrêter et quitter**, ou fermer
le lanceur, arrête le moteur et les calculs en cours. Fermer l’onglet seul ne suffit pas.

Dans le studio, **Tutoriel interactif** accompagne une première expérience réelle.
Le bouton **?** à côté des modes explique leurs différences : Apprendre ajoute des
conseils, Explorer privilégie la manipulation, Recherche affiche les extensions et
les vecteurs de décision. Changer de mode ne change pas les calculs.

### Depuis les sources

Requirements: Python 3.11+ and Node.js 22+ (validated locally on Python 3.13 / Node 24).

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r backend/requirements.txt
npm ci
npm --prefix frontend ci
npm --prefix frontend run build
.\.venv\Scripts\python.exe -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000 --ws wsproto
```

Open **http://127.0.0.1:8000**. On Linux/macOS, use `.venv/bin/python`.
For frontend development, run `npm --prefix frontend run dev` alongside the backend.
The Vite server proxies API and WebSocket requests to port 8000.

```powershell
npm run desktop:dev
# Windows installer (requires preparing the portable runtime for offline distribution):
powershell -ExecutionPolicy Bypass -File scripts/build-desktop-full.ps1
```

A bundled Python runtime is used directly, without installation at first launch.
Without that bundle, the desktop bootstrap needs Python and network access.
Cross-platform installers and completely offline first launch on clean machines still require
release qualification; the code does not claim universal hardware support.

## Scientific conventions

The scenario engine is a deterministic, non-preemptive list scheduler with DAG precedence,
per-device queues and one serialized ingress link per tier. Units: MI, MIPS, MB, Mbps,
seconds, watts and joules. DAX runtime uses an explicit 1,000 MIPS reference machine;
I/O is aggregated per task. It is not a packet-level network simulator or a validated
replacement for every CloudSim Plus model.

Hypervolume requires a common reference. Correlated generations are not independent
statistical samples. Campaign inference includes only successful exact-budget runs and
reports effect sizes and corrected p-values. At least five samples per group is a software
minimum, not a guarantee of statistical power. Population plots draw at most approximately
1,000 points and label dominance within the displayed sample; exports preserve full results.

## Storage and limits

- Engine journal: `~/.algoarena/runs.sqlite3`, configurable with `ALGOARENA_DATA_DIR`.
- Two simultaneous worker processes by default (`ALGOARENA_MAX_JOBS`).
- Inactivity timeout: 30 seconds for benchmarks, 300 for scenarios/campaigns (`ALGOARENA_WORKER_TIMEOUT_SEC`).
- API limits: 12 benchmark configurations, 1,000 population members, 2,000 generations.
- Benchmark summary exports retain the last 200 snapshots per algorithm; full events are paginated.
- Campaign limit: five million requested evaluations.
- SQLite main database capped near 1 GiB; WAL and exports need additional disk space.

Workers stop when their WebSocket disconnects. Runs interrupted by a backend restart remain
in the journal. Campaigns can resume from Projects; mid-generation checkpoint recovery is
not implemented. The local CLI retains its direct execution path.

## Local security

Python uploads and external evaluators are disabled by default. Enable only trusted code:

- `ALGOARENA_ENABLE_CUSTOM_PROBLEM_UPLOAD=1`
- `ALGOARENA_ENABLE_CUSTOM_ALGORITHM_UPLOAD=1`
- `ALGOARENA_ENABLE_SUBPROCESS=1`

RestrictedPython and separate processes are not an operating-system sandbox.
The default services bind to `127.0.0.1`. Additional browser origins must be explicitly listed
in `ALGOARENA_ALLOWED_ORIGINS` (comma-separated). Origin checks do not replace authentication
for a shared network deployment.

## Verify

```powershell
.\.venv\Scripts\python.exe -m pytest backend/tests -q
npm --prefix frontend run test
npm --prefix frontend run build
# With the built frontend and backend running on port 8000:
node scripts/test_studio.mjs
npm audit
npm --prefix frontend audit
```

The browser test covers benchmark, modes, presentation, export, scenario-to-Gantt selection,
campaigns and desktop/mobile layout. Captures are written to ignored `reports/`.
CI tests backend and frontend on Windows and Linux.

## API and CLI

Interactive API reference: http://127.0.0.1:8000/docs

- `/ws/run`, `/ws/scenario`, `/ws/campaign`: streamed execution.
- `GET /api/runs`: persisted run manifests.
- `GET /api/runs/{id}/manifest`: configuration, seed, versions and fingerprint.
- `GET /api/runs/{id}/events?after=N`: ordered event replay (up to 100 per page).
- `POST /api/scenario/decode`: decode the placement vector against its scenario.
- `GET /api/runs/{id}/export/{csv|pdf|latex|statistics}`: benchmark exports.

```powershell
.\.venv\Scripts\python.exe -m algoarena_cli algorithms
.\.venv\Scripts\python.exe -m algoarena_cli run --problem ZDT1 --algorithm NSGA-II --seed 42 --generations 20
```

The standalone GitHub Pages demo in `docs/index.html` is a separate historical demonstration;
it does not execute the local Studio backend. Only this README is kept as Markdown at the
repository root. Historical instructions are under `docs/guides/`.
