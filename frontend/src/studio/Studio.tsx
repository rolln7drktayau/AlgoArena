import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { useAppStore, buildRunPayload } from "../store/useAppStore";
import { useRunSocket } from "../hooks/useRunSocket";
import { buildApiUrl } from "../lib/api";
import { saveLab } from "../lib/labStorage";
import { ErrorBoundary } from "../components/ErrorBoundary";
import {
  Convergence,
  Gantt,
  number,
  ParetoPlot,
  type ScheduleRow,
  type Solution,
} from "./plots";
import { useScenario } from "./useScenario";
import { CampaignPanel, useCampaign } from "./Campaign";
import type { ScenarioEnvironment, WorkflowSpec } from "../types";
import "./studio.css";

const ProblemPanel = lazy(() =>
  import("../components/ProblemConfigPanel").then((m) => ({
    default: m.ProblemConfigPanel,
  })),
);
const Labs = lazy(() =>
  import("../components/LabsPanel").then((m) => ({ default: m.LabsPanel })),
);
const Tutorial = lazy(() =>
  import("../components/TutorialTab").then((m) => ({ default: m.TutorialTab })),
);
const Explore = lazy(() =>
  import("../components/V2ExploreTab").then((m) => ({
    default: m.V2ExploreTab,
  })),
);
const AlgorithmPanel = lazy(() =>
  import("../components/AlgorithmConfigPanel").then((m) => ({
    default: m.AlgorithmConfigPanel,
  })),
);

type View =
  | "scenario"
  | "workflow"
  | "objectives"
  | "algorithms"
  | "arena"
  | "pareto"
  | "metrics"
  | "compare"
  | "statistics"
  | "projects"
  | "export"
  | "help"
  | "explore";
