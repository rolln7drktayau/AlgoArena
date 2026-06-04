import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlgorithmConfigPanel } from "./components/AlgorithmConfigPanel";
import { AlgorithmComparisonGrid } from "./components/AlgorithmComparisonGrid";
import { CommonResearchPanel } from "./components/CommonResearchPanel";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { Leaderboard } from "./components/Leaderboard";
import { LabsPanel } from "./components/LabsPanel";
import { MetricPins } from "./components/MetricPins";
import { ProblemConfigPanel } from "./components/ProblemConfigPanel";
import { ProfileSetup } from "./components/ProfileSetup";
import { RadarSummary } from "./components/RadarSummary";
import { ReplayControls } from "./components/ReplayControls";
import { ScenarioTab } from "./components/ScenarioTab";
import { TutorialTab } from "./components/TutorialTab";
import { V2ExploreTab } from "./components/V2ExploreTab";
import { useRunSocket } from "./hooks/useRunSocket";
import { buildApiUrl } from "./lib/api";
import { buildRunPayload, useAppStore } from "./store/useAppStore";
import type { DesktopStartupInfo } from "./types/desktopBridge";
import type { AlgorithmSpec, ProblemSpec } from "./types";
import { useShallow } from "zustand/react/shallow";

type UiLanguage = "fr" | "en";

const uiText: Record<
  UiLanguage,
  {
    subtitle: string;
    themeLight: string;
    themeDark: string;
    tabBenchmark: string;
    tabScenario: string;
    tabExplore: string;
    tabTutorial: string;
    errorNoAlgo: string;
    scenarioTitle: string;
    tutorialTitle: string;
    problemDefTitle: string;
    algoLibTitle: string;
    restartRun: string;
    startRun: string;
    stop: string;
    exportCsv: string;
    exportPdf: string;
    exportLatex: string;
    exportBibtex: string;
    exportStats: string;
    errorPrefix: string;
    leaderboardTitle: string;
    radarTitle: string;
    competitionGridTitle: string;
    researchChartsTitle: string;
    languageFr: string;
    languageEn: string;
  }
> = {
  fr: {
    subtitle: "Benchmarking temps reel pour algorithmes d'optimisation multi-objectifs",
    themeLight: "Theme clair",
    themeDark: "Theme sombre",
    tabBenchmark: "Benchmark",
    tabScenario: "Scenario Simulator",
    tabExplore: "Exploration V2",
    tabTutorial: "Tutoriel",
    errorNoAlgo: "Active au moins un algorithme avant de lancer.",
    scenarioTitle: "Scenario Simulator",
    tutorialTitle: "Tutoriel",
    problemDefTitle: "Definition du probleme",
    algoLibTitle: "Bibliotheque d'algorithmes",
    restartRun: "Relancer la competition",
    startRun: "Lancer la competition",
    stop: "Stop",
    exportCsv: "Exporter CSV",
    exportPdf: "Exporter PDF",
    exportLatex: "Exporter LaTeX",
    exportBibtex: "BibTeX",
    exportStats: "Stats JSON",
    errorPrefix: "Erreur",
    leaderboardTitle: "Classement",
    radarTitle: "Comparaison Radar",
    competitionGridTitle: "Grille de competition",
    researchChartsTitle: "Graphiques de recherche",
    languageFr: "Francais",
    languageEn: "English"
  },
  en: {
    subtitle: "Real-time benchmarking for multi-objective optimization algorithms",
    themeLight: "Light Theme",
    themeDark: "Dark Theme",
    tabBenchmark: "Benchmark",
    tabScenario: "Scenario Simulator",
    tabExplore: "V2 Explore",
    tabTutorial: "Tutorial",
    errorNoAlgo: "Enable at least one algorithm before starting.",
    scenarioTitle: "Scenario Simulator",
    tutorialTitle: "Tutorial",
    problemDefTitle: "Problem Definition",
    algoLibTitle: "Algorithm Library",
    restartRun: "Restart Competition",
    startRun: "Start Competition",
    stop: "Stop",
    exportCsv: "Export CSV",
    exportPdf: "Export PDF",
    exportLatex: "Export LaTeX",
    exportBibtex: "BibTeX",
    exportStats: "Stats JSON",
    errorPrefix: "Error",
    leaderboardTitle: "Leaderboard",
    radarTitle: "Radar Comparison",
    competitionGridTitle: "Competition Grid",
    researchChartsTitle: "Common Research Charts",
    languageFr: "Francais",
    languageEn: "English"
  }
};

