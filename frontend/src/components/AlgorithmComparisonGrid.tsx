import { useMemo, useState } from "react";
import { useAppStore, selectSnapshotForView } from "../store/useAppStore";
import { DiversityHeatmap } from "./DiversityHeatmap";
import { ErrorBoundary } from "./ErrorBoundary";
import { MetricsChart } from "./MetricsChart";
import { ParetoChart } from "./ParetoChart";
import { useShallow } from "zustand/react/shallow";

export const AlgorithmComparisonGrid = ({ objectiveCount }: { objectiveCount: number }) => {
  const { allAlgorithms, snapshotsByAlgorithm, pinnedMetrics, replay, reorderAlgorithms } = useAppStore(
    useShallow((state) => ({
      allAlgorithms: state.algorithms,
      snapshotsByAlgorithm: state.snapshotsByAlgorithm,
      pinnedMetrics: state.pinnedMetrics,
      replay: state.replay,
      reorderAlgorithms: state.reorderAlgorithms
    }))
  );
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const algorithms = useMemo(() => allAlgorithms.filter((algo) => algo.enabled), [allAlgorithms]);

  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-display text-sm text-ice">Side-by-Side Competition Panels</h3>
        <p className="text-xs text-slate">Drag cards to reorder visual comparisons.</p>
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        {algorithms.map((algorithm) => {
          const history = snapshotsByAlgorithm[algorithm.id] ?? [];
          const current = selectSnapshotForView(algorithm.id, history, replay);

          return (
            <article
              key={algorithm.id}
              draggable
              onDragStart={() => setDraggedId(algorithm.id)}
              onDragOver={(event) => event.preventDefault()}
              onDrop={() => {
                if (draggedId && draggedId !== algorithm.id) {
                  reorderAlgorithms(draggedId, algorithm.id);
                }
                setDraggedId(null);
              }}
              className="rounded-2xl border border-stroke bg-card/75 p-3"
            >
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <h4 className="font-display text-base text-ice">{algorithm.name}</h4>
                  <p className="text-xs text-slate">
                    Generation {current?.generation ?? 0} | Elapsed {current?.elapsed_sec.toFixed(2) ?? "0.00"}s
                  </p>
                </div>
              </div>

              <div className="grid gap-3">
                <ErrorBoundary title={`${algorithm.name} Pareto Front`}>
                  <ParetoChart snapshot={current} objectives={objectiveCount} />
                </ErrorBoundary>
                <ErrorBoundary title={`${algorithm.name} Convergence`}>
                  <MetricsChart snapshots={history} pinnedMetrics={pinnedMetrics} />
                </ErrorBoundary>
                <ErrorBoundary title={`${algorithm.name} Diversity`}>
                  <DiversityHeatmap matrix={current?.heatmap ?? []} />
                </ErrorBoundary>
              </div>
            </article>
          );
        })}
        {algorithms.length === 0 && (
          <div className="rounded-xl border border-stroke bg-card/40 p-5 text-center text-sm text-slate">
            No algorithm enabled. Activate at least one algorithm in the library panel.
          </div>
        )}
      </div>
    </section>
  );
};
