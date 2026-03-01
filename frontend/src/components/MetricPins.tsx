import { useAppStore } from "../store/useAppStore";

const METRICS = [
  { key: "hv", label: "Hypervolume" },
  { key: "igd", label: "IGD" },
  { key: "igd_plus", label: "IGD+" },
  { key: "gd", label: "GD" },
  { key: "gd_plus", label: "GD+" },
  { key: "epsilon", label: "Additive Epsilon" },
  { key: "spread", label: "Spread/Delta" },
  { key: "spacing", label: "Spacing" },
  { key: "generation_speed", label: "Speed (gen/s)" },
  { key: "hv_improvement_rate", label: "HV Rate (/s)" }
];

export const MetricPins = () => {
  const pinnedMetrics = useAppStore((state) => state.pinnedMetrics);
  const togglePinnedMetric = useAppStore((state) => state.togglePinnedMetric);

  return (
    <section className="rounded-xl border border-stroke bg-card/70 p-3">
      <h3 className="font-display text-sm text-ice">Pinned Metrics</h3>
      <div className="mt-2 flex flex-wrap gap-3">
        {METRICS.map((metric) => (
          <label key={metric.key} className="flex items-center gap-2 text-xs text-slate">
            <input
              type="checkbox"
              checked={pinnedMetrics.includes(metric.key)}
              onChange={() => togglePinnedMetric(metric.key)}
              className="h-4 w-4 accent-ember"
            />
            {metric.label}
          </label>
        ))}
      </div>
    </section>
  );
};
