import { create } from "zustand";
import type {
  AlgorithmConfig,
  AlgorithmSpec,
  GenerationMessage,
  GenerationSnapshot,
  LeaderboardEntry,
  LabDocument,
  LabRunRecord,
  ProblemConfig,
  ProblemSpec,
  RunSummary,
  UserProfile
} from "../types";

type TabName = "benchmark" | "scenario" | "explore" | "tutorial";
type ThemeMode = "dark" | "light";
type AppLanguage = "fr" | "en";

interface ReplayState {
  enabled: boolean;
  playing: boolean;
  index: number;
}

interface AppState {
  currentLab: LabDocument | null;
  userProfile: UserProfile | null;
  tab: TabName;
  algorithmSpecs: AlgorithmSpec[];
  algorithms: AlgorithmConfig[];
  problems: ProblemSpec[];
  problemConfig: ProblemConfig;
  snapshotsByAlgorithm: Record<string, GenerationSnapshot[]>;
  algorithmNameById: Record<string, string>;
  leaderboard: LeaderboardEntry[];
  runSummary: RunSummary | null;
  runId: string | null;
  isRunning: boolean;
  socketError: string | null;
  configRevision: number;
  pinnedMetrics: string[];
  replay: ReplayState;
  theme: ThemeMode;
  language: AppLanguage;
  setCurrentLab: (lab: LabDocument | null) => void;
  createLab: (title?: string) => LabDocument;
  updateLabJournal: (journal: string) => void;
  updateLabTitle: (title: string) => void;
  addRunToLab: (run?: Partial<LabRunRecord>) => void;
  setUserProfile: (profile: UserProfile) => void;
  setTab: (tab: TabName) => void;
  setAlgorithmSpecs: (specs: AlgorithmSpec[]) => void;
  setProblems: (specs: ProblemSpec[]) => void;
  toggleAlgorithm: (algorithmId: string) => void;
  duplicateAlgorithm: (algorithmId: string) => void;
  updateHyperparam: (algorithmId: string, key: string, value: number) => void;
  reorderAlgorithms: (draggedId: string, targetId: string) => void;
  setProblemConfig: (patch: Partial<ProblemConfig>) => void;
  addSnapshot: (message: GenerationMessage) => void;
  addSnapshotsBatch: (messages: GenerationMessage[]) => void;
  setLeaderboard: (rows: LeaderboardEntry[]) => void;
  setRunSummary: (summary: RunSummary | null) => void;
  setRunId: (runId: string | null) => void;
  setRunning: (running: boolean) => void;
  setSocketError: (error: string | null) => void;
  resetRunData: () => void;
  togglePinnedMetric: (metric: string) => void;
  setReplayEnabled: (enabled: boolean) => void;
  setReplayIndex: (index: number) => void;
  setReplayPlaying: (playing: boolean) => void;
  setTheme: (theme: ThemeMode) => void;
  toggleTheme: () => void;
  setLanguage: (language: AppLanguage) => void;
  toggleLanguage: () => void;
}

const DEFAULT_METRICS = ["hv", "igd", "spread", "generation_speed"];
const MAX_SNAPSHOT_HISTORY = 2000;

const createAlgorithmId = (name: string): string =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const createId = (prefix: string): string => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const defaultsFromSchema = (schema: AlgorithmSpec["hyperparams"]): Record<string, number> => {
  const result: Record<string, number> = {};
  Object.entries(schema).forEach(([key, spec]) => {
    result[key] = spec.default;
  });
  return result;
};

const getInitialTheme = (): ThemeMode => {
  if (typeof window === "undefined") {
    return "dark";
  }
  const stored = window.localStorage.getItem("algoarena-theme");
  return stored === "light" ? "light" : "dark";
};

const persistTheme = (theme: ThemeMode) => {
  if (typeof window !== "undefined") {
    window.localStorage.setItem("algoarena-theme", theme);
  }
};

