import { useAppStore } from "../store/useAppStore";
import { useProfileFilter } from "../hooks/useProfileFilter";

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
  const language = useAppStore((state) => state.language);
  const togglePinnedMetric = useAppStore((state) => state.togglePinnedMetric);
  const { allowedMetrics, showMetricExplanations } = useProfileFilter();
  const visibleMetrics = allowedMetrics ? METRICS.filter((metric) => allowedMetrics.includes(metric.key)) : METRICS;

  const t = language === "fr"
    ? { title: "Metriques epinglees", hv: "Plus c'est grand, mieux c'est.", igd: "Plus c'est petit, plus l'algorithme est precis." }
    : { title: "Pinned Metrics", hv: "Higher is better.", igd: "Lower means the algorithm is more precise." };

  return (
    <section className="rounded-xl border border-stroke bg-card/70 p-3">
      <h3 className="font-display text-sm text-ice">{t.title}</h3>
      <div className="mt-2 flex flex-wrap gap-3">
        {visibleMetrics.map((metric) => (
          <div key={metric.key} className="rounded-lg border border-stroke/60 bg-ink/50 p-2">
            <label className="flex items-center gap-2 text-xs text-slate">
              <input
                type="checkbox"
                checked={pinnedMetrics.includes(metric.key)}
                onChange={() => togglePinnedMetric(metric.key)}
                className="h-4 w-4 accent-ember"
              />
              {metric.label}
            </label>
            {showMetricExplanations && metric.key === "hv" && (
              <p className="mt-1 text-[11px] text-accent">{t.hv}</p>
            )}
            {showMetricExplanations && metric.key === "igd" && (
              <p className="mt-1 text-[11px] text-accent">{t.igd}</p>
            )}
          </div>
        ))}
      </div>
    </section>
  );
};
