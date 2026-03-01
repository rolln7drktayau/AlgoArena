import { useEffect, useMemo, useRef, useState } from "react";
import * as d3 from "d3";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import type { GenerationSnapshot } from "../types";
import { downsampleScatterPoints } from "../lib/chartWorker";

const COLORS = ["#29dba6", "#f18f01", "#6bb9ff", "#f45b69", "#9b5de5", "#f9c74f", "#80ed99", "#577590"];

const METRIC_OPTIONS = [
  { key: "hv", label: "Hypervolume (HV)" },
  { key: "igd", label: "IGD" },
  { key: "igd_plus", label: "IGD+" },
  { key: "gd", label: "GD" },
  { key: "epsilon", label: "Additive Epsilon" },
  { key: "spread", label: "Spread/Delta" },
  { key: "generation_speed", label: "Speed (gen/s)" },
  { key: "hv_improvement_rate", label: "HV rate (/s)" }
];

interface Props {
  objectiveCount: number;
  snapshotsByAlgorithm: Record<string, GenerationSnapshot[]>;
  algorithmNameById: Record<string, string>;
}

const project3D = (point: number[], angle: number): { x: number; y: number } => {
  const [x, y, z] = [point[0], point[1], point[2] ?? 0];
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const rx = x * cos - z * sin;
  const rz = x * sin + z * cos;
  return { x: rx + rz * 0.35, y: y - rz * 0.25 };
};

