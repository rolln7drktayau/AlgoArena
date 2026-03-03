# AlgoArena

<p align="left">
  <img src="./frontend/public/logo.png" alt="AlgoArena logo" width="96" />
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

## Deploy Online (Professor Demo Branch)

Use branch `web/prof-demo` to host a public demo URL with one service (FastAPI + built React SPA).

### What this branch adds

- A root `Dockerfile` that builds the frontend and runs the backend.
- FastAPI serves `frontend/dist` in production (same domain for API + WebSocket).
- `render.yaml` for Render Blueprint deployment.

### Deploy on Render

1. Push branch `web/prof-demo` to GitHub.
2. In Render: `New` -> `Blueprint`.
3. Connect your repo and choose branch `web/prof-demo`.
4. Confirm service creation from `render.yaml`.
5. Wait for build/deploy, then open the generated URL.

The app and backend are served together, so the WebSocket endpoints (`/ws/run`, `/ws/scenario`) work directly from the same domain.

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
