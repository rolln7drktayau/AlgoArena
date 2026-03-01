import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors
} from "@dnd-kit/core";
import { SortableContext, rectSortingStrategy, sortableKeyboardCoordinates, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useMemo, useState } from "react";
import { useAppStore, selectSnapshotForView } from "../store/useAppStore";
import { DiversityHeatmap } from "./DiversityHeatmap";
import { ErrorBoundary } from "./ErrorBoundary";
import { MetricsChart } from "./MetricsChart";
import { ParetoChart } from "./ParetoChart";
import { useShallow } from "zustand/react/shallow";
import type { AlgorithmConfig, GenerationSnapshot } from "../types";

interface SortableComparisonCardProps {
  algorithm: AlgorithmConfig;
  objectiveCount: number;
  current: GenerationSnapshot | null;
  history: GenerationSnapshot[];
  pinnedMetrics: string[];
}

const SortableComparisonCard = ({ algorithm, objectiveCount, current, history, pinnedMetrics }: SortableComparisonCardProps) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: algorithm.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition
  };

  return (
    <article
      ref={setNodeRef}
      style={style}
      className={`rounded-2xl border border-stroke bg-card/75 p-3 ${isDragging ? "z-20 opacity-70 shadow-glow" : ""}`}
    >
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h4 className="font-display text-base text-ice">{algorithm.name}</h4>
          <p className="text-xs text-slate">
            Generation {current?.generation ?? 0} | Elapsed {current?.elapsed_sec.toFixed(2) ?? "0.00"}s
          </p>
        </div>
        <button
          type="button"
          aria-label={`Drag to reorder ${algorithm.name}`}
          className="cursor-grab rounded border border-stroke px-2 py-1 text-[10px] text-slate active:cursor-grabbing"
          {...attributes}
          {...listeners}
        >
          Drag
        </button>
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
};

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
  const [activeId, setActiveId] = useState<string | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8
      }
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates
    })
  );
  const algorithms = useMemo(() => allAlgorithms.filter((algo) => algo.enabled), [allAlgorithms]);
  const activeAlgorithmName = useMemo(
    () => algorithms.find((algorithm) => algorithm.id === activeId)?.name ?? null,
    [activeId, algorithms]
  );

  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-display text-sm text-ice">Side-by-Side Competition Panels</h3>
        <p className="text-xs text-slate">Use the Drag handle to reorder cards in real time.</p>
      </div>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={({ active }) => setActiveId(String(active.id))}
        onDragCancel={() => setActiveId(null)}
        onDragEnd={({ active, over }) => {
          setActiveId(null);
          if (!over || active.id === over.id) {
            return;
          }
          reorderAlgorithms(String(active.id), String(over.id));
        }}
      >
        <SortableContext items={algorithms.map((algorithm) => algorithm.id)} strategy={rectSortingStrategy}>
          <div className="grid gap-4 xl:grid-cols-2">
            {algorithms.map((algorithm) => {
              const history = snapshotsByAlgorithm[algorithm.id] ?? [];
              const current = selectSnapshotForView(algorithm.id, history, replay);
              return (
                <SortableComparisonCard
                  key={algorithm.id}
                  algorithm={algorithm}
                  objectiveCount={objectiveCount}
                  current={current}
                  history={history}
                  pinnedMetrics={pinnedMetrics}
                />
              );
            })}
            {algorithms.length === 0 && (
              <div className="rounded-xl border border-stroke bg-card/40 p-5 text-center text-sm text-slate">
                No algorithm enabled. Activate at least one algorithm in the library panel.
              </div>
            )}
          </div>
        </SortableContext>
        <DragOverlay>
          {activeAlgorithmName ? (
            <div className="rounded-xl border border-accent/60 bg-card px-3 py-2 text-xs text-ice shadow-glow">
              {activeAlgorithmName}
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </section>
  );
};
