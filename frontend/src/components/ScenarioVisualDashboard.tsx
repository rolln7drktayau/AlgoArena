import { useEffect, useMemo, useRef, useState } from "react";
import {
  CartesianGrid,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { downsampleScatterPoints, prepareParallelLines } from "../lib/chartWorker";
import type {
  ScenarioAttainmentPayload,
  ScenarioResult,
  ScenarioRunSample,
  ScenarioStatSummary
} from "../types";

interface Props {
  results: ScenarioResult[];
  objectiveNames: string[];
  objectiveDirections: Record<string, "min" | "max">;
  objectiveTargets: Record<string, number>;
  attainment?: ScenarioAttainmentPayload | null;
  liveSamplesByAlgorithm?: Record<string, ScenarioRunSample[]>;
  isRunning?: boolean;
  completedAlgorithms?: number;
  totalAlgorithms?: number;
  completedSteps?: number;
  totalSteps?: number;
  sessionId?: number;
}

interface ParetoPoint {
  x: number;
  y: number;
  algorithm: string;
  color: string;
  mean?: boolean;
}

const COLORS = ["#29dba6", "#f18f01", "#6bb9ff", "#f45b69", "#9b5de5", "#80ed99"];
const AXIS = "#7da2b8";
const GRID = "#214059";

const token = (value: string): string => value.toLowerCase().replace(/[^a-z0-9]/g, "");

const findInMap = (source: Record<string, number>, key: string): number | null => {
  if (typeof source[key] === "number") {
    return source[key];
  }
  const match = Object.entries(source).find(([name]) => token(name) === token(key));
  return typeof match?.[1] === "number" ? match[1] : null;
};

const getObjectiveValue = (result: ScenarioResult, objective: string): number | null => {
  if (result.objective_values) {
    const value = findInMap(result.objective_values, objective);
    if (value !== null) {
      return value;
    }
  }
  return findInMap(result.best_objectives as Record<string, number>, objective);
};

const getObjectiveStat = (result: ScenarioResult, objective: string): ScenarioStatSummary | null => {
  const stats = result.repeat_stats?.objectives ?? {};
  if (stats[objective]) {
    return stats[objective];
  }
  const match = Object.entries(stats).find(([name]) => token(name) === token(objective));
  return match?.[1] ?? null;
};

const getMetricStat = (result: ScenarioResult, metric: string): ScenarioStatSummary | null => {
  const stats = result.repeat_stats?.metrics ?? {};
  if (stats[metric]) {
    return stats[metric];
  }
  const match = Object.entries(stats).find(([name]) => token(name) === token(metric));
  return match?.[1] ?? null;
};

const resolveDirection = (objective: string, directions: Record<string, "min" | "max">): "min" | "max" => {
  if (directions[objective]) {
    return directions[objective];
  }
  const match = Object.entries(directions).find(([name]) => token(name) === token(objective));
  return match?.[1] ?? "min";
};

const resolveTarget = (objective: string, targets: Record<string, number>): number | null => {
  if (typeof targets[objective] === "number") {
    return targets[objective];
  }
  const match = Object.entries(targets).find(([name]) => token(name) === token(objective));
  return typeof match?.[1] === "number" ? match[1] : null;
};

const downloadBlob = (name: string, blob: Blob) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
};

const svgFromRef = (ref: React.RefObject<HTMLDivElement>): SVGSVGElement | null => ref.current?.querySelector("svg") ?? null;

const exportSvg = (ref: React.RefObject<HTMLDivElement>, name: string) => {
  const svg = svgFromRef(ref);
  if (!svg) {
    return;
  }
  const text = new XMLSerializer().serializeToString(svg);
  downloadBlob(name, new Blob([text], { type: "image/svg+xml;charset=utf-8" }));
};

