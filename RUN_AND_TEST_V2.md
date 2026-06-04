# AlgoArena V2 - Run and Test Guide

## Branches

```powershell
git switch develop/v2
```

`release/v1.0` is the frozen V1 baseline. Do not delete `release/*` branches.

## 1. Local App, Full Mode

This is the complete developer/local mode with FastAPI, WebSockets, pymoo and the React UI.

Install once:

```powershell
python -m venv .venv
.\.venv\Scripts\activate
pip install -r backend\requirements.txt
cd frontend
npm install
cd ..
```

If old dev servers are already running, stop them first:

```powershell
npm run local:stop
```

Run both backend and frontend with one command:

```powershell
npm run local:dev
```

Open:

```text
http://localhost:5173
```

`local:dev` uses strict port `5173`; it will not silently open `5174`. Press `Ctrl+C` in that terminal to stop both backend and frontend. If anything remains, run `npm run local:stop`.

Alternative, run backend and frontend separately:

Run backend:

```powershell
.\.venv\Scripts\activate
npm run local:backend
```

Run frontend in another terminal:

```powershell
npm run local:frontend
```

Open:

- App: http://localhost:5173
- API docs: http://localhost:8000/docs
- Health: http://localhost:8000/api/health

Smoke tests:

```powershell
Invoke-WebRequest -UseBasicParsing http://localhost:8000/api/health
Invoke-WebRequest -UseBasicParsing http://localhost:8000/api/capabilities
Invoke-WebRequest -UseBasicParsing http://localhost:8000/api/problem-domains
```

UI checks:

- Choose a profile at first launch.
- Create a Lab.
- Duplicate `NSGA-II`.
- Change the duplicate population size.
- Run benchmark.
- Export CSV/PDF/LaTeX/BibTeX.
- Open `Exploration V2`.
- Run `TSP`, `Bin packing`, `Noisy function`.
- Export the Lab as `.algoarena`.

## 2. Desktop Electron

Development desktop mode:

```powershell
npm install
npm run desktop:dev
```

Build Windows installer:

```powershell
npm run desktop:dist:win
```

Optional portable Python preparation:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\prepare_portable_python_windows.ps1
npm run desktop:dist:win
```

Electron runtime behavior:

- First tries `ALGOARENA_PYTHON`.
- Then tries embedded `desktop/python/python.exe`.
- Then tries local `.venv`.
- Then falls back to system `python` / `python3`.

## 3. CLI

Editable local usage:

```powershell
python -m algoarena_cli algorithms
python -m algoarena_cli problems
python -m algoarena_cli domains
python -m algoarena_cli run --problem ZDT1 --algorithm NSGA-II --population 20 --generations 3
python -m algoarena_cli domain-run --kind tsp --iterations 80
```

Install as package:

```powershell
pip install -e .
algoarena algorithms
algoarena domain-run --kind noisy --iterations 120
```

## 4. GitHub Pages Web Demo

The GitHub Pages version is in:

```text
docs/index.html
```

It is intentionally serverless and lightweight:

- no FastAPI;
- no WebSockets;
- no Python file upload;
- no subprocess;
- Pyodide in browser when available;
- JavaScript fallback with no custom expression execution;
- localStorage Lab persistence;
- `.algoarena` export.

Serve locally:

```powershell
npm run pages:serve
```

Open:

```text
http://localhost:4174
```

GitHub Pages setup:

1. Push `develop/v2`.
2. In GitHub repository settings, open Pages.
3. Source: deploy from branch.
4. Branch: `develop/v2`.
5. Folder: `/docs`.
6. Save.

The public URL will be shown by GitHub Pages after deployment.

## 5. Security Defaults

Safe by default:

- Mathematical expressions use AST validation.
- Uploaded Python custom problems use RestrictedPython.
- Custom algorithm upload is disabled by default.
- External subprocess evaluators are disabled by default.
- Algorithm steps have a timeout.
- GitHub Pages does not execute uploaded Python or subprocesses.

Trusted local opt-ins:

```powershell
$env:ALGOARENA_ENABLE_CUSTOM_ALGORITHM_UPLOAD="1"
$env:ALGOARENA_ENABLE_SUBPROCESS="1"
$env:ALGOARENA_ALGORITHM_STEP_TIMEOUT_SEC="20"
```

Use those only on your own machine with trusted code.

## 6. Full Test Suite

```powershell
npm run local:build
python -m pytest backend/tests
npm --prefix frontend run test
python -m algoarena_cli run --problem ZDT1 --algorithm NSGA-II --population 20 --generations 2 --output .\build\cli-smoke.json
python -m algoarena_cli domain-run --kind bin_packing --iterations 20
```
