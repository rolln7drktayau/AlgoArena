import { useEffect, useMemo, useState } from "react";
import { buildApiUrl } from "../lib/api";
import { useAppStore } from "../store/useAppStore";
import type { ScenarioEnvironment, ScenarioObjectiveSpec, ScenarioResult, WorkflowSpec } from "../types";
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

const defaultObjectiveRows: ObjectiveRow[] = [
  { id: "obj-latency", name: "Latency", key: "latency", direction: "min", target: "", expression: "" },
  { id: "obj-cost", name: "Cost", key: "cost", direction: "min", target: "", expression: "" },
  { id: "obj-energy", name: "Energy", key: "energy", direction: "min", target: "", expression: "" },
  { id: "obj-makespan", name: "Makespan", key: "makespan", direction: "min", target: "", expression: "" },
  { id: "obj-speed", name: "Execution Speed", key: "execution_speed", direction: "max", target: "", expression: "" }
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

export const ScenarioTab = () => {
  const allAlgorithms = useAppStore((state) => state.algorithms);
  const [rows, setRows] = useState<EnvRow[]>(defaultRows);
  const [taskCount, setTaskCount] = useState(20);
  const [workflowSpecs, setWorkflowSpecs] = useState<WorkflowSpec[]>([]);
  const [selectedWorkflowId, setSelectedWorkflowId] = useState("");
  const [workflowTaskLimit, setWorkflowTaskLimit] = useState<number | "">("");
  const [workflowLoadError, setWorkflowLoadError] = useState<string | null>(null);
  const [populationSize, setPopulationSize] = useState(80);
  const [generations, setGenerations] = useState(50);
  const [results, setResults] = useState<ScenarioResult[]>([]);
  const [resultObjectiveNames, setResultObjectiveNames] = useState<string[]>([]);
  const [resultObjectiveDirections, setResultObjectiveDirections] = useState<Record<string, "min" | "max">>({});
  const [resultObjectiveTargets, setResultObjectiveTargets] = useState<Record<string, number>>({});
  const [failedAlgorithms, setFailedAlgorithms] = useState<Array<{ algorithm_name: string; error: string }>>([]);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [objectiveRows, setObjectiveRows] = useState<ObjectiveRow[]>(defaultObjectiveRows);
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

  const updateEnv = (idx: number, key: keyof ScenarioEnvironment, value: number) => {
    setRows((prev) =>
      prev.map((row, rowIdx) =>
        rowIdx === idx ? { ...row, values: { ...row.values, [key]: Number.isFinite(value) ? value : 0 } } : row
      )
    );
  };

  const runScenario = async () => {
    setIsLoading(true);
    setFeedback(null);
    setResults([]);
    setResultObjectiveNames([]);
    setResultObjectiveDirections({});
    setResultObjectiveTargets({});
    setFailedAlgorithms([]);
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
    if (normalizedRows.length > 5) {
      setFeedback("Simulation failed: maximum 5 objectives are supported.");
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
    const payload = {
      environments: environmentPayload,
      tasks: selectedWorkflowId ? [] : makeSyntheticTasks(taskCount),
      algorithms: compatibleAlgorithms,
      population_size: populationSize,
      generations,
      objective_names: objectiveSpecs.map((item) => item.name),
      objective_targets: targetsPayload,
      objective_specs: objectiveSpecs,
      workflow_id: selectedWorkflowId || undefined,
      workflow_task_limit:
        selectedWorkflowId && workflowTaskLimit !== "" ? Number(workflowTaskLimit) : undefined
    };
    try {
      const response = await fetch(buildApiUrl("/api/scenario/simulate"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (!response.ok) {
        const detail = await response.text();
        setFeedback(`Simulation failed: ${detail}`);
        return;
      }
      const data = (await response.json()) as {
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
        results: ScenarioResult[];
        failed_algorithms: Array<{ algorithm_name: string; error: string }>;
      };
      setResults(data.results);
      setResultObjectiveNames(data.objective_names ?? []);
      setResultObjectiveTargets(data.objective_targets ?? {});
      setResultObjectiveDirections(data.objective_directions ?? {});
      setFailedAlgorithms(data.failed_algorithms ?? []);
      const workflowLabel = data.workflow?.name ? ` [Workflow: ${data.workflow.name}]` : "";
      setFeedback(
        `Simulated ${data.task_count} tasks${workflowLabel} across ${data.environments.join(", ")}. Success: ${data.results.length}, Failed: ${
          (data.failed_algorithms ?? []).length
        }${compatibleAlgorithms.length !== algorithms.length ? " (SPEA2 skipped for >2 objectives)." : ""}.`
      );
    } catch (error) {
      setFeedback(`Simulation failed: ${error instanceof Error ? error.message : "Unexpected error"}`);
    } finally {
      setIsLoading(false);
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

        <div className="mt-3 grid gap-3 lg:grid-cols-[1.5fr_1fr_1fr_1fr_auto]">
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
          <button
            type="button"
            onClick={runScenario}
            disabled={isLoading || algorithms.length === 0}
            className="h-fit rounded-md bg-accent px-3 py-2 text-xs font-semibold text-ink disabled:opacity-50 lg:self-end"
          >
            {isLoading ? "Simulating..." : "Simulate Scheduling"}
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
            Configure 2 to 5 objectives. Built-ins include latency, cost, energy, makespan, and execution speed.
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
              disabled={objectiveRows.length >= 5}
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
              onClick={() => setObjectiveRows(defaultObjectiveRows)}
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
      />
    </section>
  );
};
