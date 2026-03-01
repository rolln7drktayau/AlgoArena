from __future__ import annotations

from pathlib import Path
import sys

import numpy as np

ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.append(str(ROOT))

from backend.app.core.metrics import build_diversity_heatmap, compute_metrics  # noqa: E402


def test_metrics_are_computed_for_valid_population() -> None:
    pop = np.array([[0.2, 0.9], [0.3, 0.7], [0.4, 0.5], [0.6, 0.35]])
    ref = np.array([[0.1, 0.95], [0.5, 0.4], [0.9, 0.2]])
    metrics = compute_metrics(pop, reference_front=ref)
    assert metrics["hv"] is not None
    assert metrics["igd"] is not None
    assert metrics["igd_plus"] is not None
    assert metrics["gd"] is not None
    assert metrics["gd_plus"] is not None
    assert metrics["epsilon"] is not None
    assert metrics["spread"] is not None
    assert metrics["spacing"] is not None


def test_diversity_heatmap_shape() -> None:
    pop = np.array([[0.2, 0.1], [0.4, 0.3], [0.8, 0.7]])
    heatmap = build_diversity_heatmap(pop, bins=8)
    assert len(heatmap) == 8
    assert all(len(row) == 8 for row in heatmap)
