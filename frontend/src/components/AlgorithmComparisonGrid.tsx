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
import { useEffect, useMemo, useState } from "react";
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
          <h4 className="font-display text-base text-ice">{algorithm.label ?? algorithm.name}</h4>
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
  const { allAlgorithms, snapshotsByAlgorithm, pinnedMetrics, replay, reorderAlgorithms, language } = useAppStore(
    useShallow((state) => ({
      allAlgorithms: state.algorithms,
      snapshotsByAlgorithm: state.snapshotsByAlgorithm,
      pinnedMetrics: state.pinnedMetrics,
      replay: state.replay,
      reorderAlgorithms: state.reorderAlgorithms,
      language: state.language
    }))
  );
  const [activeId, setActiveId] = useState<string | null>(null);
  const [visibleIds, setVisibleIds] = useState<string[]>([]);
  const text = language === "fr"
    ? {
        title: "Panneaux de competition cote a cote",
        body: "Choisis les concurrents que tu veux observer ici. Cela ne change pas les algorithmes lances, seulement les panneaux affiches.",
        showAll: "Tout afficher",
        hideAll: "Tout masquer",
        drag: "Utilise Drag pour reordonner les cartes.",
        empty: "Aucun panneau selectionne. Affiche tout ou coche quelques concurrents.",
        noAlgo: "Aucun algorithme actif. Active au moins un algorithme dans la bibliotheque."
      }
    : {
        title: "Side-by-Side Competition Panels",
        body: "Choose which competitors to inspect here. This does not change which algorithms run, only which panels are displayed.",
        showAll: "Show all",
        hideAll: "Hide all",
        drag: "Use Drag to reorder cards.",
        empty: "No panel selected. Show all or check a few competitors.",
        noAlgo: "No algorithm enabled. Activate at least one algorithm in the library panel."
      };
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
  useEffect(() => {
    setVisibleIds((current) => {
      const enabledIds = algorithms.map((algo) => algo.id);
      if (current.length === 0) {
        return enabledIds;
      }
      const kept = current.filter((id) => enabledIds.includes(id));
      return kept.length === 0 ? enabledIds : kept;
    });
  }, [algorithms]);
  const visibleAlgorithms = useMemo(
    () => algorithms.filter((algorithm) => visibleIds.includes(algorithm.id)),
    [algorithms, visibleIds]
  );
  const activeAlgorithmName = useMemo(
    () => algorithms.find((algorithm) => algorithm.id === activeId)?.name ?? null,
    [activeId, algorithms]
  );

  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h3 className="font-display text-sm text-ice">{text.title}</h3>
          <p className="mt-1 text-xs text-slate">{text.body}</p>
        </div>
        <p className="text-xs text-slate">{text.drag}</p>
      </div>
      <div className="mb-3 rounded-xl border border-stroke bg-card/50 p-3">
        <div className="mb-2 flex flex-wrap gap-2">
          <button type="button" onClick={() => setVisibleIds(algorithms.map((algo) => algo.id))} className="rounded border border-stroke px-3 py-1 text-xs text-slate">
            {text.showAll}
          </button>
          <button type="button" onClick={() => setVisibleIds([])} className="rounded border border-stroke px-3 py-1 text-xs text-slate">
            {text.hideAll}
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {algorithms.map((algorithm) => (
            <label key={algorithm.id} className="flex items-center gap-2 rounded border border-stroke bg-ink px-2 py-1 text-xs text-slate">
              <input
                type="checkbox"
                checked={visibleIds.includes(algorithm.id)}
                onChange={() =>
                  setVisibleIds((current) =>
                    current.includes(algorithm.id)
                      ? current.filter((id) => id !== algorithm.id)
                      : [...current, algorithm.id]
                  )
                }
                className="accent-accent"
              />
              {algorithm.label ?? algorithm.name}
            </label>
          ))}
        </div>
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
        <SortableContext items={visibleAlgorithms.map((algorithm) => algorithm.id)} strategy={rectSortingStrategy}>
          <div className="grid gap-4 xl:grid-cols-2">
            {visibleAlgorithms.map((algorithm) => {
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
                {text.noAlgo}
              </div>
            )}
            {algorithms.length > 0 && visibleAlgorithms.length === 0 && (
              <div className="rounded-xl border border-stroke bg-card/40 p-5 text-center text-sm text-slate">
                {text.empty}
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
