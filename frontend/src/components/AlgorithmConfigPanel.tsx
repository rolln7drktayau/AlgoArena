import { useMemo, useState } from "react";
import type { AlgorithmConfig, AlgorithmSpec } from "../types";
import { buildApiUrl } from "../lib/api";
import { useProfileFilter } from "../hooks/useProfileFilter";
import { useAppStore } from "../store/useAppStore";

interface Props {
  specs: AlgorithmSpec[];
  refreshAlgorithms: () => Promise<void>;
}

const basicHyperparams = new Set(["population_size", "pop_size", "n_gen", "generations"]);

export const AlgorithmConfigPanel = ({ specs, refreshAlgorithms }: Props) => {
  const algorithms = useAppStore((state) => state.algorithms);
  const language = useAppStore((state) => state.language);
  const toggleAlgorithm = useAppStore((state) => state.toggleAlgorithm);
  const duplicateAlgorithm = useAppStore((state) => state.duplicateAlgorithm);
  const updateHyperparam = useAppStore((state) => state.updateHyperparam);
  const { allowedAlgorithms, showCustomAlgorithmUpload, showAdvancedHyperparams, isResearcher } = useProfileFilter();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(isResearcher);
  const [showAdvancedParams, setShowAdvancedParams] = useState(isResearcher);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadClassName, setUploadClassName] = useState("");
  const [uploadDisplayName, setUploadDisplayName] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);

  const specByName = useMemo(() => new Map(specs.map((spec) => [spec.name, spec])), [specs]);
  const visibleAlgorithms = useMemo(() => {
    if (showAll || !allowedAlgorithms) {
      return algorithms;
    }
    return algorithms.filter((algorithm) => allowedAlgorithms.includes(algorithm.name));
  }, [algorithms, allowedAlgorithms, showAll]);

  const selectedAlgorithm =
    visibleAlgorithms.find((algorithm) => algorithm.id === selectedId) ??
    visibleAlgorithms.find((algorithm) => algorithm.enabled) ??
    visibleAlgorithms[0] ??
    null;
  const selectedSpec = selectedAlgorithm ? specByName.get(selectedAlgorithm.name) : null;

  const text = language === "fr"
    ? {
        title: "ETAPE 2 - Quels algorithmes ?",
        hint: "Selectionne quelques concurrents. Les reglages apparaissent seulement pour l'algorithme choisi.",
        selected: "selectionnes",
        seeAll: "+ Voir tous les algorithmes (mode avance)",
        hideAll: "Masquer le mode avance",
        params: "Parametres",
        advanced: "Parametres avances",
        duplicate: "Dupliquer cette configuration",
        upload: "Algorithme personnalise",
        register: "Enregistrer l'algorithme",
        disable: "Desactiver",
        enable: "Activer",
        advancedOpen: "ouverts",
        advancedClosed: "fermes",
        pickFile: "Choisis un fichier Python qui implemente BaseAlgorithm.",
        uploadFailed: "Upload echoue",
        uploadOk: "Algorithme personnalise enregistre.",
        className: "Nom de classe",
        displayName: "Nom affiche"
      }
    : {
        title: "STEP 2 - Which algorithms?",
        hint: "Pick a few competitors. Settings appear only for the selected algorithm.",
        selected: "selected",
        seeAll: "+ Show all algorithms (advanced mode)",
        hideAll: "Hide advanced mode",
        params: "Settings",
        advanced: "Advanced settings",
        duplicate: "Duplicate this configuration",
        upload: "Custom Algorithm Upload",
        register: "Register Algorithm",
        disable: "Disable",
        enable: "Enable",
        advancedOpen: "open",
        advancedClosed: "closed",
        pickFile: "Pick a Python file implementing BaseAlgorithm.",
        uploadFailed: "Upload failed",
        uploadOk: "Custom algorithm registered.",
        className: "Class name",
        displayName: "Display name"
      };

  const enabledCount = visibleAlgorithms.filter((algorithm) => algorithm.enabled).length;

  const handleUploadAlgorithm = async () => {
    if (!uploadFile) {
      setFeedback(text.pickFile);
      return;
    }
    const formData = new FormData();
    formData.append("file", uploadFile);
    if (uploadClassName.trim()) formData.append("class_name", uploadClassName.trim());
    if (uploadDisplayName.trim()) formData.append("display_name", uploadDisplayName.trim());

    const response = await fetch(buildApiUrl("/api/algorithms/upload"), { method: "POST", body: formData });
    if (!response.ok) {
      setFeedback(`${text.uploadFailed}: ${await response.text()}`);
      return;
    }
    setFeedback(text.uploadOk);
    setUploadFile(null);
    setUploadClassName("");
    setUploadDisplayName("");
    await refreshAlgorithms();
  };

  return (
    <section className="rounded-2xl border border-stroke bg-card/70 p-4 shadow-glow">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-ice">{text.title}</h2>
          <p className="mt-1 text-xs italic text-slate">{text.hint}</p>
        </div>
        <span className="rounded-full border border-stroke px-3 py-1 text-sm text-accent">
          {enabledCount} {text.selected}
        </span>
      </div>

      <div className="flex flex-wrap gap-2">
        {visibleAlgorithms.map((algorithm: AlgorithmConfig) => (
          <button
            key={algorithm.id}
            type="button"
            onClick={() => {
              if (!algorithm.enabled) {
                toggleAlgorithm(algorithm.id);
              }
              setSelectedId(algorithm.id);
            }}
            className={`rounded-full border px-3 py-2 text-xs transition ${
              algorithm.enabled
                ? "border-accent bg-accent/15 text-ice"
                : "border-stroke bg-ink/60 text-slate"
            } ${selectedAlgorithm?.id === algorithm.id ? "ring-2 ring-accent/60" : ""}`}
          >
            <span className="mr-2">{algorithm.enabled ? "[x]" : "[ ]"}</span>
            {algorithm.label ?? algorithm.name}
          </button>
        ))}
      </div>

      {allowedAlgorithms && (
        <button
          type="button"
          onClick={() => setShowAll((value) => !value)}
          className="mt-3 rounded-md border border-stroke px-3 py-2 text-xs text-slate"
        >
          {showAll ? text.hideAll : text.seeAll}
        </button>
      )}

      {selectedAlgorithm && selectedSpec && (
        <div className="mt-4 rounded-xl border border-stroke bg-ink/70 p-3">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="font-display text-sm text-ice">{text.params}: {selectedAlgorithm.label ?? selectedAlgorithm.name}</h3>
              <p className="text-xs text-slate">{selectedSpec.source}</p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => toggleAlgorithm(selectedAlgorithm.id)}
                className="rounded border border-stroke px-3 py-2 text-xs text-slate"
              >
                {selectedAlgorithm.enabled ? text.disable : text.enable}
              </button>
              <button
                type="button"
                onClick={() => duplicateAlgorithm(selectedAlgorithm.id)}
                className="rounded border border-stroke px-3 py-2 text-xs text-slate"
              >
                {text.duplicate}
              </button>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {Object.entries(selectedSpec.hyperparams)
              .filter(([key]) => showAdvancedHyperparams || showAdvancedParams || basicHyperparams.has(key))
              .map(([key, meta]) => {
                const value = selectedAlgorithm.hyperparams[key] ?? meta.default;
                return (
                  <label key={key} className="block text-sm text-slate">
                    <span className="text-gray-400">{meta.label}</span>
                    <div className="mt-1 flex items-center gap-2">
                      <input
                        type="range"
                        min={meta.min}
                        max={meta.max}
                        step={meta.step}
                        value={value}
                        onChange={(event) => updateHyperparam(selectedAlgorithm.id, key, Number(event.target.value))}
                        className="w-full accent-accent"
                      />
                      <input
                        type="number"
                        min={meta.min}
                        max={meta.max}
                        step={meta.step}
                        value={value}
                        onChange={(event) => updateHyperparam(selectedAlgorithm.id, key, Number(event.target.value))}
                        className="w-20 rounded-md border border-stroke bg-card px-2 py-1 text-xs text-ice"
                      />
                    </div>
                  </label>
                );
              })}
          </div>
          {!showAdvancedHyperparams && (
            <button
              type="button"
              onClick={() => setShowAdvancedParams((value) => !value)}
              className="mt-3 rounded border border-stroke px-3 py-2 text-xs text-slate"
            >
              {text.advanced} {showAdvancedParams ? text.advancedOpen : text.advancedClosed}
            </button>
          )}
        </div>
      )}

      {showCustomAlgorithmUpload && (
        <div className="mt-4 rounded-xl border border-dashed border-stroke p-3">
          <h3 className="font-display text-sm text-ice">{text.upload}</h3>
          <div className="mt-2 grid gap-2 sm:grid-cols-3">
            <input type="text" placeholder={text.className} value={uploadClassName} onChange={(event) => setUploadClassName(event.target.value)} className="rounded-md border border-stroke bg-ink px-2 py-1 text-xs text-ice" />
            <input type="text" placeholder={text.displayName} value={uploadDisplayName} onChange={(event) => setUploadDisplayName(event.target.value)} className="rounded-md border border-stroke bg-ink px-2 py-1 text-xs text-ice" />
            <input type="file" accept=".py" onChange={(event) => setUploadFile(event.target.files?.[0] ?? null)} className="rounded-md border border-stroke bg-ink px-2 py-1 text-xs text-ice file:mr-3 file:rounded-md file:border-0 file:bg-accent file:px-2 file:py-1 file:text-ink" />
          </div>
          <button type="button" onClick={handleUploadAlgorithm} className="mt-3 rounded-md bg-accent px-3 py-2 text-xs font-semibold text-ink">
            {text.register}
          </button>
          {feedback && <p className="mt-2 text-xs text-accent">{feedback}</p>}
        </div>
      )}
    </section>
  );
};
