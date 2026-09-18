import type { LabDocument } from "../types";

/** Accept the existing v1 format, including the additive Studio metadata. */
export function validateLab(value: unknown): LabDocument {
  if (!value || typeof value !== "object") throw Error("Invalid project");
  const lab = value as LabDocument;
  if (
    lab.schema_version !== 1 ||
    typeof lab.id !== "string" ||
    typeof lab.title !== "string" ||
    !lab.problem ||
    !["builtin", "expression", "uploaded", "external"].includes(
      lab.problem.kind,
    ) ||
    !Array.isArray(lab.algorithms) ||
    !Array.isArray(lab.pinned_metrics) ||
    !Array.isArray(lab.runs) ||
    typeof lab.updated_at !== "string"
  )
    throw Error("Unsupported or incomplete project");
  if (
    lab.algorithms.some(
      (a) =>
        !a ||
        typeof a.id !== "string" ||
        typeof a.name !== "string" ||
        typeof a.enabled !== "boolean" ||
        !a.hyperparams ||
        Object.values(a.hyperparams).some(
          (v) => typeof v !== "number" || !Number.isFinite(v),
        ),
    )
  ) {
    throw Error("Invalid algorithm configuration");
  }
  if (
    lab.studio &&
    (!Number.isInteger(lab.studio.seed) ||
      !["benchmark", "scenario"].includes(lab.studio.kind) ||
      !lab.studio.scenario ||
      !lab.studio.scenario.environments ||
      !Number.isFinite(lab.studio.scenario.taskCount))
  ) {
    throw Error("Invalid Studio configuration");
  }
  return lab;
}
