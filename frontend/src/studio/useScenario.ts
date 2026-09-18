import { useEffect, useRef, useState } from "react";
import { buildApiUrl, buildWsUrl } from "../lib/api";
import type { ScenarioEnvironment } from "../types";
import type { ScheduleRow, Solution } from "./plots";

export const defaultEnvironments: Record<string, ScenarioEnvironment> = {
  Edge: {
    devices: 2,
    processing_rate: 1000,
    processing_cost: 0.002,
    idle_power: 8,
    working_power: 30,
    uplink_bandwidth: 100,
    downlink_bandwidth: 100,
  },
  Fog: {
    devices: 2,
    processing_rate: 1800,
    processing_cost: 0.006,
    idle_power: 15,
    working_power: 75,
    uplink_bandwidth: 200,
    downlink_bandwidth: 200,
  },
  Cloud: {
    devices: 3,
    processing_rate: 3200,
    processing_cost: 0.012,
    idle_power: 35,
    working_power: 150,
    uplink_bandwidth: 300,
    downlink_bandwidth: 300,
  },
};
export interface ScenarioConfig {
  environments: Record<string, ScenarioEnvironment>;
  taskCount: number;
  workflowId: string;
  population: number;
  generations: number;
  repetitions: number;
}
export const initialScenario: ScenarioConfig = {
  environments: defaultEnvironments,
  taskCount: 12,
  workflowId: "",
  population: 40,
  generations: 20,
  repetitions: 1,
};

export function scenarioPayload(
  config: ScenarioConfig,
  algorithms: string[],
  seed: number,
) {
  return {
    environments: config.environments,
    workflow_id: config.workflowId || undefined,
    workflow_task_limit: config.workflowId ? config.taskCount : undefined,
    tasks: Array.from({ length: config.taskCount }, (_, i) => ({
      id: `T${i + 1}`,
      compute_demand: 250 + ((i * 137) % 1800),
      data_size: 4 + ((i * 3) % 20),
      parents: i > 1 ? [`T${Math.floor(i / 2)}`] : [],
    })),
    algorithms,
    population_size: config.population,
    generations: config.generations,
    repetitions: config.repetitions,
    base_seed: seed,
    objective_names: ["Latency", "Energy", "Cost"],
  };
}

export function useScenario() {
  const [config, setConfig] = useState<ScenarioConfig>(initialScenario);
  const [solutions, setSolutions] = useState<Solution[]>([]);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState({ completed: 0, total: 1 });
  const [runId, setRunId] = useState<string | null>(null);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const socket = useRef<WebSocket | null>(null);
  const payload = useRef<ReturnType<typeof scenarioPayload> | null>(null);
  const stop = () => {
    socket.current?.close();
    socket.current = null;
    setRunning(false);
  };
  useEffect(() => () => socket.current?.close(), []);
  const start = (algorithms: string[], seed: number) => {
    stop();
    setError(null);
    setSolutions([]);
    setResult(null);
    setRunId(null);
    setRunning(true);
    setProgress({
      completed: 0,
      total: algorithms.length * config.repetitions,
    });
    payload.current = scenarioPayload(config, algorithms, seed);
    const ws = new WebSocket(buildWsUrl("/ws/scenario"));
    socket.current = ws;
    ws.onopen = () =>
      ws.send(
        JSON.stringify({ type: "start_scenario", payload: payload.current }),
      );
    ws.onmessage = (event) => {
      if (socket.current !== ws) return;
      const message = JSON.parse(event.data);
      if (message.run_id) setRunId(message.run_id);
      if (message.completed_steps != null)
        setProgress({
          completed: message.completed_steps,
          total: message.total_steps,
        });
      if (message.type === "scenario_result") {
        const row = message.result;
        const next: Solution[] = (row.solutions ?? []).map(
          (s: {
            id: string;
            x: number[];
            objectives: Record<string, number>;
          }) => ({
            id: `${message.run_id}:${s.id}`,
            algorithm: row.algorithm_name,
            generation: row.generation,
            x: s.x,
            f: [s.objectives.Latency, s.objectives.Energy, s.objectives.Cost],
          }),
        );
        setSolutions((previous) => [...previous, ...next]);
      }
      if (message.type === "scenario_completed") {
        setResult(message.payload ?? message);
        setRunning(false);
      }
      if (message.type === "error" || message.type.endsWith("_error"))
        setError(message.error ?? "Une exécution a échoué.");
    };
    ws.onerror = () => setError("Connexion au moteur interrompue.");
    ws.onclose = () => {
      if (socket.current === ws) setRunning(false);
    };
  };
  const decode = async (
    solution: Solution,
    signal?: AbortSignal,
  ): Promise<ScheduleRow[]> => {
    const response = await fetch(buildApiUrl("/api/scenario/decode"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ request: payload.current, x: solution.x }),
      signal,
    });
    if (!response.ok) throw new Error("Impossible de décoder cette solution.");
    return (await response.json()).schedule;
  };
  return {
    config,
    setConfig,
    solutions,
    running,
    error,
    progress,
    start,
    stop,
    decode,
    runId,
    result,
  };
}
