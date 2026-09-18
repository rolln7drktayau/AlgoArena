from __future__ import annotations

import asyncio
import io

import numpy as np
import pytest
from fastapi import HTTPException, UploadFile
from fastapi.testclient import TestClient
from pydantic import ValidationError
from starlette.websockets import WebSocketDisconnect

from backend.app import main
from backend.app.api.routes import MAX_UPLOAD_BYTES, _save_python_upload
from backend.app.core.metrics import compute_metrics
from backend.app.core.models import RunRequest
from backend.app.core.run_manager import RunManager


def test_static_file_cannot_escape_dist(tmp_path, monkeypatch):
    dist = tmp_path / "dist"
    dist.mkdir()
    (tmp_path / "secret.txt").write_text("private")
    monkeypatch.setattr(main, "FRONTEND_DIST", dist)
    with pytest.raises(HTTPException) as exc:
        asyncio.run(main.spa_fallback("../secret.txt"))
    assert exc.value.status_code == 404


def test_browser_origin_rejected_for_http_and_websocket():
    client = TestClient(main.app)
    assert client.get("/api/health", headers={"Origin": "https://untrusted.example"}).status_code == 403
    with pytest.raises(WebSocketDisconnect):
        with client.websocket_connect("/ws/run", headers={"Origin": "https://untrusted.example"}):
            pass
    assert client.get("/api/health", headers={"Origin": "http://localhost:5173"}).status_code == 200


def test_problem_upload_disabled_by_default(monkeypatch):
    monkeypatch.delenv("ALGOARENA_ENABLE_CUSTOM_PROBLEM_UPLOAD", raising=False)
    response = TestClient(main.app).post(
        "/api/problems/custom/upload", files={"file": ("problem.py", b"while True: pass")},
        data={"name": "untrusted", "n_var": "2", "n_obj": "2"},
    )
    assert response.status_code == 403


def test_upload_ignores_client_path_and_rejects_oversize(tmp_path):
    upload = UploadFile(filename="../../outside.py", file=io.BytesIO(b"# example"))
    saved = asyncio.run(_save_python_upload(upload, tmp_path))
    assert saved.parent == tmp_path
    assert saved.name.endswith(".py") and "outside" not in saved.name
    large = UploadFile(filename="big.py", file=io.BytesIO(b"x" * (MAX_UPLOAD_BYTES + 1)))
    with pytest.raises(HTTPException) as exc:
        asyncio.run(_save_python_upload(large, tmp_path))
    assert exc.value.status_code == 413
    assert len(list(tmp_path.iterdir())) == 1


def test_run_id_cannot_be_a_file_path():
    with pytest.raises(ValidationError):
        RunRequest(run_id="../../outside", problem={"name": "zdt1"}, algorithms=[])


def test_hypervolume_requires_shared_reference():
    population = np.array([[0.2, 0.8], [0.8, 0.2]])
    assert compute_metrics(population)["hv"] is None
    assert compute_metrics(population, hv_reference_point=np.array([1., 1.]))["hv"] == pytest.approx(0.28)


def test_seed_reproduces_benchmark_and_statistics_are_descriptive():
    class Sink:
        async def send_json(self, message):
            pass

    async def run():
        manager = RunManager()
        request = RunRequest(seed=42, problem={"name": "zdt1", "n_var": 5}, algorithms=[
            {"id": "random", "name": "Random Search", "hyperparams": {"population_size": 10, "generations": 2}}
        ])
        first = await manager.execute_run("first", request, Sink())
        second = await manager.execute_run("second", request, Sink())
        assert [p.x for p in first.algorithms["random"].snapshots[-1].population] == [
            p.x for p in second.algorithms["random"].snapshots[-1].population
        ]
        stats = manager.export_statistics("first")
        assert stats["kruskal_wallis"]["available"] is False
        assert stats["pairwise_wilcoxon"] == []

    asyncio.run(run())
