from __future__ import annotations

import math

import numpy as np
from pymoo.util.ref_dirs import get_reference_directions


def build_ref_dirs(
    n_obj: int,
    target_pop: int,
    min_partitions: int = 2,
    max_partitions: int = 14,
):
    partitions = max(min_partitions, min(max_partitions, int(round(target_pop ** (1.0 / max(1, n_obj - 1))))))
    return get_reference_directions("das-dennis", n_obj, n_partitions=partitions)


def build_ref_points(n_obj: int, count: int = 3) -> np.ndarray:
    if n_obj == 2:
        # Simple aspiration points spanning the trade-off line.
        base = np.array([[0.2, 0.8], [0.5, 0.5], [0.8, 0.2]], dtype=float)
        return base[: max(1, min(count, len(base)))]

    ref_dirs = build_ref_dirs(n_obj=n_obj, target_pop=max(count * 4, n_obj + 2), min_partitions=1, max_partitions=6)
    if len(ref_dirs) <= count:
        return ref_dirs.astype(float)
    idx = np.linspace(0, len(ref_dirs) - 1, count).astype(int)
    return ref_dirs[idx].astype(float)


def nearest_reference_point_count(
    n_obj: int,
    target_points: int,
    min_partitions: int = 1,
    max_partitions: int = 12,
) -> int:
    target = max(1, int(target_points))
    candidates: list[int] = []
    for n_partitions in range(min_partitions, max_partitions + 1):
        points = math.comb(n_partitions + n_obj - 1, n_obj - 1)
        candidates.append(points)
    if not candidates:
        return target
    candidates = sorted(set(candidates))
    best = min(candidates, key=lambda value: (abs(value - target), value))
    return int(best)