const getInitialLanguage = (): AppLanguage => {
  if (typeof window === "undefined") {
    return "fr";
  }
  const stored = window.localStorage.getItem("algoarena-language");
  if (stored === "fr" || stored === "en") {
    return stored;
  }
  const nav = window.navigator.language.toLowerCase();
  return nav.startsWith("fr") ? "fr" : "en";
};

const getInitialProfile = (): UserProfile | null => {
  if (typeof window === "undefined") {
    return null;
  }
  const stored = window.localStorage.getItem("algoarena-profile");
  if (stored === "student" || stored === "researcher" || stored === "curious") {
    return stored;
  }
  return null;
};

const persistProfile = (profile: UserProfile) => {
  if (typeof window !== "undefined") {
    window.localStorage.setItem("algoarena-profile", profile);
  }
};

const cloneAlgorithm = (algorithm: AlgorithmConfig, variantNumber: number): AlgorithmConfig => ({
  ...algorithm,
  id: `${createAlgorithmId(algorithm.name)}-variant-${variantNumber}-${Date.now().toString(36)}`,
  label: `${algorithm.name} config ${variantNumber}`,
  enabled: true,
  hyperparams: { ...algorithm.hyperparams }
});

const buildLabFromState = (state: AppState, title = "Untitled Lab"): LabDocument => {
  const now = new Date().toISOString();
  return {
    schema_version: 1,
    id: createId("lab"),
    title,
    profile: state.userProfile ?? "student",
    created_at: now,
    updated_at: now,
    problem: state.problemConfig,
    algorithms: state.algorithms,
    pinned_metrics: state.pinnedMetrics,
    pinned_charts: [],
    journal: "",
    runs: []
  };
};

const persistLanguage = (language: AppLanguage) => {
  if (typeof window !== "undefined") {
    window.localStorage.setItem("algoarena-language", language);
  }
};

const mergeSnapshotHistory = (
  previous: GenerationSnapshot[],
  incoming: GenerationSnapshot
): { next: GenerationSnapshot[]; changed: boolean } => {
  if (previous.length === 0) {
    return { next: [incoming], changed: true };
  }
  const last = previous[previous.length - 1];
  if (last.generation === incoming.generation) {
    // Replace same-generation snapshot to avoid duplicate churn.
    if (last.elapsed_sec === incoming.elapsed_sec && last.population.length === incoming.population.length) {
      return { next: previous, changed: false };
    }
    const replaced = [...previous.slice(0, -1), incoming];
    return { next: replaced, changed: true };
  }

  const appended = [...previous, incoming];
  if (appended.length > MAX_SNAPSHOT_HISTORY) {
    return { next: appended.slice(appended.length - MAX_SNAPSHOT_HISTORY), changed: true };
  }
  return { next: appended, changed: true };
};

const leaderboardEquals = (a: LeaderboardEntry[], b: LeaderboardEntry[]): boolean => {
  if (a === b) {
    return true;
  }
  if (a.length !== b.length) {
    return false;
  }
  for (let index = 0; index < a.length; index += 1) {
    const left = a[index];
    const right = b[index];
    if (
      left.algorithm_id !== right.algorithm_id ||
      left.rank !== right.rank ||
      left.generation !== right.generation ||
      left.elapsed_sec !== right.elapsed_sec ||
      left.hv !== right.hv ||
      left.igd !== right.igd ||
      left.igd_plus !== right.igd_plus ||
      left.gd !== right.gd ||
      left.gd_plus !== right.gd_plus ||
      left.epsilon !== right.epsilon ||
      left.spread !== right.spread ||
      left.spacing !== right.spacing ||
      left.generation_speed !== right.generation_speed ||
      left.hv_improvement !== right.hv_improvement ||
      left.hv_improvement_rate !== right.hv_improvement_rate ||
      left.time_to_convergence !== right.time_to_convergence ||
      left.error !== right.error
    ) {
      return false;
    }
  }
  return true;
};

