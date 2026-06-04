import { useMemo, useState } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { buildApiUrl } from "../lib/api";
import { useAppStore } from "../store/useAppStore";
import { DrawableLandscape } from "./explore/DrawableLandscape";
import { Landscape3DExplorer } from "./explore/Landscape3DExplorer";

type DomainKind = "mono_objective" | "tsp" | "bin_packing" | "bayesian" | "noisy" | "drawable";

interface DomainResult {
  kind: DomainKind;
  algorithm: string;
  best?: { value?: number | null; x?: number[]; order?: number[]; bins?: number[][] };
  history?: Array<{ iteration: number; value: number; best: number; order?: number[]; bins?: number[][] }>;
  points?: Array<{ x: number; y: number }>;
  items?: number[];
  capacity?: number;
  landscape?: number[][];
  decision_points?: Array<{ x: number; y: number; value: number }>;
  confidence_band?: Array<{ iteration: number; mean: number; low: number; high: number }>;
  genealogy?: Array<{ iteration: number; accepted: boolean }>;
  visualizations?: string[];
}

const domains: Array<{ id: DomainKind; label: string; expression: string }> = [
  { id: "mono_objective", label: "Mono-objective", expression: "sum((x[i] - 0.5)**2 for i in range(len(x)))" },
  { id: "tsp", label: "TSP", expression: "" },
  { id: "bin_packing", label: "Bin packing", expression: "" },
  { id: "bayesian", label: "Bayesian light", expression: "math.sin(10*x[0]) * x[0] + (x[0] - 0.5)**2" },
  { id: "noisy", label: "Noisy function", expression: "sum((x[i] - 0.35)**2 for i in range(len(x)))" },
  { id: "drawable", label: "Drawable grid", expression: "" }
];

const chartData = (result: DomainResult | null) =>
  (result?.history ?? []).map((row) => ({ iteration: row.iteration, value: row.value, best: row.best }));

