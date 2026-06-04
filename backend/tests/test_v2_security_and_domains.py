from __future__ import annotations

from pathlib import Path
import sys

import numpy as np
import pytest
from fastapi.testclient import TestClient

ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.append(str(ROOT))

from backend.app.core.domain_simulator import DomainSimulationRequest, simulate_domain  # noqa: E402
from backend.app.main import app  # noqa: E402
from problems.safe_expressions import SafeExpressionError, compile_safe_expression  # noqa: E402


def test_safe_expression_accepts_numeric_objective() -> None:
    evaluator = compile_safe_expression("(x[0] - 0.25)**2 + math.sin(x[1])")
    value = evaluator(np.array([0.5, 0.1]))
    assert np.isfinite(value)


def test_safe_expression_blocks_imports() -> None:
    with pytest.raises(SafeExpressionError):
        compile_safe_expression("__import__('os').system('echo unsafe')")


def test_domain_simulator_runs_tsp() -> None:
    result = simulate_domain(DomainSimulationRequest(kind="tsp", iterations=20, seed=7))
    assert result["kind"] == "tsp"
    assert result["best"]["value"] > 0
    assert len(result["history"]) == 21


def test_domain_simulator_runs_mono() -> None:
    result = simulate_domain(DomainSimulationRequest(kind="mono_objective", iterations=15, seed=7))
    assert result["best"]["value"] is not None
    assert len(result["history"]) == 15


def test_custom_algorithm_upload_disabled_by_default() -> None:
    client = TestClient(app)
    response = client.post(
        "/api/algorithms/upload",
        files={"file": ("unsafe.py", b"print('unsafe')", "text/x-python")},
    )
    assert response.status_code == 403
