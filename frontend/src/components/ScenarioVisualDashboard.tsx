import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis
} from "recharts";
import type { ScenarioResult } from "../types";

interface Props {
  results: ScenarioResult[];
  objectiveNames: string[];
  objectiveDirections: Record<string, "min" | "max">;
  objectiveTargets: Record<string, number>;
  isRunning?: boolean;
  completedAlgorithms?: number;
  totalAlgorithms?: number;
  sessionId?: number;
}

const CHART_COLORS = ["#29dba6", "#f18f01", "#6bb9ff", "#f45b69", "#9b5de5", "#80ed99", "#f9c74f", "#577590"];
const GRID_COLOR = "#214059";
const AXIS_COLOR = "#7da2b8";

const token = (value: string): string => value.toLowerCase().replace(/[^a-z0-9]/g, "");

const resolveObjectiveDirection = (
  objective: string,
  objectiveDirections: Record<string, "min" | "max">
): "min" | "max" => {
  if (objectiveDirections[objective]) {
    return objectiveDirections[objective];
  }
  const objectiveKey = token(objective);
  const match = Object.entries(objectiveDirections).find(([key]) => token(key) === objectiveKey);
  return match?.[1] ?? "min";
};

const resolveObjectiveTarget = (objective: string, objectiveTargets: Record<string, number>): number | null => {
  if (typeof objectiveTargets[objective] === "number") {
    return objectiveTargets[objective];
  }
  const objectiveKey = token(objective);
  const match = Object.entries(objectiveTargets).find(([key]) => token(key) === objectiveKey);
  return typeof match?.[1] === "number" ? match[1] : null;
};

const findObjectiveValue = (result: ScenarioResult, objective: string): number | null => {
  const objectiveKey = token(objective);
  const sources: Array<Record<string, number>> = [];
  if (result.objective_values) {
    sources.push(result.objective_values);
  }
  sources.push(result.best_objectives as Record<string, number>);
  for (const source of sources) {
    if (typeof source[objective] === "number") {
      return source[objective];
    }
    const match = Object.entries(source).find(([key]) => token(key) === objectiveKey);
    if (match && typeof match[1] === "number") {
      return match[1];
    }
  }
  return null;
};

const countTierAssignments = (result: ScenarioResult): Record<string, number> => {
  return result.schedule.reduce<Record<string, number>>((acc, assignment) => {
    acc[assignment.tier] = (acc[assignment.tier] ?? 0) + 1;
    return acc;
  }, {});
};

