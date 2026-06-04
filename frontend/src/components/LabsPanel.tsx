import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  canChooseLabDirectory,
  chooseLabDirectory,
  decodeLabFromUrl,
  deleteLab,
  encodeLabForUrl,
  getLabDirectoryName,
  listLabs,
  saveLab,
  saveLabToChosenDirectory
} from "../lib/labStorage";
import { useAppStore } from "../store/useAppStore";
import type { LabDocument, UserProfile } from "../types";

const profileLabels: Record<UserProfile, string> = {
  student: "Etudiant",
  researcher: "Chercheur",
  curious: "Curieux"
};
const profileLabelsEn: Record<UserProfile, string> = {
  student: "Student",
  researcher: "Researcher",
  curious: "Curious"
};

const copy = {
  fr: {
    title: "Lab local",
    body: "Un Lab sauvegarde ton probleme, tes algorithmes, tes runs, tes notes et tes graphiques epingles sur cette machine.",
    newLab: "Nouveau Lab",
    import: "Importer",
    export: "Exporter",
    chooseFolder: "Choisir dossier",
    storage: "Stockage",
    browserStorage: "Auto: navigateur",
    delete: "Supprimer",
    open: "Ouvrir",
    profile: "Profil",
    journal: "Journal du Lab...",
    createHint: "Cree ou importe un Lab pour sauvegarder ton travail.",
    localLabs: "Labs locaux",
    noLabs: "Aucun Lab sauvegarde.",
    runHistory: "Historique de runs dans ce Lab",
    tooLarge: "Ce Lab est trop grand pour le partage par URL. Exporte le fichier .algoarena."
  },
  en: {
    title: "Local Lab",
    body: "A Lab saves your problem, algorithms, runs, notes and pinned charts on this machine.",
    newLab: "New Lab",
    import: "Import",
    export: "Export",
    chooseFolder: "Choose folder",
    storage: "Storage",
    browserStorage: "Auto: browser",
    delete: "Delete",
    open: "Open",
    profile: "Profile",
    journal: "Lab journal...",
    createHint: "Create or import a Lab to persist your work.",
    localLabs: "Local Labs",
    noLabs: "No saved Labs yet.",
    runHistory: "Run history in this Lab",
    tooLarge: "This Lab is too large for URL sharing. Export the .algoarena file instead."
  }
};

const downloadJson = (fileName: string, data: unknown): void => {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
};

