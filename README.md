# AlgoArena

<p align="left">
  <img src="./frontend/public/logo.png" alt="AlgoArena logo" width="96" />
</p>
<p align="left">
  <img src="./assets/branding/logo-wordmark.png" alt="AlgoArena wordmark" width="420" />
</p>

AlgoArena is a full-stack single-page application for benchmarking and visually comparing multi-objective optimization algorithms in real time.

Authors: AST & RCT

## Stack

- Frontend: React + Tailwind CSS + Zustand + D3.js + Recharts
- Backend: FastAPI + pymoo + DEAP
- Realtime transport: WebSocket (`/ws/run`)
- Deployment: local development workflow (no Docker required)

## Project Structure

```text
.
├── frontend/          # React SPA
├── backend/           # FastAPI service
├── algorithms/        # Pluggable algorithm modules (builtin + custom uploads)
├── problems/          # Builtin/custom problem registry
├── Workflows/         # Scientific workflow XML presets (Pegasus DAX)
└── README.md
```

## Features Implemented

- Built-in algorithms: `NSGA-II`, `NSGA-III`, `U-NSGA-III`, `R-NSGA-II`, `R-NSGA-III`, `D-NSGA-II`, `MOEA/D`, `RVEA`, `C-TAEA`, `SPEA2`, `SMS-EMOA`, `Random Search`
- Optional (if available in your installed `pymoo` build): `CMOPSO`, `MOPSO-CD`
- Plug-in architecture with user upload for custom algorithm classes
- Built-in benchmark problems: `ZDT1-6`, `DTLZ1-7`, `WFG1-9` (plus `WFG` alias)
- Custom problems from objective expressions or uploaded Python evaluator
- Per-algorithm hyperparameter panel with immediate-run restart behavior
- Real-time side-by-side visualization:
  - Pareto front (2D or projected 3D)
  - Convergence curves (HV, IGD, IGD+, GD, GD+, Epsilon, Spread/Delta, Spacing, speed)
  - Diversity heatmap
  - Generation and elapsed time
- Common researcher charts:
  - Global Pareto chart (all algorithms together)
  - Global convergence chart with selectable metric
- Competition mode:
  - Multiple algorithms on same problem
  - Live leaderboard (HV, IGD, time-to-convergence, elapsed time)
  - Final radar comparison chart
  - Export to CSV and PDF report
- UI/UX:
  - Dark/Light theme toggle (dark default)
  - Drag-and-drop panel reorder
  - Pin/unpin metrics
  - Replay mode generation-by-generation
  - Responsive layout
- Scenario simulation tab:
  - Define Edge/Fog/Cloud-like environments
  - Add/remove tiers
  - Load scientific workflow presets from XML (Epigenomics, CyberShake, Montage, Inspiral, Sipht, plus other available DAX files)
  - Optional workflow task-limit for large instances (e.g., 1000-task workflows)
  - Manual objective builder (2 to 5 objectives): built-ins + optional expressions
  - Built-in objectives include `latency`, `cost`, `energy`, `makespan`, `execution_speed`, and `avg_wait`
  - Per-objective min/max direction and optional target values
  - Simulate scheduling recommendations per algorithm
  - Compare objective values, goal distance, speed, and assignments

## Workflow API (Scenario Presets)

- `GET /api/workflows` returns all detected Pegasus DAX workflows discovered recursively under `Workflows/**/*.xml`
- `GET /api/workflows/{workflow_id}?limit=25` returns metadata and a normalized task preview
- Scenario simulation accepts:
  - `workflow_id` to use a workflow preset
  - `workflow_task_limit` to run only the first N tasks in topological order

If `workflow_id` is omitted, simulation uses manual/synthetic tasks.

## Run Locally

Detailed French tutorial:

- [GUIDE_COMPLET_FR.md](./GUIDE_COMPLET_FR.md)

### Backend

```bash
# from repository root
python -m venv .venv
# Windows PowerShell:
# .venv\Scripts\activate
# Linux/WSL:
# source .venv/bin/activate
pip install -r backend/requirements.txt
uvicorn backend.app.main:app --host 0.0.0.0 --port 8000
```

### Frontend

```bash
# in a second terminal
cd frontend
npm install
npm run dev
```

- Frontend: `http://localhost:5173`
- Backend API: `http://localhost:8000`
- OpenAPI docs: `http://localhost:8000/docs`

## Branches and Public Demo

AlgoArena keeps two long-lived branches:

