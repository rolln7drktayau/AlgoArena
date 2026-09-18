import { t } from "./i18n";
import { useMemo } from "react";
import { useAppStore } from "../store/useAppStore";

export interface Solution {
  id: string;
  algorithm: string;
  generation: number;
  x: number[];
  f: number[];
}
export interface ScheduleRow {
  task_id: string;
  tier: string;
  device: number;
  start: number;
  finish: number;
  parents: string[];
}
export const number = (value: number | null | undefined) =>
  value == null || !Number.isFinite(value)
    ? "—"
    : new Intl.NumberFormat(useAppStore.getState().language, { maximumFractionDigits: 4 }).format(value);

export function ParetoPlot({
  solutions,
  selected,
  onSelect,
  xAxis,
  yAxis,
  labels,
}: {
  solutions: Solution[];
  selected: string | null;
  onSelect: (s: Solution) => void;
  xAxis: number;
  yAxis: number;
  labels: string[];
}) {
  const points = useMemo(() => {
    const finite = solutions.filter((s) => s.f.every(Number.isFinite));
    // Only the drawing is sampled; full results remain in the run journal.
    const stride = Math.max(1, Math.ceil(finite.length / 1000));
    const visible = finite.filter(
      (_, i) => i % stride === 0 || finite[i].id === selected,
    );
    return visible.map((s) => ({
      ...s,
      nondominated: !visible.some(
        (p) =>
          p.f.every((v, i) => v <= s.f[i]) && p.f.some((v, i) => v < s.f[i]),
      ),
    }));
  }, [solutions, selected]);
  const bounds = (axis: number) => {
    const values = points.map((p) => p.f[axis]);
    const min = Math.min(...values),
      max = Math.max(...values);
    const padding = (max - min || Math.abs(min) || 1) * 0.08;
    return [min - padding, max + padding];
  };
  if (!points.length)
    return (
      <div className="studio-empty">
        <span className="empty-orbit">◌</span>
        <h2>{t("Votre prochain compromis commence ici")}</h2>
        <p>{t("Choisissez un problème et lancez une expérience.")}<br />{t("Le front se dessinera à partir des solutions calculées.")}</p>
      </div>
    );
  const [xmin, xmax] = bounds(xAxis),
    [ymin, ymax] = bounds(yAxis);
  return (
    <svg
      className="pareto-svg"
      viewBox="0 0 860 370"
      role="group"
      aria-label={t("Front de Pareto interactif")}
    >
      {Array.from({ length: 6 }, (_, i) => (
        <g key={i} className="plot-grid">
          <line x1={70 + i * 150} y1={20} x2={70 + i * 150} y2={315} />
          <line x1={70} y1={20 + i * 59} x2={820} y2={20 + i * 59} />
          <text x={70 + i * 150} y={337} textAnchor="middle">
            {number(xmin + ((xmax - xmin) * i) / 5)}
          </text>
          <text x={59} y={319 - i * 59} textAnchor="end">
            {number(ymin + ((ymax - ymin) * i) / 5)}
          </text>
        </g>
      ))}
      <text className="axis-label" x={455} y={363} textAnchor="middle">
        {labels[xAxis]} ↓
      </text>
      <text
        className="axis-label"
        transform="translate(14 170) rotate(-90)"
        textAnchor="middle"
      >
        {labels[yAxis]} ↓
      </text>
      {[...points]
        .sort((a, b) => Number(a.id === selected) - Number(b.id === selected))
        .map((p) => (
          <circle
            key={p.id}
            cx={70 + ((p.f[xAxis] - xmin) / (xmax - xmin)) * 750}
            cy={315 - ((p.f[yAxis] - ymin) / (ymax - ymin)) * 295}
            r={p.id === selected ? 7 : p.nondominated ? 4.8 : 3.4}
            className={`pareto-point ${p.nondominated ? "nondominated" : ""} ${p.id === selected ? "selected" : ""}`}
            tabIndex={0}
            role="button"
            aria-label={`${p.algorithm}, ${labels[xAxis]} ${number(p.f[xAxis])}, ${labels[yAxis]} ${number(p.f[yAxis])}`}
            aria-pressed={p.id === selected}
            onClick={() => onSelect(p)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onSelect(p);
              }
            }}
          >
            <title>
              {p.algorithm} · {p.f.map(number).join(" / ")}
            </title>
          </circle>
        ))}
    </svg>
  );
}

export function Convergence({
  series,
  label,
}: {
  series: { name: string; values: { generation: number; value: number }[] }[];
  label: string;
}) {
  const all = series
    .flatMap((s) => s.values)
    .filter((p) => Number.isFinite(p.value));
  if (!all.length)
    return (
      <div className="small-empty">{t("Les mesures apparaîtront pendant l’exécution.")}</div>
    );
  const maxX = Math.max(1, ...all.map((p) => p.generation));
  const minY = Math.min(0, ...all.map((p) => p.value)),
    maxY = Math.max(...all.map((p) => p.value));
  const colors = ["#37c8fa", "#2de1c2", "#f7b36c", "#bd9bff"];
  return (
    <svg
      className="convergence-svg"
      viewBox="0 0 540 180"
      role="img"
      aria-label={`Convergence ${label}`}
    >
      {[0, 1, 2, 3].map((i) => (
        <g className="plot-grid" key={i}>
          <line x1={50} x2={520} y1={20 + i * 40} y2={20 + i * 40} />
          <text x={43} y={144 - i * 40} textAnchor="end">
            {number(minY + ((maxY - minY) * i) / 3)}
          </text>
        </g>
      ))}
      {series.map((s, i) => (
        <polyline
          key={s.name}
          fill="none"
          stroke={colors[i % colors.length]}
          strokeWidth="2.2"
          points={s.values
            .filter((p) => Number.isFinite(p.value))
            .map(
              (p) =>
                `${50 + (p.generation / maxX) * 470},${140 - ((p.value - minY) / (maxY - minY || 1)) * 120}`,
            )
            .join(" ")}
        >
          <title>{s.name}</title>
        </polyline>
      ))}
      <text className="axis-label" x={280} y={172} textAnchor="middle">{t("Générations · 0 —")}{maxX}
      </text>
    </svg>
  );
}

export function Gantt({ rows }: { rows: ScheduleRow[] }) {
  const end = Math.max(1e-9, ...rows.map((r) => r.finish));
  return (
    <div className="gantt">
      <p className="subtle">{t("Temps en secondes · calcul par ressource")}</p>
      {rows.map((row) => (
        <div className="gantt-row" key={row.task_id}>
          <span title={row.parents.join(", ")}>
            {row.task_id}{" "}
            <small>
              {row.tier} {row.device + 1}
            </small>
          </span>
          <div className="gantt-track">
            <div
              style={{
                marginLeft: `${(row.start / end) * 100}%`,
                width: `${Math.max(0.5, ((row.finish - row.start) / end) * 100)}%`,
              }}
              title={`${number(row.start)} → ${number(row.finish)} s`}
            />
          </div>
          <small>{number(row.finish)} s</small>
        </div>
      ))}
    </div>
  );
}
