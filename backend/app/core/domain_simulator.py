from __future__ import annotations

import math
import random
from dataclasses import dataclass
from typing import Any, Literal

import numpy as np
from pydantic import BaseModel, Field

from problems.safe_expressions import compile_safe_expression


DomainKind = Literal["mono_objective", "tsp", "bin_packing", "bayesian", "noisy", "drawable"]


class DomainSimulationRequest(BaseModel):
    kind: DomainKind
    algorithm: str = "random_search"
    iterations: int = Field(default=120, ge=1, le=5000)
    seed: int | None = None
    expression: str | None = None
    dimension: int = Field(default=2, ge=1, le=8)
    noise_std: float = Field(default=0.05, ge=0.0, le=100.0)
    points: list[tuple[float, float]] | None = None
    item_sizes: list[float] | None = None
    bin_capacity: float = Field(default=1.0, gt=0.0)
    canvas: list[list[float]] | None = None


@dataclass
class Candidate:
    x: list[float]
    value: float


def _rng(seed: int | None) -> random.Random:
    return random.Random(seed if seed is not None else 42)


def _default_expression(kind: DomainKind) -> str:
    if kind == "noisy":
        return "sum((x[i] - 0.35)**2 for i in range(len(x)))"
    return "sum((x[i] - 0.5)**2 for i in range(len(x)))"


def _evaluate_expression(expression: str, x: list[float]) -> float:
    # The safe expression compiler expects numpy arrays and validates AST syntax.
    evaluator = compile_safe_expression(expression)
    return evaluator(np.asarray(x, dtype=float))