export const ScenarioVisualDashboard = ({
  results,
  objectiveNames,
  objectiveDirections,
  objectiveTargets,
  isRunning = false,
  completedAlgorithms = 0,
  totalAlgorithms = 0,
  sessionId = 0
}: Props) => {
  const [visibleCount, setVisibleCount] = useState(1);
  const [autoPlay, setAutoPlay] = useState(true);
  const [replaySpeed, setReplaySpeed] = useState(1);
  const [xObjective, setXObjective] = useState("");
  const [yObjective, setYObjective] = useState("");

  useEffect(() => {
    setVisibleCount(results.length > 0 ? 1 : 0);
    setAutoPlay(true);
    setReplaySpeed(1);
  }, [sessionId]);

  useEffect(() => {
    if (results.length === 0) {
      setVisibleCount(0);
      return;
    }
    setVisibleCount((previous) => Math.max(1, Math.min(previous, results.length)));
  }, [results.length]);

  useEffect(() => {
    if (!autoPlay || results.length <= 1 || visibleCount >= results.length) {
      return;
    }
    const delayMs = Math.max(80, Math.round(550 / Math.max(0.25, replaySpeed)));
    const timer = window.setTimeout(() => {
      setVisibleCount((previous) => Math.min(previous + 1, results.length));
    }, delayMs);
    return () => window.clearTimeout(timer);
  }, [autoPlay, replaySpeed, results.length, visibleCount]);

  const resolvedObjectives = useMemo(() => {
    if (objectiveNames.length > 0) {
      return objectiveNames;
    }
    if (results.length === 0) {
      return [];
    }
    const first = results[0];
    if (first.objective_values && Object.keys(first.objective_values).length > 0) {
      return Object.keys(first.objective_values);
    }
    return Object.keys(first.best_objectives ?? {});
  }, [objectiveNames, results]);

  useEffect(() => {
    if (resolvedObjectives.length === 0) {
      return;
    }
    const fallbackX = resolvedObjectives[0];
    const fallbackY = resolvedObjectives[Math.min(1, resolvedObjectives.length - 1)];
    setXObjective((previous) => (resolvedObjectives.includes(previous) ? previous : fallbackX));
    setYObjective((previous) => {
      if (resolvedObjectives.includes(previous) && previous !== fallbackX) {
        return previous;
      }
      return fallbackY;
    });
  }, [resolvedObjectives]);

  const visibleResults = useMemo(() => {
    if (results.length === 0) {
      return [];
    }
    return results.slice(0, Math.max(1, visibleCount));
  }, [results, visibleCount]);

  const xDirection = resolveObjectiveDirection(xObjective, objectiveDirections);
  const yDirection = resolveObjectiveDirection(yObjective, objectiveDirections);
  const xTarget = resolveObjectiveTarget(xObjective, objectiveTargets);
  const yTarget = resolveObjectiveTarget(yObjective, objectiveTargets);

  const paretoRows = useMemo(
    () =>
      visibleResults
        .map((result, index) => {
          const x = findObjectiveValue(result, xObjective);
          const y = findObjectiveValue(result, yObjective);
          if (x === null || y === null) {
            return null;
          }
          return {
            algorithm: result.algorithm_name,
            x,
            y,
            color: CHART_COLORS[index % CHART_COLORS.length]
          };
        })
        .filter((row): row is { algorithm: string; x: number; y: number; color: string } => row !== null),
    [visibleResults, xObjective, yObjective]
  );

  const objectiveStats = useMemo(() => {
    const stats = new Map<string, { min: number; max: number }>();
    resolvedObjectives.forEach((objective) => {
      const values = visibleResults
        .map((result) => findObjectiveValue(result, objective))
        .filter((value): value is number => typeof value === "number");
      if (values.length === 0) {
        return;
      }
      stats.set(objective, { min: Math.min(...values), max: Math.max(...values) });
    });
    return stats;
  }, [resolvedObjectives, visibleResults]);

  const radarRows = useMemo(
    () =>
      resolvedObjectives.map((objective) => {
        const row: Record<string, number | string> = { objective };
        const bounds = objectiveStats.get(objective);
        const direction = resolveObjectiveDirection(objective, objectiveDirections);
        visibleResults.forEach((result) => {
          const value = findObjectiveValue(result, objective);
          if (value === null || !bounds) {
            row[result.algorithm_name] = 0;
            return;
          }
          const range = Math.max(bounds.max - bounds.min, 1e-9);
          const betterHigh = direction === "max";
          const score = betterHigh ? (value - bounds.min) / range : (bounds.max - value) / range;
          row[result.algorithm_name] = Math.max(0, Math.min(1, score));
        });
        return row;
      }),
    [objectiveDirections, objectiveStats, resolvedObjectives, visibleResults]
  );

  const tierKeys = useMemo(() => {
    return Array.from(new Set(visibleResults.flatMap((result) => result.schedule.map((item) => item.tier))));
  }, [visibleResults]);

  const allocationRows = useMemo(
    () =>
      visibleResults.map((result) => {
        const counts = countTierAssignments(result);
        const row: Record<string, number | string> = { algorithm: result.algorithm_name };
        tierKeys.forEach((tier) => {
          row[tier] = counts[tier] ?? 0;
        });
        return row;
      }),
    [tierKeys, visibleResults]
  );

  const dynamicsRows = useMemo(
    () =>
      visibleResults.map((result, index) => {
        const generationSpeed =
          result.quality_metrics.generation_speed ??
          (result.elapsed_sec > 0 ? result.generation / result.elapsed_sec : 0);
        const targetSatisfaction = Math.max(2, (result.target_satisfaction ?? 0.25) * 100);
        return {
          algorithm: result.algorithm_name,
          runtime: result.elapsed_sec,
          generationSpeed,
          targetSatisfaction,
          color: CHART_COLORS[index % CHART_COLORS.length]
        };
      }),
    [visibleResults]
  );

  if (results.length === 0 && !isRunning) {
    return null;
  }

  if (results.length === 0 && isRunning) {
    return (
      <section className="rounded-2xl border border-stroke bg-card/70 p-4 shadow-glow">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="font-display text-base text-ice">Visual Scenario Insights</h3>
          <span className="text-xs text-slate">
            Progress: {completedAlgorithms}/{totalAlgorithms || 0}
          </span>
        </div>
        <p className="mb-3 text-xs text-slate">Preparing live charts. Results will appear progressively.</p>
        <div className="grid gap-4 xl:grid-cols-2">
          <div className="h-56 animate-pulse rounded-xl border border-stroke bg-ink/60" />
          <div className="h-56 animate-pulse rounded-xl border border-stroke bg-ink/60" />
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-stroke bg-card/70 p-4 shadow-glow">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-display text-base text-ice">Visual Scenario Insights</h3>
          <p className="text-xs text-slate">Graph-first comparison across objectives, allocation, and execution dynamics.</p>
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-stroke bg-ink/70 px-2 py-1">
          <span className="text-[11px] text-slate">
            Progress: {Math.min(completedAlgorithms, totalAlgorithms || completedAlgorithms)}/{totalAlgorithms || completedAlgorithms}
          </span>
          <button
            type="button"
            onClick={() => {
              setVisibleCount(1);
              setAutoPlay(true);
            }}
            className="rounded border border-stroke px-2 py-1 text-[11px] text-slate"
          >
            Replay
          </button>
          <button
            type="button"
            onClick={() => setAutoPlay((previous) => !previous)}
            className="rounded border border-stroke px-2 py-1 text-[11px] text-slate"
          >
            {autoPlay ? "Pause" : "Play"}
          </button>
          <label className="text-[11px] text-slate">
            Speed
            <select
              value={replaySpeed}
              onChange={(event) => setReplaySpeed(Number(event.target.value))}
              className="ml-1 rounded border border-stroke bg-card px-2 py-1 text-[11px] text-ice"
            >
              <option value={0.5}>0.5x</option>
              <option value={1}>1x</option>
              <option value={1.5}>1.5x</option>
              <option value={2}>2x</option>
              <option value={3}>3x</option>
              <option value={4}>4x</option>
            </select>
          </label>
          <input
            type="range"
            min={1}
            max={Math.max(1, results.length)}
            value={Math.min(Math.max(1, visibleCount), Math.max(1, results.length))}
            onChange={(event) => {
              setAutoPlay(false);
              setVisibleCount(Number(event.target.value));
            }}
            className="accent-accent"
          />
          <span className="text-[11px] text-slate">
            {Math.min(Math.max(1, visibleCount), Math.max(1, results.length))}/{results.length}
          </span>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <div className="rounded-xl border border-stroke bg-ink/60 p-3">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-slate">Common Pareto View</p>
            <div className="flex gap-2">
              <label className="text-[11px] text-slate">
                X
                <select
                  value={xObjective}
                  onChange={(event) => setXObjective(event.target.value)}
                  className="ml-1 rounded border border-stroke bg-card px-2 py-1 text-[11px] text-ice"
                >
                  {resolvedObjectives.map((objective) => (
                    <option key={objective} value={objective}>
                      {objective}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-[11px] text-slate">
                Y
                <select
                  value={yObjective}
                  onChange={(event) => setYObjective(event.target.value)}
                  className="ml-1 rounded border border-stroke bg-card px-2 py-1 text-[11px] text-ice"
                >
                  {resolvedObjectives.map((objective) => (
                    <option key={objective} value={objective}>
                      {objective}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 10, right: 10, left: 10, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} />
                <XAxis
                  type="number"
                  dataKey="x"
                  name={xObjective}
                  stroke={AXIS_COLOR}
                  tick={{ fontSize: 10 }}
                  label={{ value: `${xObjective} (${xDirection})`, position: "insideBottom", offset: -5, fill: AXIS_COLOR, fontSize: 10 }}
                />
                <YAxis
                  type="number"
                  dataKey="y"
                  name={yObjective}
                  stroke={AXIS_COLOR}
                  tick={{ fontSize: 10 }}
                  label={{ value: `${yObjective} (${yDirection})`, angle: -90, position: "insideLeft", fill: AXIS_COLOR, fontSize: 10 }}
                />
                {typeof xTarget === "number" && <ReferenceLine x={xTarget} stroke="#f9c74f" strokeDasharray="5 5" />}
                {typeof yTarget === "number" && <ReferenceLine y={yTarget} stroke="#f9c74f" strokeDasharray="5 5" />}
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 10 }} />
                {paretoRows.map((row) => (
                  <Scatter
                    key={row.algorithm}
                    name={row.algorithm}
                    data={[row]}
                    fill={row.color}
                    isAnimationActive
                    animationDuration={550}
                  />
                ))}
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-xl border border-stroke bg-ink/60 p-3">
          <p className="mb-2 text-xs text-slate">Objective Dominance Radar (normalized)</p>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={radarRows}>
                <PolarGrid stroke={GRID_COLOR} />
                <PolarAngleAxis dataKey="objective" tick={{ fill: AXIS_COLOR, fontSize: 10 }} />
                <PolarRadiusAxis domain={[0, 1]} tick={false} axisLine={false} />
                <Tooltip />
                {visibleResults.map((result, index) => (
                  <Radar
                    key={result.algorithm_name}
                    name={result.algorithm_name}
                    dataKey={result.algorithm_name}
                    stroke={CHART_COLORS[index % CHART_COLORS.length]}
                    fill={CHART_COLORS[index % CHART_COLORS.length]}
                    fillOpacity={0.16}
                    isAnimationActive
                    animationDuration={550}
                  />
                ))}
                <Legend wrapperStyle={{ fontSize: 10 }} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-xl border border-stroke bg-ink/60 p-3">
          <p className="mb-2 text-xs text-slate">Task Allocation by Environment Tier</p>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={allocationRows} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} />
                <XAxis dataKey="algorithm" stroke={AXIS_COLOR} tick={{ fontSize: 10 }} angle={-10} textAnchor="end" height={55} />
                <YAxis stroke={AXIS_COLOR} tick={{ fontSize: 10 }} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 10 }} />
                {tierKeys.map((tier, index) => (
                  <Bar
                    key={tier}
                    dataKey={tier}
                    stackId="allocation"
                    fill={CHART_COLORS[index % CHART_COLORS.length]}
                    isAnimationActive
                    animationDuration={550}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-xl border border-stroke bg-ink/60 p-3">
          <p className="mb-2 text-xs text-slate">Runtime vs Optimization Speed (bubble = target fit)</p>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 10, right: 10, left: 10, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} />
                <XAxis type="number" dataKey="runtime" stroke={AXIS_COLOR} tick={{ fontSize: 10 }} name="Runtime (s)" />
                <YAxis type="number" dataKey="generationSpeed" stroke={AXIS_COLOR} tick={{ fontSize: 10 }} name="Gen/s" />
                <ZAxis type="number" dataKey="targetSatisfaction" range={[90, 450]} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 10 }} />
                {dynamicsRows.map((row) => (
                  <Scatter
                    key={row.algorithm}
                    data={[row]}
                    name={row.algorithm}
                    fill={row.color}
                    isAnimationActive
                    animationDuration={550}
                  />
                ))}
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </section>
  );
};
