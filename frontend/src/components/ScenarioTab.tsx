import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { buildApiUrl, buildWsUrl } from "../lib/api";
import { useAppStore } from "../store/useAppStore";
import type {
  ScenarioAttainmentPayload,
  ScenarioEnvironment,
  ScenarioObjectiveSpec,
  ScenarioResult,
  ScenarioRunSample,
  WorkflowSpec
} from "../types";
import { ScenarioVisualDashboard } from "./ScenarioVisualDashboard";

interface EnvRow {
  name: string;
  values: ScenarioEnvironment;
}

interface ObjectiveRow {
  id: string;
  name: string;
  key: string;
  direction: "min" | "max";
  target: string;
  expression: string;
}

const objectiveCatalog: Array<{ key: string; label: string; defaultDirection: "min" | "max" }> = [
  { key: "latency", label: "Latency", defaultDirection: "min" },
  { key: "cost", label: "Cost", defaultDirection: "min" },
  { key: "energy", label: "Energy", defaultDirection: "min" },
  { key: "makespan", label: "Makespan", defaultDirection: "min" },
  { key: "execution_speed", label: "Execution Speed", defaultDirection: "max" },
  { key: "avg_wait", label: "Average Wait", defaultDirection: "min" }
];

const createDefaultObjectiveRows = (): ObjectiveRow[] => [
  { id: "obj-latency", name: "Latency", key: "latency", direction: "min", target: "", expression: "" },
  { id: "obj-cost", name: "Cost", key: "cost", direction: "min", target: "", expression: "" },
  { id: "obj-energy", name: "Energy", key: "energy", direction: "min", target: "", expression: "" },
  { id: "obj-makespan", name: "Makespan", key: "makespan", direction: "min", target: "", expression: "" }
];

const defaultRows: EnvRow[] = [
  {
    name: "Edge",
    values: {
      devices: 5,
      processing_rate: 1000,
      processing_cost: 0.02,
      idle_power: 30,
      working_power: 700,
      uplink_bandwidth: 20480,
      downlink_bandwidth: 20480
    }
  },
  {
    name: "Fog",
    values: {
      devices: 5,
      processing_rate: 1300,
      processing_cost: 0.48,
      idle_power: 30,
      working_power: 700,
      uplink_bandwidth: 10000,
      downlink_bandwidth: 10000
    }
  },
  {
    name: "Cloud",
    values: {
      devices: 5,
      processing_rate: 1600,
      processing_cost: 0.96,
      idle_power: 1332,
      working_power: 1648,
      uplink_bandwidth: 100,
      downlink_bandwidth: 10000
    }
  }
];

const makeSyntheticTasks = (count: number) =>
  Array.from({ length: count }).map((_, index) => ({
    id: `T${index + 1}`,
    compute_demand: 250 + ((index * 137) % 1800),
    data_size: 40 + ((index * 53) % 600),
    deadline: 1.5 + ((index * 17) % 10)
  }));

interface ScenarioResponse {
  task_count: number;
  environments: string[];
  objective_names: string[];
  objective_targets: Record<string, number>;
  objective_directions: Record<string, "min" | "max">;
  workflow?: {
    workflow_id: string;
    name: string;
    family: string;
    task_count: number;
    available_task_count: number;
  } | null;
  repetitions?: number;
  base_seed?: number | null;
  results: ScenarioResult[];
  failed_algorithms: Array<{ algorithm_name: string; error: string }>;
  attainment?: ScenarioAttainmentPayload | null;
}

type ScenarioStreamMessage =
  | {
      type: "scenario_started";
      run_id: string;
      total_algorithms: number;
      completed_algorithms: number;
      total_steps?: number;
      completed_steps?: number;
      repetitions?: number;
      base_seed?: number | null;
      objective_names: string[];
      objective_targets: Record<string, number>;
      objective_directions: Record<string, "min" | "max">;
    }
  | {
      type: "scenario_repeat_result";
      run_id: string;
      algorithm_name: string;
      repeat_index: number;
      repetitions: number;
      total_algorithms: number;
      completed_algorithms: number;
      total_steps?: number;
      completed_steps?: number;
      sample: ScenarioRunSample;
    }
  | {
      type: "scenario_repeat_error";
      run_id: string;
      algorithm_name: string;
      repeat_index: number;
      repetitions: number;
      total_algorithms: number;
      completed_algorithms: number;
      total_steps?: number;
      completed_steps?: number;
      error: string;
    }
  | {
      type: "scenario_result";
      run_id: string;
      total_algorithms: number;
      completed_algorithms: number;
      total_steps?: number;
      completed_steps?: number;
      result: ScenarioResult;
    }
  | {
      type: "scenario_algorithm_error";
      run_id: string;
      total_algorithms: number;
      completed_algorithms: number;
      total_steps?: number;
      completed_steps?: number;
      algorithm_name: string;
      error: string;
    }
  | {
      type: "scenario_completed";
      run_id: string;
      payload: ScenarioResponse;
    }
  | {
      type: "scenario_error";
      run_id: string;
      error: string;
      payload?: ScenarioResponse;
    }
  | {
      type: "scenario_keepalive";
      run_id: string;
      total_algorithms?: number;
      completed_algorithms?: number;
      total_steps?: number;
      completed_steps?: number;
    }
  | {
      type: "error";
      error: string;
    };

