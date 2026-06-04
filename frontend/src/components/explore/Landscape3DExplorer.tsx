import { useEffect, useRef, useState } from "react";
import { useAppStore } from "../../store/useAppStore";

const functions = {
  sphere: (x: number, y: number) => x * x + y * y,
  rastrigin: (x: number, y: number) => 20 + x * x + y * y - 10 * (Math.cos(2 * Math.PI * x) + Math.cos(2 * Math.PI * y)),
  rosenbrock: (x: number, y: number) => (1 - x) ** 2 + 10 * (y - x * x) ** 2,
  ackley: (x: number, y: number) => -20 * Math.exp(-0.2 * Math.sqrt((x * x + y * y) / 2)) - Math.exp((Math.cos(2 * Math.PI * x) + Math.cos(2 * Math.PI * y)) / 2) + 20 + Math.E
};

export const Landscape3DExplorer = () => {
  const language = useAppStore((state) => state.language);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [kind, setKind] = useState<keyof typeof functions>("rastrigin");
  const [angle, setAngle] = useState(0.7);
  const [zoom, setZoom] = useState(1);
  const [speed, setSpeed] = useState(1);
  const t = language === "fr"
    ? {
        title: "Paysage 3D",
        hint: "Glisser pour tourner · Molette pour zoomer",
        problem: "Paysage",
        speed: "Vitesse",
        legend1: "Bleu = bonne solution (fitness basse) | Rouge = mauvaise solution",
        legend2: "Etoile = meilleure solution trouvee",
        descriptions: {
          rastrigin: "Surface tres accidentee avec beaucoup de faux minima. L'algorithme peut facilement se perdre.",
          sphere: "Surface simple avec un seul minimum global. N'importe quel algorithme le trouve facilement.",
          rosenbrock: "Vallee en forme de banane. Facile a trouver, difficile a suivre jusqu'au fond.",
          ackley: "Surface plate avec un bassin central. L'exploration doit trouver l'entree du bassin."
        }
      }
    : {
        title: "3D Landscape",
        hint: "Drag to rotate · Wheel to zoom",
        problem: "Landscape",
        speed: "Speed",
        legend1: "Blue = good solution (low fitness) | Red = bad solution",
        legend2: "Star = best solution found",
        descriptions: {
          rastrigin: "Very rugged surface with many false minima. The algorithm can easily get lost.",
          sphere: "Simple surface with one global minimum. Almost any algorithm finds it easily.",
          rosenbrock: "Banana-shaped valley. Easy to find, hard to follow to the bottom.",
          ackley: "Flat surface with a central basin. Exploration must find the basin entrance."
        }
      };

  useEffect(() => {
    const timer = window.setInterval(() => {
      setAngle((value) => value + 0.006 * speed);
    }, 60);
    return () => window.clearInterval(timer);
  }, [speed]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#101822";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const fn = functions[kind];
    const rows: Array<{ x: number; y: number; z: number; sx: number; sy: number }> = [];
    const n = 42;
    for (let iy = 0; iy < n; iy += 1) {
      for (let ix = 0; ix < n; ix += 1) {
        const x = -2 + (ix / (n - 1)) * 4;
        const y = -2 + (iy / (n - 1)) * 4;
        const z = Math.min(40, fn(x, y));
        const rx = x * Math.cos(angle) - y * Math.sin(angle);
        const ry = x * Math.sin(angle) + y * Math.cos(angle);
        rows.push({ x, y, z, sx: 300 + rx * 70 * zoom, sy: 230 + ry * 30 * zoom - z * 5 * zoom });
      }
    }
    const maxZ = Math.max(...rows.map((p) => p.z));
    rows.sort((a, b) => a.sy - b.sy).forEach((p) => {
      const hot = p.z / maxZ;
      ctx.fillStyle = `rgb(${Math.floor(40 + hot * 200)}, ${Math.floor(210 - hot * 150)}, ${Math.floor(255 - hot * 220)})`;
      ctx.beginPath();
      ctx.arc(p.sx, p.sy, 2.4 * zoom, 0, Math.PI * 2);
      ctx.fill();
    });
  }, [angle, kind, t.hint, zoom]);

  return (
    <section className="rounded-2xl border border-stroke bg-card/70 p-4 shadow-glow">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-display text-base text-ice">{t.title}</h3>
          <p className="mt-1 text-xs text-slate">{t.hint}</p>
        </div>
        <div className="flex max-w-2xl flex-wrap items-center gap-2">
          <label className="text-xs text-slate">
            {t.problem}
            <select value={kind} onChange={(event) => setKind(event.target.value as keyof typeof functions)} className="ml-2 rounded border border-stroke bg-ink px-2 py-1 text-ice">
              <option value="sphere">Sphere</option>
              <option value="rastrigin">Rastrigin</option>
              <option value="rosenbrock">Rosenbrock</option>
              <option value="ackley">Ackley</option>
            </select>
          </label>
          <p className="text-xs leading-5 text-slate">{t.descriptions[kind]}</p>
        </div>
      </div>
      <div className="relative">
        <canvas
          ref={canvasRef}
          width={600}
          height={420}
          onMouseMove={(event) => {
            if (event.buttons === 1) setAngle((value) => value + event.movementX * 0.01);
          }}
          onWheel={(event) => {
            event.preventDefault();
            setZoom((value) => Math.min(1.8, Math.max(0.55, value - event.deltaY * 0.001)));
          }}
          onDoubleClick={() => {
            setAngle(0.7);
            setZoom(1);
          }}
          className="aspect-[10/7] w-full rounded-lg border border-stroke bg-ink"
        />
        <div className="absolute bottom-3 left-3 rounded-md border border-stroke bg-card/90 px-3 py-2 text-xs text-ice">
          {t.hint}
        </div>
      </div>
      <div className="mt-3 space-y-1 text-xs text-slate">
        <p>{t.legend1}</p>
        <p>{t.legend2}</p>
      </div>
      <label className="mt-3 flex max-w-sm items-center gap-3 text-xs text-slate">
        {t.speed}
        <span>Lent</span>
        <input type="range" min={0.3} max={2.4} step={0.1} value={speed} onChange={(event) => setSpeed(Number(event.target.value))} className="w-full accent-accent" />
        <span>Rapide</span>
      </label>
    </section>
  );
};
