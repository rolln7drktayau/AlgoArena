import type { LeaderboardEntry } from "../types";

const metric = (value: number | null | undefined): string => {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "-";
  }
  return value.toFixed(4);
};

export const Leaderboard = ({ entries }: { entries: LeaderboardEntry[] }) => {
  return (
    <section className="rounded-xl border border-stroke bg-card/70 p-3">
      <h3 className="font-display text-sm text-ice">Live Leaderboard</h3>
      <div className="mt-2 overflow-x-auto">
        <table className="min-w-full text-left text-xs text-slate">
          <thead>
            <tr className="border-b border-stroke text-[11px] uppercase tracking-wide">
              <th className="px-2 py-2">#</th>
              <th className="px-2 py-2">Algorithm</th>
              <th className="px-2 py-2">HV</th>
              <th className="px-2 py-2">IGD</th>
              <th className="px-2 py-2">Eps</th>
              <th className="px-2 py-2">Speed</th>
              <th className="px-2 py-2">TTC</th>
              <th className="px-2 py-2">Elapsed</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <tr key={entry.algorithm_id} className="border-b border-stroke/50">
                <td className="px-2 py-2 text-ice">{entry.rank}</td>
                <td className="px-2 py-2">{entry.algorithm_name}</td>
                <td className="px-2 py-2">{metric(entry.hv)}</td>
                <td className="px-2 py-2">{metric(entry.igd)}</td>
                <td className="px-2 py-2">{metric(entry.epsilon)}</td>
                <td className="px-2 py-2">{metric(entry.generation_speed)}</td>
                <td className="px-2 py-2">{entry.time_to_convergence ?? "-"}</td>
                <td className="px-2 py-2">{entry.elapsed_sec.toFixed(2)}s</td>
              </tr>
            ))}
            {entries.length === 0 && (
              <tr>
                <td colSpan={8} className="px-2 py-3 text-center text-xs text-slate">
                  Run a competition to populate leaderboard.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
};
