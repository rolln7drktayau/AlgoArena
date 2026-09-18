import { describe, expect, it } from "vitest";
import { validateLab } from "./validateLab";

describe("Project migration", () => {
  it("preserves an existing v1 lab without Studio metadata", () => {
    const old = {
      schema_version: 1,
      id: "old",
      title: "Old lab",
      updated_at: "2026-01-01",
      problem: { kind: "builtin", name: "ZDT1" },
      algorithms: [],
      pinned_metrics: ["hv"],
      runs: [],
    };
    expect(validateLab(old)).toBe(old);
  });
  it("rejects malformed and future schemas instead of loading them into the store", () => {
    expect(() => validateLab({ schema_version: 99 })).toThrow();
    expect(() => validateLab(null)).toThrow();
  });
});
