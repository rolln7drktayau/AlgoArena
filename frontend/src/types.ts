export type ProblemKind = "builtin" | "expression" | "uploaded";

export interface HyperparamField {
  label: string;
  type: "int" | "float";
  min: number;
  max: number;
  step: number;
  default: number;
}

export interface AlgorithmSpec {
  name: string;
  source: "builtin" | "custom";
  module: string;
  hyperparams: Record<string, HyperparamField>;
}

export interface AlgorithmConfig {
  id: string;
  name: string;
  enabled: boolean;
  hyperparams: Record<string, number>;
}

export interface ProblemSpec {
  name: string;
  kind: ProblemKind;
  default_n_obj?: number;
  problem_id?: string;
  n_obj?: number;
  n_var?: number;
  objectives?: string[];
}

export interface ProblemConfig {
  kind: ProblemKind;
  name?: string;
  problem_id?: string;
  n_var?: number;
  n_obj?: number;
  xl?: number | number[];
  xu?: number | number[];
  objectives?: string[];
}

export interface PopulationMember {
  x: number[];
  f: number[];
}

export interface GenerationSnapshot {
  generation: number;
  elapsed_sec: number;
  population: PopulationMember[];
  metrics: Record<string, number | null>;
  heatmap: number[][];
  done: boolean;
}

export interface GenerationMessage {
  type: "generation";
  run_id: string;
  algorithm_id: string;
  algorithm_name: string;
  snapshot: GenerationSnapshot;
}

export interface LeaderboardEntry {
  rank: number;
  algorithm_id: string;
  algorithm_name: string;
  generation: number;
  elapsed_sec: number;
  hv: number | null;
  igd: number | null;
  igd_plus: number | null;
  gd?: number | null;
  gd_plus?: number | null;
  epsilon?: number | null;
  spread: number | null;
  spacing?: number | null;
  generation_speed?: number | null;
  hv_improvement?: number | null;
  hv_improvement_rate?: number | null;
  time_to_convergence: number | null;
  error?: string | null;
}

export interface LeaderboardMessage {
  type: "leaderboard";
  run_id: string;
  entries: LeaderboardEntry[];
}

export interface CompletedMessage {
  type: "completed";
  run_id: string;
  summary: RunSummary;
}

export interface RunSummary {
  best_overall: string | null;
  leaderboard: LeaderboardEntry[];
  radar: RadarRow[];
  algorithms: {
    algorithm_id: string;
    algorithm_name: string;
    metrics: Record<string, number | null>;
    generations: number;
    error?: string | null;
  }[];
}

export interface RadarRow {
  algorithm_name: string;
  hv: number;
  igd: number;
  igd_plus: number;
  gd?: number;
  epsilon?: number;
  spread: number;
  generation_speed?: number;
  time_to_convergence: number;
}

export interface RunStartedMessage {
  type: "run_started";
  run_id: string;
}

export interface ErrorMessage {
  type: "error" | "algorithm_error";
  error: string;
  algorithm_id?: string;
  algorithm_name?: string;
}

export type SocketMessage =
  | RunStartedMessage
  | GenerationMessage
  | LeaderboardMessage
  | CompletedMessage
  | ErrorMessage;

export interface ScenarioEnvironment {
  devices: number;
  processing_rate: number;
  processing_cost: number;
  idle_power: number;
  working_power: number;
  uplink_bandwidth: number;
  downlink_bandwidth: number;
}

export interface ScenarioResult {
  algorithm_name: string;
  best_objectives: {
    latency: number;
    cost: number;
    energy: number;
    makespan?: number;
    execution_speed?: number;
  };
  objective_values?: Record<string, number>;
  objective_directions?: Record<string, "min" | "max">;
  goal_distance?: number | null;
  target_satisfaction?: number | null;
  quality_metrics: Record<string, number | null>;
  schedule: { task_id: string; tier: string }[];
  generation: number;
  elapsed_sec: number;
}

export interface ScenarioObjectiveSpec {
  name: string;
  key?: string | null;
  expression?: string | null;
  direction: "min" | "max";
  target?: number | null;
}

export interface WorkflowSpec {
  workflow_id: string;
  name: string;
  family: string;
  size: number;
  task_count: number;
  edge_count: number;
  max_depth: number;
  source_file: string;
}
