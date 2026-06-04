import { DndContext, DragOverlay, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useMemo, useState } from "react";
import type { AlgorithmConfig, AlgorithmSpec } from "../types";
import { buildApiUrl } from "../lib/api";
import { useAppStore } from "../store/useAppStore";

interface Props {
  specs: AlgorithmSpec[];
  refreshAlgorithms: () => Promise<void>;
}

interface SortableAlgorithmCardProps {
  algorithm: AlgorithmConfig;
  spec: AlgorithmSpec;
  toggleAlgorithm: (algorithmId: string) => void;
  duplicateAlgorithm: (algorithmId: string) => void;
  updateHyperparam: (algorithmId: string, key: string, value: number) => void;
}

const SortableAlgorithmCard = ({ algorithm, spec, toggleAlgorithm, duplicateAlgorithm, updateHyperparam }: SortableAlgorithmCardProps) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: algorithm.id
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition
  };

  return (
    <article
      ref={setNodeRef}
      style={style}
      className={`rounded-xl border border-stroke bg-ink/80 p-3 ${isDragging ? "z-20 opacity-70 shadow-glow" : ""}`}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <div>
          <p className="font-display text-sm text-ice">{algorithm.label ?? algorithm.name}</p>
          <p className="text-[10px] uppercase tracking-wide text-slate">{spec.source}</p>
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 text-xs text-slate">
            <input
              type="checkbox"
              checked={algorithm.enabled}
              onChange={() => toggleAlgorithm(algorithm.id)}
              className="h-4 w-4 accent-accent"
            />
            Enabled
          </label>
          <button
            type="button"
            onClick={() => duplicateAlgorithm(algorithm.id)}
            className="rounded border border-stroke px-2 py-1 text-[10px] text-slate"
          >
            Duplicate
          </button>
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
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        {Object.entries(spec.hyperparams).map(([key, meta]) => {
          const value = algorithm.hyperparams[key] ?? meta.default;
          return (
            <label key={key} className="block text-[11px] text-slate">
              {meta.label}
              <div className="mt-1 flex items-center gap-2">
                <input
                  type="range"
                  min={meta.min}
                  max={meta.max}
                  step={meta.step}
                  value={value}
                  onChange={(event) => updateHyperparam(algorithm.id, key, Number(event.target.value))}
                  className="w-full accent-accent"
                />
                <input
                  type="number"
                  min={meta.min}
                  max={meta.max}
                  step={meta.step}
                  value={value}
                  onChange={(event) => updateHyperparam(algorithm.id, key, Number(event.target.value))}
                  className="w-20 rounded-md border border-stroke bg-card px-2 py-1 text-xs text-ice"
                />
              </div>
            </label>
          );
        })}
      </div>
    </article>
  );
};

export const AlgorithmConfigPanel = ({ specs, refreshAlgorithms }: Props) => {
  const algorithms = useAppStore((state) => state.algorithms);
  const toggleAlgorithm = useAppStore((state) => state.toggleAlgorithm);
  const duplicateAlgorithm = useAppStore((state) => state.duplicateAlgorithm);
  const updateHyperparam = useAppStore((state) => state.updateHyperparam);
  const reorderAlgorithms = useAppStore((state) => state.reorderAlgorithms);

  const [activeId, setActiveId] = useState<string | null>(null);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadClassName, setUploadClassName] = useState("");
  const [uploadDisplayName, setUploadDisplayName] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);
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

  const specByName = useMemo(() => {
    const map = new Map<string, AlgorithmSpec>();
    specs.forEach((spec) => map.set(spec.name, spec));
    return map;
  }, [specs]);
  const activeAlgorithmName = useMemo(
    () => algorithms.find((algorithm) => algorithm.id === activeId)?.name ?? null,
    [activeId, algorithms]
  );

  const handleUploadAlgorithm = async () => {
    if (!uploadFile) {
      setFeedback("Pick a Python file implementing BaseAlgorithm.");
      return;
    }
    const formData = new FormData();
    formData.append("file", uploadFile);
    if (uploadClassName.trim()) {
      formData.append("class_name", uploadClassName.trim());
    }
    if (uploadDisplayName.trim()) {
      formData.append("display_name", uploadDisplayName.trim());
    }

    const response = await fetch(buildApiUrl("/api/algorithms/upload"), {
      method: "POST",
      body: formData
    });
    if (!response.ok) {
      const detail = await response.text();
      setFeedback(`Upload failed: ${detail}`);
      return;
    }
    setFeedback("Custom algorithm registered.");
    setUploadFile(null);
    setUploadClassName("");
    setUploadDisplayName("");
    await refreshAlgorithms();
  };

  return (
    <section className="rounded-2xl border border-stroke bg-card/70 p-4 shadow-glow">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-lg text-ice">Algorithm Library</h2>
        <p className="text-xs text-slate">
          Reorder with the Drag handle. This controls panel order in both Benchmark and Competition views.
        </p>
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
        <SortableContext items={algorithms.map((algorithm) => algorithm.id)} strategy={verticalListSortingStrategy}>
          <div className="grid gap-3">
            {algorithms.map((algorithm: AlgorithmConfig) => {
              const spec = specByName.get(algorithm.name);
              if (!spec) {
                return null;
              }
              return (
                <SortableAlgorithmCard
                  key={algorithm.id}
                  algorithm={algorithm}
                  spec={spec}
                  toggleAlgorithm={toggleAlgorithm}
                  duplicateAlgorithm={duplicateAlgorithm}
                  updateHyperparam={updateHyperparam}
                />
              );
            })}
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

      <div className="mt-4 rounded-xl border border-dashed border-stroke p-3">
        <h3 className="font-display text-sm text-ice">Upload Custom Algorithm Plug-in</h3>
        <div className="mt-2 grid gap-2 sm:grid-cols-3">
          <input
            type="text"
            placeholder="Class name (optional)"
            value={uploadClassName}
            onChange={(event) => setUploadClassName(event.target.value)}
            className="rounded-md border border-stroke bg-ink px-2 py-1 text-xs text-ice"
          />
          <input
            type="text"
            placeholder="Display name (optional)"
            value={uploadDisplayName}
            onChange={(event) => setUploadDisplayName(event.target.value)}
            className="rounded-md border border-stroke bg-ink px-2 py-1 text-xs text-ice"
          />
          <input
            type="file"
            accept=".py"
            onChange={(event) => setUploadFile(event.target.files?.[0] ?? null)}
            className="rounded-md border border-stroke bg-ink px-2 py-1 text-xs text-ice file:mr-3 file:rounded-md file:border-0 file:bg-accent file:px-2 file:py-1 file:text-ink"
          />
        </div>
        <button
          type="button"
          onClick={handleUploadAlgorithm}
          className="mt-3 rounded-md bg-accent px-3 py-2 text-xs font-semibold text-ink"
        >
          Register Algorithm
        </button>
        {feedback && <p className="mt-2 text-xs text-accent">{feedback}</p>}
      </div>
    </section>
  );
};
