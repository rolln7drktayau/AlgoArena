import { useCallback, useEffect, useMemo, useRef } from "react";
import { AlgorithmConfigPanel } from "./components/AlgorithmConfigPanel";
import { AlgorithmComparisonGrid } from "./components/AlgorithmComparisonGrid";
import { CommonResearchPanel } from "./components/CommonResearchPanel";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { Leaderboard } from "./components/Leaderboard";
import { MetricPins } from "./components/MetricPins";
import { ProblemConfigPanel } from "./components/ProblemConfigPanel";
import { RadarSummary } from "./components/RadarSummary";
import { ReplayControls } from "./components/ReplayControls";
import { ScenarioTab } from "./components/ScenarioTab";
import { useRunSocket } from "./hooks/useRunSocket";
import { buildApiUrl } from "./lib/api";
import { buildRunPayload, useAppStore } from "./store/useAppStore";
import type { AlgorithmSpec, ProblemSpec } from "./types";
import { useShallow } from "zustand/react/shallow";

const exportRun = (runId: string, kind: "csv" | "pdf") => {
  const url = buildApiUrl(`/api/runs/${runId}/export/${kind}`);
  window.open(url, "_blank", "noopener,noreferrer");
};

export default function App() {
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
    toggleTheme
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
      toggleTheme: state.toggleTheme
    }))
  );

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
      useAppStore.getState().setSocketError("Enable at least one algorithm before starting.");
      return;
    }
    startRun(payload);
  }, [startRun]);

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
      <div className="relative overflow-hidden">
        <div className="pointer-events-none absolute -left-44 top-[-8rem] h-80 w-80 rounded-full bg-accent/20 blur-3xl" />
        <div className="pointer-events-none absolute right-[-9rem] top-20 h-72 w-72 rounded-full bg-ember/20 blur-3xl" />

        <header className="mx-auto flex w-full max-w-[1500px] flex-wrap items-center justify-between gap-4 px-4 py-5 md:px-6">
          <div>
            <h1 className="font-display text-2xl tracking-tight">AlgoArena</h1>
            <p className="text-xs text-slate">Real-time benchmarking for multi-objective optimization algorithms</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-stroke bg-card/60 p-1 text-xs">
            <button
              type="button"
              onClick={toggleTheme}
              className="rounded-lg border border-stroke px-3 py-2 text-slate"
            >
              {theme === "dark" ? "Light Theme" : "Dark Theme"}
            </button>
            <button
              type="button"
              onClick={() => setTab("benchmark")}
              className={`rounded-lg px-3 py-2 ${tab === "benchmark" ? "bg-accent text-ink" : "text-slate"}`}
            >
              Benchmark
            </button>
            <button
              type="button"
              onClick={() => setTab("scenario")}
              className={`rounded-lg px-3 py-2 ${tab === "scenario" ? "bg-accent text-ink" : "text-slate"}`}
            >
              Scenario Simulator
            </button>
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1500px] space-y-4 px-4 pb-8 md:px-6">
          {tab === "scenario" && (
            <ErrorBoundary title="Scenario Simulator">
              <ScenarioTab />
            </ErrorBoundary>
          )}

          {tab === "benchmark" && (
            <>
              <section className="grid gap-4 xl:grid-cols-[1.1fr_1.2fr]">
                <div className="space-y-4">
                  <ErrorBoundary title="Problem Definition">
                    <ProblemConfigPanel problems={problems} />
                  </ErrorBoundary>
                  <ErrorBoundary title="Algorithm Library">
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
                        {isRunning ? "Restart Run" : "Start Competition"}
                      </button>
                      <button
                        type="button"
                        onClick={stopRun}
                        className="rounded-md border border-stroke px-4 py-2 text-sm text-slate"
                      >
                        Stop
                      </button>
                      <button
                        type="button"
                        disabled={!runId}
                        onClick={() => runId && exportRun(runId, "csv")}
                        className="rounded-md border border-stroke px-4 py-2 text-sm text-slate disabled:opacity-40"
                      >
                        Export CSV
                      </button>
                      <button
                        type="button"
                        disabled={!runId}
                        onClick={() => runId && exportRun(runId, "pdf")}
                        className="rounded-md border border-stroke px-4 py-2 text-sm text-slate disabled:opacity-40"
                      >
                        Export PDF
                      </button>
                    </div>
                    {socketError && <p className="mt-3 text-xs text-rose-300">Error: {socketError}</p>}
                  </section>

                  <MetricPins />
                  <ReplayControls maxGeneration={replayMax} />
                  <ErrorBoundary title="Leaderboard">
                    <Leaderboard entries={leaderboard} />
                  </ErrorBoundary>
                  <ErrorBoundary title="Radar Comparison">
                    <RadarSummary summary={runSummary} />
                  </ErrorBoundary>
                </div>
              </section>

              <ErrorBoundary title="Competition Grid">
                <AlgorithmComparisonGrid objectiveCount={problemConfig.n_obj ?? 2} />
              </ErrorBoundary>
              <ErrorBoundary title="Common Research Charts">
                <CommonResearchPanel
                  objectiveCount={problemConfig.n_obj ?? 2}
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