const exportPng = async (ref: React.RefObject<HTMLDivElement>, name: string): Promise<void> => {
  const svg = svgFromRef(ref);
  if (!svg) {
    return;
  }
  const text = new XMLSerializer().serializeToString(svg);
  const url = URL.createObjectURL(new Blob([text], { type: "image/svg+xml;charset=utf-8" }));
  const img = new Image();
  await new Promise<void>((resolve, reject) => {
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(640, svg.clientWidth || 640);
      canvas.height = Math.max(360, svg.clientHeight || 360);
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        URL.revokeObjectURL(url);
        reject(new Error("Canvas unavailable"));
        return;
      }
      ctx.fillStyle = "rgba(8,15,22,1)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((blob) => {
        URL.revokeObjectURL(url);
        if (!blob) {
          reject(new Error("PNG export failed"));
          return;
        }
        downloadBlob(name, blob);
        resolve();
      }, "image/png");
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("SVG load failed"));
    };
    img.src = url;
  });
};

const buildLatex = (results: ScenarioResult[], objectives: string[]): string => {
  const headers = ["Algorithm", ...objectives, "HV", "IGD", "Speed", "Elapsed"];
  const rows = results.map((result) => {
    const objectiveCells = objectives.map((objective) => {
      const stat = getObjectiveStat(result, objective);
      const mean = stat?.mean ?? getObjectiveValue(result, objective);
      const half = stat ? (stat.ci95_high - stat.ci95_low) / 2 : 0;
      return mean !== null ? `${mean.toFixed(4)} \\\\pm ${half.toFixed(4)}` : "-";
    });
    const hv = getMetricStat(result, "hv");
    const igd = getMetricStat(result, "igd");
    const speed = getMetricStat(result, "generation_speed");
    const hvValue = hv ? `${hv.mean.toFixed(4)} \\\\pm ${((hv.ci95_high - hv.ci95_low) / 2).toFixed(4)}` : "-";
    const igdValue = igd ? `${igd.mean.toFixed(4)} \\\\pm ${((igd.ci95_high - igd.ci95_low) / 2).toFixed(4)}` : "-";
    const speedValue = speed ? `${speed.mean.toFixed(4)} \\\\pm ${((speed.ci95_high - speed.ci95_low) / 2).toFixed(4)}` : "-";
    const elapsed = result.repeat_stats?.elapsed_sec;
    const elapsedValue = elapsed
      ? `${elapsed.mean.toFixed(4)} \\\\pm ${((elapsed.ci95_high - elapsed.ci95_low) / 2).toFixed(4)}`
      : result.elapsed_sec.toFixed(4);
    return [result.algorithm_name, ...objectiveCells, hvValue, igdValue, speedValue, elapsedValue].join(" & ");
  });
  return [
    "\\begin{table}[ht]",
    "\\centering",
    `\\begin{tabular}{l${"c".repeat(headers.length - 1)}}`,
    "\\hline",
    `${headers.join(" & ")} \\\\`,
    "\\hline",
    ...rows.map((row) => `${row} \\\\`),
    "\\hline",
    "\\end{tabular}",
    "\\caption{Scenario comparison with 95\\% confidence intervals}",
    "\\end{table}"
  ].join("\n");
};

