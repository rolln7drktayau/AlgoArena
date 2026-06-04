import { useEffect } from "react";
import { useAppStore } from "../store/useAppStore";
import { useShallow } from "zustand/react/shallow";

export const ReplayControls = ({ maxGeneration }: { maxGeneration: number }) => {
  const { replay, setReplayEnabled, setReplayIndex, setReplayPlaying } = useAppStore(
    useShallow((state) => ({
      replay: state.replay,
      setReplayEnabled: state.setReplayEnabled,
      setReplayIndex: state.setReplayIndex,
      setReplayPlaying: state.setReplayPlaying
    }))
  );
  const language = useAppStore((state) => state.language);
  const t = language === "fr"
    ? { mode: "Mode Rejouer", pause: "Pause", play: "Lire", generation: "Generation" }
    : { mode: "Replay mode", pause: "Pause", play: "Play", generation: "Generation" };

  useEffect(() => {
    if (!replay.enabled || !replay.playing || maxGeneration <= 0) {
      return;
    }
    const timer = window.setInterval(() => {
      const current = useAppStore.getState().replay.index;
      if (current >= maxGeneration) {
        setReplayPlaying(false);
        return;
      }
      setReplayIndex(current + 1);
    }, 250);
    return () => window.clearInterval(timer);
  }, [maxGeneration, replay.enabled, replay.playing, setReplayIndex, setReplayPlaying]);

  return (
    <section className="rounded-xl border border-stroke bg-card/70 p-3">
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-xs text-slate">
          <input
            type="checkbox"
            checked={replay.enabled}
            onChange={(event) => setReplayEnabled(event.target.checked)}
            className="h-4 w-4 accent-ember"
          />
          {t.mode}
        </label>
        <button
          type="button"
          disabled={!replay.enabled || maxGeneration === 0}
          className="rounded-md bg-ember px-3 py-1 text-xs font-semibold text-ink disabled:opacity-50"
          onClick={() => setReplayPlaying(!replay.playing)}
        >
          {replay.playing ? t.pause : t.play}
        </button>
        <span className="text-xs text-slate">
          {t.generation} {replay.index}/{maxGeneration}
        </span>
      </div>
      <input
        type="range"
        min={0}
        max={maxGeneration}
        value={Math.min(replay.index, maxGeneration)}
        disabled={!replay.enabled || maxGeneration === 0}
        onChange={(event) => setReplayIndex(Number(event.target.value))}
        className="mt-3 w-full accent-accent disabled:opacity-50"
      />
    </section>
  );
};