export const useAppStore = create<AppState>((set) => ({
  currentLab: null,
  userProfile: getInitialProfile(),
  tab: "benchmark",
  algorithmSpecs: [],
  algorithms: [],
  problems: [],
  problemConfig: { kind: "builtin", name: "DTLZ2", n_var: 30, n_obj: 4, xl: 0, xu: 1 },
  snapshotsByAlgorithm: {},
  algorithmNameById: {},
  leaderboard: [],
  runSummary: null,
  runId: null,
  isRunning: false,
  socketError: null,
  configRevision: 0,
  pinnedMetrics: DEFAULT_METRICS,
  replay: { enabled: false, playing: false, index: 0 },
  theme: getInitialTheme(),
  language: getInitialLanguage(),

  setCurrentLab: (lab) =>
    set((state) => {
      if (!lab) {
        return { currentLab: null };
      }
      return {
        currentLab: lab,
        userProfile: lab.profile ?? state.userProfile,
        problemConfig: lab.problem,
        algorithms: lab.algorithms,
        pinnedMetrics: lab.pinned_metrics.length ? lab.pinned_metrics : state.pinnedMetrics
      };
    }),

  createLab: (title) => {
    const state = useAppStore.getState();
    const lab = buildLabFromState(state, title ?? "Untitled Lab");
    set({ currentLab: lab });
    return lab;
  },

  updateLabJournal: (journal) =>
    set((state) => {
      if (!state.currentLab) {
        return state;
      }
      return {
        currentLab: {
          ...state.currentLab,
          journal,
          updated_at: new Date().toISOString()
        }
      };
    }),

  updateLabTitle: (title) =>
    set((state) => {
      if (!state.currentLab) {
        return state;
      }
      return {
        currentLab: {
          ...state.currentLab,
          title: title.trim() || "Untitled Lab",
          updated_at: new Date().toISOString()
        }
      };
    }),

  addRunToLab: (run) =>
    set((state) => {
      const currentLab = state.currentLab ?? buildLabFromState(state);
      const now = new Date().toISOString();
      const record: LabRunRecord = {
        id: createId("run"),
        run_id: state.runId,
        title: `Run ${currentLab.runs.length + 1}`,
        created_at: now,
        problem: state.problemConfig,
        algorithms: state.algorithms,
        leaderboard: state.leaderboard,
        summary: state.runSummary,
        notes: "",
        ...run
      };
      return {
        currentLab: {
          ...currentLab,
          problem: state.problemConfig,
          algorithms: state.algorithms,
          pinned_metrics: state.pinnedMetrics,
          updated_at: now,
          runs: [record, ...currentLab.runs]
        }
      };
    }),

  setUserProfile: (profile) => {
    persistProfile(profile);
    set((state) => ({
      userProfile: profile,
      currentLab: state.currentLab
        ? { ...state.currentLab, profile, updated_at: new Date().toISOString() }
        : state.currentLab
    }));
  },

  setTab: (tab) => set({ tab }),

  setAlgorithmSpecs: (specs) =>
    set((state) => {
      const existing = new Map(state.algorithms.map((algo) => [algo.name, algo]));
      const specNames = new Set(specs.map((spec) => spec.name));
      const baseAlgorithms = specs.map((spec) => {
        const current = existing.get(spec.name);
        if (current) {
          return {
            ...current,
            hyperparams: { ...defaultsFromSchema(spec.hyperparams), ...current.hyperparams }
          };
        }
        return {
          id: createAlgorithmId(spec.name),
          name: spec.name,
          enabled: true,
          hyperparams: defaultsFromSchema(spec.hyperparams)
        };
      });
      const variants = state.algorithms.filter((algo) => specNames.has(algo.name) && algo.label);
      return { algorithmSpecs: specs, algorithms: [...baseAlgorithms, ...variants] };
    }),

  setProblems: (specs) => set({ problems: specs }),

  toggleAlgorithm: (algorithmId) =>
    set((state) => {
      const algorithms = state.algorithms.map((algo) =>
        algo.id === algorithmId ? { ...algo, enabled: !algo.enabled } : algo
      );
      return {
        algorithms,
        currentLab: state.currentLab
          ? { ...state.currentLab, algorithms, updated_at: new Date().toISOString() }
          : state.currentLab,
        configRevision: state.configRevision + 1
      };
    }),

  duplicateAlgorithm: (algorithmId) =>
    set((state) => {
      const source = state.algorithms.find((algo) => algo.id === algorithmId);
      if (!source) {
        return state;
      }
      const variantNumber = state.algorithms.filter((algo) => algo.name === source.name).length + 1;
      const algorithms = [...state.algorithms, cloneAlgorithm(source, variantNumber)];
      return {
        algorithms,
        currentLab: state.currentLab
          ? { ...state.currentLab, algorithms, updated_at: new Date().toISOString() }
          : state.currentLab,
        configRevision: state.configRevision + 1
      };
    }),

  updateHyperparam: (algorithmId, key, value) =>
    set((state) => {
      const algorithms = state.algorithms.map((algo) =>
        algo.id === algorithmId
          ? { ...algo, hyperparams: { ...algo.hyperparams, [key]: value } }
          : algo
      );
      return {
        algorithms,
        currentLab: state.currentLab
          ? { ...state.currentLab, algorithms, updated_at: new Date().toISOString() }
          : state.currentLab,
        configRevision: state.configRevision + 1
      };
    }),

  reorderAlgorithms: (draggedId, targetId) =>
    set((state) => {
      const current = [...state.algorithms];
      const from = current.findIndex((item) => item.id === draggedId);
      const to = current.findIndex((item) => item.id === targetId);
      if (from < 0 || to < 0 || from === to) {
        return state;
      }
      const [moved] = current.splice(from, 1);
      current.splice(to, 0, moved);
      return {
        algorithms: current,
        currentLab: state.currentLab
          ? { ...state.currentLab, algorithms: current, updated_at: new Date().toISOString() }
          : state.currentLab,
        configRevision: state.configRevision + 1
      };
    }),

  setProblemConfig: (patch) =>
    set((state) => {
      const problemConfig = { ...state.problemConfig, ...patch };
      return {
        problemConfig,
        currentLab: state.currentLab
          ? { ...state.currentLab, problem: problemConfig, updated_at: new Date().toISOString() }
          : state.currentLab,
        configRevision: state.configRevision + 1
      };
    }),

  addSnapshot: (message) =>
    set((state) => {
      const prev = state.snapshotsByAlgorithm[message.algorithm_id] ?? [];
      const merged = mergeSnapshotHistory(prev, message.snapshot);
      if (!merged.changed && state.algorithmNameById[message.algorithm_id] === message.algorithm_name) {
        return state;
      }
      return {
        snapshotsByAlgorithm: { ...state.snapshotsByAlgorithm, [message.algorithm_id]: merged.next },
        algorithmNameById: {
          ...state.algorithmNameById,
          [message.algorithm_id]: message.algorithm_name
        }
      };
    }),
  addSnapshotsBatch: (messages) =>
    set((state) => {
      if (messages.length === 0) {
        return state;
      }
      let changed = false;
      const snapshotsByAlgorithm = { ...state.snapshotsByAlgorithm };
      const algorithmNameById = { ...state.algorithmNameById };

      messages.forEach((message) => {
        const prev = snapshotsByAlgorithm[message.algorithm_id] ?? [];
        const merged = mergeSnapshotHistory(prev, message.snapshot);
        if (merged.changed) {
          snapshotsByAlgorithm[message.algorithm_id] = merged.next;
          changed = true;
        }
        if (algorithmNameById[message.algorithm_id] !== message.algorithm_name) {
          algorithmNameById[message.algorithm_id] = message.algorithm_name;
          changed = true;
        }
      });

      if (!changed) {
        return state;
      }
      return { snapshotsByAlgorithm, algorithmNameById };
    }),

  setLeaderboard: (rows) =>
    set((state) => {
      if (leaderboardEquals(state.leaderboard, rows)) {
        return state;
      }
      return { leaderboard: rows };
    }),
  setRunSummary: (summary) =>
    set((state) => {
      if (state.runSummary === summary) {
        return state;
      }
      return { runSummary: summary };
    }),
  setRunId: (runId) =>
    set((state) => {
      if (state.runId === runId) {
        return state;
      }
      return { runId };
    }),
  setRunning: (running) =>
    set((state) => {
      if (state.isRunning === running) {
        return state;
      }
      return { isRunning: running };
    }),
  setSocketError: (error) =>
    set((state) => {
      if (state.socketError === error) {
        return state;
      }
      return { socketError: error };
    }),

  resetRunData: () =>
    set({
      snapshotsByAlgorithm: {},
      algorithmNameById: {},
      leaderboard: [],
      runSummary: null,
      runId: null,
      replay: { enabled: false, playing: false, index: 0 },
      socketError: null
    }),

  togglePinnedMetric: (metric) =>
    set((state) => {
      if (state.pinnedMetrics.includes(metric)) {
        const pinnedMetrics = state.pinnedMetrics.filter((item) => item !== metric);
        return {
          pinnedMetrics,
          currentLab: state.currentLab
            ? { ...state.currentLab, pinned_metrics: pinnedMetrics, updated_at: new Date().toISOString() }
            : state.currentLab
        };
      }
      const pinnedMetrics = [...state.pinnedMetrics, metric];
      return {
        pinnedMetrics,
        currentLab: state.currentLab
          ? { ...state.currentLab, pinned_metrics: pinnedMetrics, updated_at: new Date().toISOString() }
          : state.currentLab
      };
    }),

  setReplayEnabled: (enabled) =>
    set((state) => ({
      replay: { ...state.replay, enabled, playing: enabled ? state.replay.playing : false, index: 0 }
    })),
  setReplayIndex: (index) => set((state) => ({ replay: { ...state.replay, index } })),
  setReplayPlaying: (playing) => set((state) => ({ replay: { ...state.replay, playing } })),
  setTheme: (theme) => {
    persistTheme(theme);
    set({ theme });
  },
  toggleTheme: () =>
    set((state) => {
      const nextTheme: ThemeMode = state.theme === "dark" ? "light" : "dark";
      persistTheme(nextTheme);
      return { theme: nextTheme };
    }),
  setLanguage: (language) => {
    persistLanguage(language);
    set({ language });
  },
  toggleLanguage: () =>
    set((state) => {
      const nextLanguage: AppLanguage = state.language === "fr" ? "en" : "fr";
      persistLanguage(nextLanguage);
      return { language: nextLanguage };
    })
}));