const extractFilename = (contentDisposition: string | null, fallback: string): string => {
  if (!contentDisposition) {
    return fallback;
  }
  const utf8Match = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match?.[1]) {
    try {
      return decodeURIComponent(utf8Match[1].trim());
    } catch (_) {
      return utf8Match[1].trim();
    }
  }
  const plainMatch = contentDisposition.match(/filename="?([^\";]+)"?/i);
  if (plainMatch?.[1]) {
    return plainMatch[1].trim();
  }
  return fallback;
};

const triggerBlobDownload = (fileName: string, blob: Blob): void => {
  const blobUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = blobUrl;
  anchor.download = fileName;
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
};

const exportRun = async (runId: string, kind: "csv" | "pdf" | "latex" | "statistics"): Promise<void> => {
  const url = buildApiUrl(`/api/runs/${runId}/export/${kind}`);
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Export failed with status ${response.status}`);
    }
    const fallbackName = `run-${runId}.${kind === "latex" ? "tex" : kind === "statistics" ? "json" : kind}`;
    const fileName = extractFilename(response.headers.get("content-disposition"), fallbackName);
    const blob = await response.blob();
    triggerBlobDownload(fileName, blob);
  } catch (error) {
    console.error("Unable to export run.", error);
    useAppStore.getState().setSocketError("Export failed. Please retry once the run is completed.");
  }
};

const exportBibtex = async (): Promise<void> => {
  try {
    const response = await fetch(buildApiUrl("/api/exports/bibtex"));
    if (!response.ok) {
      throw new Error(`Export failed with status ${response.status}`);
    }
    const fileName = extractFilename(response.headers.get("content-disposition"), "algoarena.bib");
    const blob = await response.blob();
    triggerBlobDownload(fileName, blob);
  } catch (error) {
    console.error("Unable to export BibTeX.", error);
    useAppStore.getState().setSocketError("BibTeX export failed.");
  }
};

export default function App() {
  const [startupInfo, setStartupInfo] = useState<DesktopStartupInfo | null>(null);
  const {
    tab,
    setTab,
    algorithmSpecs,
    setAlgorithmSpecs,
    problems,
    setProblems,
    problemConfig,
    isRunning,
    runId,
    leaderboard,
    runSummary,
    socketError,
    configRevision,
    snapshotsByAlgorithm,
    algorithmNameById,
    theme,
    toggleTheme,
    language,
    setLanguage
  } = useAppStore(
    useShallow((state) => ({
      tab: state.tab,
      setTab: state.setTab,
      algorithmSpecs: state.algorithmSpecs,
      setAlgorithmSpecs: state.setAlgorithmSpecs,
      problems: state.problems,
      setProblems: state.setProblems,
      problemConfig: state.problemConfig,
      isRunning: state.isRunning,
      runId: state.runId,
      leaderboard: state.leaderboard,
      runSummary: state.runSummary,
      socketError: state.socketError,
      configRevision: state.configRevision,
      snapshotsByAlgorithm: state.snapshotsByAlgorithm,
      algorithmNameById: state.algorithmNameById,
      theme: state.theme,
      toggleTheme: state.toggleTheme,
      language: state.language,
      setLanguage: state.setLanguage
    }))
  );

  const t = uiText[language];

  const { startRun, stopRun } = useRunSocket();
  const revisionRef = useRef(configRevision);

  const refreshAlgorithms = useCallback(async () => {
    const response = await fetch(buildApiUrl("/api/algorithms"));
    const data = (await response.json()) as { algorithms: AlgorithmSpec[] };
    setAlgorithmSpecs(data.algorithms);
  }, [setAlgorithmSpecs]);

  const refreshProblems = useCallback(async () => {
    const response = await fetch(buildApiUrl("/api/problems"));
    const data = (await response.json()) as { problems: ProblemSpec[] };
    setProblems(data.problems);
  }, [setProblems]);

  useEffect(() => {
    void refreshAlgorithms();
    void refreshProblems();
  }, [refreshAlgorithms, refreshProblems]);

  const beginRun = useCallback(() => {
    const payload = buildRunPayload();
    if (!payload.algorithms.length) {
      useAppStore.getState().setSocketError(t.errorNoAlgo);
      return;
    }
    startRun(payload);
  }, [startRun, t.errorNoAlgo]);

  useEffect(() => {
    if (!isRunning) {
      revisionRef.current = configRevision;
      return;
    }
    if (revisionRef.current === configRevision) {
      return;
    }
    revisionRef.current = configRevision;
    const timer = window.setTimeout(() => {
      beginRun();
    }, 250);
    return () => window.clearTimeout(timer);
  }, [beginRun, configRevision, isRunning]);

  useEffect(() => {
    document.body.classList.toggle("theme-light", theme === "light");
  }, [theme]);

  useEffect(() => {
    const onStartupInfo = window.algoarenaDesktop?.onStartupInfo;
    if (!onStartupInfo) {
      return;
    }
    const unsubscribe = onStartupInfo((payload) => {
      setStartupInfo(payload);
    });
    return () => {
      if (typeof unsubscribe === "function") {
        unsubscribe();
      }
    };
  }, []);

  const replayMax = useMemo(() => {
    let maxGeneration = 0;
    Object.values(snapshotsByAlgorithm).forEach((rows) => {
      const last = rows[rows.length - 1];
      if (last && last.generation > maxGeneration) {
        maxGeneration = last.generation;
      }
    });
    return maxGeneration;
  }, [snapshotsByAlgorithm]);

  return (
    <div className="min-h-screen bg-panel text-ice">
      <ProfileSetup />
      {startupInfo && (
        <div className="pointer-events-none fixed right-4 top-4 z-[60] w-full max-w-md md:right-6 md:top-6">
          <div className="pointer-events-auto rounded-xl border border-stroke bg-card/95 p-4 shadow-glow backdrop-blur">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent/20 text-accent">
                i
              </div>
              <div className="flex-1 space-y-1">
                <p className="text-base font-semibold text-ice">{startupInfo.message}</p>
                <p className="text-xs text-slate">Local app URL: {startupInfo.localUrl}</p>
                <p className="text-xs text-slate">API docs URL: {startupInfo.docsUrl}</p>
                {startupInfo.note && <p className="pt-1 text-xs text-slate">{startupInfo.note}</p>}
              </div>
              <button
                type="button"
                aria-label="Close startup message"
                onClick={() => setStartupInfo(null)}
                className="rounded-md border border-stroke px-2 py-0.5 text-xs text-slate hover:bg-panel"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}
      <div className="relative overflow-hidden">
        <div className="pointer-events-none absolute -left-44 top-[-8rem] h-80 w-80 rounded-full bg-accent/20 blur-3xl" />
        <div className="pointer-events-none absolute right-[-9rem] top-20 h-72 w-72 rounded-full bg-ember/20 blur-3xl" />

        <header className="mx-auto flex w-full max-w-[1500px] flex-wrap items-center justify-between gap-4 px-4 py-5 md:px-6">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="AlgoArena logo" className="h-10 w-10 rounded-lg object-cover ring-1 ring-stroke" />
            <div>
              <h1 className="font-display text-2xl tracking-tight">AlgoArena</h1>
              <p className="text-xs text-slate">{t.subtitle}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-stroke bg-card/60 p-1 text-xs">
            <select
              value={language}
              onChange={(event) => setLanguage(event.target.value as UiLanguage)}
              className="rounded-lg border border-stroke bg-card px-2 py-2 text-slate"
            >
              <option value="fr">{t.languageFr}</option>
              <option value="en">{t.languageEn}</option>
            </select>
            <button
              type="button"
              onClick={toggleTheme}
              className="rounded-lg border border-stroke px-3 py-2 text-slate"
            >
              {theme === "dark" ? t.themeLight : t.themeDark}
            </button>
            <button
              type="button"
              onClick={() => setTab("benchmark")}
              className={`rounded-lg px-3 py-2 ${tab === "benchmark" ? "bg-accent text-ink" : "text-slate"}`}
            >
              {t.tabBenchmark}
            </button>
            <button
              type="button"
              onClick={() => setTab("scenario")}
              className={`rounded-lg px-3 py-2 ${tab === "scenario" ? "bg-accent text-ink" : "text-slate"}`}
            >
              {t.tabScenario}
            </button>
            <button
              type="button"
              onClick={() => setTab("explore")}
              className={`rounded-lg px-3 py-2 ${tab === "explore" ? "bg-accent text-ink" : "text-slate"}`}
            >
              {t.tabExplore}
            </button>
            <button
              type="button"
              onClick={() => setTab("tutorial")}
              className={`rounded-lg px-3 py-2 ${tab === "tutorial" ? "bg-accent text-ink" : "text-slate"}`}
            >
              {t.tabTutorial}
            </button>
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1500px] space-y-4 px-4 pb-8 md:px-6">
          {tab === "scenario" && (
            <ErrorBoundary title={t.scenarioTitle}>
              <ScenarioTab />
            </ErrorBoundary>
          )}

          {tab === "tutorial" && (
            <ErrorBoundary title={t.tutorialTitle}>
              <TutorialTab />
            </ErrorBoundary>
          )}

          {tab === "explore" && (
            <ErrorBoundary title={t.tabExplore}>
              <V2ExploreTab />
            </ErrorBoundary>
          )}

          {tab === "benchmark" && (
            <>
              <LabsPanel />
              <section className="grid gap-4 xl:grid-cols-[1.1fr_1.2fr]">
                <div className="space-y-4">
                  <ErrorBoundary title={t.problemDefTitle}>
                    <ProblemConfigPanel problems={problems} />
                  </ErrorBoundary>
                  <ErrorBoundary title={t.algoLibTitle}>
                    <AlgorithmConfigPanel specs={algorithmSpecs} refreshAlgorithms={refreshAlgorithms} />
                  </ErrorBoundary>
                </div>

                <div className="space-y-4">
                  <section className="rounded-2xl border border-stroke bg-card/70 p-4 shadow-glow">
                    <div className="flex flex-wrap items-center gap-3">
                      <button
                        type="button"
                        onClick={beginRun}
                        className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-ink"
                      >
                        {isRunning ? t.restartRun : t.startRun}
                      </button>
                      <button
                        type="button"
                        onClick={stopRun}
                        className="rounded-md border border-stroke px-4 py-2 text-sm text-slate"
                      >
                        {t.stop}
                      </button>
                      <button
                        type="button"
                        disabled={!runId}
                        onClick={() => {
                          if (runId) {
                            void exportRun(runId, "csv");
                          }
                        }}
                        className="rounded-md border border-stroke px-4 py-2 text-sm text-slate disabled:opacity-40"
                      >
                        {t.exportCsv}
                      </button>
                      <button
                        type="button"
                        disabled={!runId}
                        onClick={() => {
                          if (runId) {
                            void exportRun(runId, "pdf");
                          }
                        }}
                        className="rounded-md border border-stroke px-4 py-2 text-sm text-slate disabled:opacity-40"
                      >
                        {t.exportPdf}
                      </button>
                      <button
                        type="button"
                        disabled={!runId}
                        onClick={() => {
                          if (runId) {
                            void exportRun(runId, "latex");
                          }
                        }}
                        className="rounded-md border border-stroke px-4 py-2 text-sm text-slate disabled:opacity-40"
                      >
                        {t.exportLatex}
                      </button>
                      <button
                        type="button"
                        onClick={() => void exportBibtex()}
                        className="rounded-md border border-stroke px-4 py-2 text-sm text-slate"
                      >
                        {t.exportBibtex}
                      </button>
                      <button
                        type="button"
                        disabled={!runId}
                        onClick={() => {
                          if (runId) {
                            void exportRun(runId, "statistics");
                          }
                        }}
                        className="rounded-md border border-stroke px-4 py-2 text-sm text-slate disabled:opacity-40"
                      >
                        {t.exportStats}
                      </button>
                    </div>
                    {socketError && <p className="mt-3 text-xs text-rose-300">{t.errorPrefix}: {socketError}</p>}
                  </section>

                  <MetricPins />
                  <ReplayControls maxGeneration={replayMax} />
                  <ErrorBoundary title={t.leaderboardTitle}>
                    <Leaderboard entries={leaderboard} />
                  </ErrorBoundary>
                  <ErrorBoundary title={t.radarTitle}>
                    <RadarSummary summary={runSummary} leaderboard={leaderboard} isRunning={isRunning} />
                  </ErrorBoundary>
                </div>
              </section>

              <ErrorBoundary title={t.competitionGridTitle}>
                <AlgorithmComparisonGrid objectiveCount={problemConfig.n_obj ?? 4} />
              </ErrorBoundary>
              <ErrorBoundary title={t.researchChartsTitle}>
                <CommonResearchPanel
                  objectiveCount={problemConfig.n_obj ?? 4}
                  snapshotsByAlgorithm={snapshotsByAlgorithm}
                  algorithmNameById={algorithmNameById}
                />
              </ErrorBoundary>
            </>
          )}
        </main>

        <footer className="mx-auto w-full max-w-[1500px] px-4 pb-8 text-right text-xs text-slate md:px-6">
          Authors: AST & RCT
        </footer>
      </div>
    </div>
  );
}