const RouteView = ({ result }: { result: DomainResult }) => {
  const order = result.best?.order ?? result.history?.[result.history.length - 1]?.order ?? [];
  const points = result.points ?? [];
  const path = order.map((idx) => points[idx]).filter(Boolean);
  if (points.length === 0 || path.length === 0) {
    return null;
  }
  const size = 260;
  const toX = (x: number) => 12 + x * (size - 24);
  const toY = (y: number) => 12 + y * (size - 24);
  const route = [...path, path[0]].map((point) => `${toX(point.x)},${toY(point.y)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="h-64 w-full rounded border border-stroke bg-ink">
      <polyline points={route} fill="none" stroke="#29dba6" strokeWidth="2" />
      {points.map((point, idx) => (
        <g key={idx}>
          <circle cx={toX(point.x)} cy={toY(point.y)} r="4" fill="#f18f01" />
          <text x={toX(point.x) + 5} y={toY(point.y) - 5} className="fill-current text-[9px] text-slate">
            {idx}
          </text>
        </g>
      ))}
    </svg>
  );
};

const PackingView = ({ result }: { result: DomainResult }) => {
  const bins = result.best?.bins ?? result.history?.[result.history.length - 1]?.bins ?? [];
  const items = result.items ?? [];
  const capacity = result.capacity ?? 1;
  if (bins.length === 0) {
    return null;
  }
  return (
    <div className="grid gap-2 md:grid-cols-2">
      {bins.map((bin, idx) => {
        const used = bin.reduce((sum, itemIdx) => sum + (items[itemIdx] ?? 0), 0);
        return (
          <div key={idx} className="rounded border border-stroke bg-ink p-2">
            <div className="mb-1 flex justify-between text-[11px] text-slate">
              <span>Bin {idx + 1}</span>
              <span>{used.toFixed(2)} / {capacity.toFixed(2)}</span>
            </div>
            <div className="flex h-8 overflow-hidden rounded bg-card">
              {bin.map((itemIdx) => (
                <div
                  key={itemIdx}
                  title={`Item ${itemIdx}: ${items[itemIdx]}`}
                  style={{ width: `${Math.max(2, ((items[itemIdx] ?? 0) / capacity) * 100)}%` }}
                  className="border-r border-ink bg-accent"
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export const V2ExploreTab = () => {
  const language = useAppStore((state) => state.language);
  const [kind, setKind] = useState<DomainKind>("mono_objective");
  const [iterations, setIterations] = useState(160);
  const [expression, setExpression] = useState(domains[0].expression);
  const [result, setResult] = useState<DomainResult | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const data = useMemo(() => chartData(result), [result]);
  const text = language === "fr"
    ? {
        title: "Exploration V2",
        intro: "Ce mode sert a comprendre l'optimisation avec des problemes visuels. Il ne remplace pas le Benchmark : il montre d'autres familles de problemes et leurs visualisations adaptees.",
        domain: "Domaine",
        expression: "Expression",
        iterations: "Iterations",
        run: "Lancer l'exploration",
        running: "Simulation V2 en cours...",
        methodNotAllowed: "Le backend ouvert semble etre une ancienne instance. Lance `npm run local:stop`, puis `npm run local:dev`, et recharge cette page.",
        best: "Meilleure valeur",
        convergence: "Convergence",
        domainView: "Vue du domaine",
        landscape: "Paysage de fitness",
        decision: "Decision space vs objective",
        genealogy: "Arbre genealogique simplifie",
        noChart: "Ce domaine renvoie surtout une vue directe.",
        purpose: "Pourquoi ce mode existe ? Pour voir pourquoi un algorithme progresse, stagne ou explore mal, avec des exemples plus intuitifs que le multi-objectifs pur."
      }
    : {
        title: "V2 Explore",
        intro: "This mode helps explain optimization with visual problems. It does not replace Benchmark: it shows other problem families and adapted visualizations.",
        domain: "Domain",
        expression: "Expression",
        iterations: "Iterations",
        run: "Run exploration",
        running: "Running V2 simulation...",
        methodNotAllowed: "The backend looks like an older instance. Run `npm run local:stop`, then `npm run local:dev`, and refresh this page.",
        best: "Best value",
        convergence: "Convergence",
        domainView: "Domain View",
        landscape: "Fitness landscape",
        decision: "Decision space vs objective",
        genealogy: "Simplified solution genealogy",
        noChart: "This domain mostly returns a direct view.",
        purpose: "Why this mode? To see why an algorithm improves, stagnates or explores poorly, using more intuitive examples than pure multi-objective optimization."
      };

  const run = async () => {
    setFeedback(text.running);
    setResult(null);
    try {
      const payload = {
        kind,
        iterations,
        expression: expression.trim() || undefined,
        dimension: kind === "bayesian" ? 1 : 2,
        noise_std: 0.08,
        item_sizes: kind === "bin_packing" ? [0.48, 0.36, 0.22, 0.54, 0.31, 0.19, 0.62, 0.27, 0.41, 0.33] : undefined,
        canvas: kind === "drawable"
          ? Array.from({ length: 18 }, (_, y) => Array.from({ length: 18 }, (_, x) => Math.abs(x - 7) + Math.abs(y - 10)))
          : undefined
      };
      const response = await fetch(buildApiUrl("/api/problem-domains/simulate"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (!response.ok) {
        const raw = await response.text();
        if (response.status === 405) {
          throw new Error(text.methodNotAllowed);
        }
        try {
          const parsed = JSON.parse(raw) as { detail?: string };
          throw new Error(parsed.detail ?? raw);
        } catch {
          throw new Error(raw);
        }
      }
      const body = (await response.json()) as DomainResult;
      setResult(body);
      setFeedback(`${text.best}: ${typeof body.best?.value === "number" ? body.best.value.toFixed(6) : "n/a"}`);
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Simulation failed.");
    }
  };

  const selected = domains.find((item) => item.id === kind) ?? domains[0];

  return (
    <section className="space-y-4">
      <DrawableLandscape />
      <Landscape3DExplorer />
      <div className="rounded-2xl border border-stroke bg-card/70 p-4 shadow-glow">
        <h2 className="font-display text-lg text-ice">{text.title}</h2>
        <p className="mt-1 text-xs leading-5 text-slate">{text.intro}</p>
        <p className="mt-1 text-xs leading-5 text-slate">{text.purpose}</p>
        <div className="mt-4 grid gap-3 md:grid-cols-[1fr_1fr_120px]">
          <label className="text-xs text-slate">
            {text.domain}
            <select
              value={kind}
              onChange={(event) => {
                const next = event.target.value as DomainKind;
                setKind(next);
                setExpression(domains.find((item) => item.id === next)?.expression ?? "");
              }}
              className="mt-1 w-full rounded border border-stroke bg-ink px-2 py-2 text-ice"
            >
              {domains.map((domain) => (
                <option key={domain.id} value={domain.id}>
                  {domain.label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs text-slate">
            {text.expression}
            <input
              value={expression}
              disabled={!selected.expression}
              onChange={(event) => setExpression(event.target.value)}
              className="mt-1 w-full rounded border border-stroke bg-ink px-2 py-2 text-xs text-ice disabled:opacity-50"
            />
          </label>
          <label className="text-xs text-slate">
            {text.iterations}
            <input
              type="number"
              min={1}
              max={5000}
              value={iterations}
              onChange={(event) => setIterations(Number(event.target.value))}
              className="mt-1 w-full rounded border border-stroke bg-ink px-2 py-2 text-ice"
            />
          </label>
        </div>
        <button type="button" onClick={run} className="mt-3 rounded-md bg-accent px-4 py-2 text-sm font-semibold text-ink">
          {text.run}
        </button>
        {feedback && <p className="mt-2 text-xs text-accent">{feedback}</p>}
      </div>

      {result && (
        <div className="grid gap-4 xl:grid-cols-2">
          <section className="rounded-2xl border border-stroke bg-card/70 p-4 shadow-glow">
            <h3 className="font-display text-base text-ice">{text.convergence}</h3>
            {data.length > 0 ? (
              <div className="mt-3 h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#214059" />
                    <XAxis dataKey="iteration" stroke="#7da2b8" tick={{ fontSize: 10 }} />
                    <YAxis stroke="#7da2b8" tick={{ fontSize: 10 }} />
                    <Tooltip />
                    <Line type="monotone" dataKey="value" stroke="#f18f01" dot={false} />
                    <Line type="monotone" dataKey="best" stroke="#29dba6" dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="mt-3 text-xs text-slate">{text.noChart}</p>
            )}
          </section>

          <section className="rounded-2xl border border-stroke bg-card/70 p-4 shadow-glow">
            <h3 className="font-display text-base text-ice">{text.domainView}</h3>
            <div className="mt-3">
              {result.kind === "tsp" && <RouteView result={result} />}
              {result.kind === "bin_packing" && <PackingView result={result} />}
              {result.kind !== "tsp" && result.kind !== "bin_packing" && (
                <pre className="max-h-64 overflow-auto rounded border border-stroke bg-ink p-3 text-xs text-slate">
                  {JSON.stringify(result.best, null, 2)}
                </pre>
              )}
            </div>
          </section>
          {result.landscape && (
            <section className="rounded-2xl border border-stroke bg-card/70 p-4 shadow-glow">
              <h3 className="font-display text-base text-ice">{text.landscape}</h3>
              <div className="mt-3 grid aspect-square max-h-80 w-full max-w-80 grid-cols-[repeat(24,minmax(0,1fr))] overflow-hidden rounded border border-stroke">
                {result.landscape.flatMap((row, y) =>
                  row.map((value, x) => {
                    const all = result.landscape?.flat() ?? [0, 1];
                    const min = Math.min(...all);
                    const max = Math.max(...all);
                    const alpha = (value - min) / Math.max(1e-9, max - min);
                    return <div key={`${x}-${y}`} style={{ backgroundColor: `rgba(41, 219, 166, ${1 - alpha * 0.85})` }} />;
                  })
                )}
              </div>
            </section>
          )}
          {result.decision_points && result.decision_points.length > 0 && (
            <section className="rounded-2xl border border-stroke bg-card/70 p-4 shadow-glow">
              <h3 className="font-display text-base text-ice">{text.decision}</h3>
              <div className="mt-3 h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={result.decision_points.slice(-200).map((point, index) => ({ index, objective: point.value }))}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#214059" />
                    <XAxis dataKey="index" stroke="#7da2b8" tick={{ fontSize: 10 }} />
                    <YAxis stroke="#7da2b8" tick={{ fontSize: 10 }} />
                    <Tooltip />
                    <Line type="monotone" dataKey="objective" stroke="#6bb9ff" dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </section>
          )}
          {result.genealogy && (
            <section className="rounded-2xl border border-stroke bg-card/70 p-4 shadow-glow">
              <h3 className="font-display text-base text-ice">{text.genealogy}</h3>
              <div className="mt-3 flex flex-wrap gap-1">
                {result.genealogy.map((row) => (
                  <span key={row.iteration} className={`h-3 w-3 rounded-full ${row.accepted ? "bg-accent" : "bg-slate/40"}`} title={`Iteration ${row.iteration}`} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </section>
  );
};