type Mode = "learn" | "explore" | "research";
const navigation: { group: string; items: [View, string, string][] }[] = [
  {
    group: "PRÉPARER",
    items: [
      ["scenario", "Scénario", "box"],
      ["workflow", "Workflow", "nodes"],
      ["objectives", "Objectifs", "target"],
      ["algorithms", "Algorithmes", "hex"],
    ],
  },
  { group: "EXÉCUTER", items: [["arena", "Arena", "play"]] },
  {
    group: "ANALYSER",
    items: [
      ["pareto", "Pareto", "chart"],
      ["metrics", "Métriques", "bars"],
      ["compare", "Comparer", "grid"],
      ["statistics", "Statistiques", "wave"],
    ],
  },
  {
    group: "CONSERVER",
    items: [
      ["projects", "Projets", "file"],
      ["export", "Exporter", "export"],
    ],
  },
];
const paths: Record<string, string> = {
  box: "M4 6h16v14H4z M8 2v8 M12 10v6 M16 8v8",
  nodes: "M5 5l14 7L5 19 M5 5v14 M2 5h6 M16 12h6 M2 19h6",
  target: "M12 3l8 4v6l-8 8-8-8V7z M8 11l3 3 5-6",
  hex: "M12 2l9 5v10l-9 5-9-5V7z M3 7l9 5 9-5 M12 12v10",
  play: "M6 3l15 9-15 9z",
  chart: "M3 3v18h18 M7 15l4-5 4 2 5-7",
  bars: "M5 20V10 M12 20V3 M19 20V7",
  grid: "M3 3h18v18H3z M3 10h18 M10 3v18",
  wave: "M2 14h4l3-9 5 14 4-11h4",
  file: "M5 2h9l5 5v15H5z M14 2v6h5",
  export: "M12 16V2 M7 7l5-5 5 5 M4 14v7h16v-7",
  panel: "M3 4h18v16H3z M15 4v16",
  sun: "M12 3v2 M12 19v2 M3 12h2 M19 12h2 M6 6l1 1 M17 17l1 1 M6 18l1-1 M17 7l1-1 M9 9h6v6H9z",
};
function Icon({ name }: { name: string }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[name] ?? paths.box} />
    </svg>
  );
}
function download(data: unknown, filename: string) {
  const blob =
    data instanceof Blob
      ? data
      : new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function Studio() {
  const state = useAppStore(
    useShallow((s) => ({
      algorithms: s.algorithms,
      specs: s.algorithmSpecs,
      problems: s.problems,
      problem: s.problemConfig,
      snapshots: s.snapshotsByAlgorithm,
      names: s.algorithmNameById,
      running: s.isRunning,
      runId: s.runId,
      error: s.socketError,
      leaderboard: s.leaderboard,
      lab: s.currentLab,
      theme: s.theme,
    })),
  );
  const [view, setView] = useState<View>("pareto");
  const [mode, setMode] = useState<Mode>("explore");
  const [present, setPresent] = useState(false);
  const [inspector, setInspector] = useState(() => window.innerWidth > 1000);
  const [kind, setKind] = useState<"benchmark" | "scenario">("benchmark");
  const [seed, setSeed] = useState(42);
  const [algorithmId, setAlgorithmId] = useState("");
  const [selection, setSelection] = useState<Solution | null>(null);
  const [xAxis, setXAxis] = useState(0),
    [yAxis, setYAxis] = useState(1);
  const [runLabels, setRunLabels] = useState<string[] | null>(null);
  const [metric, setMetric] = useState("hv");
  const [error, setError] = useState<string | null>(null);
  const [online, setOnline] = useState(false);
  const [workflows, setWorkflows] = useState<WorkflowSpec[]>([]);
  const [schedule, setSchedule] = useState<ScheduleRow[]>([]);
  const [savedRuns, setSavedRuns] = useState<
    { run_id: string; status: string; kind: string; started_at: string }[]
  >([]);
  const [elapsed, setElapsed] = useState(0);
  const { startRun, stopRun } = useRunSocket();
  const scenario = useScenario();
  const loadedLab = useRef<string | null>(null);
  const campaign = useCampaign();
  const running = state.running || scenario.running || campaign.running;
  const runId =
    view === "statistics"
      ? campaign.runId
      : kind === "benchmark"
        ? state.runId
        : scenario.runId;
  const refreshAlgorithms = async () => {
    const response = await fetch(buildApiUrl("/api/algorithms"));
    if (!response.ok) throw Error("Moteur indisponible");
    useAppStore
      .getState()
      .setAlgorithmSpecs((await response.json()).algorithms);
  };
  useEffect(() => {
    let mounted = true;
    Promise.all([
      refreshAlgorithms(),
      fetch(buildApiUrl("/api/problems")).then((r) => r.json()),
      fetch(buildApiUrl("/api/workflows")).then((r) => r.json()),
    ])
      .then(([, problems, catalog]) => {
        if (!mounted) return;
        useAppStore.getState().setProblems(problems.problems);
        setWorkflows(catalog.workflows);
        setOnline(true);
      })
      .catch(() => {
        if (mounted)
          setError(
            "Le moteur local ne répond pas. Vérifiez son démarrage, puis rechargez la page.",
          );
      });
    return () => {
      mounted = false;
    };
  }, []);
  useEffect(() => {
    document.body.classList.toggle("theme-light", state.theme === "light");
  }, [state.theme]);
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPresent(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);
  useEffect(() => {
    if (!running) return;
    const start = Date.now();
    setElapsed(0);
    const timer = setInterval(
      () => setElapsed((Date.now() - start) / 1000),
      500,
    );
    return () => clearInterval(timer);
  }, [running]);
  useEffect(() => {
    if (!state.lab) return;
    if (loadedLab.current !== state.lab.id) {
      loadedLab.current = state.lab.id;
      if (state.lab.studio) {
        setSeed(state.lab.studio.seed);
        setKind(state.lab.studio.kind);
        scenario.setConfig(state.lab.studio.scenario);
        setSelection(null);
        return;
      }
    }
    const studio = { seed, kind, scenario: scenario.config };
    if (JSON.stringify(state.lab.studio) !== JSON.stringify(studio)) {
      useAppStore.setState({
        currentLab: {
          ...state.lab,
          studio,
          updated_at: new Date().toISOString(),
        },
      });
      return;
    }
    const timer = setTimeout(() => {
      void saveLab({
        ...state.lab!,
        problem: state.problem,
        algorithms: state.algorithms,
      }).catch(() =>
        setError("La sauvegarde locale a échoué. Exportez votre projet."),
      );
    }, 400);
    return () => clearTimeout(timer);
  }, [state.lab, state.problem, state.algorithms, kind, seed, scenario.config]);
  useEffect(() => {
    if (view !== "projects" && view !== "export") return;
    fetch(buildApiUrl("/api/runs"))
      .then((r) => r.json())
      .then((data) => setSavedRuns(data.runs ?? []))
      .catch(() => setSavedRuns([]));
  }, [view, running]);

  const algorithm =
    state.algorithms.find((a) => a.id === algorithmId) ??
    state.algorithms.find((a) => a.enabled) ??
    state.algorithms[0];
  const configuredLabels =
    kind === "scenario"
      ? ["Latence cumulée (s)", "Énergie (J)", "Coût (unité)"]
      : Array.from(
          { length: state.problem.n_obj ?? 2 },
          (_, i) => `Objectif ${i + 1}`,
        );
  const labels = runLabels ?? configuredLabels;
  const solutions = useMemo(
    () =>
      kind === "scenario"
        ? scenario.solutions
        : Object.entries(state.snapshots).flatMap(([id, history]) => {
            const snapshot = history[history.length - 1];
            if (!snapshot) return [];
            return snapshot.population.map((p, index) => ({
              id: `${state.runId}:${id}:${snapshot.generation}:${index}`,
              algorithm: state.names[id] ?? id,
              generation: snapshot.generation,
              x: p.x,
              f: p.f,
            }));
          }),
    [kind, scenario.solutions, state.snapshots, state.runId, state.names],
  );
  const selected = selection ?? solutions[0] ?? null;
  const maxGeneration = Math.max(
    0,
    ...Object.values(state.snapshots).map(
      (rows) => rows[rows.length - 1]?.generation ?? 0,
    ),
  );
  const targetGeneration = Math.max(
    1,
    ...state.algorithms
      .filter((a) => a.enabled)
      .map((a) => a.hyperparams.generations ?? 60),
  );
  const progress = campaign.running
    ? campaign.progress.completed / Math.max(1, campaign.progress.total)
    : kind === "scenario"
      ? scenario.progress.completed / Math.max(1, scenario.progress.total)
      : maxGeneration / targetGeneration;
  const series = useMemo(
    () =>
      Object.entries(state.snapshots).map(([id, rows]) => ({
        name: state.names[id] ?? id,
        values: rows
          .filter((row) => row.metrics[metric] != null)
          .map((row) => ({
            generation: row.generation,
            value: row.metrics[metric]!,
          })),
      })),
    [state.snapshots, state.names, metric],
  );
  useEffect(() => {
    setSchedule([]);
    if (kind !== "scenario" || !selected) return;
    const controller = new AbortController();
    scenario
      .decode(selected, controller.signal)
      .then(setSchedule)
      .catch((e) => {
        if (e.name !== "AbortError") setError(e.message);
      });
    return () => controller.abort();
  }, [selected?.id, kind]);

  const start = () => {
    setError(null);
    setSelection(null);
    setSchedule([]);
    const payload = buildRunPayload();
    if (!payload.algorithms.length) {
      setError("Sélectionnez au moins un algorithme.");
      setView("algorithms");
      return;
    }
    setRunLabels(configuredLabels);
    setView("arena");
    if (kind === "scenario")
      scenario.start(
        payload.algorithms.map((a) => a.name),
        seed,
      );
    else startRun({ ...payload, seed });
  };
  const stop = () => {
    stopRun();
    scenario.stop();
    campaign.stop();
  };
  const changeKind = (value: "benchmark" | "scenario") => {
    setKind(value);
    setRunLabels(null);
    setSelection(null);
    setXAxis(0);
    setYAxis(1);
  };
  const exportFile = async (format: string, id = runId) => {
    if (!id) return;
    try {
      const response = await fetch(
        buildApiUrl(
          format === "manifest"
            ? `/api/runs/${id}/manifest`
            : `/api/runs/${id}/export/${format}`,
        ),
      );
      if (!response.ok)
        throw Error("L’export n’est pas disponible pour cette exécution.");
      download(
        await response.blob(),
        `algoarena-${id}.${format === "latex" ? "tex" : ["manifest", "statistics"].includes(format) ? "json" : format}`,
      );
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const updateEnvironment = (
    name: string,
    key: keyof ScenarioEnvironment,
    value: number,
  ) =>
    scenario.setConfig((c) => ({
      ...c,
      environments: {
        ...c.environments,
        [name]: { ...c.environments[name], [key]: value },
      },
    }));
  const chartView = ["arena", "pareto", "metrics"].includes(view);
  const notice = error ?? scenario.error ?? state.error;

  return (
    <div
      className={`studio ${present ? "presentation" : ""} ${!inspector ? "inspector-hidden" : ""}`}
      data-mode={mode}
    >
      <header className="studio-header">
        <a
          className="studio-brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            setView("pareto");
          }}
        >
          <span className="brand-symbol">A</span>
          <strong>AlgoArena</strong>
        </a>
        <button
          className="project-switch"
          onClick={() => setView("projects")}
          title="Ouvrir ou sauvegarder un projet"
        >
          <span>Projet</span> {state.lab?.title ?? "Première expérience"}
          <span>⌄</span>
        </button>
        <div className="studio-modes" aria-label="Niveau de détail">
          {(
            [
              ["learn", "Apprendre"],
              ["explore", "Explorer"],
              ["research", "Recherche"],
            ] as [Mode, string][]
          ).map(([value, label]) => (
            <button
              key={value}
              aria-pressed={mode === value}
              onClick={() => {
                setMode(value);
                useAppStore
                  .getState()
                  .setUserProfile(
                    value === "research"
                      ? "researcher"
                      : value === "learn"
                        ? "student"
                        : "curious",
                  );
              }}
            >
              {label}
            </button>
          ))}
        </div>
        <button
          className="present-button"
          aria-pressed={present}
          onClick={() => {
            setPresent(!present);
            setView("pareto");
          }}
        >
          {present ? "Quitter · Échap" : "Présenter"}
        </button>
        <button
          className="run-button"
          onClick={start}
          disabled={running || !online}
        >
          <Icon name="play" /> Lancer
        </button>
        <div className="header-tools">
          <button
            title="Changer le thème"
            aria-label="Changer le thème"
            onClick={() => useAppStore.getState().toggleTheme()}
          >
            <Icon name="sun" />
          </button>
          <button
            title="Afficher ou masquer l’inspecteur"
            aria-label="Afficher ou masquer l’inspecteur"
            aria-pressed={inspector}
            onClick={() => setInspector(!inspector)}
          >
            <Icon name="panel" />
          </button>
        </div>
        <div className="connection">
          <i className={online ? "online" : "offline"} />
          <span>
            {running ? "Calcul en cours" : online ? "Prêt" : "Hors connexion"}
            <small>Local · Studio 3</small>
          </span>
        </div>
      </header>
      <nav className="studio-nav" aria-label="Navigation principale">
        {navigation.map((group) => (
          <div className="nav-group" key={group.group}>
            <h2>{group.group}</h2>
            {group.items.map(([id, label, icon]) => (
              <button
                key={id}
                aria-current={view === id ? "page" : undefined}
                onClick={() => setView(id)}
              >
                <Icon name={icon} />
                <span>{label}</span>
              </button>
            ))}
          </div>
        ))}
        <div className="nav-bottom">
          <button onClick={() => setView("help")}>
            ? <span>Comprendre</span>
          </button>
          <button onClick={() => setView("explore")}>
            ◌ <span>Bac à sable</span>
          </button>
          <p>
            Comprendre.
            <br />
            Expérimenter. Reproduire.
          </p>
        </div>
      </nav>
      <main className={`studio-main ${chartView ? "chart-view" : ""}`}>
        {notice && (
          <div role="alert" className="studio-alert">
            {notice}
            <button
              aria-label="Fermer le message"
              onClick={() => {
                setError(null);
                useAppStore.getState().setSocketError(null);
              }}
            >
              ×
            </button>
          </div>
        )}
        {mode === "learn" && (
          <div className="learn-hint">
            <strong>Votre expérience, en quatre étapes.</strong> Préparez un
            problème, lancez un algorithme, sélectionnez un compromis, puis
            conservez ses résultats. Changer de niveau ne modifie pas le calcul.
          </div>
        )}
        <ErrorBoundary title="Espace de travail">
          <Suspense
            fallback={<div className="studio-empty">Chargement de la vue…</div>}
          >
            {chartView && (
              <>
                <section className="studio-card main-plot">
                  <div className="card-heading">
                    <h1>
                      {view === "metrics"
                        ? "CONVERGENCE"
                        : view === "arena"
                          ? "ARENA · FRONT EN DIRECT"
                          : "FRONT DE PARETO"}
                    </h1>
                    <div className="axis-controls">
                      <label>
                        X{" "}
                        <select
                          aria-label="Objectif horizontal"
                          value={xAxis}
                          onChange={(e) => setXAxis(+e.target.value)}
                        >
                          {labels.map((label, i) => (
                            <option key={label} value={i}>
                              {label}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Y{" "}
                        <select
                          aria-label="Objectif vertical"
                          value={yAxis}
                          onChange={(e) => setYAxis(+e.target.value)}
                        >
                          {labels.map((label, i) => (
                            <option key={label} value={i}>
                              {label}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                  </div>
                  <div className="plot-legend">
                    <span>
                      <i />
                      Population
                    </span>
                    <span>
                      <i className="cyan" />
                      Non dominée · vue
                    </span>
                    <span>
                      {solutions.length} solutions
                      {solutions.length > 1000 ? " · vue échantillonnée" : ""} ·
                      minimisation
                    </span>
                  </div>
                  {view === "metrics" && kind === "benchmark" ? (
                    <Convergence series={series} label={metric} />
                  ) : (
                    <ParetoPlot
                      solutions={solutions}
                      selected={selected?.id ?? null}
                      onSelect={setSelection}
                      xAxis={Math.min(xAxis, labels.length - 1)}
                      yAxis={Math.min(yAxis, labels.length - 1)}
                      labels={labels}
                    />
                  )}
                </section>
                <div className="studio-bottom-grid">
                  <section className="studio-card convergence-card">
                    <div className="card-heading">
                      <h2>
                        {kind === "scenario"
                          ? "Placement · trace d’exécution"
                          : "Convergence"}
                      </h2>
                      {kind === "benchmark" && (
                        <select
                          aria-label="Métrique de convergence"
                          value={metric}
                          onChange={(e) => setMetric(e.target.value)}
                        >
                          <option value="hv">Hypervolume ↑</option>
                          <option value="igd">IGD ↓</option>
                          <option value="igd_plus">IGD+ ↓</option>
                          <option value="epsilon">Epsilon ↓</option>
                        </select>
                      )}
                    </div>
                    {kind === "scenario" ? (
                      schedule.length ? (
                        <Gantt rows={schedule} />
                      ) : (
                        <div className="small-empty">
                          Sélectionnez un point pour examiner son
                          ordonnancement.
                        </div>
                      )
                    ) : (
                      <Convergence series={series} label={metric} />
                    )}
                  </section>
                  <section className="studio-card selection-card">
                    <div className="card-heading">
                      <h2>Solution sélectionnée</h2>
                      <span className="pill">
                        {selected ? `G${selected.generation}` : "—"}
                      </span>
                    </div>
                    {selected ? (
                      <>
                        <div className="solution-metrics">
                          {selected.f.map((value, i) => (
                            <div key={i}>
                              <span>{labels[i] ?? `Objectif ${i + 1}`}</span>
                              <strong>{number(value)}</strong>
                            </div>
                          ))}
                        </div>
                        <div className="solution-provenance">
                          <span>{selected.algorithm}</span>
                          <small>
                            {selection
                              ? "Sélection conservée"
                              : "Première solution de la population"}
                          </small>
                        </div>
                      </>
                    ) : (
                      <div className="small-empty">
                        Les objectifs et la provenance apparaîtront ici.
                      </div>
                    )}
                  </section>
                </div>
              </>
            )}
            {(view === "scenario" || view === "objectives") && (
              <section className="studio-card form-card">
                <div className="card-heading">
                  <h1>
                    {view === "objectives"
                      ? "OBJECTIFS ET HYPOTHÈSES"
                      : "PRÉPARER L’EXPÉRIENCE"}
                  </h1>
                  <span className="pill">Configuration explicite</span>
                </div>
                <div className="choice-row">
                  <button
                    className={kind === "benchmark" ? "active" : ""}
                    disabled={running}
                    onClick={() => changeKind("benchmark")}
                  >
                    <Icon name="chart" />
                    <strong>Benchmark mathématique</strong>
                    <small>Comparer sur ZDT, DTLZ ou vos expressions</small>
                  </button>
                  <button
                    className={kind === "scenario" ? "active" : ""}
                    disabled={running}
                    onClick={() => changeKind("scenario")}
                  >
                    <Icon name="nodes" />
                    <strong>Simulation edge / fog / cloud</strong>
                    <small>
                      Placer les tâches d’un workflow et lire sa trace
                    </small>
                  </button>
                </div>
                {kind === "benchmark" ? (
                  <fieldset disabled={running} className="embedded-panel">
                    <ProblemPanel problems={state.problems} />
                  </fieldset>
                ) : (
                  <>
                    <p className="subtle">
                      Modèle non préemptif : dépendances conservées, une liaison
                      entrante partagée par tier, vitesse par appareil. Latence
                      cumulée en secondes, énergie en joules, coût par MI.
                    </p>
                    <div className="environment-grid">
                      {Object.entries(scenario.config.environments).map(
                        ([name, env]) => (
                          <fieldset
                            disabled={running}
                            className="environment-card"
                            key={name}
                          >
                            <legend>
                              <Icon name="hex" /> {name}
                            </legend>
                            {(
                              [
                                ["devices", "Appareils"],
                                [
                                  "processing_rate",
                                  "Vitesse / appareil (MIPS)",
                                ],
                                ["processing_cost", "Coût / MI"],
                                ["idle_power", "Puissance au repos (W)"],
                                ["working_power", "Puissance en calcul (W)"],
                                ["uplink_bandwidth", "Liaison entrante (Mbps)"],
                                [
                                  "downlink_bandwidth",
                                  "Liaison sortante (Mbps)",
                                ],
                              ] as [keyof ScenarioEnvironment, string][]
                            ).map(([key, label]) => (
                              <label key={key}>
                                {label}
                                <input
                                  type="number"
                                  min={key === "devices" ? 1 : 0}
                                  step={key === "devices" ? 1 : "any"}
                                  value={env[key]}
                                  onChange={(e) =>
                                    updateEnvironment(
                                      name,
                                      key,
                                      +e.target.value,
                                    )
                                  }
                                />
                              </label>
                            ))}
                          </fieldset>
                        ),
                      )}
                    </div>
                  </>
                )}
              </section>
            )}
            {view === "workflow" && (
              <section className="studio-card form-card">
                <h1>WORKFLOW ET DÉPENDANCES</h1>
                <p className="subtle">
                  Le moteur attend la fin des parents et les transferts avant de
                  démarrer une tâche.
                </p>
                <label className="field">
                  Source
                  <select
                    disabled={running}
                    value={scenario.config.workflowId}
                    onChange={(e) => {
                      changeKind("scenario");
                      scenario.setConfig((c) => ({
                        ...c,
                        workflowId: e.target.value,
                      }));
                    }}
                  >
                    <option value="">Exercice synthétique déterministe</option>
                    {workflows.map((w) => (
                      <option key={w.workflow_id} value={w.workflow_id}>
                        {w.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  Nombre de tâches / limite
                  <input
                    disabled={running}
                    type="number"
                    min="2"
                    max="1000"
                    value={scenario.config.taskCount}
                    onChange={(e) =>
                      scenario.setConfig((c) => ({
                        ...c,
                        taskCount: +e.target.value,
                      }))
                    }
                  />
                </label>
                <p className="info-box">
                  DAX : runtime converti avec une machine de référence à 1 000
                  MIPS. Volumes agrégés par tâche ; la simulation ne modélise
                  pas les paquets réseau.
                </p>
                <button
                  className="primary"
                  disabled={running}
                  onClick={() => {
                    changeKind("scenario");
                    setView("scenario");
                  }}
                >
                  Configurer les ressources
                </button>
                {schedule.length > 0 && <Gantt rows={schedule} />}
              </section>
            )}
            {view === "algorithms" && (
              <section className="studio-card form-card">
                <h1>BIBLIOTHÈQUE D’ALGORITHMES</h1>
                <p className="subtle">
                  Activez les concurrents. Les modifications s’appliquent à la
                  prochaine exécution.
                </p>
                <div className="algorithm-list">
                  {state.algorithms.map((a) => (
                    <div
                      key={a.id}
                      className={a.id === algorithm?.id ? "chosen" : ""}
                    >
                      <label>
                        <input
                          type="checkbox"
                          disabled={running}
                          checked={a.enabled}
                          onChange={() =>
                            useAppStore.getState().toggleAlgorithm(a.id)
                          }
                        />
                        {a.label ?? a.name}
                      </label>
                      <button
                        onClick={() => {
                          setAlgorithmId(a.id);
                          setInspector(true);
                        }}
                      >
                        Paramètres →
                      </button>
                    </div>
                  ))}
                </div>
                {mode === "research" && (
                  <details>
                    <summary>Extensions et paramètres avancés</summary>
                    <fieldset disabled={running}>
                      <AlgorithmPanel
                        specs={state.specs}
                        refreshAlgorithms={refreshAlgorithms}
                      />
                    </fieldset>
                  </details>
                )}
              </section>
            )}
            {view === "compare" && (
              <section className="studio-card form-card">
                <h1>COMPARER LES RÉSULTATS</h1>
                <p className="subtle">
                  Benchmark : tri HV puis IGD. Les valeurs sont propres au
                  problème et au budget ; aucun algorithme n’est un gagnant
                  universel.
                </p>
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Algorithme</th>
                        <th>Génération</th>
                        <th>HV ↑</th>
                        <th>IGD ↓</th>
                        <th>Temps (s)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {state.leaderboard.map((row) => (
                        <tr key={row.algorithm_id}>
                          <td>{row.algorithm_name}</td>
                          <td>{row.generation}</td>
                          <td>{number(row.hv)}</td>
                          <td>{number(row.igd)}</td>
                          <td>{number(row.elapsed_sec)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {!state.leaderboard.length && (
                  <p className="small-empty">
                    Lancez un benchmark pour remplir ce tableau.
                  </p>
                )}
              </section>
            )}
            {view === "statistics" && (
              <CampaignPanel campaign={campaign} disabled={running} />
            )}
            {view === "projects" && (
              <section className="studio-card form-card">
                <h1>PROJETS LOCAUX</h1>
                <fieldset disabled={running}>
                  <Labs />
                </fieldset>
                <h2>Journal du moteur</h2>
                <p className="subtle">
                  Les manifestes et événements restent disponibles après
                  redémarrage.
                </p>
                <div className="run-history">
                  {savedRuns.map((run) => (
                    <div key={run.run_id}>
                      <span>
                        {run.kind} ·{" "}
                        {new Date(run.started_at).toLocaleString("fr")}
                      </span>
                      <span className="pill">{run.status}</span>
                      <button
                        onClick={() => void exportFile("manifest", run.run_id)}
                      >
                        Manifeste
                      </button>
                      {run.kind === "campaign" && (
                        <button
                          disabled={running}
                          onClick={() => {
                            setView("statistics");
                            void campaign.resume(run.run_id);
                          }}
                        >
                          Reprendre
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}
            {view === "export" && (
              <section className="studio-card form-card">
                <h1>EXPORTER ET REPRODUIRE</h1>
                <p className="subtle">
                  Conservez la configuration, les versions et les résultats de
                  votre expérience.
                </p>
                <div className="export-grid">
                  {["manifest", "csv", "pdf", "latex", "statistics"].map(
                    (format) => (
                      <button
                        key={format}
                        disabled={
                          !runId ||
                          running ||
                          (kind === "scenario" && format !== "manifest")
                        }
                        onClick={() => void exportFile(format)}
                      >
                        <Icon name="export" />
                        <strong>
                          {
                            {
                              manifest: "Manifeste reproductible",
                              csv: "Tableau CSV",
                              pdf: "Rapport PDF",
                              latex: "Tableau LaTeX",
                              statistics: "Statistiques descriptives",
                            }[format]
                          }
                        </strong>
                        <small>
                          {format === "manifest"
                            ? "Graines, paramètres, versions et empreinte"
                            : "Résultats du benchmark courant"}
                        </small>
                      </button>
                    ),
                  )}
                </div>
                {scenario.result && (
                  <button
                    onClick={() =>
                      download(scenario.result, "scenario-results.json")
                    }
                  >
                    Résultats et placements du scénario · JSON
                  </button>
                )}
                <p className="info-box">
                  Les exports synthétiques du benchmark conservent les 200
                  derniers instantanés. Le journal paginé du moteur conserve les
                  événements complets.
                </p>
              </section>
            )}
            {view === "help" && (
              <section className="studio-card form-card">
                <Tutorial />
              </section>
            )}
            {view === "explore" && (
              <section className="studio-card form-card">
                <Explore />
              </section>
            )}
          </Suspense>
        </ErrorBoundary>
      </main>
      <aside className="studio-inspector" aria-label="Inspecteur">
        <div className="inspector-heading">
          <h2>Inspecteur</h2>
          <button
            title="Masquer"
            aria-label="Masquer l’inspecteur"
            onClick={() => setInspector(false)}
          >
            ↗
          </button>
        </div>
        <section className="studio-card inspector-config">
          <div className="algorithm-title">
            <span className="algorithm-icon">
              <Icon name="nodes" />
            </span>
            <div>
              <strong>
                {algorithm?.label ?? algorithm?.name ?? "Algorithme"}
              </strong>
              <small>
                {kind === "scenario"
                  ? "Ordonnancement multi-objectif"
                  : "Optimisation multi-objectif"}
              </small>
            </div>
          </div>
          <fieldset disabled={running}>
            {kind === "benchmark" ? (
              <>
                <label>
                  Algorithme
                  <select
                    aria-label="Algorithme inspecté"
                    value={algorithm?.id ?? ""}
                    onChange={(e) => setAlgorithmId(e.target.value)}
                  >
                    {state.algorithms.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.label ?? a.name}
                      </option>
                    ))}
                  </select>
                </label>
                {algorithm &&
                  [
                    "population_size",
                    "generations",
                    "mutation_rate",
                    "crossover_rate",
                  ]
                    .filter((key) => key in algorithm.hyperparams)
                    .map((key) => (
                      <label key={key}>
                        {
                          {
                            population_size: "Population",
                            generations: "Générations",
                            mutation_rate: "Mutation",
                            crossover_rate: "Croisement",
                          }[key]
                        }
                        <input
                          aria-label={key}
                          type="number"
                          step={key.endsWith("rate") ? 0.01 : 1}
                          min={key.endsWith("rate") ? 0 : 1}
                          max={key.endsWith("rate") ? 1 : 10000}
                          value={algorithm.hyperparams[key]}
                          onChange={(e) =>
                            useAppStore
                              .getState()
                              .updateHyperparam(
                                algorithm.id,
                                key,
                                +e.target.value,
                              )
                          }
                        />
                      </label>
                    ))}
              </>
            ) : (
              <>
                {(
                  [
                    ["population", "Population"],
                    ["generations", "Générations"],
                    ["repetitions", "Répétitions"],
                  ] as const
                ).map(([key, label]) => (
                  <label key={key}>
                    {label}
                    <input
                      type="number"
                      min="1"
                      max={key === "repetitions" ? 30 : 1000}
                      value={scenario.config[key]}
                      onChange={(e) =>
                        scenario.setConfig((c) => ({
                          ...c,
                          [key]: +e.target.value,
                        }))
                      }
                    />
                  </label>
                ))}
              </>
            )}
            <label>
              Graine
              <input
                aria-label="Graine"
                type="number"
                min="0"
                step="1"
                value={seed}
                onChange={(e) => setSeed(+e.target.value)}
              />
            </label>
          </fieldset>
          <details>
            <summary>Protocole</summary>
            <p>
              Budget et graine sont fixés avant le lancement. Changer de vue
              n’altère pas l’expérience.
            </p>
            <span className="pill">
              {kind === "benchmark"
                ? (state.problem.name ?? state.problem.kind)
                : "DAG · listes déterministes"}
            </span>
          </details>
        </section>
        <section className="studio-card inspector-objectives">
          <div className="card-heading">
            <h2>Objectifs</h2>
            <button onClick={() => setView("objectives")}>Configurer</button>
          </div>
          {labels.map((label) => (
            <div className="objective-row" key={label}>
              <span>{label}</span>
              <span>↓</span>
              <small>Minimiser</small>
            </div>
          ))}
        </section>
        {mode === "research" && selected && (
          <section className="studio-card decision-card">
            <h2>Vecteur de décision</h2>
            <code>{selected.x.map(number).join(" · ")}</code>
            <small>{selected.id}</small>
          </section>
        )}
        {mode === "learn" && (
          <div className="learn-hint">
            <strong>Qu’est-ce que Pareto ?</strong>
            <p>
              Une solution est non dominée lorsqu’aucune autre n’améliore un
              objectif sans en dégrader un autre.
            </p>
          </div>
        )}
      </aside>
      <footer className="studio-status">
        <div className={`status-orbit ${running ? "spinning" : ""}`}>◔</div>
        <div className="status-label">
          <strong>
            {running
              ? "Simulation en cours…"
              : solutions.length
                ? "Résultats disponibles"
                : "Prêt à expérimenter"}
          </strong>
          <small>
            {running
              ? "Calcul local · processus isolé"
              : "Sélectionnez un compromis pour l’examiner"}
          </small>
        </div>
        <progress
          aria-label="Progression"
          max="1"
          value={Math.min(1, progress)}
        />
        <span className="progress-text">
          {campaign.running
            ? `Campagne ${campaign.progress.completed} / ${campaign.progress.total}`
            : kind === "benchmark"
              ? `Génération ${maxGeneration} / ${targetGeneration}`
              : `Répétitions ${scenario.progress.completed} / ${scenario.progress.total}`}
        </span>
        <span className="elapsed">◷ {number(elapsed)} s</span>
        <span className="status-detail">
          {state.algorithms.filter((a) => a.enabled).length} algorithme(s)
        </span>
        <button disabled={!running} onClick={stop}>
          ■ Arrêter
        </button>
      </footer>
    </div>
  );
}