def _run_mono(request: DomainSimulationRequest) -> dict[str, Any]:
    rng = _rng(request.seed)
    expression = request.expression or _default_expression(request.kind)
    best: Candidate | None = None
    history: list[dict[str, Any]] = []
    decision_points: list[dict[str, float]] = []
    for iteration in range(1, request.iterations + 1):
        x = [rng.random() for _ in range(request.dimension)]
        value = _evaluate_expression(expression, x)
        if request.kind == "noisy":
            value += rng.gauss(0.0, request.noise_std)
        if best is None or value < best.value:
            best = Candidate(x=x, value=value)
        if len(x) >= 2:
            decision_points.append({"x": x[0], "y": x[1], "value": value})
        history.append({"iteration": iteration, "x": x, "value": value, "best": best.value})
    confidence_band = None
    if request.kind == "noisy":
        rolling = []
        window = max(5, min(30, request.iterations // 6 or 5))
        for index in range(len(history)):
            values = [row["value"] for row in history[max(0, index - window + 1) : index + 1]]
            mean = float(np.mean(values))
            std = float(np.std(values))
            rolling.append({"iteration": history[index]["iteration"], "mean": mean, "low": mean - 1.96 * std, "high": mean + 1.96 * std})
        confidence_band = rolling
    landscape = None
    if request.dimension == 2:
        grid = []
        for gy in range(24):
            row = []
            for gx in range(24):
                row.append(_evaluate_expression(expression, [gx / 23, gy / 23]))
            grid.append(row)
        landscape = grid
    return {
        "kind": request.kind,
        "algorithm": request.algorithm,
        "best": {"x": best.x if best else [], "value": best.value if best else None},
        "history": history,
        "decision_points": decision_points,
        "confidence_band": confidence_band,
        "landscape": landscape,
        "visualizations": ["fitness_curve", "landscape_2d" if request.dimension == 2 else "sample_history", "decision_vs_objective"],
    }


def _route_length(order: list[int], points: list[tuple[float, float]]) -> float:
    total = 0.0
    for idx, current in enumerate(order):
        nxt = order[(idx + 1) % len(order)]
        ax, ay = points[current]
        bx, by = points[nxt]
        total += math.dist((ax, ay), (bx, by))
    return total


def _run_tsp(request: DomainSimulationRequest) -> dict[str, Any]:
    rng = _rng(request.seed)
    points = request.points or [(rng.random(), rng.random()) for _ in range(16)]
    order = list(range(len(points)))
    rng.shuffle(order)
    best_order = list(order)
    best_length = _route_length(best_order, points)
    history = [{"iteration": 0, "value": best_length, "best": best_length, "order": best_order}]
    genealogy = []
    temperature = 1.0
    for iteration in range(1, request.iterations + 1):
        candidate = list(order)
        i, j = rng.sample(range(len(candidate)), 2)
        candidate[i], candidate[j] = candidate[j], candidate[i]
        current_length = _route_length(order, points)
        candidate_length = _route_length(candidate, points)
        accept = candidate_length < current_length or rng.random() < math.exp((current_length - candidate_length) / max(1e-9, temperature))
        if accept:
            genealogy.append({"iteration": iteration, "parent": order, "child": candidate, "accepted": True})
            order = candidate
            current_length = candidate_length
        else:
            genealogy.append({"iteration": iteration, "parent": order, "child": candidate, "accepted": False})
        if current_length < best_length:
            best_order = list(order)
            best_length = current_length
        temperature *= 0.995
        history.append({"iteration": iteration, "value": current_length, "best": best_length, "order": list(order)})
    return {
        "kind": "tsp",
        "algorithm": "simulated_annealing",
        "points": [{"x": x, "y": y} for x, y in points],
        "best": {"order": best_order, "value": best_length},
        "history": history,
        "genealogy": genealogy[-80:],
        "visualizations": ["route_view", "fitness_curve", "solution_genealogy"],
    }


def _pack_bins(order: list[int], sizes: list[float], capacity: float) -> list[list[int]]:
    bins: list[list[int]] = []
    remaining: list[float] = []
    for item_idx in order:
        size = sizes[item_idx]
        placed = False
        for bin_idx, room in enumerate(remaining):
            if size <= room + 1e-9:
                bins[bin_idx].append(item_idx)
                remaining[bin_idx] -= size
                placed = True
                break
        if not placed:
            bins.append([item_idx])
            remaining.append(capacity - size)
    return bins


def _run_bin_packing(request: DomainSimulationRequest) -> dict[str, Any]:
    rng = _rng(request.seed)
    sizes = request.item_sizes or [round(rng.uniform(0.08, 0.65), 3) for _ in range(24)]
    order = list(range(len(sizes)))
    best_bins = _pack_bins(order, sizes, request.bin_capacity)
    best_score = len(best_bins)
    history = []
    for iteration in range(1, request.iterations + 1):
        if request.algorithm == "first_fit_decreasing":
            order = sorted(range(len(sizes)), key=lambda idx: sizes[idx], reverse=True)
        else:
            rng.shuffle(order)
        bins = _pack_bins(order, sizes, request.bin_capacity)
        score = len(bins)
        if score < best_score:
            best_bins = bins
            best_score = score
        history.append({"iteration": iteration, "value": score, "best": best_score, "bins": bins})
    return {
        "kind": "bin_packing",
        "algorithm": request.algorithm,
        "items": sizes,
        "capacity": request.bin_capacity,
        "best": {"bins": best_bins, "value": best_score},
        "history": history,
        "visualizations": ["packing_view", "fitness_curve"],
    }


def _run_bayesian_light(request: DomainSimulationRequest) -> dict[str, Any]:
    rng = _rng(request.seed)
    expression = request.expression or "math.sin(10*x[0]) * x[0] + (x[0] - 0.5)**2"
    samples: list[Candidate] = []
    best: Candidate | None = None
    for iteration in range(1, request.iterations + 1):
        if iteration <= 8 or not samples:
            x0 = rng.random()
        else:
            elite = sorted(samples, key=lambda item: item.value)[: max(3, len(samples) // 8)]
            center = rng.choice(elite).x[0]
            x0 = min(1.0, max(0.0, rng.gauss(center, 0.08)))
        x = [x0]
        value = _evaluate_expression(expression, x)
        candidate = Candidate(x=x, value=value)
        samples.append(candidate)
        if best is None or value < best.value:
            best = candidate
    return {
        "kind": "bayesian",
        "algorithm": "surrogate_guided_sampling",
        "best": {"x": best.x if best else [], "value": best.value if best else None},
        "history": [
            {"iteration": idx + 1, "x": sample.x, "value": sample.value, "best": min(row.value for row in samples[: idx + 1])}
            for idx, sample in enumerate(samples)
        ],
        "decision_points": [{"x": sample.x[0], "y": sample.value, "value": sample.value} for sample in samples],
        "visualizations": ["sample_history", "acquisition", "decision_vs_objective"],
    }


def _run_drawable(request: DomainSimulationRequest) -> dict[str, Any]:
    canvas = request.canvas or [[0.0 for _ in range(16)] for _ in range(16)]
    arr = np.asarray(canvas, dtype=float)
    if arr.ndim != 2 or arr.size == 0:
        raise ValueError("Drawable canvas must be a non-empty 2D grid.")
    y_idx, x_idx = np.unravel_index(np.argmin(arr), arr.shape)
    return {
        "kind": "drawable",
        "algorithm": "grid_minimum",
        "best": {"x": [float(x_idx / max(1, arr.shape[1] - 1)), float(y_idx / max(1, arr.shape[0] - 1))], "value": float(arr[y_idx, x_idx])},
        "history": [],
        "canvas": arr.round(6).tolist(),
        "visualizations": ["canvas_landscape"],
    }


def simulate_domain(request: DomainSimulationRequest) -> dict[str, Any]:
    if request.kind in {"mono_objective", "noisy"}:
        return _run_mono(request)
    if request.kind == "tsp":
        return _run_tsp(request)
    if request.kind == "bin_packing":
        return _run_bin_packing(request)
    if request.kind == "bayesian":
        return _run_bayesian_light(request)
    if request.kind == "drawable":
        return _run_drawable(request)
    raise ValueError(f"Unsupported V2 domain '{request.kind}'.")