export const LabsPanel = () => {
  const currentLab = useAppStore((state) => state.currentLab);
  const userProfile = useAppStore((state) => state.userProfile);
  const language = useAppStore((state) => state.language);
  const setUserProfile = useAppStore((state) => state.setUserProfile);
  const setCurrentLab = useAppStore((state) => state.setCurrentLab);
  const createLab = useAppStore((state) => state.createLab);
  const updateLabJournal = useAppStore((state) => state.updateLabJournal);
  const updateLabTitle = useAppStore((state) => state.updateLabTitle);
  const [labs, setLabs] = useState<LabDocument[]>([]);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [directoryName, setDirectoryName] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const t = copy[language];
  const labels = language === "fr" ? profileLabels : profileLabelsEn;

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const encodedLab = params.get("lab");
    if (!encodedLab) {
      return;
    }
    try {
      const decoded = decodeLabFromUrl(encodedLab);
      setCurrentLab({ ...decoded, id: `${decoded.id}-imported-${Date.now().toString(36)}` });
      setFeedback("Lab imported from URL.");
    } catch {
      setFeedback("Unable to decode Lab URL.");
    }
  }, [setCurrentLab]);

  useEffect(() => {
    void listLabs().then((rows) => setLabs(rows.sort((a, b) => b.updated_at.localeCompare(a.updated_at))));
  }, [currentLab?.id, currentLab?.updated_at]);

  useEffect(() => {
    void getLabDirectoryName().then(setDirectoryName);
  }, []);

  useEffect(() => {
    if (!currentLab) {
      return;
    }
    const timer = window.setTimeout(() => {
      void saveLab(currentLab).then(async () => {
        try {
          const path = await saveLabToChosenDirectory(currentLab);
          setFeedback(path ? `Lab saved locally and synced to ${path}.` : "Lab saved locally.");
        } catch (error) {
          setFeedback(error instanceof Error ? error.message : "Lab saved locally, but file sync failed.");
        }
      });
    }, 400);
    return () => window.clearTimeout(timer);
  }, [currentLab]);

  const shareUrl = useMemo(() => {
    if (!currentLab) {
      return "";
    }
    const encoded = encodeLabForUrl(currentLab);
    if (encoded.length > 6000) {
      return "";
    }
    const url = new URL(window.location.href);
    url.searchParams.set("lab", encoded);
    return url.toString();
  }, [currentLab]);

  const importLab = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    try {
      const parsed = JSON.parse(await file.text()) as LabDocument;
      setCurrentLab({ ...parsed, id: `${parsed.id}-imported-${Date.now().toString(36)}` });
      setFeedback(`Imported ${parsed.title}.`);
    } catch {
      setFeedback("Import failed: invalid .algoarena file.");
    } finally {
      event.target.value = "";
    }
  };

  const chooseDirectory = async () => {
    try {
      const name = await chooseLabDirectory();
      setDirectoryName(name);
      if (currentLab) {
        await saveLabToChosenDirectory(currentLab);
      }
      setFeedback(`Lab folder selected: ${name}.`);
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Unable to choose Lab folder.");
    }
  };

  const removeLab = async (lab: LabDocument) => {
    const confirmed = window.confirm(`Delete Lab "${lab.title}" from local browser storage? Export it first if you need a backup.`);
    if (!confirmed) {
      return;
    }
    await deleteLab(lab.id);
    if (currentLab?.id === lab.id) {
      setCurrentLab(null);
    }
    const rows = await listLabs();
    setLabs(rows.sort((a, b) => b.updated_at.localeCompare(a.updated_at)));
    setFeedback(`Deleted ${lab.title}.`);
  };

  return (
    <section className="rounded-2xl border border-stroke bg-card/70 p-4 shadow-glow">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-lg text-ice">Labs</h2>
          <p className="text-xs text-slate">{t.body}</p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          <button type="button" onClick={() => createLab("AlgoArena Lab")} className="rounded-md bg-accent px-3 py-2 font-semibold text-ink">
            {t.newLab}
          </button>
          <button type="button" onClick={() => fileRef.current?.click()} className="rounded-md border border-stroke px-3 py-2 text-slate">
            {t.import}
          </button>
          <input ref={fileRef} type="file" accept=".algoarena,.json" onChange={importLab} className="hidden" />
          <button
            type="button"
            disabled={!currentLab}
            onClick={() => currentLab && downloadJson(`${currentLab.title.replace(/[^a-z0-9]+/gi, "-")}.algoarena`, currentLab)}
            className="rounded-md border border-stroke px-3 py-2 text-slate disabled:opacity-40"
          >
            {t.export}
          </button>
          <button
            type="button"
            disabled={!canChooseLabDirectory()}
            onClick={() => void chooseDirectory()}
            className="rounded-md border border-stroke px-3 py-2 text-slate disabled:opacity-40"
          >
            {t.chooseFolder}
          </button>
        </div>
      </div>
      <p className="mt-2 text-[11px] text-slate">
        {t.storage}: {directoryName ? `${directoryName} + IndexedDB` : t.browserStorage}
      </p>

      <div className="mt-3 grid gap-3 lg:grid-cols-[1.2fr_1fr]">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <label className="text-xs text-slate">
              {t.profile}
              <select
                value={userProfile ?? "student"}
                onChange={(event) => setUserProfile(event.target.value as UserProfile)}
                className="ml-2 rounded border border-stroke bg-ink px-2 py-1 text-ice"
              >
                {(Object.keys(profileLabels) as UserProfile[]).map((value) => (
                  <option key={value} value={value}>
                    {labels[value]}
                  </option>
                ))}
              </select>
            </label>
            {currentLab && (
              <input
                value={currentLab.title}
                onChange={(event) => updateLabTitle(event.target.value)}
                className="min-w-60 rounded border border-stroke bg-ink px-2 py-1 text-sm text-ice"
              />
            )}
          </div>
          {currentLab ? (
            <textarea
              value={currentLab.journal}
              onChange={(event) => updateLabJournal(event.target.value)}
              rows={5}
              placeholder={t.journal}
              className="w-full rounded border border-stroke bg-ink px-3 py-2 text-xs text-ice"
            />
          ) : (
            <div className="rounded border border-stroke bg-ink p-3 text-xs text-slate">{t.createHint}</div>
          )}
          {shareUrl && (
            <input readOnly value={shareUrl} className="w-full rounded border border-stroke bg-ink px-2 py-1 text-[10px] text-slate" />
          )}
          {currentLab && !shareUrl && (
            <p className="text-[11px] text-slate">{t.tooLarge}</p>
          )}
        </div>

        <div className="max-h-48 overflow-y-auto rounded border border-stroke bg-ink p-2 text-xs text-slate">
          <p className="mb-2 font-semibold text-ice">{t.localLabs}</p>
          {labs.map((lab) => (
            <div
              key={lab.id}
              className="mb-1 rounded border border-stroke/70 px-2 py-2"
            >
              <span className="block text-ice">{lab.title}</span>
              <span>{lab.runs.length} runs | {labels[lab.profile]}</span>
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setCurrentLab(lab)}
                  className="rounded border border-stroke px-2 py-1 text-[11px] text-slate hover:border-accent"
                >
                  {t.open}
                </button>
                <button
                  type="button"
                  onClick={() => void removeLab(lab)}
                  className="rounded border border-rose-400/60 px-2 py-1 text-[11px] text-rose-200"
                >
                  {t.delete}
                </button>
              </div>
            </div>
          ))}
          {labs.length === 0 && <p>{t.noLabs}</p>}
        </div>
      </div>
      {currentLab && <p className="mt-2 text-[11px] text-slate">{t.runHistory}: {currentLab.runs.length}</p>}
      {feedback && <p className="mt-2 text-[11px] text-accent">{feedback}</p>}
    </section>
  );
};
