import { useEffect, useRef, useState } from "react";
import { buildApiUrl, buildWsUrl } from "../lib/api";
import { buildRunPayload, useAppStore } from "../store/useAppStore";
import { number } from "./plots";

interface Sample {
  problem: string;
  algorithm: string;
  seed: number;
  status: string;
  actual_evaluations?: number;
  budget_exact?: boolean;
  metrics?: Record<string, number | null>;
  error?: string;
}
interface Comparison {
  left: string;
  right: string;
  p_holm: number;
  rank_biserial: number;
}
interface Result {
  samples: Sample[];
  comparisons: Comparison[];
  statistical_design: string;
}
export function useCampaign() {
  const [running, setRunning] = useState(false),
    [error, setError] = useState<string | null>(null);
  const [samples, setSamples] = useState<Sample[]>([]),
    [result, setResult] = useState<Result | null>(null);
  const [progress, setProgress] = useState({ completed: 0, total: 1 });
  const [runId, setRunId] = useState<string | null>(null);
  const socket = useRef<WebSocket | null>(null);
  const stop = () => {
    socket.current?.close();
    socket.current = null;
    setRunning(false);
  };
  useEffect(() => () => socket.current?.close(), []);
  const launch = (payload: {
    problems: unknown[];
    algorithms: unknown[];
    seeds: number[];
    evaluations: number;
    resume_from?: string;
  }) => {
    stop();
    setError(null);
    setSamples([]);
    setResult(null);
    setRunning(true);
    setRunId(null);
    setProgress({
      completed: 0,
      total:
        payload.problems.length *
        payload.seeds.length *
        payload.algorithms.length,
    });
    const ws = new WebSocket(buildWsUrl("/ws/campaign"));
    socket.current = ws;
    ws.onopen = () =>
      ws.send(JSON.stringify({ type: "start_campaign", payload }));
    ws.onmessage = (event) => {
      if (socket.current !== ws) return;
      const message = JSON.parse(event.data);
      if (message.run_id) setRunId(message.run_id);
      if (message.type === "campaign_sample") {
        setSamples((previous) => [...previous, message.sample]);
        setProgress({ completed: message.completed, total: message.total });
      }
      if (message.type === "campaign_completed") {
        setResult(message.payload);
        setRunning(false);
      }
      if (message.type === "error") setError(message.error);
    };
    ws.onerror = () => setError("Connexion de campagne interrompue.");
    ws.onclose = () => {
      if (socket.current === ws) setRunning(false);
    };
  };
  const start = (problems: string[], seeds: number[], evaluations: number) => {
    const algorithms = buildRunPayload().algorithms;
    if (!algorithms.length) {
      setError("Activez au moins un algorithme dans la bibliothèque.");
      return;
    }
    launch({
      problems: problems.map((name) => ({
        ...useAppStore.getState().problemConfig,
        kind: "builtin",
        name,
      })),
      algorithms,
      seeds,
      evaluations,
    });
  };
  const resume = async (id: string) => {
    try {
      const response = await fetch(buildApiUrl(`/api/runs/${id}/manifest`));
      if (!response.ok) throw Error("Manifeste introuvable.");
      const manifest = await response.json();
      launch({ ...manifest.config, resume_from: id });
    } catch (e) {
      setError((e as Error).message);
    }
  };
  return {
    running,
    error,
    samples,
    result,
    start,
    stop,
    progress,
    runId,
    resume,
  };
}

export function CampaignPanel({
  campaign,
  disabled,
}: {
  campaign: ReturnType<typeof useCampaign>;
  disabled: boolean;
}) {
  const problems = useAppStore((s) => s.problems);
  const [chosen, setChosen] = useState(["ZDT1"]),
    [seeds, setSeeds] = useState("42, 43, 44, 45, 46");
  const [budget, setBudget] = useState(1200);
  const download = () => {
    const a = document.createElement("a"),
      url = URL.createObjectURL(
        new Blob([JSON.stringify(campaign.result, null, 2)], {
          type: "application/json",
        }),
      );
    a.href = url;
    a.download = `campaign-${campaign.runId}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return (
    <section className="studio-card form-card">
      <h1>CAMPAGNES ET STATISTIQUES</h1>
      <p className="subtle">
        Problèmes × configurations actives × graines. Un résultat final par
        exécution indépendante.
      </p>
      <fieldset disabled={disabled}>
        <div className="campaign-problems">
          {problems
            .filter((p) => p.kind === "builtin")
            .map((p) => (
              <label key={p.name}>
                <input
                  type="checkbox"
                  checked={chosen.includes(p.name)}
                  onChange={() =>
                    setChosen((previous) =>
                      previous.includes(p.name)
                        ? previous.filter((n) => n !== p.name)
                        : [...previous, p.name],
                    )
                  }
                />
                {p.name}
              </label>
            ))}
        </div>
        <label className="field">
          Graines de base distinctes, séparées par des virgules
          <input value={seeds} onChange={(e) => setSeeds(e.target.value)} />
        </label>
        <label className="field">
          Budget demandé par exécution (évaluations)
          <input
            type="number"
            min="100"
            max="100000"
            value={budget}
            onChange={(e) => setBudget(+e.target.value)}
          />
        </label>
        <button
          className="primary"
          disabled={!chosen.length || !seeds.trim()}
          onClick={() =>
            campaign.start(
              chosen,
              seeds.split(",").map((s) => Number(s.trim())),
              budget,
            )
          }
        >
          Lancer la campagne
        </button>
      </fieldset>
      <p className="info-box">
        Seuls les runs réussis ayant exactement le budget demandé entrent dans
        les comparaisons. Le dépassement éventuel d’une génération complète est
        signalé. Mann–Whitney bilatéral sur HV, correction de Holm, taille
        d’effet ; minimum de cinq observations par groupe, sans garantie
        universelle de puissance statistique.
      </p>
      {campaign.error && (
        <p role="alert" className="studio-alert">
          {campaign.error}
        </p>
      )}
      {(campaign.running || campaign.samples.length > 0) && (
        <p>
          {campaign.progress.completed} / {campaign.progress.total} exécutions
        </p>
      )}
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Problème</th>
              <th>Algorithme</th>
              <th>Graine</th>
              <th>Évaluations</th>
              <th>HV</th>
              <th>Statut</th>
            </tr>
          </thead>
          <tbody>
            {campaign.samples.map((s, i) => (
              <tr key={i}>
                <td>{s.problem}</td>
                <td>{s.algorithm}</td>
                <td>{s.seed}</td>
                <td>{s.actual_evaluations ?? "—"}</td>
                <td>{number(s.metrics?.hv)}</td>
                <td title={s.error}>
                  {s.status === "failed"
                    ? s.error
                    : s.budget_exact
                      ? "Budget respecté"
                      : "Budget différent · exclu"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {campaign.result && (
        <>
          <h2>Comparaisons entre groupes indépendants</h2>
          {campaign.result.comparisons.length ? (
            <table>
              <thead>
                <tr>
                  <th>Comparaison</th>
                  <th>p corrigée (Holm)</th>
                  <th>Effet rang-bisérial</th>
                </tr>
              </thead>
              <tbody>
                {campaign.result.comparisons.map((c, i) => (
                  <tr key={i}>
                    <td>
                      {c.left} / {c.right}
                    </td>
                    <td>{number(c.p_holm)}</td>
                    <td>{number(c.rank_biserial)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="subtle">
              Pas de comparaison disponible : effectifs, référence HV ou budgets
              insuffisants.
            </p>
          )}
          <button onClick={download}>
            Exporter la campagne complète · JSON
          </button>
        </>
      )}
    </section>
  );
}
