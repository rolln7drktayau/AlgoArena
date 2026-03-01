export interface WorkerScatterPoint {
  x: number;
  y: number;
  [key: string]: unknown;
}

export interface WorkerParallelLine {
  algorithm: string;
  values: number[];
}

interface WorkerResponseBase {
  id: number;
  type: string;
}

interface DownsampleResponse extends WorkerResponseBase {
  type: "downsample_scatter";
  points: WorkerScatterPoint[];
}

interface ParallelResponse extends WorkerResponseBase {
  type: "prepare_parallel";
  lines: Array<{ algorithm: string; values: number[] }>;
  extents: Array<{ min: number; max: number }>;
}

type WorkerResponse = DownsampleResponse | ParallelResponse;

let requestId = 0;

const spawnWorker = () => new Worker(new URL("../workers/chartWorker.ts", import.meta.url), { type: "module" });

export const downsampleScatterPoints = (
  points: WorkerScatterPoint[],
  maxPoints: number
): Promise<WorkerScatterPoint[]> => {
  const id = ++requestId;
  return new Promise((resolve, reject) => {
    const worker = spawnWorker();
    worker.onerror = () => {
      worker.terminate();
      reject(new Error("Scatter downsampling worker failed."));
    };
    worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      const payload = event.data;
      if (payload.id !== id || payload.type !== "downsample_scatter") {
        return;
      }
      worker.terminate();
      resolve(payload.points);
    };
    worker.postMessage({ id, type: "downsample_scatter", points, maxPoints });
  });
};

export const prepareParallelLines = (
  lines: WorkerParallelLine[],
  maxLines: number
): Promise<{ lines: Array<{ algorithm: string; values: number[] }>; extents: Array<{ min: number; max: number }> }> => {
  const id = ++requestId;
  return new Promise((resolve, reject) => {
    const worker = spawnWorker();
    worker.onerror = () => {
      worker.terminate();
      reject(new Error("Parallel coordinates worker failed."));
    };
    worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      const payload = event.data;
      if (payload.id !== id || payload.type !== "prepare_parallel") {
        return;
      }
      worker.terminate();
      resolve({ lines: payload.lines, extents: payload.extents });
    };
    worker.postMessage({ id, type: "prepare_parallel", lines, maxLines });
  });
};
