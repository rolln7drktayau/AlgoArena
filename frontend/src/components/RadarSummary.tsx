import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip
} from "recharts";
import type { LeaderboardEntry, RunSummary } from "../types";

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

const normalizeRadarRows = (rows: Array<Record<string, number | null>>): number[][] => {
  const metricCount = RADAR_KEYS.length;
  const metricValues: number[][] = Array.from({ length: metricCount }, () => []);

  rows.forEach((row) => {
    RADAR_KEYS.forEach((item, index) => {
      const value = row[item.key];
      if (typeof value === "number" && Number.isFinite(value)) {
        metricValues[index].push(value);
      }
    });
  });

  return rows.map((row) =>
    RADAR_KEYS.map((item, index) => {
      const value = row[item.key];
      if (typeof value !== "number" || !Number.isFinite(value)) {
        return 0;
      }
      const values = metricValues[index];
      if (values.length === 0) {
        return 0;
      }
      const min = Math.min(...values);
      const max = Math.max(...values);
      if (Math.abs(max - min) < 1e-12) {
        return 1;
      }
      if (item.key === "hv" || item.key === "generation_speed") {
        return (value - min) / (max - min);
      }
      return (max - value) / (max - min);
    })
  );
};

const buildLiveRadar = (leaderboard: LeaderboardEntry[]) => {
  if (leaderboard.length === 0) {
    return [];
  }
  const source = leaderboard.map((entry) => ({
    algorithm_name: entry.algorithm_name,
    hv: entry.hv,
    igd: entry.igd,
    igd_plus: entry.igd_plus,
    gd: entry.gd ?? null,
    epsilon: entry.epsilon ?? null,
    spread: entry.spread,
    generation_speed: entry.generation_speed ?? null,
    time_to_convergence: entry.time_to_convergence
  }));
  const normalized = normalizeRadarRows(
    source.map((item) => ({
      hv: item.hv,
      igd: item.igd,
      igd_plus: item.igd_plus,
      gd: item.gd,
      epsilon: item.epsilon,
      spread: item.spread,
      generation_speed: item.generation_speed,
      time_to_convergence: item.time_to_convergence
    }))
  );

  return source.map((item, idx) => ({
    algorithm_name: item.algorithm_name,
    hv: normalized[idx][0],
    igd: normalized[idx][1],
    igd_plus: normalized[idx][2],
    gd: normalized[idx][3],
    epsilon: normalized[idx][4],
    spread: normalized[idx][5],
    generation_speed: normalized[idx][6],
    time_to_convergence: normalized[idx][7]
  }));
};

export const RadarSummary = ({
  summary,
  leaderboard,
  isRunning
}: {
  summary: RunSummary | null;
  leaderboard: LeaderboardEntry[];
  isRunning: boolean;
}) => {
  const finalRadar = summary?.radar ?? [];
  const liveRadar = buildLiveRadar(leaderboard);
  const radarRows = finalRadar.length > 0 ? finalRadar : liveRadar;

  if (radarRows.length === 0) {
    return (
      <section className="rounded-xl border border-stroke bg-card/70 p-3 text-xs text-slate">
        {isRunning ? "Live radar appears after first generations arrive." : "Final comparison radar appears when the run completes."}
      </section>
    );
  }

  const chartRows = RADAR_KEYS.map((item) => {
    const row: Record<string, number | string> = { metric: item.label };
    radarRows.forEach((algorithm) => {
      row[algorithm.algorithm_name] = algorithm[item.key] ?? 0;
    });
    return row;
  });

  return (
    <section className="rounded-xl border border-stroke bg-card/70 p-3">
      <h3 className="font-display text-sm text-ice">
        {finalRadar.length > 0 ? "Final Radar Comparison" : "Live Radar Comparison"}
      </h3>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={chartRows}>
            <PolarGrid stroke="#214059" />
            <PolarAngleAxis dataKey="metric" tick={{ fill: "#7da2b8", fontSize: 10 }} />
            <PolarRadiusAxis domain={[0, 1]} tick={false} axisLine={false} />
            <Tooltip />
            {radarRows.map((algorithm, idx) => (
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
      <p className="text-xs text-slate">Best overall: {summary?.best_overall ?? leaderboard[0]?.algorithm_name ?? "-"}</p>
    </section>
  );
};
