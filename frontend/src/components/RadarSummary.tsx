import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip
} from "recharts";
import type { RunSummary } from "../types";

const RADAR_KEYS = [
  { key: "hv", label: "HV" },
  { key: "igd", label: "IGD" },
  { key: "igd_plus", label: "IGD+" },
  { key: "gd", label: "GD" },
  { key: "epsilon", label: "Epsilon" },
  { key: "spread", label: "Spread" },
  { key: "generation_speed", label: "Speed" },
  { key: "time_to_convergence", label: "TTC" }
] as const;

const COLORS = ["#29dba6", "#f18f01", "#6bb9ff", "#f45b69", "#c5d86d", "#ffa5ab"];

export const RadarSummary = ({ summary }: { summary: RunSummary | null }) => {
  if (!summary || summary.radar.length === 0) {
    return (
      <section className="rounded-xl border border-stroke bg-card/70 p-3 text-xs text-slate">
        Final comparison radar appears when the run completes.
      </section>
    );
  }

  const chartRows = RADAR_KEYS.map((item) => {
    const row: Record<string, number | string> = { metric: item.label };
    summary.radar.forEach((algorithm) => {
      row[algorithm.algorithm_name] = algorithm[item.key] ?? 0;
    });
    return row;
  });

  return (
    <section className="rounded-xl border border-stroke bg-card/70 p-3">
      <h3 className="font-display text-sm text-ice">Final Radar Comparison</h3>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={chartRows}>
            <PolarGrid stroke="#214059" />
            <PolarAngleAxis dataKey="metric" tick={{ fill: "#7da2b8", fontSize: 10 }} />
            <PolarRadiusAxis domain={[0, 1]} tick={false} axisLine={false} />
            <Tooltip />
            {summary.radar.map((algorithm, idx) => (
              <Radar
                key={algorithm.algorithm_name}
                name={algorithm.algorithm_name}
                dataKey={algorithm.algorithm_name}
                stroke={COLORS[idx % COLORS.length]}
                fill={COLORS[idx % COLORS.length]}
                fillOpacity={0.2}
              />
            ))}
          </RadarChart>
        </ResponsiveContainer>
      </div>
      <p className="text-xs text-slate">Best overall: {summary.best_overall ?? "-"}</p>
    </section>
  );
};