export const CommonResearchPanel = ({ objectiveCount, snapshotsByAlgorithm, algorithmNameById }: Props) => {
  const [selectedMetric, setSelectedMetric] = useState("hv");
  const [downsampledPopByAlgorithm, setDownsampledPopByAlgorithm] = useState<Record<string, number[][]>>({});
  const svgRef = useRef<SVGSVGElement | null>(null);

  const latestByAlgorithm = useMemo(() => {
    const rows: Array<{ algorithmId: string; algorithmName: string; snapshot: GenerationSnapshot }> = [];
    Object.entries(snapshotsByAlgorithm).forEach(([algorithmId, snapshots]) => {
      const latest = snapshots[snapshots.length - 1];
      if (!latest) {
        return;
      }
      rows.push({
        algorithmId,
        algorithmName: algorithmNameById[algorithmId] ?? algorithmId,
        snapshot: latest
      });
    });
    return rows;
  }, [algorithmNameById, snapshotsByAlgorithm]);

  const mergedConvergenceData = useMemo(() => {
    const map = new Map<number, Record<string, number | string | null>>();
    Object.entries(snapshotsByAlgorithm).forEach(([algorithmId, snapshots]) => {
      const algorithmName = algorithmNameById[algorithmId] ?? algorithmId;
      snapshots.forEach((snapshot) => {
        const current = map.get(snapshot.generation) ?? { generation: snapshot.generation };
        current[algorithmName] = snapshot.metrics[selectedMetric] ?? null;
        map.set(snapshot.generation, current);
      });
    });
    return Array.from(map.values()).sort((a, b) => Number(a.generation) - Number(b.generation));
  }, [algorithmNameById, selectedMetric, snapshotsByAlgorithm]);

  useEffect(() => {
    let cancelled = false;
    const rawEntries = latestByAlgorithm.map((row) => ({
      algorithmId: row.algorithmId,
      points: row.snapshot.population.map((member) => ({
        x: member.f[0] ?? 0,
        y: member.f[1] ?? 0,
        z: member.f[2] ?? 0,
        f: member.f
      }))
    }));

    const run = async () => {
      const next: Record<string, number[][]> = {};
      for (const entry of rawEntries) {
        const points = entry.points;
        if (points.length === 0) {
          next[entry.algorithmId] = [];
          continue;
        }
        if (points.length <= 1200) {
          next[entry.algorithmId] = points.map((point) => point.f);
          continue;
        }
        try {
          const sampled = await downsampleScatterPoints(points, 1200);
          next[entry.algorithmId] = sampled
            .map((point) => (Array.isArray(point.f) ? (point.f as number[]) : [point.x as number, point.y as number, point.z as number]))
            .map((row) => row.slice(0, Math.max(2, objectiveCount)));
        } catch {
          next[entry.algorithmId] = points.slice(0, 1200).map((point) => point.f);
        }
      }
      if (!cancelled) {
        setDownsampledPopByAlgorithm(next);
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [latestByAlgorithm, objectiveCount]);

  useEffect(() => {
    if (!svgRef.current || objectiveCount < 3) {
      return;
    }
    const width = 560;
    const height = 260;
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();
    svg
      .append("rect")
      .attr("x", 0)
      .attr("y", 0)
      .attr("width", width)
      .attr("height", height)
      .attr("fill", "rgba(8, 15, 22, 0.70)");

    const allProjected: Array<{ x: number; y: number; color: string }> = [];
    latestByAlgorithm.forEach((row, index) => {
      const angle = (row.snapshot.generation * Math.PI) / 40;
      const front = downsampledPopByAlgorithm[row.algorithmId] ?? row.snapshot.population.map((member) => member.f);
      front.forEach((f) => {
        const projected = project3D(f, angle);
        allProjected.push({ ...projected, color: COLORS[index % COLORS.length] });
      });
    });
    if (allProjected.length === 0) {
      return;
    }
    const xExtent = d3.extent(allProjected, (d) => d.x) as [number, number];
    const yExtent = d3.extent(allProjected, (d) => d.y) as [number, number];
    const scaleX = d3.scaleLinear().domain(xExtent).range([35, width - 20]).nice();
    const scaleY = d3.scaleLinear().domain(yExtent).range([height - 25, 20]).nice();

    svg
      .selectAll("circle")
      .data(allProjected)
      .enter()
      .append("circle")
      .attr("cx", (d) => scaleX(d.x))
      .attr("cy", (d) => scaleY(d.y))
      .attr("r", 2.7)
      .attr("fill", (d) => d.color)
      .attr("opacity", 0.85);

    svg
      .append("g")
      .attr("transform", `translate(0,${height - 25})`)
      .call(d3.axisBottom(scaleX).ticks(5) as never)
      .attr("color", "#7da2b8");
    svg
      .append("g")
      .attr("transform", "translate(35,0)")
      .call(d3.axisLeft(scaleY).ticks(5) as never)
      .attr("color", "#7da2b8");
  }, [downsampledPopByAlgorithm, latestByAlgorithm, objectiveCount]);

  if (latestByAlgorithm.length === 0) {
    return (
      <section className="rounded-xl border border-stroke bg-card/70 p-3 text-xs text-slate">
        Common research charts appear during/after a run.
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-stroke bg-card/70 p-3">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h3 className="font-display text-sm text-ice">Common Research Charts</h3>
        <label className="text-xs text-slate">
          Convergence Metric
          <select
            className="ml-2 rounded-md border border-stroke bg-ink px-2 py-1 text-xs text-ice"
            value={selectedMetric}
            onChange={(event) => setSelectedMetric(event.target.value)}
          >
            {METRIC_OPTIONS.map((item) => (
              <option key={item.key} value={item.key}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid gap-3 xl:grid-cols-2">
        <div className="rounded-lg border border-stroke bg-ink/60 p-2">
          <p className="mb-2 text-xs text-slate">Global Pareto Front</p>
          {objectiveCount >= 3 ? (
            <svg ref={svgRef} width="100%" height="260" viewBox="0 0 560 260" preserveAspectRatio="xMidYMid meet" />
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart margin={{ top: 10, right: 12, bottom: 10, left: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#214059" />
                  <XAxis type="number" dataKey="x" stroke="#7da2b8" tick={{ fontSize: 10 }} />
                  <YAxis type="number" dataKey="y" stroke="#7da2b8" tick={{ fontSize: 10 }} />
                  <Tooltip />
                  {latestByAlgorithm.map((row, index) => (
                    <Scatter
                      key={row.algorithmId}
                      name={row.algorithmName}
                      data={(downsampledPopByAlgorithm[row.algorithmId] ?? row.snapshot.population.map((member) => member.f)).map(
                        (values) => ({ x: values[0], y: values[1] })
                      )}
                      fill={COLORS[index % COLORS.length]}
                    />
                  ))}
                  <Legend wrapperStyle={{ fontSize: 10 }} />
                </ScatterChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="rounded-lg border border-stroke bg-ink/60 p-2">
          <p className="mb-2 text-xs text-slate">Global Convergence ({selectedMetric})</p>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={mergedConvergenceData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#214059" />
                <XAxis dataKey="generation" stroke="#7da2b8" tick={{ fontSize: 10 }} />
                <YAxis stroke="#7da2b8" tick={{ fontSize: 10 }} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 10 }} />
                {latestByAlgorithm.map((row, index) => (
                  <Line
                    key={`${row.algorithmId}-${selectedMetric}`}
                    type="monotone"
                    dataKey={row.algorithmName}
                    stroke={COLORS[index % COLORS.length]}
                    strokeWidth={2}
                    dot={false}
                    connectNulls
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </section>
  );
};