- `release/v1.0`: frozen V1 baseline.
- `develop/v2`: active V2 development and GitHub Pages demo source.

The GitHub Pages demo is served from `docs/` on `develop/v2`. It is intentionally serverless: no Docker, no backend, no cloud database. The full app still runs locally with FastAPI, WebSockets and pymoo through `npm run local:dev`.

## One-Command Startup Scripts

### Windows (PowerShell)

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\start_windows.ps1
```

Optional:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\start_windows.ps1 -SkipInstall
powershell -ExecutionPolicy Bypass -File .\scripts\start_windows.ps1 -NoToast
```

You can also use:

```bat
.\scripts\start_windows.bat
```

Windows launcher can show native toast notifications.
It auto-opens the app URL in your default browser when services are ready.

### Desktop Mode (Electron)

Run a native desktop window (similar to Paige):

```powershell
npm install
npm run desktop:dev
```

Build a Windows desktop installer (`dist-electron`):

```powershell
npm install
npm run desktop:dist:win
```

Paige-style packaging commands are also available:

```powershell
npm run dist
npm run dist:win
npm run dist:linux
npm run dist:mac
```

A GitHub Actions workflow builds installers on Windows/Linux/macOS and uploads artifacts:

- [build.yml](./.github/workflows/build.yml)

### Branding Assets (Logo Pack)

Branding sources and exports are stored in:

- `assets/branding/logo-main.svg`
- `assets/branding/logo-variant-b.svg`
- `assets/branding/logo-monochrome.svg`
- `assets/branding/logo-wordmark.svg`
- `assets/branding/logo-variant-b.png`
- `assets/branding/logo-wordmark.png`
- `assets/branding/logo-monochrome.png`

Desktop/taskbar icon (optimized for small sizes):

- `desktop/assets/icon-taskbar.ico`

To regenerate production icon files used by the app and installer:

```powershell
python scripts/generate_brand_assets.py
```

### Build Windows EXE Launcher

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\build_launcher_exe.ps1
```

Then run:

```powershell
.\dist\AlgoArenaLauncher.exe
```

### WSL / Linux

```bash
chmod +x scripts/start_wsl.sh
./scripts/start_wsl.sh
```

Optional:

```bash
./scripts/start_wsl.sh --skip-install
```

## WebSocket Protocol

Endpoint: `ws://localhost:8000/ws/run`

1. Client sends:

```json
{
  "type": "start_run",
  "payload": {
    "problem": { "kind": "builtin", "name": "ZDT1", "n_var": 30, "n_obj": 2 },
    "algorithms": [
      {
        "id": "nsga-ii",
        "name": "NSGA-II",
        "hyperparams": {
          "population_size": 120,
          "generations": 140,
          "crossover_rate": 0.9,
          "mutation_rate": 0.1
        }
      }
    ]
  }
}
```

2. Server streams `run_started`, `generation`, `leaderboard`, and `completed` messages.

## Custom Algorithm Plug-in Interface

Place (or upload) a Python module containing a class inheriting `BaseAlgorithm`:

```python
from algorithms.base import BaseAlgorithm, PopulationSnapshot

class MyAlgorithm(BaseAlgorithm):
    display_name = "My Custom MOEA"
    hyperparam_schema = {
        "population_size": {"label": "Population Size", "type": "int", "min": 20, "max": 200, "step": 10, "default": 80},
        "generations": {"label": "Generations", "type": "int", "min": 10, "max": 500, "step": 10, "default": 100}
    }

    def __init__(self, problem, hyperparams):
        super().__init__(problem, hyperparams)
        self._done = False

    def step(self) -> PopulationSnapshot:
        # Build and return one generation snapshot
        raise NotImplementedError

    def is_done(self) -> bool:
        return self._done
```

Upload through UI or `POST /api/algorithms/upload` (multipart).
An editable starter template is available at `algorithms/custom/_template_algorithm.py`.

## Custom Problem Options

1. Expression-based:
   - `POST /api/problems/custom/expression`
   - Each objective is an expression using `x`, `np`, and `math`
2. Uploaded Python function:
   - `POST /api/problems/custom/upload`
   - Function signature example:

```python
def evaluate(x):
    return [x[0]**2, (1 - x[0])**2]
```

## Tests

Backend tests are under `backend/tests`:

```bash
python -m pytest backend/tests
```

Frontend robustness tests:

```bash
cd frontend
npm run test
```
