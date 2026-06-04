import { useMemo } from "react";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { GenerationSnapshot } from "../types";
import { useAppStore } from "../store/useAppStore";

const COLOR_MAP: Record<string, string> = {
  hv: "#29dba6",
  igd: "#f18f01",
  igd_plus: "#6bb9ff",
  gd: "#9b5de5",
  gd_plus: "#4895ef",
  epsilon: "#e36414",
  spread: "#f45b69",
  spacing: "#80ed99",
  generation_speed: "#f9c74f",
  hv_improvement_rate: "#f94144"
};

interface Props {
  snapshots: GenerationSnapshot[];
  pinnedMetrics: string[];
}

export const MetricsChart = ({ snapshots, pinnedMetrics }: Props) => {
  const language = useAppStore((state) => state.language);
  const data = useMemo(
    () => {
      return snapshots.map((snapshot) => {
        const row: Record<string, number | null> = { generation: snapshot.generation };
        pinnedMetrics.forEach((metric) => {
          row[metric] = snapshot.metrics[metric] ?? null;
        });
        return row;
      });
    },
    [pinnedMetrics, snapshots]
  );

  if (snapshots.length === 0) {
    return <div className="h-52 rounded-lg border border-stroke bg-ink/60 p-3 text-xs text-slate">{language === "fr" ? "Aucune metrique pour le moment." : "No metrics yet."}</div>;
  }

  return (
    <div className="h-52 rounded-lg border border-stroke bg-ink/60 p-2">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#214059" />
          <XAxis dataKey="generation" stroke="#7da2b8" tick={{ fontSize: 10 }} />
          <YAxis stroke="#7da2b8" tick={{ fontSize: 10 }} />
          <Tooltip />
          <Legend wrapperStyle={{ fontSize: 10 }} />
          {pinnedMetrics.map((metric) => (
            <Line
              key={metric}
              type="monotone"
              dataKey={metric}
              stroke={COLOR_MAP[metric] ?? "#d4f2ff"}
              strokeWidth={2}
              dot={false}
              connectNulls
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};