export const buildRunPayload = () => {
  const state = useAppStore.getState();
  const objectiveCount = state.problemConfig.n_obj ?? 4;
  return {
    problem: state.problemConfig,
    algorithms: state.algorithms
      .filter((algo) => algo.enabled)
      .filter((algo) => !(objectiveCount > 2 && algo.name === "SPEA2"))
      .map((algo) => ({
        id: algo.id,
        name: algo.name,
        label: algo.label,
        hyperparams: algo.hyperparams
      }))
  };
};

export const maxReplayGeneration = (): number => {
  const state = useAppStore.getState();
  let maxGeneration = 0;
  Object.values(state.snapshotsByAlgorithm).forEach((rows) => {
    const last = rows[rows.length - 1];
    if (last && last.generation > maxGeneration) {
      maxGeneration = last.generation;
    }
  });
  return maxGeneration;
};

export const selectSnapshotForView = (
  _algorithmId: string,
  snapshots: GenerationSnapshot[],
  replay: ReplayState
): GenerationSnapshot | null => {
  if (snapshots.length === 0) {
    return null;
  }
  if (!replay.enabled) {
    return snapshots[snapshots.length - 1];
  }
  const byGeneration = snapshots.find((snapshot) => snapshot.generation >= replay.index);
  return byGeneration ?? snapshots[snapshots.length - 1];
};

export const getAlgorithmSpec = (name: string): AlgorithmSpec | undefined => {
  return useAppStore.getState().algorithmSpecs.find((spec) => spec.name === name);
};
