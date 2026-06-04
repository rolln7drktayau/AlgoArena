import { useEffect, useRef, useState } from "react";
import { useAppStore } from "../../store/useAppStore";

const W = 60;
const H = 40;

const makeGrid = (value = 1) => Array.from({ length: H }, () => Array.from({ length: W }, () => value));

export const DrawableLandscape = () => {
  const language = useAppStore((state) => state.language);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [grid, setGrid] = useState(makeGrid());
  const [intensity, setIntensity] = useState(0.35);
  const [running, setRunning] = useState(false);
  const [points, setPoints] = useState<Array<{ x: number; y: number; best?: boolean }>>([]);
  const [best, setBest] = useState<{ x: number; y: number; score: number } | null>(null);
  const t = language === "fr"
    ? {
        title: "Dessine ton paysage",
        body: "Peins des vallees sombres. L'algorithme cherchera les zones les plus basses.",
        intensity: "Intensite",
        clear: "Effacer",
        simple: "Exemple : vallee simple",
        two: "Exemple : deux vallees",
        run: "Lancer la recherche",
        best: "Meilleur score",
        running: "L'algorithme explore les zones sombres.",
        done: "Termine : le meilleur point est marque."
      }
    : {
        title: "Draw your landscape",
        body: "Paint dark valleys. The algorithm will search for the lowest zones.",
        intensity: "Intensity",
        clear: "Clear",
        simple: "Example: simple valley",
        two: "Example: two valleys",
        run: "Run search",
        best: "Best score",
        running: "The algorithm is exploring dark zones.",
        done: "Done: the best point is marked."
      };

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const cw = canvas.width / W;
    const ch = canvas.height / H;
    for (let y = 0; y < H; y += 1) {
      for (let x = 0; x < W; x += 1) {
        const v = grid[y][x];
        const shade = Math.floor(32 + v * 190);
        ctx.fillStyle = `rgb(${shade},${shade + 20},${shade + 28})`;
        ctx.fillRect(x * cw, y * ch, cw + 1, ch + 1);
      }
    }
    points.forEach((point) => {
      ctx.fillStyle = point.best ? "#f9c74f" : "#29dba6";
      ctx.beginPath();
      ctx.arc(point.x * cw, point.y * ch, point.best ? 7 : 4, 0, Math.PI * 2);
      ctx.fill();
    });
  };

  useEffect(draw, [best, grid, points]);

  const paintAt = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const gx = Math.floor(((clientX - rect.left) / rect.width) * W);
    const gy = Math.floor(((clientY - rect.top) / rect.height) * H);
    setGrid((current) =>
      current.map((row, y) =>
        row.map((cell, x) => {
          const d = Math.hypot(x - gx, y - gy);
          if (d > 5) return cell;
          return Math.max(0, cell - intensity * (1 - d / 5));
        })
      )
    );
  };

  const loadValley = (two = false) => {
    const next = makeGrid();
    const centers = two ? [{ x: 18, y: 18 }, { x: 43, y: 25 }] : [{ x: 30, y: 20 }];
    centers.forEach((center, idx) => {
      for (let y = 0; y < H; y += 1) {
        for (let x = 0; x < W; x += 1) {
          const d = Math.hypot(x - center.x, y - center.y);
          next[y][x] = Math.min(next[y][x], Math.min(1, d / (idx === 0 ? 20 : 14)));
        }
      }
    });
    setGrid(next);
    setPoints([]);
    setBest(null);
  };

  const run = () => {
    setRunning(true);
    const population = Array.from({ length: 34 }, () => ({ x: Math.floor(Math.random() * W), y: Math.floor(Math.random() * H) }));
    let generation = 0;
    const timer = window.setInterval(() => {
      generation += 1;
      const moved = population.map((point) => {
        const candidates = [
          point,
          { x: Math.max(0, point.x - 1), y: point.y },
          { x: Math.min(W - 1, point.x + 1), y: point.y },
          { x: point.x, y: Math.max(0, point.y - 1) },
          { x: point.x, y: Math.min(H - 1, point.y + 1) },
          { x: Math.floor(Math.random() * W), y: Math.floor(Math.random() * H) }
        ];
        return candidates.sort((a, b) => grid[a.y][a.x] - grid[b.y][b.x])[0];
      });
      population.splice(0, population.length, ...moved);
      const bestPoint = moved.sort((a, b) => grid[a.y][a.x] - grid[b.y][b.x])[0];
      setBest({ ...bestPoint, score: grid[bestPoint.y][bestPoint.x] });
      setPoints(moved.map((point) => ({ ...point, best: point.x === bestPoint.x && point.y === bestPoint.y })));
      if (generation >= 40) {
        window.clearInterval(timer);
        setRunning(false);
      }
    }, 160);
  };

  return (
    <section className="rounded-2xl border border-stroke bg-card/70 p-4 shadow-glow">
      <h3 className="font-display text-base text-ice">{t.title}</h3>
      <p className="mt-1 text-xs text-slate">{running ? t.running : best ? t.done : t.body}</p>
      <canvas
        ref={canvasRef}
        width={600}
        height={400}
        onMouseDown={(event) => paintAt(event.clientX, event.clientY)}
        onMouseMove={(event) => {
          if (event.buttons === 1) paintAt(event.clientX, event.clientY);
        }}
        className="mt-3 aspect-[3/2] w-full rounded-lg border border-stroke bg-ink"
      />
      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
        <label className="flex items-center gap-2 text-slate">
          {t.intensity}
          <input type="range" min={0.05} max={0.8} step={0.05} value={intensity} onChange={(event) => setIntensity(Number(event.target.value))} />
        </label>
        <button type="button" onClick={() => setGrid(makeGrid())} className="rounded border border-stroke px-3 py-2 text-slate">{t.clear}</button>
        <button type="button" onClick={() => loadValley(false)} className="rounded border border-stroke px-3 py-2 text-slate">{t.simple}</button>
        <button type="button" onClick={() => loadValley(true)} className="rounded border border-stroke px-3 py-2 text-slate">{t.two}</button>
        <button type="button" onClick={run} className="rounded bg-accent px-3 py-2 font-semibold text-ink">{t.run}</button>
        {best && <span className="text-accent">{t.best}: {best.score.toFixed(3)}</span>}
      </div>
    </section>
  );
};
