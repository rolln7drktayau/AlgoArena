from __future__ import annotations

from typing import Any

import numpy as np
from pymoo.indicators.gd import GD
from pymoo.indicators.gd_plus import GDPlus
from pymoo.indicators.hv import HV
from pymoo.indicators.igd import IGD
from pymoo.indicators.igd_plus import IGDPlus


def _safe_float(value: Any) -> float | None:
    try:
        result = float(value)
    except (TypeError, ValueError):
        return None
    if np.isnan(result) or np.isinf(result):
        return None
    return result


def compute_spread(pop_objectives: np.ndarray, reference_front: np.ndarray | None = None) -> float | None:
    if pop_objectives.size == 0 or len(pop_objectives) < 2:
        return None

    points = np.asarray(pop_objectives, dtype=float)
    # Delta is standard for 2-objective fronts; for >=3 we use CV of nearest-neighbor distances.
    if points.shape[1] == 2:
        order = np.argsort(points[:, 0])
        sorted_points = points[order]
        distances = np.linalg.norm(np.diff(sorted_points, axis=0), axis=1)
        if len(distances) == 0:
            return None
        d_bar = np.mean(distances)
        if d_bar <= 0:
            return 0.0

        d_f = 0.0
        d_l = 0.0
        if reference_front is not None and len(reference_front) > 1:
            ref_sorted = reference_front[np.argsort(reference_front[:, 0])]
            d_f = np.linalg.norm(sorted_points[0] - ref_sorted[0])
            d_l = np.linalg.norm(sorted_points[-1] - ref_sorted[-1])

        numerator = d_f + d_l + np.sum(np.abs(distances - d_bar))
        denominator = d_f + d_l + (len(distances) * d_bar)
        if denominator <= 0:
            return None
        return float(numerator / denominator)

    distances = []
    for i, point in enumerate(points):
        others = np.delete(points, i, axis=0)
        nearest = np.min(np.linalg.norm(others - point, axis=1))
        distances.append(nearest)
    distances_arr = np.array(distances)
    mean_dist = np.mean(distances_arr)
    if mean_dist <= 0:
        return 0.0
    return float(np.std(distances_arr) / mean_dist)


def compute_spacing(pop_objectives: np.ndarray) -> float | None:
    if pop_objectives.size == 0 or len(pop_objectives) < 2:
        return None
    points = np.asarray(pop_objectives, dtype=float)
    nearest_distances = []
    for i, point in enumerate(points):
        others = np.delete(points, i, axis=0)
        if len(others) == 0:
            continue
        nearest = np.min(np.linalg.norm(others - point, axis=1))
        nearest_distances.append(nearest)
    if len(nearest_distances) < 2:
        return 0.0
    distances = np.asarray(nearest_distances, dtype=float)
    d_bar = np.mean(distances)
    if d_bar <= 0:
        return 0.0
    return float(np.sqrt(np.sum((distances - d_bar) ** 2) / (len(distances) - 1)))


def compute_additive_epsilon(pop_objectives: np.ndarray, reference_front: np.ndarray | None) -> float | None:
    if reference_front is None or len(reference_front) == 0 or pop_objectives.size == 0:
        return None
    p = np.asarray(pop_objectives, dtype=float)
    r = np.asarray(reference_front, dtype=float)
    if p.shape[1] != r.shape[1]:
        return None
    epsilon_values = []
    for ref_point in r:
        min_over_pop = np.inf
        for pop_point in p:
            min_over_pop = min(min_over_pop, np.max(pop_point - ref_point))
        epsilon_values.append(min_over_pop)
    if len(epsilon_values) == 0:
        return None
    return _safe_float(np.max(epsilon_values))


def build_diversity_heatmap(pop_objectives: np.ndarray, bins: int = 12) -> list[list[float]]:
    if pop_objectives.size == 0:
        return [[0.0 for _ in range(bins)] for _ in range(bins)]

    points = np.asarray(pop_objectives, dtype=float)
    x_axis = points[:, 0]
    y_axis = points[:, 1] if points.shape[1] > 1 else np.zeros_like(x_axis)
    heatmap, _, _ = np.histogram2d(x_axis, y_axis, bins=bins)
    max_count = np.max(heatmap)
    if max_count > 0:
        heatmap = heatmap / max_count
    return heatmap.round(6).tolist()


def compute_metrics(
    pop_objectives: np.ndarray,
    reference_front: np.ndarray | None = None,
    hv_reference_point: np.ndarray | None = None,
) -> dict[str, float | None]:
    if pop_objectives.size == 0:
        return {
            "hv": None,
            "igd": None,
            "igd_plus": None,
            "gd": None,
            "gd_plus": None,
            "epsilon": None,
            "spread": None,
            "spacing": None,
        }

    points = np.asarray(pop_objectives, dtype=float)
    hv_ref = hv_reference_point
    if hv_ref is None:
        hv_ref = np.max(points, axis=0) * 1.15 + 1e-9

    hv_score: float | None = None
    igd_score: float | None = None
    igd_plus_score: float | None = None
    gd_score: float | None = None
    gd_plus_score: float | None = None

    try:
        hv_indicator = HV(ref_point=hv_ref)
        hv_score = _safe_float(hv_indicator(points))
    except Exception:
        hv_score = None

    if reference_front is not None and len(reference_front) > 0:
        try:
            igd_score = _safe_float(IGD(reference_front)(points))
        except Exception:
            igd_score = None
        try:
            igd_plus_score = _safe_float(IGDPlus(reference_front)(points))
        except Exception:
            igd_plus_score = None
        try:
            gd_score = _safe_float(GD(reference_front)(points))
        except Exception:
            gd_score = None
        try:
            gd_plus_score = _safe_float(GDPlus(reference_front)(points))
        except Exception:
            gd_plus_score = None

    spread_score = _safe_float(compute_spread(points, reference_front))
    spacing_score = _safe_float(compute_spacing(points))
    epsilon_score = _safe_float(compute_additive_epsilon(points, reference_front))
    return {
        "hv": hv_score,
        "igd": igd_score,
        "igd_plus": igd_plus_score,
        "gd": gd_score,
        "gd_plus": gd_plus_score,
        "epsilon": epsilon_score,
        "spread": spread_score,
        "spacing": spacing_score,
    }
