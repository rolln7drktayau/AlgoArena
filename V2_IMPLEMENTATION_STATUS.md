# AlgoArena V2 Implementation Status

Branch strategy:

- `release/v1.0` preserves the V1 baseline.
- `develop/v2` contains V2 work.
- `release/*` branches must not be deleted.

Implemented in this V2 slice:

- Local Labs model in the frontend.
- IndexedDB persistence with localStorage fallback.
- `.algoarena` import/export.
- Small Lab URL sharing for compact Labs.
- First-launch user profiles: student, researcher, curious.
- Profile switching from the Labs panel.
- Automatic run history capture when a benchmark completes.
- Multi-configuration competitors by duplicating an algorithm card.
- Backend support for competitor labels without changing existing WebSocket payload compatibility.
- AST-validated mathematical objective expressions.
- RestrictedPython loading for uploaded custom problem evaluators.
- Per-algorithm step timeout via `ALGOARENA_ALGORITHM_STEP_TIMEOUT_SEC`.
- Runtime capabilities endpoint: `/api/capabilities`.
- V2 problem-domain registry endpoint: `/api/problem-domains`.
- V2 domain simulation endpoint: `/api/problem-domains/simulate`.
- Functional lightweight simulations for mono-objective, noisy, TSP, bin packing, Bayesian-light, and drawable grid domains.
- Frontend `Exploration V2` tab for those new domains.
- V2 Explore now includes fitness landscape, decision/objective trace, simplified genealogy and noisy confidence-band data where applicable.
- Side-by-side benchmark panels can now be selected independently from the algorithms that run.
- Common research charts include metric guidance and clearer empty states.
- `npm run local:dev` starts frontend and backend together.
- `npm run local:stop` stops AlgoArena dev ports 8000/5173/5174/4174.
- Vite uses strict port 5173 to avoid silent 5174 confusion.
- GitHub Pages serverless demo in `docs/index.html`.
- JavaScript custom problem evaluator worker with timeout.
- External JSON stdin/stdout evaluator support, disabled by default unless `ALGOARENA_ENABLE_SUBPROCESS=1`.
- Electron detects `desktop/python/python.exe` as an embedded portable Python runtime.
- Windows helper script for portable Python preparation.
- LaTeX benchmark export endpoint and frontend button.
- BibTeX export endpoint and frontend button.
- Minimal `pip install algoarena` packaging and `algoarena` CLI.
- Statistics JSON export with Kruskal-Wallis and pairwise Wilcoxon results when enough samples exist.

Still planned / partial after current V2 implementation:

- Full React Pyodide/GitHub Pages runtime. A lightweight serverless demo exists in `docs/`.
- Desktop Python-portable bundling workflow.
- Production-grade custom algorithm sandbox. Direct custom algorithm upload is disabled by default.
- Full combinatorial optimization algorithm library beyond the implemented TSP/bin-packing demos.
- Full single-objective algorithm suite beyond current random/domain demos.
- Production Bayesian optimization module beyond current surrogate-guided sampling demo.
- 3D landscape explorer. 2D landscape exists in V2 Explore.
- Full evolutionary genealogy from pymoo internals. Simplified genealogy exists for TSP.
- Drawable fitness landscape.
- Formal Wilcoxon/Kruskal-Wallis exports for repeated experiments.

Compatibility notes:

- Existing `/ws/run` and `/ws/scenario` endpoints are preserved.
- Existing pymoo algorithm adapters are preserved.
- Existing CSV/PDF exports are preserved.
- Docker is not required or added.
