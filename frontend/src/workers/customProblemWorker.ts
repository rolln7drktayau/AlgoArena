interface WorkerRequest {
  id: string;
  source: string;
  x: number[];
}

const blockedTokens = ["import(", "fetch(", "XMLHttpRequest", "WebSocket", "localStorage", "sessionStorage", "indexedDB", "postMessage", "self.", "globalThis", "Function("];

self.onmessage = (event: MessageEvent<WorkerRequest>) => {
  const { id, source, x } = event.data;
  try {
    for (const token of blockedTokens) {
      if (source.includes(token)) {
        throw new Error(`Unsupported token in worker evaluator: ${token}`);
      }
    }
    const wrapped = `"use strict";\n${source}\nreturn evaluate;`;
    const factory = new Function(wrapped);
    const evaluate = factory();
    if (typeof evaluate !== "function") {
      throw new Error("JavaScript evaluator must define evaluate(x).");
    }
    const raw = evaluate(Object.freeze([...x]));
    const values = Array.isArray(raw) ? raw : [raw];
    const f = values.map((value) => {
      const parsed = Number(value);
      if (!Number.isFinite(parsed)) {
        throw new Error("Evaluator returned a non-finite value.");
      }
      return parsed;
    });
    self.postMessage({ id, ok: true, f });
  } catch (error) {
    self.postMessage({ id, ok: false, error: error instanceof Error ? error.message : "Evaluation failed." });
  }
};

export {};