const isRenderHosted = (): boolean => {
  if (typeof window === "undefined") {
    return false;
  }
  return window.location.hostname.endsWith("onrender.com");
};

const summarizeServerError = (raw: string): string => {
  const text = raw.trim();
  if (!text) {
    return "Unexpected server error.";
  }
  if (text.startsWith("<!DOCTYPE") || text.startsWith("<html")) {
    return "Gateway error (502): the hosted backend is temporarily unavailable or overloaded. Reduce workload and retry.";
  }
  try {
    const parsed = JSON.parse(text) as { detail?: string };
    if (typeof parsed.detail === "string" && parsed.detail.trim().length > 0) {
      return parsed.detail.trim();
    }
  } catch {
    // Ignore parse failures and continue with plain text fallback.
  }
  const noTags = text.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  return noTags.length > 240 ? `${noTags.slice(0, 240)}...` : noTags;
};

export const ScenarioTab = () => {
  const allAlgorithms = useAppStore((state) => state.algorithms);
  const [rows, setRows] = useState<EnvRow[]>(defaultRows);
  const [taskCount, setTaskCount] = useState(20);
  const [workflowSpecs, setWorkflowSpecs] = useState<WorkflowSpec[]>([]);
  const [selectedWorkflowId, setSelectedWorkflowId] = useState("");
  const [workflowTaskLimit, setWorkflowTaskLimit] = useState<number | "">("");
  const [workflowLoadError, setWorkflowLoadError] = useState<string | null>(null);
  const [populationSize, setPopulationSize] = useState(60);
  const [generations, setGenerations] = useState(30);
  const [repetitions, setRepetitions] = useState(2);
  const [baseSeed, setBaseSeed] = useState<number | "">(42);
  const [results, setResults] = useState<ScenarioResult[]>([]);
  const [resultObjectiveNames, setResultObjectiveNames] = useState<string[]>([]);
  const [resultObjectiveDirections, setResultObjectiveDirections] = useState<Record<string, "min" | "max">>({});
  const [resultObjectiveTargets, setResultObjectiveTargets] = useState<Record<string, number>>({});
  const [attainment, setAttainment] = useState<ScenarioAttainmentPayload | null>(null);
  const [failedAlgorithms, setFailedAlgorithms] = useState<Array<{ algorithm_name: string; error: string }>>([]);
  const [liveSamplesByAlgorithm, setLiveSamplesByAlgorithm] = useState<Record<string, ScenarioRunSample[]>>({});
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [streamProgress, setStreamProgress] = useState({ completed: 0, total: 0, stepCompleted: 0, stepTotal: 0 });
  const [scenarioSessionId, setScenarioSessionId] = useState(0);
  const [objectiveRows, setObjectiveRows] = useState<ObjectiveRow[]>(() => createDefaultObjectiveRows());
  const streamSocketRef = useRef<WebSocket | null>(null);
  const algorithms = useMemo(
    () => allAlgorithms.filter((algo) => algo.enabled).map((algo) => algo.name),
    [allAlgorithms]
  );
  const selectedWorkflow = useMemo(
    () => workflowSpecs.find((item) => item.workflow_id === selectedWorkflowId) ?? null,
    [selectedWorkflowId, workflowSpecs]
  );
  const workflowFamilies = useMemo(
    () => Array.from(new Set(workflowSpecs.map((workflow) => workflow.family))).sort(),
    [workflowSpecs]
  );

  const environmentPayload = useMemo(() => {
    const payload: Record<string, ScenarioEnvironment> = {};
    rows.forEach((row) => {
      payload[row.name] = row.values;
    });
    return payload;
  }, [rows]);

  useEffect(() => {
    const loadWorkflows = async () => {
      try {
        const response = await fetch(buildApiUrl("/api/workflows"));
        if (!response.ok) {
          setWorkflowLoadError(`Workflow API unavailable (${response.status}).`);
          return;
        }
        const data = (await response.json()) as { workflows: WorkflowSpec[] };
        const specs = data.workflows ?? [];
        setWorkflowSpecs(specs);
        setWorkflowLoadError(null);
        if (!selectedWorkflowId && specs.length > 0) {
          setSelectedWorkflowId(specs[0].workflow_id);
        }
      } catch {
        setWorkflowLoadError("Cannot load workflow presets from backend.");
      }
    };
    void loadWorkflows();
  }, []);

  useEffect(() => {
    return () => {
      const existingSocket = streamSocketRef.current;
      if (existingSocket) {
        existingSocket.close();
        streamSocketRef.current = null;
      }
    };
  }, []);

  const applyScenarioResponse = useCallback(
    (data: ScenarioResponse, compatibleAlgorithms: string[]) => {
      setResults(data.results ?? []);
      setLiveSamplesByAlgorithm(() =>
        Object.fromEntries((data.results ?? []).map((result) => [result.algorithm_name, result.run_samples ?? []]))
      );
      setResultObjectiveNames(data.objective_names ?? []);
      setResultObjectiveTargets(data.objective_targets ?? {});
      setResultObjectiveDirections(data.objective_directions ?? {});
      setAttainment(data.attainment ?? null);
      setFailedAlgorithms(data.failed_algorithms ?? []);
      setStreamProgress({
        completed: compatibleAlgorithms.length,
        total: compatibleAlgorithms.length,
        stepCompleted: compatibleAlgorithms.length * Math.max(1, data.repetitions ?? repetitions),
        stepTotal: compatibleAlgorithms.length * Math.max(1, data.repetitions ?? repetitions)
      });

      const workflowLabel = data.workflow?.name ? ` [Workflow: ${data.workflow.name}]` : "";
      setFeedback(
        `Simulated ${data.task_count} tasks${workflowLabel} across ${data.environments.join(", ")} with ${
          data.repetitions ?? repetitions
        } repeats. Success: ${
          (data.results ?? []).length
        }, Failed: ${(data.failed_algorithms ?? []).length}${
          compatibleAlgorithms.length !== algorithms.length ? " (SPEA2 skipped for >2 objectives)." : ""
        }.`
      );
    },
    [algorithms.length, repetitions]
  );

  const updateEnv = (idx: number, key: keyof ScenarioEnvironment, value: number) => {
    setRows((prev) =>
      prev.map((row, rowIdx) =>
        rowIdx === idx ? { ...row, values: { ...row.values, [key]: Number.isFinite(value) ? value : 0 } } : row
      )
    );
  };

  const clearScenarioRunState = useCallback(() => {
    setResults([]);
    setResultObjectiveNames([]);
    setResultObjectiveDirections({});
    setResultObjectiveTargets({});
    setAttainment(null);
    setFailedAlgorithms([]);
    setLiveSamplesByAlgorithm({});
    setStreamProgress({ completed: 0, total: 0, stepCompleted: 0, stepTotal: 0 });
  }, []);

  const resetSimulationRun = useCallback(
    (message = "Simulation run reset.") => {
      const existingSocket = streamSocketRef.current;
      if (existingSocket) {
        existingSocket.close();
        streamSocketRef.current = null;
      }
      setIsLoading(false);
      clearScenarioRunState();
      setScenarioSessionId((previous) => previous + 1);
      setFeedback(message);
    },
    [clearScenarioRunState]
  );

  const runScenario = async () => {
    const existingSocket = streamSocketRef.current;
    if (existingSocket) {
      existingSocket.close();
      streamSocketRef.current = null;
    }

    setIsLoading(true);
    setFeedback(null);
    clearScenarioRunState();
    setScenarioSessionId((previous) => previous + 1);

    const normalizedRows = objectiveRows
      .map((row, index) => {
        const name = row.name.trim() || `Objective ${index + 1}`;
        const expression = row.expression.trim();
        const key = row.key.trim();
        const direction = row.direction;
        const rawTarget = row.target.trim();
        const parsedTarget = rawTarget ? Number(rawTarget) : Number.NaN;
        const target = !Number.isNaN(parsedTarget) ? parsedTarget : undefined;
        return { ...row, name, key, expression, direction, target };
      })
      .filter((row) => row.name.length > 0);
    if (normalizedRows.length < 2) {
      setFeedback("Simulation failed: define at least two objectives.");
      setIsLoading(false);
      return;
    }

    const objectiveSpecs: ScenarioObjectiveSpec[] = normalizedRows.map((row) => ({
      name: row.name,
      key: row.key || undefined,
      expression: row.expression || undefined,
      direction: row.direction,
      target: row.target
    }));
    const targetsPayload: Record<string, number> = {};
    objectiveSpecs.forEach((spec) => {
      if (typeof spec.target === "number") {
        targetsPayload[spec.name] = spec.target;
      }
    });
    const compatibleAlgorithms = algorithms.filter((name) => !(objectiveSpecs.length > 2 && name === "SPEA2"));
    const normalizedRepetitions = Math.max(1, Math.min(30, Number(repetitions)));
    const normalizedBaseSeed =
      baseSeed === "" || Number.isNaN(Number(baseSeed)) ? undefined : Math.trunc(Number(baseSeed));
    const workloadScore = compatibleAlgorithms.length * normalizedRepetitions * Math.max(1, generations) * Math.max(1, populationSize);
    if (isRenderHosted() && workloadScore > 60_000) {
      setFeedback(
        "Simulation cancelled: workload is too high for hosted mode. Reduce algorithms, repetitions, generations, or population size."
      );
      setIsLoading(false);
      return;
    }
    setStreamProgress({
      completed: 0,
      total: compatibleAlgorithms.length,
      stepCompleted: 0,
      stepTotal: compatibleAlgorithms.length * normalizedRepetitions
    });
    const payload = {
      environments: environmentPayload,
      tasks: selectedWorkflowId ? [] : makeSyntheticTasks(taskCount),
      algorithms: compatibleAlgorithms,
      population_size: populationSize,
      generations,
      repetitions: normalizedRepetitions,
      base_seed: normalizedBaseSeed,
      objective_names: objectiveSpecs.map((item) => item.name),
      objective_targets: targetsPayload,
      objective_specs: objectiveSpecs,
      workflow_id: selectedWorkflowId || undefined,
      workflow_task_limit:
        selectedWorkflowId && workflowTaskLimit !== "" ? Number(workflowTaskLimit) : undefined
    };

    const runViaHttpFallback = async (reason: string) => {
      setFeedback(`Streaming unavailable (${reason}). Falling back to HTTP mode...`);
      const response = await fetch(buildApiUrl("/api/scenario/simulate"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (!response.ok) {
        const detail = await response.text();
        throw new Error(summarizeServerError(detail));
      }
      const data = (await response.json()) as ScenarioResponse;
      applyScenarioResponse(data, compatibleAlgorithms);
    };

    let streamEverStarted = false;
    const runViaStream = () =>
      new Promise<{ started: boolean }>((resolve, reject) => {
        const ws = new WebSocket(buildWsUrl("/ws/scenario"));
        streamSocketRef.current = ws;
        let settled = false;
        let started = false;

        const finish = (ok: boolean, errorMessage?: string) => {
          if (settled) {
            return;
          }
          settled = true;
          if (ok) {
            resolve({ started });
            return;
          }
          reject(new Error(errorMessage ?? "Scenario stream failed."));
        };

        ws.onopen = () => {
          ws.send(
            JSON.stringify({
              type: "start_scenario",
              payload
            })
          );
        };

        ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data) as ScenarioStreamMessage;
            if (message.type === "scenario_started") {
              started = true;
              streamEverStarted = true;
              setResultObjectiveNames(message.objective_names ?? []);
              setResultObjectiveTargets(message.objective_targets ?? {});
              setResultObjectiveDirections(message.objective_directions ?? {});
              setStreamProgress({
                completed: message.completed_algorithms ?? 0,
                total: message.total_algorithms ?? compatibleAlgorithms.length,
                stepCompleted: message.completed_steps ?? 0,
                stepTotal:
                  message.total_steps ?? (message.total_algorithms ?? compatibleAlgorithms.length) * Math.max(1, message.repetitions ?? repetitions)
              });
              setFeedback(
                `Scenario running... ${message.completed_steps ?? 0}/${
                  message.total_steps ?? (message.total_algorithms ?? compatibleAlgorithms.length) * Math.max(1, message.repetitions ?? repetitions)
                } repetitions complete.`
              );
              return;
            }

            if (message.type === "scenario_keepalive") {
              return;
            }

            if (message.type === "scenario_repeat_result") {
              setLiveSamplesByAlgorithm((previous) => {
                const current = previous[message.algorithm_name] ?? [];
                return {
                  ...previous,
                  [message.algorithm_name]: [...current, message.sample]
                };
              });
              setResults((previous) => {
                const existing = previous.find((item) => item.algorithm_name === message.algorithm_name);
                if (existing) {
                  return previous.map((item) =>
                    item.algorithm_name === message.algorithm_name
                      ? {
                          ...item,
                          objective_values: message.sample.objective_values,
                          quality_metrics: message.sample.quality_metrics,
                          elapsed_sec: message.sample.elapsed_sec,
                          generation: message.sample.generation,
                          run_samples: [...(item.run_samples ?? []), message.sample]
                        }
                      : item
                  );
                }
                const fallbackBestObjectives = {
                  latency: Number(message.sample.objective_values.Latency ?? 0),
                  cost: Number(message.sample.objective_values.Cost ?? 0),
                  energy: Number(message.sample.objective_values.Energy ?? 0),
                  makespan: Number(message.sample.objective_values.Makespan ?? 0),
                  execution_speed: Number(message.sample.objective_values["Execution Speed"] ?? 0)
                };
                const provisional: ScenarioResult = {
                  algorithm_name: message.algorithm_name,
                  best_objectives: fallbackBestObjectives,
                  objective_values: message.sample.objective_values,
                  quality_metrics: message.sample.quality_metrics,
                  schedule: [],
                  generation: message.sample.generation,
                  elapsed_sec: message.sample.elapsed_sec,
                  run_samples: [message.sample],
                  repeat_count: message.repetitions
                };
                return [...previous, provisional];
              });
              setStreamProgress({
                completed: message.completed_algorithms ?? 0,
                total: message.total_algorithms ?? compatibleAlgorithms.length,
                stepCompleted: message.completed_steps ?? message.repeat_index,
                stepTotal:
                  message.total_steps ?? (message.total_algorithms ?? compatibleAlgorithms.length) * Math.max(1, message.repetitions ?? repetitions)
              });
              setFeedback(
                `Scenario running... ${message.completed_steps ?? message.repeat_index}/${
                  message.total_steps ?? (message.total_algorithms ?? compatibleAlgorithms.length) * Math.max(1, message.repetitions ?? repetitions)
                } repetitions complete.`
              );
              return;
            }

            if (message.type === "scenario_repeat_error") {
              setStreamProgress({
                completed: message.completed_algorithms ?? 0,
                total: message.total_algorithms ?? compatibleAlgorithms.length,
                stepCompleted: message.completed_steps ?? message.repeat_index,
                stepTotal:
                  message.total_steps ?? (message.total_algorithms ?? compatibleAlgorithms.length) * Math.max(1, message.repetitions ?? repetitions)
              });
              setFeedback(
                `Scenario running... ${message.completed_steps ?? message.repeat_index}/${
                  message.total_steps ?? (message.total_algorithms ?? compatibleAlgorithms.length) * Math.max(1, message.repetitions ?? repetitions)
                } repetitions complete (with some errors).`
              );
              return;
            }

            if (message.type === "scenario_result") {
              setResults((previous) => {
                const next = previous.filter((item) => item.algorithm_name !== message.result.algorithm_name);
                next.push(message.result);
                return next;
              });
              setStreamProgress({
                completed: message.completed_algorithms ?? 0,
                total: message.total_algorithms ?? compatibleAlgorithms.length,
                stepCompleted: message.completed_steps ?? 0,
                stepTotal:
                  message.total_steps ?? (message.total_algorithms ?? compatibleAlgorithms.length) * Math.max(1, repetitions)
              });
              setFeedback(
                `Scenario running... ${message.completed_steps ?? 0}/${
                  message.total_steps ?? (message.total_algorithms ?? compatibleAlgorithms.length) * Math.max(1, repetitions)
                } repetitions complete.`
              );
              return;
            }

            if (message.type === "scenario_algorithm_error") {
              setFailedAlgorithms((previous) => [
                ...previous,
                { algorithm_name: message.algorithm_name, error: message.error }
              ]);
              setStreamProgress({
                completed: message.completed_algorithms ?? 0,
                total: message.total_algorithms ?? compatibleAlgorithms.length,
                stepCompleted: message.completed_steps ?? 0,
                stepTotal:
                  message.total_steps ?? (message.total_algorithms ?? compatibleAlgorithms.length) * Math.max(1, repetitions)
              });
              setFeedback(
                `Scenario running... ${message.completed_steps ?? 0}/${
                  message.total_steps ?? (message.total_algorithms ?? compatibleAlgorithms.length) * Math.max(1, repetitions)
                } repetitions complete.`
              );
              return;
            }

            if (message.type === "scenario_completed") {
              applyScenarioResponse(message.payload, compatibleAlgorithms);
              ws.close();
              finish(true);
              return;
            }

            if (message.type === "scenario_error" || message.type === "error") {
              ws.close();
              finish(false, message.error);
            }
          } catch {
            ws.close();
            finish(false, "Invalid scenario stream message.");
          }
        };

        ws.onerror = () => {
          finish(false, "WebSocket connection error");
        };

        ws.onclose = () => {
          if (streamSocketRef.current === ws) {
            streamSocketRef.current = null;
          }
          if (!settled) {
            finish(false, "WebSocket closed before completion");
          }
        };
      });

    try {
      await runViaStream();
    } catch (streamError) {
      const streamMessage = streamError instanceof Error ? streamError.message : "unknown stream error";
      if (streamEverStarted) {
        setFeedback(
          `Simulation stream interrupted: ${streamMessage}. Try again with a smaller workload (fewer algorithms/repetitions).`
        );
        return;
      }
      try {
        const firstTry = await runViaStream();
        if (firstTry.started) {
          return;
        }
      } catch {
        // Ignore retry errors and continue fallback decision.
      }

      if (isRenderHosted()) {
        setFeedback(
          `Simulation failed: ${streamMessage}. Hosted backend may be overloaded. Reduce workload and retry.`
        );
        return;
      }
      try {
        await runViaHttpFallback(streamMessage);
      } catch (httpError) {
        const message = httpError instanceof Error ? httpError.message : "Unexpected error";
        setFeedback(`Simulation failed: ${summarizeServerError(message)}`);
      }
    } finally {
      setIsLoading(false);
      const socketAtEnd = streamSocketRef.current;
      if (socketAtEnd) {
        socketAtEnd.close();
        streamSocketRef.current = null;
      }
    }
  };

  return (
    <section className="space-y-4">
      <div className="rounded-2xl border border-stroke bg-card/70 p-4 shadow-glow">
        <h2 className="font-display text-lg text-ice">Scenario Simulator (Edge/Fog/Cloud)</h2>
        <p className="mt-1 text-xs text-slate">
          Define environment tiers, optionally load a scientific workflow preset, then compare scheduling plans.
        </p>
        <p className="mt-1 text-[11px] text-slate">
          Workflows loaded: {workflowSpecs.length} {workflowFamilies.length > 0 && `(${workflowFamilies.join(", ")})`}
        </p>
        {workflowLoadError && <p className="mt-1 text-[11px] text-rose-300">{workflowLoadError}</p>}

        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-left text-xs text-slate">
            <thead>
              <tr className="border-b border-stroke text-[10px] uppercase tracking-wide">
                <th className="px-2 py-2">Tier</th>
                <th className="px-2 py-2">Devices</th>
                <th className="px-2 py-2">Rate</th>
                <th className="px-2 py-2">Cost</th>
                <th className="px-2 py-2">Idle</th>
                <th className="px-2 py-2">Working</th>
                <th className="px-2 py-2">Up</th>
                <th className="px-2 py-2">Down</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={`${row.name}-${index}`} className="border-b border-stroke/50">
                  <td className="px-2 py-2">
                    <input
                      className="w-20 rounded border border-stroke bg-ink px-1 py-1 text-ice"
                      value={row.name}
                      onChange={(event) =>
                        setRows((prev) =>
                          prev.map((item, idx) => (idx === index ? { ...item, name: event.target.value } : item))
                        )
                      }
                    />
                  </td>
                  {(
                    [
                      "devices",
                      "processing_rate",
                      "processing_cost",
                      "idle_power",
                      "working_power",
                      "uplink_bandwidth",
                      "downlink_bandwidth"
                    ] as (keyof ScenarioEnvironment)[]
                  ).map((key) => (
                    <td key={key} className="px-2 py-2">
                      <input
                        type="number"
                        value={row.values[key]}
                        onChange={(event) => updateEnv(index, key, Number(event.target.value))}
                        className="w-20 rounded border border-stroke bg-ink px-1 py-1 text-ice"
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-3 grid gap-3 lg:grid-cols-[1.5fr_repeat(6,minmax(0,1fr))]">
          <label className="text-xs text-slate">
            Workflow Preset
            <select
              value={selectedWorkflowId}
              onChange={(event) => setSelectedWorkflowId(event.target.value)}
              className="mt-1 w-full rounded border border-stroke bg-ink px-2 py-2 text-xs text-ice"
            >
              <option value="">Manual synthetic tasks</option>
              {workflowSpecs.map((workflow) => (
                <option key={workflow.workflow_id} value={workflow.workflow_id}>
                  {workflow.name} ({workflow.task_count} tasks)
                </option>
              ))}
            </select>
          </label>
          {selectedWorkflowId ? (
            <label className="text-xs text-slate">
              Workflow Task Limit
              <input
                type="number"
                min={1}
                max={selectedWorkflow?.task_count ?? 5000}
                value={workflowTaskLimit}
                onChange={(event) => {
                  const next = event.target.value.trim();
                  if (!next) {
                    setWorkflowTaskLimit("");
                    return;
                  }
                  const parsed = Number(next);
                  if (!Number.isNaN(parsed)) {
                    setWorkflowTaskLimit(parsed);
                  }
                }}
                className="mt-1 w-full rounded border border-stroke bg-ink px-2 py-2 text-xs text-ice"
                placeholder={`Max ${selectedWorkflow?.task_count ?? "-"}`}
              />
            </label>
          ) : (
            <label className="text-xs text-slate">
              Tasks
              <input
                type="number"
                min={5}
                max={100}
                value={taskCount}
                onChange={(event) => setTaskCount(Number(event.target.value))}
                className="mt-1 w-full rounded border border-stroke bg-ink px-2 py-2 text-xs text-ice"
              />
            </label>
          )}
          <button
            type="button"
            onClick={() =>
              setRows((prev) => [
                ...prev,
                {
                  name: `Tier${prev.length + 1}`,
                  values: {
                    devices: 2,
                    processing_rate: 900,
                    processing_cost: 0.2,
                    idle_power: 40,
                    working_power: 450,
                    uplink_bandwidth: 3000,
                    downlink_bandwidth: 3000
                  }
                }
              ])
            }
            className="h-fit rounded-md bg-ember px-3 py-2 text-xs font-semibold text-ink lg:self-end"
          >
            Add Environment Tier
          </button>
          <label className="text-xs text-slate">
            Population
            <input
              type="number"
              min={20}
              max={300}
              value={populationSize}
              onChange={(event) => setPopulationSize(Number(event.target.value))}
              className="mt-1 w-full rounded border border-stroke bg-ink px-2 py-2 text-xs text-ice"
            />
          </label>
          <label className="text-xs text-slate">
            Generations
            <input
              type="number"
              min={5}
              max={300}
              value={generations}
              onChange={(event) => setGenerations(Number(event.target.value))}
              className="mt-1 w-full rounded border border-stroke bg-ink px-2 py-2 text-xs text-ice"
            />
          </label>
          <label className="text-xs text-slate">
            Repetitions
            <input
              type="number"
              min={1}
              max={30}
              value={repetitions}
              onChange={(event) => setRepetitions(Number(event.target.value))}
              className="mt-1 w-full rounded border border-stroke bg-ink px-2 py-2 text-xs text-ice"
            />
          </label>
          <label className="text-xs text-slate">
            Base Seed
            <input
              type="number"
              value={baseSeed}
              onChange={(event) => {
                const next = event.target.value.trim();
                if (!next) {
                  setBaseSeed("");
                  return;
                }
                const parsed = Number(next);
                if (!Number.isNaN(parsed)) {
                  setBaseSeed(parsed);
                }
              }}
              className="mt-1 w-full rounded border border-stroke bg-ink px-2 py-2 text-xs text-ice"
              placeholder="optional"
            />
          </label>
          <button
            type="button"
            onClick={runScenario}
            disabled={isLoading || algorithms.length === 0}
            className="h-fit rounded-md bg-accent px-3 py-2 text-xs font-semibold text-ink disabled:opacity-50 lg:self-end"
          >
            {isLoading ? "Simulating..." : "Simulate Scheduling"}
          </button>
          <button
            type="button"
            onClick={() => resetSimulationRun()}
            className="h-fit rounded-md border border-stroke px-3 py-2 text-xs font-semibold text-slate lg:self-end"
          >
            Reset Simulation Run
          </button>
        </div>
        {selectedWorkflow && (
          <p className="mt-2 text-[11px] text-slate">
            Selected workflow: {selectedWorkflow.family} | Tasks: {selectedWorkflow.task_count} | Edges:{" "}
            {selectedWorkflow.edge_count} | Depth: {selectedWorkflow.max_depth}
          </p>
        )}

        <div className="mt-4 rounded-lg border border-stroke bg-ink/50 p-3">
          <h4 className="font-display text-sm text-ice">Objectives (Manual)</h4>
          <p className="mt-1 text-[11px] text-slate">
            Configure at least 2 objectives (default: 4). Built-ins include latency, cost, energy, makespan, and execution speed.
            You can also define expression-based objectives.
          </p>
          <div className="mt-3 space-y-2">
            {objectiveRows.map((row, idx) => (
              <div key={row.id} className="grid gap-2 rounded border border-stroke/60 p-2 md:grid-cols-6">
                <label className="text-[11px] text-slate">
                  Name
                  <input
                    value={row.name}
                    onChange={(event) =>
                      setObjectiveRows((prev) =>
                        prev.map((item, j) => (j === idx ? { ...item, name: event.target.value } : item))
                      )
                    }
                    className="mt-1 w-full rounded border border-stroke bg-ink px-2 py-1 text-xs text-ice"
                  />
                </label>
                <label className="text-[11px] text-slate">
                  Key
                  <select
                    value={row.key}
                    onChange={(event) =>
                      setObjectiveRows((prev) =>
                        prev.map((item, j) =>
                          j === idx
                            ? {
                                ...item,
                                key: event.target.value,
                                direction:
                                  objectiveCatalog.find((entry) => entry.key === event.target.value)?.defaultDirection ??
                                  item.direction
                              }
                            : item
                        )
                      )
                    }
                    className="mt-1 w-full rounded border border-stroke bg-ink px-2 py-1 text-xs text-ice"
                  >
                    <option value="">Custom expression</option>
                    {objectiveCatalog.map((entry) => (
                      <option key={entry.key} value={entry.key}>
                        {entry.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-[11px] text-slate">
                  Direction
                  <select
                    value={row.direction}
                    onChange={(event) =>
                      setObjectiveRows((prev) =>
                        prev.map((item, j) =>
                          j === idx ? { ...item, direction: event.target.value as "min" | "max" } : item
                        )
                      )
                    }
                    className="mt-1 w-full rounded border border-stroke bg-ink px-2 py-1 text-xs text-ice"
                  >
                    <option value="min">Minimize</option>
                    <option value="max">Maximize</option>
                  </select>
                </label>
                <label className="text-[11px] text-slate">
                  Target
                  <input
                    type="number"
                    value={row.target}
                    onChange={(event) =>
                      setObjectiveRows((prev) =>
                        prev.map((item, j) => (j === idx ? { ...item, target: event.target.value } : item))
                      )
                    }
                    className="mt-1 w-full rounded border border-stroke bg-ink px-2 py-1 text-xs text-ice"
                  />
                </label>
                <label className="text-[11px] text-slate md:col-span-2">
                  Expression
                  <input
                    value={row.expression}
                    onChange={(event) =>
                      setObjectiveRows((prev) =>
                        prev.map((item, j) => (j === idx ? { ...item, expression: event.target.value } : item))
                      )
                    }
                    className="mt-1 w-full rounded border border-stroke bg-ink px-2 py-1 text-xs text-ice"
                    placeholder="e.g. 0.6*latency + 0.4*cost"
                  />
                </label>
                <div className="md:col-span-6">
                  <button
                    type="button"
                    disabled={objectiveRows.length <= 2}
                    onClick={() => setObjectiveRows((prev) => prev.filter((_, j) => j !== idx))}
                    className="rounded border border-rose-400/50 px-2 py-1 text-[11px] text-rose-200 disabled:opacity-40"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() =>
                setObjectiveRows((prev) => [
                  ...prev,
                  {
                    id: `obj-${Date.now()}-${prev.length + 1}`,
                    name: `Objective ${prev.length + 1}`,
                    key: "",
                    direction: "min",
                    target: "",
                    expression: ""
                  }
                ])
              }
              className="rounded border border-stroke px-3 py-1 text-xs text-slate disabled:opacity-40"
            >
              Add Objective
            </button>
            <button
              type="button"
              onClick={() => setObjectiveRows(createDefaultObjectiveRows())}
              className="rounded border border-stroke px-3 py-1 text-xs text-slate"
            >
              Reset
            </button>
          </div>
        </div>
        {feedback && <p className="mt-2 text-xs text-accent">{feedback}</p>}
        {failedAlgorithms.length > 0 && (
          <div className="mt-2 rounded border border-rose-400/40 bg-rose-950/30 p-2 text-xs text-rose-100">
            {failedAlgorithms.map((item) => (
              <div key={`${item.algorithm_name}-${item.error}`}>
                {item.algorithm_name}: {item.error}
              </div>
            ))}
          </div>
        )}
      </div>

      <ScenarioVisualDashboard
        results={results}
        objectiveNames={resultObjectiveNames}
        objectiveDirections={resultObjectiveDirections}
        objectiveTargets={resultObjectiveTargets}
        attainment={attainment}
        liveSamplesByAlgorithm={liveSamplesByAlgorithm}
        isRunning={isLoading}
        completedAlgorithms={streamProgress.completed}
        totalAlgorithms={streamProgress.total}
        completedSteps={streamProgress.stepCompleted}
        totalSteps={streamProgress.stepTotal}
        sessionId={scenarioSessionId}
      />
    </section>
  );
};
