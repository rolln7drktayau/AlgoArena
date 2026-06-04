interface WorkerResponse {
  id: string;
  ok: boolean;
  f?: number[];
  error?: string;
}

export const evaluateJavaScriptProblem = (source: string, x: number[], timeoutMs = 1000): Promise<number[]> =>
  new Promise((resolve, reject) => {
    const worker = new Worker(new URL("../workers/customProblemWorker.ts", import.meta.url), { type: "module" });
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const timer = window.setTimeout(() => {
      worker.terminate();
      reject(new Error(`JavaScript evaluator timed out after ${timeoutMs}ms.`));
    }, timeoutMs);

    worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      const message = event.data;
      if (message.id !== id) {
        return;
      }
      window.clearTimeout(timer);
      worker.terminate();
      if (!message.ok) {
        reject(new Error(message.error ?? "JavaScript evaluator failed."));
        return;
      }
      resolve(message.f ?? []);
    };

    worker.onerror = (event) => {
      window.clearTimeout(timer);
      worker.terminate();
      reject(new Error(event.message));
    };

    worker.postMessage({ id, source, x });
  });