export const ScenarioVisualDashboard = ({
  results,
  objectiveNames,
  objectiveDirections,
  objectiveTargets,
  attainment = null,
  liveSamplesByAlgorithm = {},
  isRunning = false,
  completedAlgorithms = 0,
  totalAlgorithms = 0,
  completedSteps = 0,
  totalSteps = 0,
  sessionId = 0
}: Props) => {
  const [visibleCount, setVisibleCount] = useState(1);
  const [replaySpeed, setReplaySpeed] = useState(1);
  const [autoPlay, setAutoPlay] = useState(true);
  const [xObjective, setXObjective] = useState("");
  const [yObjective, setYObjective] = useState("");
  const [ciKey, setCiKey] = useState("");
  const [paretoRows, setParetoRows] = useState<ParetoPoint[]>([]);
  const [parallelRows, setParallelRows] = useState<Array<{ algorithm: string; values: number[] }>>([]);
  const [parallelExtents, setParallelExtents] = useState<Array<{ min: number; max: number }>>([]);
  const [selectedAttAlgo, setSelectedAttAlgo] = useState("");
  const [selectedAttLevel, setSelectedAttLevel] = useState(0.5);

  const paretoRef = useRef<HTMLDivElement>(null);
  const ciRef = useRef<HTMLDivElement>(null);
  const parallelRef = useRef<HTMLDivElement>(null);
  const attainmentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setVisibleCount(results.length > 0 ? 1 : 0);
    setReplaySpeed(1);
    setAutoPlay(true);
  }, [sessionId, results.length]);

  useEffect(() => {
    if (!autoPlay || results.length <= 1 || visibleCount >= results.length) {
      return;
    }
    const delay = Math.max(80, Math.round(550 / Math.max(0.25, replaySpeed)));
    const timer = window.setTimeout(() => setVisibleCount((v) => Math.min(v + 1, results.length)), delay);
    return () => window.clearTimeout(timer);
  }, [autoPlay, replaySpeed, results.length, visibleCount]);

  const visibleResults = useMemo(() => results.slice(0, Math.max(1, visibleCount)), [results, visibleCount]);

  const objectives = useMemo(() => {
    if (objectiveNames.length > 0) {
      return objectiveNames;
    }
    if (results.length === 0) {
      return [];
    }
    return Object.keys(results[0].objective_values ?? results[0].best_objectives ?? {});
  }, [objectiveNames, results]);

  useEffect(() => {
    if (objectives.length === 0) {
      return;
    }
    setXObjective((v) => (objectives.includes(v) ? v : objectives[0]));
    setYObjective((v) => (objectives.includes(v) ? v : objectives[Math.min(1, objectives.length - 1)]));
  }, [objectives]);

  const sampleMap = useMemo(() => {
    const map = new Map<string, ScenarioRunSample[]>();
    visibleResults.forEach((result) => map.set(result.algorithm_name, result.run_samples ?? []));
    Object.entries(liveSamplesByAlgorithm).forEach(([algorithm, samples]) => {
      const merged = [...(map.get(algorithm) ?? []), ...samples];
      const unique = new Map<number, ScenarioRunSample>();
      merged.forEach((sample) => unique.set(sample.repeat_index, sample));
      map.set(algorithm, Array.from(unique.values()).sort((a, b) => a.repeat_index - b.repeat_index));
    });
    return map;
  }, [liveSamplesByAlgorithm, visibleResults]);

  const paretoSource = useMemo(() => {
    const rows: ParetoPoint[] = [];
    visibleResults.forEach((result, index) => {
      const color = COLORS[index % COLORS.length];
      const samples = sampleMap.get(result.algorithm_name) ?? [];
      samples.forEach((sample) => {
        const x = findInMap(sample.objective_values, xObjective);
        const y = findInMap(sample.objective_values, yObjective);
        if (x !== null && y !== null) {
          rows.push({ x, y, algorithm: `${result.algorithm_name} sample`, color });
        }
      });
      const meanX = getObjectiveStat(result, xObjective)?.mean ?? getObjectiveValue(result, xObjective);
      const meanY = getObjectiveStat(result, yObjective)?.mean ?? getObjectiveValue(result, yObjective);
      if (meanX !== null && meanY !== null) {
        rows.push({ x: meanX, y: meanY, algorithm: result.algorithm_name, color, mean: true });
      }
    });
    return rows;
  }, [sampleMap, visibleResults, xObjective, yObjective]);

  useEffect(() => {
    let cancelled = false;
    const means = paretoSource.filter((row) => row.mean);
    const cloud = paretoSource.filter((row) => !row.mean);
    if (cloud.length <= 1200) {
      setParetoRows([...cloud, ...means]);
      return () => {
        cancelled = true;
      };
    }
    const workerInput = cloud.map((point) => ({ ...point }));
    void downsampleScatterPoints(workerInput, 1200)
      .then((rows) => {
        if (!cancelled) {
          const sampled: ParetoPoint[] = rows.map((row) => ({
            x: Number(row.x),
            y: Number(row.y),
            algorithm: String(row.algorithm ?? "sample"),
            color: String(row.color ?? "#29dba6"),
            mean: Boolean(row.mean)
          }));
          setParetoRows([...sampled, ...means]);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setParetoRows([...cloud.slice(0, 1200), ...means]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [paretoSource]);

  const ciOptions = useMemo(() => {
    const objectiveKeys = objectives.map((objective) => `objective:${objective}`);
    const metricKeys = Array.from(
      new Set(visibleResults.flatMap((result) => Object.keys(result.repeat_stats?.metrics ?? {})))
    ).map((metric) => `metric:${metric}`);
    return [...objectiveKeys, ...metricKeys];
  }, [objectives, visibleResults]);

  useEffect(() => {
    if (ciOptions.length === 0) {
      setCiKey("");
      return;
    }
    setCiKey((prev) => (ciOptions.includes(prev) ? prev : ciOptions[0]));
  }, [ciOptions]);

  const ciRows = useMemo(() => {
    if (!ciKey) {
      return [];
    }
    const [kind, key] = ciKey.split(":");
    return visibleResults
      .map((result, index) => {
        const color = COLORS[index % COLORS.length];
        if (kind === "objective") {
          const stat = getObjectiveStat(result, key);
          const fallback = getObjectiveValue(result, key);
          if (!stat && fallback === null) {
            return null;
          }
          const mean = stat?.mean ?? fallback ?? 0;
          return { algorithm: result.algorithm_name, mean, low: stat?.ci95_low ?? mean, high: stat?.ci95_high ?? mean, color };
        }
        const stat = getMetricStat(result, key);
        const fallback = Number(result.quality_metrics[key] ?? Number.NaN);
        if (!stat && Number.isNaN(fallback)) {
          return null;
        }
        const mean = stat?.mean ?? fallback;
        return { algorithm: result.algorithm_name, mean, low: stat?.ci95_low ?? mean, high: stat?.ci95_high ?? mean, color };
      })
      .filter((row): row is { algorithm: string; mean: number; low: number; high: number; color: string } => row !== null);
  }, [ciKey, visibleResults]);

  const ciDomain = useMemo(() => {
    if (ciRows.length === 0) {
      return { min: 0, max: 1 };
    }
    const min = Math.min(...ciRows.map((row) => row.low));
    const max = Math.max(...ciRows.map((row) => row.high));
    const span = Math.max(1e-9, max - min);
    return { min: min - span * 0.1, max: max + span * 0.1 };
  }, [ciRows]);

  const parallelInput = useMemo(() => {
    if (objectives.length < 3) {
      return [] as Array<{ algorithm: string; values: number[] }>;
    }
    const rows: Array<{ algorithm: string; values: number[] }> = [];
    visibleResults.forEach((result) => {
      const samples = sampleMap.get(result.algorithm_name) ?? [];
      samples.forEach((sample) => {
        const values = objectives.map((objective) => findInMap(sample.objective_values, objective));
        if (values.every((value) => value !== null)) {
          rows.push({ algorithm: result.algorithm_name, values: values as number[] });
        }
      });
    });
    return rows;
  }, [objectives, sampleMap, visibleResults]);

  useEffect(() => {
    let cancelled = false;
    if (parallelInput.length === 0) {
      setParallelRows([]);
      setParallelExtents([]);
      return () => {
        cancelled = true;
      };
    }
    void prepareParallelLines(parallelInput, 1000)
      .then((payload) => {
        if (!cancelled) {
          setParallelRows(payload.lines);
          setParallelExtents(payload.extents);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setParallelRows([]);
          setParallelExtents([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [parallelInput]);

  useEffect(() => {
    if (!attainment || attainment.algorithms.length === 0) {
      setSelectedAttAlgo("");
      return;
    }
    setSelectedAttAlgo((prev) =>
      attainment.algorithms.some((row) => row.algorithm_name === prev) ? prev : attainment.algorithms[0].algorithm_name
    );
  }, [attainment]);

  const selectedAtt = useMemo(() => {
    if (!attainment || attainment.algorithms.length === 0) {
      return null;
    }
    return attainment.algorithms.find((row) => row.algorithm_name === selectedAttAlgo) ?? attainment.algorithms[0];
  }, [attainment, selectedAttAlgo]);

  const exportLatex = () => downloadBlob("scenario-metrics.tex", new Blob([buildLatex(results, objectives)], { type: "text/plain;charset=utf-8" }));
  const exportSvgPack = () => {
    exportSvg(paretoRef, "scenario-pareto.svg");
    exportSvg(ciRef, "scenario-ci.svg");
    exportSvg(parallelRef, "scenario-parallel.svg");
    exportSvg(attainmentRef, "scenario-attainment.svg");
  };
  const exportPngPack = async () => {
    await exportPng(paretoRef, "scenario-pareto.png");
    await exportPng(ciRef, "scenario-ci.png");
    await exportPng(parallelRef, "scenario-parallel.png");
    await exportPng(attainmentRef, "scenario-attainment.png");
  };

  if (results.length === 0 && !isRunning) {
    return null;
  }

  if (results.length === 0 && isRunning) {
    return (
      <section className="rounded-2xl border border-stroke bg-card/70 p-4 shadow-glow">
        <h3 className="font-display text-base text-ice">Visual Scenario Insights</h3>
        <p className="text-xs text-slate">
          Running... {completedSteps}/{totalSteps || 0} repeats, {completedAlgorithms}/{totalAlgorithms || 0} algorithms.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-stroke bg-card/70 p-4 shadow-glow">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-display text-base text-ice">Research Dashboard</h3>
        <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate">
          <span>
            Steps {completedSteps}/{totalSteps || completedSteps} | Algorithms {completedAlgorithms}/{totalAlgorithms || completedAlgorithms}
          </span>
          <button type="button" onClick={() => setAutoPlay((v) => !v)} className="rounded border border-stroke px-2 py-1">
            {autoPlay ? "Pause" : "Play"}
          </button>
          <select value={replaySpeed} onChange={(e) => setReplaySpeed(Number(e.target.value))} className="rounded border border-stroke bg-card px-2 py-1 text-ice">
            <option value={0.5}>0.5x</option>
            <option value={1}>1x</option>
            <option value={2}>2x</option>
            <option value={4}>4x</option>
          </select>
          <input type="range" min={1} max={Math.max(1, results.length)} value={Math.min(visibleCount, Math.max(1, results.length))} onChange={(e) => setVisibleCount(Number(e.target.value))} className="accent-accent" />
          <button type="button" onClick={exportSvgPack} className="rounded border border-stroke px-2 py-1">SVG</button>
          <button type="button" onClick={() => { void exportPngPack(); }} className="rounded border border-stroke px-2 py-1">PNG</button>
          <button type="button" onClick={exportLatex} className="rounded border border-stroke px-2 py-1">LaTeX</button>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <div ref={paretoRef} className="rounded-xl border border-stroke bg-ink/60 p-3">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-slate">Pareto (downsampled in worker)</p>
            <div className="flex gap-2 text-[11px] text-slate">
              <select value={xObjective} onChange={(e) => setXObjective(e.target.value)} className="rounded border border-stroke bg-card px-2 py-1 text-ice">
                {objectives.map((objective) => <option key={objective} value={objective}>{objective}</option>)}
              </select>
              <select value={yObjective} onChange={(e) => setYObjective(e.target.value)} className="rounded border border-stroke bg-card px-2 py-1 text-ice">
                {objectives.map((objective) => <option key={objective} value={objective}>{objective}</option>)}
              </select>
            </div>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 10, right: 10, left: 10, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={GRID} />
                <XAxis type="number" dataKey="x" stroke={AXIS} tick={{ fontSize: 10 }} label={{ value: `${xObjective} (${resolveDirection(xObjective, objectiveDirections)})`, position: "insideBottom", offset: -4, fill: AXIS, fontSize: 10 }} />
                <YAxis type="number" dataKey="y" stroke={AXIS} tick={{ fontSize: 10 }} label={{ value: `${yObjective} (${resolveDirection(yObjective, objectiveDirections)})`, angle: -90, position: "insideLeft", fill: AXIS, fontSize: 10 }} />
                {typeof resolveTarget(xObjective, objectiveTargets) === "number" && <ReferenceLine x={resolveTarget(xObjective, objectiveTargets) as number} stroke="#f9c74f" strokeDasharray="5 5" />}
                {typeof resolveTarget(yObjective, objectiveTargets) === "number" && <ReferenceLine y={resolveTarget(yObjective, objectiveTargets) as number} stroke="#f9c74f" strokeDasharray="5 5" />}
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 10 }} />
                {visibleResults.map((result, index) => (
                  <Scatter key={result.algorithm_name} name={result.algorithm_name} data={paretoRows.filter((row) => row.algorithm.startsWith(result.algorithm_name))} fill={COLORS[index % COLORS.length]} />
                ))}
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div ref={ciRef} className="rounded-xl border border-stroke bg-ink/60 p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-xs text-slate">95% CI</p>
            <select value={ciKey} onChange={(e) => setCiKey(e.target.value)} className="rounded border border-stroke bg-card px-2 py-1 text-[11px] text-ice">
              {ciOptions.map((key) => <option key={key} value={key}>{key}</option>)}
            </select>
          </div>
          <svg width="100%" height="270" viewBox="0 0 560 270" preserveAspectRatio="xMidYMid meet">
            <rect x={0} y={0} width={560} height={270} fill="rgba(8,15,22,0.6)" />
            <line x1={50} y1={25} x2={50} y2={225} stroke={AXIS} />
            <line x1={50} y1={225} x2={535} y2={225} stroke={AXIS} />
            {ciRows.map((row, index) => {
              const x = 50 + ((index + 0.5) * (485 / Math.max(1, ciRows.length)));
              const scaleY = (value: number) => 225 - ((value - ciDomain.min) / Math.max(1e-9, ciDomain.max - ciDomain.min)) * 190;
              const yMean = scaleY(row.mean);
              const yLow = scaleY(row.low);
              const yHigh = scaleY(row.high);
              return (
                <g key={row.algorithm}>
                  <line x1={x} y1={yLow} x2={x} y2={yHigh} stroke={row.color} strokeWidth={2.4} />
                  <line x1={x - 6} y1={yLow} x2={x + 6} y2={yLow} stroke={row.color} />
                  <line x1={x - 6} y1={yHigh} x2={x + 6} y2={yHigh} stroke={row.color} />
                  <circle cx={x} cy={yMean} r={4} fill={row.color} />
                  <text x={x} y={242} textAnchor="middle" fill={AXIS} fontSize={10}>{row.algorithm}</text>
                </g>
              );
            })}
          </svg>
        </div>

        <div ref={parallelRef} className="rounded-xl border border-stroke bg-ink/60 p-3 xl:col-span-2">
          <p className="mb-2 text-xs text-slate">Parallel Coordinates (worker-normalized)</p>
          {objectives.length < 3 ? (
            <p className="text-xs text-slate">Need at least 3 objectives.</p>
          ) : (
            <svg width="100%" height="300" viewBox="0 0 980 300" preserveAspectRatio="xMidYMid meet">
              <rect x={0} y={0} width={980} height={300} fill="rgba(8,15,22,0.6)" />
              {objectives.map((objective, index) => {
                const x = 90 + (index * (800 / Math.max(1, objectives.length - 1)));
                const extent = parallelExtents[index];
                return (
                  <g key={objective}>
                    <line x1={x} y1={40} x2={x} y2={250} stroke={AXIS} />
                    <text x={x} y={26} textAnchor="middle" fill={AXIS} fontSize={11}>{objective}</text>
                    {extent && <text x={x} y={265} textAnchor="middle" fill={AXIS} fontSize={9}>{extent.min.toFixed(2)} - {extent.max.toFixed(2)}</text>}
                  </g>
                );
              })}
              {parallelRows.map((row, rowIndex) => {
                const colorIndex = visibleResults.findIndex((result) => result.algorithm_name === row.algorithm);
                const color = COLORS[(colorIndex >= 0 ? colorIndex : rowIndex) % COLORS.length];
                const d = row.values.map((value, index) => {
                  const x = 90 + (index * (800 / Math.max(1, row.values.length - 1)));
                  const y = 250 - value * 210;
                  return `${index === 0 ? "M" : "L"} ${x} ${y}`;
                }).join(" ");
                return <path key={`${row.algorithm}-${rowIndex}`} d={d} fill="none" stroke={color} strokeOpacity={0.16} strokeWidth={1.2} />;
              })}
            </svg>
          )}
        </div>

        <div ref={attainmentRef} className="rounded-xl border border-stroke bg-ink/60 p-3 xl:col-span-2">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-slate">Empirical Attainment Surface</p>
            {attainment && (
              <div className="flex gap-2 text-[11px] text-slate">
                <select value={selectedAttAlgo} onChange={(e) => setSelectedAttAlgo(e.target.value)} className="rounded border border-stroke bg-card px-2 py-1 text-ice">
                  {attainment.algorithms.map((row) => <option key={row.algorithm_name} value={row.algorithm_name}>{row.algorithm_name}</option>)}
                </select>
                <select value={selectedAttLevel} onChange={(e) => setSelectedAttLevel(Number(e.target.value))} className="rounded border border-stroke bg-card px-2 py-1 text-ice">
                  <option value={0.5}>50%</option>
                  <option value={0.75}>75%</option>
                  <option value={0.9}>90%</option>
                </select>
              </div>
            )}
          </div>
          {!selectedAtt || !attainment ? (
            <p className="text-xs text-slate">Need at least two objectives and completed runs.</p>
          ) : (
            <svg width="100%" height="320" viewBox="0 0 980 320" preserveAspectRatio="xMidYMid meet">
              <rect x={0} y={0} width={980} height={320} fill="rgba(8,15,22,0.6)" />
              {(() => {
                const xMin = Math.min(...selectedAtt.x_values);
                const xMax = Math.max(...selectedAtt.x_values);
                const yMin = Math.min(...selectedAtt.y_values);
                const yMax = Math.max(...selectedAtt.y_values);
                const xScale = (v: number) => 70 + ((v - xMin) / Math.max(1e-9, xMax - xMin)) * 820;
                const yScale = (v: number) => 270 - ((v - yMin) / Math.max(1e-9, yMax - yMin)) * 220;
                const cellW = 820 / Math.max(1, selectedAtt.x_values.length);
                const cellH = 220 / Math.max(1, selectedAtt.y_values.length);
                return (
                  <>
                    <line x1={70} y1={270} x2={890} y2={270} stroke={AXIS} />
                    <line x1={70} y1={50} x2={70} y2={270} stroke={AXIS} />
                    <text x={890} y={300} textAnchor="end" fill={AXIS} fontSize={11}>{attainment.x_objective} ({attainment.x_direction})</text>
                    <text x={20} y={52} fill={AXIS} fontSize={11}>{attainment.y_objective} ({attainment.y_direction})</text>
                    {selectedAtt.probability.map((row, xi) => row.map((p, yi) => {
                      const x = 70 + xi * cellW;
                      const y = 270 - (yi + 1) * cellH;
                      const hue = 220 - p * 180;
                      const light = 20 + p * 42;
                      return <rect key={`p-${xi}-${yi}`} x={x} y={y} width={cellW + 0.3} height={cellH + 0.3} fill={`hsl(${hue},75%,${light}%)`} />;
                    }))}
                    {selectedAtt.surfaces.map((surface) => {
                      const points = surface.points.map((point) => `${xScale(point.x)},${yScale(point.y)}`).join(" ");
                      const highlight = Math.abs(surface.level - selectedAttLevel) < 1e-6;
                      return <polyline key={surface.level} points={points} fill="none" stroke={highlight ? "#f45b69" : "#29dba6"} strokeOpacity={highlight ? 1 : 0.45} strokeWidth={highlight ? 2.6 : 1.4} />;
                    })}
                  </>
                );
              })()}
            </svg>
          )}
        </div>
      </div>
    </section>
  );
};
