import { useMemo, useState } from "react";
import type { AlgorithmConfig, AlgorithmSpec } from "../types";
import { buildApiUrl } from "../lib/api";
import { useAppStore } from "../store/useAppStore";

interface Props {
  specs: AlgorithmSpec[];
  refreshAlgorithms: () => Promise<void>;
}

export const AlgorithmConfigPanel = ({ specs, refreshAlgorithms }: Props) => {
  const algorithms = useAppStore((state) => state.algorithms);
  const toggleAlgorithm = useAppStore((state) => state.toggleAlgorithm);
  const updateHyperparam = useAppStore((state) => state.updateHyperparam);
  const reorderAlgorithms = useAppStore((state) => state.reorderAlgorithms);

  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadClassName, setUploadClassName] = useState("");
  const [uploadDisplayName, setUploadDisplayName] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);

  const specByName = useMemo(() => {
    const map = new Map<string, AlgorithmSpec>();
    specs.forEach((spec) => map.set(spec.name, spec));
    return map;
  }, [specs]);

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

  const handleDrop = (targetId: string) => {
    if (!draggedId || draggedId === targetId) {
      return;
    }
    reorderAlgorithms(draggedId, targetId);
    setDraggedId(null);
  };

  return (
    <section className="rounded-2xl border border-stroke bg-card/70 p-4 shadow-glow">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-lg text-ice">Algorithm Library</h2>
        <p className="text-xs text-slate">Drag cards to reorder panels. Toggle to include in competition mode.</p>
      </div>

      <div className="grid gap-3">
        {algorithms.map((algorithm: AlgorithmConfig) => {
          const spec = specByName.get(algorithm.name);
          if (!spec) {
            return null;
          }
          return (
            <article
              key={algorithm.id}
              draggable
              onDragStart={() => setDraggedId(algorithm.id)}
              onDragOver={(event) => event.preventDefault()}
              onDrop={() => handleDrop(algorithm.id)}
              className="rounded-xl border border-stroke bg-ink/80 p-3"
            >
              <div className="mb-2 flex items-center justify-between gap-2">
                <div>
                  <p className="font-display text-sm text-ice">{algorithm.name}</p>
                  <p className="text-[10px] uppercase tracking-wide text-slate">{spec.source}</p>
                </div>
                <label className="flex items-center gap-2 text-xs text-slate">
                  <input
                    type="checkbox"
                    checked={algorithm.enabled}
                    onChange={() => toggleAlgorithm(algorithm.id)}
                    className="h-4 w-4 accent-accent"
                  />
                  Enabled
                </label>
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
        })}
      </div>

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
