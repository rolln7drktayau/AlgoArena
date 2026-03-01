interface ScatterPoint {
  x: number;
  y: number;
  [key: string]: unknown;
}

interface ParallelLineInput {
  algorithm: string;
  values: number[];
}

interface DownsampleScatterRequest {
  id: number;
  type: "downsample_scatter";
  points: ScatterPoint[];
  maxPoints: number;
}

interface PrepareParallelRequest {
  id: number;
  type: "prepare_parallel";
  lines: ParallelLineInput[];
  maxLines: number;
}

type WorkerRequest = DownsampleScatterRequest | PrepareParallelRequest;

const downsampleScatter = (points: ScatterPoint[], maxPoints: number): ScatterPoint[] => {
  if (points.length <= maxPoints || maxPoints < 10) {
    return points;
  }

  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const rangeX = Math.max(1e-9, maxX - minX);
  const rangeY = Math.max(1e-9, maxY - minY);
  const cellsPerAxis = Math.max(3, Math.floor(Math.sqrt(maxPoints)));

  const bucket = new Map<string, ScatterPoint>();
  for (const point of points) {
    const xCell = Math.min(cellsPerAxis - 1, Math.floor(((point.x - minX) / rangeX) * cellsPerAxis));
    const yCell = Math.min(cellsPerAxis - 1, Math.floor(((point.y - minY) / rangeY) * cellsPerAxis));
    const key = `${xCell}:${yCell}`;
    if (!bucket.has(key)) {
      bucket.set(key, point);
    }
  }

  const sampled = Array.from(bucket.values());
  if (sampled.length >= maxPoints) {
    const stride = Math.max(1, Math.floor(sampled.length / maxPoints));
    return sampled.filter((_, index) => index % stride === 0).slice(0, maxPoints);
  }

  const picked = new Set(sampled);
  for (const point of points) {
    if (sampled.length >= maxPoints) {
      break;
    }
    if (!picked.has(point)) {
      sampled.push(point);
      picked.add(point);
    }
  }
  return sampled;
};

const prepareParallel = (lines: ParallelLineInput[], maxLines: number) => {
  const valid = lines.filter(
    (line) => line.values.length > 0 && line.values.every((value) => Number.isFinite(value))
  );
  if (valid.length === 0) {
    return { lines: [], extents: [] as Array<{ min: number; max: number }> };
  }

  let reduced = valid;
  if (valid.length > maxLines && maxLines > 0) {
    const stride = Math.ceil(valid.length / maxLines);
    reduced = valid.filter((_, index) => index % stride === 0).slice(0, maxLines);
  }

  const objectiveCount = reduced[0].values.length;
  const extents: Array<{ min: number; max: number }> = [];
  for (let objectiveIndex = 0; objectiveIndex < objectiveCount; objectiveIndex += 1) {
    const column = reduced.map((line) => line.values[objectiveIndex]);
    const min = Math.min(...column);
    const max = Math.max(...column);
    extents.push({ min, max: min === max ? min + 1 : max });
  }

  const normalized = reduced.map((line) => ({
    algorithm: line.algorithm,
    values: line.values.map((value, index) => {
      const extent = extents[index];
      return (value - extent.min) / (extent.max - extent.min);
    })
  }));

  return { lines: normalized, extents };
};

self.onmessage = (event: MessageEvent<WorkerRequest>) => {
  const payload = event.data;
  if (payload.type === "downsample_scatter") {
    const points = downsampleScatter(payload.points, payload.maxPoints);
    self.postMessage({ id: payload.id, type: payload.type, points });
    return;
  }

  const prepared = prepareParallel(payload.lines, payload.maxLines);
  self.postMessage({ id: payload.id, type: payload.type, ...prepared });
};
