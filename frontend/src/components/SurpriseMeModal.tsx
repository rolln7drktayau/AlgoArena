import { useEffect, useMemo, useState } from "react";
import tspDemo from "../demo/tsp-demo.json";
import { useAppStore } from "../store/useAppStore";

interface Props {
  open: boolean;
  onClose: () => void;
}

const copy = {
  fr: {
    title: "Trouver le chemin le plus court entre des villes",
    subtitle: "Regarde le chemin se raccourcir. Pas besoin de regler quoi que ce soit.",
    algo: "Une recherche evolutive essaie de meilleurs chemins.",
    score: "Score",
    improvement: "amelioration",
    progress: "generation",
    try: "Essayer moi-meme",
    close: "Fermer"
  },
  en: {
    title: "Find the shortest route between cities",
    subtitle: "Watch the route get shorter. No setup needed.",
    algo: "An evolutionary search tries better routes.",
    score: "Score",
    improvement: "improvement",
    progress: "generation",
    try: "Try it myself",
    close: "Close"
  }
};

export const SurpriseMeModal = ({ open, onClose }: Props) => {
  const language = useAppStore((state) => state.language);
  const setTab = useAppStore((state) => state.setTab);
  const t = copy[language];
  const [index, setIndex] = useState(0);
  const history = tspDemo.history;
  const current = history[index] ?? history[0];
  const firstScore = history[0].score;
  const improvement = Math.max(0, Math.round(((firstScore - current.score) / firstScore) * 100));

  useEffect(() => {
    if (!open) {
      setIndex(0);
      return;
    }
    const timer = window.setInterval(() => {
      setIndex((value) => (value + 1) % history.length);
    }, 650);
    return () => window.clearInterval(timer);
  }, [history.length, open]);

  const path = useMemo(() => {
    const ordered = current.order.map((idx) => tspDemo.points[idx]);
    return [...ordered, ordered[0]].map((point) => `${point.x * 400},${point.y * 300}`).join(" ");
  }, [current]);

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-panel/90 p-4 backdrop-blur">
      <section className="w-full max-w-4xl rounded-xl border border-stroke bg-card p-5 shadow-glow">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-xl text-ice">{t.title}</h2>
            <p className="mt-1 text-sm text-slate">{t.subtitle}</p>
            <p className="mt-1 text-xs text-slate">{t.algo}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-md border border-stroke px-3 py-2 text-xs text-slate">
            {t.close}
          </button>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_240px]">
          <svg viewBox="0 0 400 300" className="h-[320px] w-full rounded-lg border border-stroke bg-ink">
            <polyline points={path} fill="none" stroke="#29dba6" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" opacity="0.9" />
            {tspDemo.points.map((point, pointIndex) => (
              <g key={pointIndex}>
                <circle cx={point.x * 400} cy={point.y * 300} r="6" fill="#f18f01" stroke="#101822" strokeWidth="2" />
                <text x={point.x * 400 + 8} y={point.y * 300 - 8} className="fill-current text-[10px] text-ice">
                  {pointIndex + 1}
                </text>
              </g>
            ))}
          </svg>

          <div className="rounded-lg border border-stroke bg-ink p-4">
            <p className="text-xs uppercase text-slate">{t.score}</p>
            <p className="mt-1 font-display text-4xl text-accent">{current.score.toFixed(2)}</p>
            <p className="mt-2 text-sm text-ice">{improvement}% {t.improvement}</p>
            <div className="mt-4 h-2 overflow-hidden rounded bg-card">
              <div className="h-full bg-accent" style={{ width: `${((index + 1) / history.length) * 100}%` }} />
            </div>
            <p className="mt-2 text-xs text-slate">
              {t.progress} {current.generation} / {history.length}
            </p>
            <button
              type="button"
              onClick={() => {
                setTab("explore");
                onClose();
              }}
              className="mt-5 w-full rounded-md bg-accent px-4 py-2 text-sm font-semibold text-ink"
            >
              {t.try}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};
