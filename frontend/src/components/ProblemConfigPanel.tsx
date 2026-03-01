import { FormEvent, useEffect, useMemo, useState } from "react";
import { buildApiUrl } from "../lib/api";
import type { ProblemKind, ProblemSpec, WorkflowSpec } from "../types";
import { useAppStore } from "../store/useAppStore";

export const ProblemConfigPanel = ({ problems }: { problems: ProblemSpec[] }) => {
  const problemConfig = useAppStore((state) => state.problemConfig);
  const setProblemConfig = useAppStore((state) => state.setProblemConfig);
  const setTab = useAppStore((state) => state.setTab);
  const [expressionText, setExpressionText] = useState("x[0]\n1.0 - np.sqrt(x[0])");
  const [customName, setCustomName] = useState("CustomExpressionProblem");
  const [uploadName, setUploadName] = useState("UploadedProblem");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [functionName, setFunctionName] = useState("evaluate");
  const [problemFeedback, setProblemFeedback] = useState<string | null>(null);
  const [workflowSpecs, setWorkflowSpecs] = useState<WorkflowSpec[]>([]);

  const builtinProblems = useMemo(
    () => problems.filter((item) => item.kind === "builtin").map((item) => item.name),
    [problems]
  );
  const workflowFamilies = useMemo(
    () => Array.from(new Set(workflowSpecs.map((item) => item.family))).sort(),
    [workflowSpecs]
  );

  useEffect(() => {
    const loadWorkflowSpecs = async () => {
      try {
        const response = await fetch(buildApiUrl("/api/workflows"));
        if (!response.ok) {
          return;
        }
        const data = (await response.json()) as { workflows: WorkflowSpec[] };
        setWorkflowSpecs(data.workflows ?? []);
      } catch {
        // Keep benchmark panel functional if workflow endpoint is unavailable.
      }
    };
    void loadWorkflowSpecs();
  }, []);

  const handleKindChange = (kind: ProblemKind) => {
    setProblemConfig({ kind, problem_id: undefined });
    setProblemFeedback(null);
  };

  const registerExpressionProblem = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const objectives = expressionText
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    if (objectives.length < 2 || objectives.length > 5) {
      setProblemFeedback("Use 2 to 5 objective expressions.");
      return;
    }

    const payload = {
      name: customName,
      objectives,
      n_var: problemConfig.n_var ?? 10,
      xl: problemConfig.xl ?? 0,
      xu: problemConfig.xu ?? 1
    };

    const response = await fetch(buildApiUrl("/api/problems/custom/expression"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    if (!response.ok) {
      const detail = await response.text();
      setProblemFeedback(`Expression problem failed: ${detail}`);
      return;
    }

    const data = (await response.json()) as { problem_id: string; name: string };
    setProblemConfig({
      kind: "expression",
      problem_id: data.problem_id,
      name: data.name,
      objectives
    });
    setProblemFeedback(`Registered expression problem: ${data.name}`);
  };

  const registerUploadedProblem = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!uploadFile) {
      setProblemFeedback("Choose a Python file first.");
      return;
    }
    const formData = new FormData();
    formData.append("file", uploadFile);
    formData.append("name", uploadName);
    formData.append("function_name", functionName);
    formData.append("n_var", String(problemConfig.n_var ?? 10));
    formData.append("n_obj", String(problemConfig.n_obj ?? 2));
    formData.append("xl", String(problemConfig.xl ?? 0));
    formData.append("xu", String(problemConfig.xu ?? 1));

    const response = await fetch(buildApiUrl("/api/problems/custom/upload"), {
      method: "POST",
      body: formData
    });
    if (!response.ok) {
      const detail = await response.text();
      setProblemFeedback(`Upload problem failed: ${detail}`);
      return;
    }
    const data = (await response.json()) as { problem_id: string; name: string };
    setProblemConfig({ kind: "uploaded", problem_id: data.problem_id, name: data.name });
    setProblemFeedback(`Registered uploaded problem: ${data.name}`);
  };

  return (
    <section className="rounded-2xl border border-stroke bg-card/70 p-4 shadow-glow">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-lg text-ice">Problem Definition</h2>
        <label className="text-xs text-slate">
          Kind
          <select
            className="ml-2 rounded-md border border-stroke bg-ink px-2 py-1 text-sm text-ice"
            value={problemConfig.kind}
            onChange={(event) => handleKindChange(event.target.value as ProblemKind)}
          >
            <option value="builtin">Built-in</option>
            <option value="expression">Lambda/Expression</option>
            <option value="uploaded">Upload Python Function</option>
          </select>
        </label>
      </div>

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <label className="text-xs text-slate">
          Variables
          <input
            type="number"
            min={2}
            className="mt-1 w-full rounded-md border border-stroke bg-ink px-2 py-1 text-ice"
            value={problemConfig.n_var ?? 10}
            onChange={(event) => setProblemConfig({ n_var: Number(event.target.value) })}
          />
        </label>
        <label className="text-xs text-slate">
          Objectives
          <input
            type="number"
            min={2}
            max={5}
            className="mt-1 w-full rounded-md border border-stroke bg-ink px-2 py-1 text-ice"
            value={problemConfig.n_obj ?? 2}
            onChange={(event) => setProblemConfig({ n_obj: Number(event.target.value) })}
          />
        </label>
        <label className="text-xs text-slate">
          Bounds (xl, xu)
          <div className="mt-1 flex gap-2">
            <input
              type="number"
              className="w-full rounded-md border border-stroke bg-ink px-2 py-1 text-ice"
              value={Number(problemConfig.xl ?? 0)}
              onChange={(event) => setProblemConfig({ xl: Number(event.target.value) })}
            />
            <input
              type="number"
              className="w-full rounded-md border border-stroke bg-ink px-2 py-1 text-ice"
              value={Number(problemConfig.xu ?? 1)}
              onChange={(event) => setProblemConfig({ xu: Number(event.target.value) })}
            />
          </div>
        </label>
      </div>

      {problemConfig.kind === "builtin" && (
        <label className="text-xs text-slate">
          Benchmark
          <select
            className="mt-1 w-full rounded-md border border-stroke bg-ink px-2 py-2 text-sm text-ice"
            value={problemConfig.name}
            onChange={(event) => setProblemConfig({ name: event.target.value })}
          >
            {builtinProblems.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </label>
      )}

      {problemConfig.kind === "expression" && (
        <form className="space-y-3" onSubmit={registerExpressionProblem}>
          <label className="block text-xs text-slate">
            Custom problem name
            <input
              className="mt-1 w-full rounded-md border border-stroke bg-ink px-2 py-1 text-ice"
              value={customName}
              onChange={(event) => setCustomName(event.target.value)}
            />
          </label>
          <label className="block text-xs text-slate">
            Objectives (one expression per line, variable is x)
            <textarea
              rows={4}
              className="mt-1 w-full rounded-md border border-stroke bg-ink px-2 py-2 font-mono text-xs text-ice"
              value={expressionText}
              onChange={(event) => setExpressionText(event.target.value)}
            />
          </label>
          <button className="rounded-md bg-accent px-3 py-2 text-sm font-semibold text-ink" type="submit">
            Register Expression Problem
          </button>
        </form>
      )}

      {problemConfig.kind === "uploaded" && (
        <form className="space-y-3" onSubmit={registerUploadedProblem}>
          <label className="block text-xs text-slate">
            Display name
            <input
              className="mt-1 w-full rounded-md border border-stroke bg-ink px-2 py-1 text-ice"
              value={uploadName}
              onChange={(event) => setUploadName(event.target.value)}
            />
          </label>
          <label className="block text-xs text-slate">
            Evaluate function name
            <input
              className="mt-1 w-full rounded-md border border-stroke bg-ink px-2 py-1 text-ice"
              value={functionName}
              onChange={(event) => setFunctionName(event.target.value)}
            />
          </label>
          <label className="block text-xs text-slate">
            Python file
            <input
              type="file"
              accept=".py"
              className="mt-1 block w-full text-xs text-ice file:mr-3 file:rounded-md file:border-0 file:bg-ember file:px-3 file:py-1 file:text-ink"
              onChange={(event) => setUploadFile(event.target.files?.[0] ?? null)}
            />
          </label>
          <button className="rounded-md bg-ember px-3 py-2 text-sm font-semibold text-ink" type="submit">
            Upload Problem Function
          </button>
        </form>
      )}

      {problemFeedback && <p className="mt-3 text-xs text-accent">{problemFeedback}</p>}

      <div className="mt-4 rounded-lg border border-stroke/70 bg-ink/50 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h4 className="font-display text-sm text-ice">Scientific Workflows</h4>
          <button
            type="button"
            onClick={() => setTab("scenario")}
            className="rounded border border-stroke px-2 py-1 text-xs text-slate"
          >
            Open Scenario Tab
          </button>
        </div>
        <p className="mt-1 text-[11px] text-slate">
          Detected: {workflowSpecs.length} workflow presets
          {workflowFamilies.length > 0 && ` (${workflowFamilies.join(", ")})`}.
        </p>
        <div className="mt-2 max-h-24 overflow-y-auto text-[11px] text-slate">
          {workflowSpecs.map((item) => (
            <div key={item.workflow_id}>
              {item.name} - {item.task_count} tasks
            </div>
          ))}
          {workflowSpecs.length === 0 && <div>No workflow preset loaded from backend.</div>}
        </div>
      </div>
    </section>
  );
};
