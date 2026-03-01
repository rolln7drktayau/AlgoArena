import { beforeEach, describe, expect, it } from "vitest";
import type { GenerationMessage } from "../types";
import { useAppStore } from "./useAppStore";

const initialState = useAppStore.getState();

const makeMessage = (generation: number, elapsed = generation * 0.1): GenerationMessage => ({
  type: "generation",
  run_id: "run-1",
  algorithm_id: "nsga2",
  algorithm_name: "NSGA-II",
  snapshot: {
    generation,
    elapsed_sec: elapsed,
    population: [{ x: [0.1, 0.2], f: [0.3, 0.4] }],
    metrics: { hv: 0.5, igd: 0.2, igd_plus: 0.2, spread: 0.1 },
    heatmap: [[0.1]],
    done: false
  }
});

describe("useAppStore realtime robustness", () => {
  beforeEach(() => {
    useAppStore.setState(initialState, true);
  });

  it("deduplicates same-generation snapshot updates", () => {
    const first = makeMessage(5, 0.5);
    const second = makeMessage(5, 0.6);

    useAppStore.getState().addSnapshot(first);
    useAppStore.getState().addSnapshot(second);

    const rows = useAppStore.getState().snapshotsByAlgorithm.nsga2;
    expect(rows).toHaveLength(1);
    expect(rows[0].elapsed_sec).toBe(0.6);
  });

  it("batches snapshots and keeps latest order", () => {
    const batch = [makeMessage(1), makeMessage(2), makeMessage(2, 0.25), makeMessage(3)];
    useAppStore.getState().addSnapshotsBatch(batch);

    const rows = useAppStore.getState().snapshotsByAlgorithm.nsga2;
    expect(rows).toHaveLength(3);
    expect(rows.map((item) => item.generation)).toEqual([1, 2, 3]);
    expect(rows[1].elapsed_sec).toBe(0.25);
  });

  it("caps history length for long runs", () => {
    const many = Array.from({ length: 2300 }, (_, idx) => makeMessage(idx + 1));
    useAppStore.getState().addSnapshotsBatch(many);
    const rows = useAppStore.getState().snapshotsByAlgorithm.nsga2;
    expect(rows).toHaveLength(2000);
    expect(rows[0].generation).toBe(301);
    expect(rows[rows.length - 1].generation).toBe(2300);
  });
});

