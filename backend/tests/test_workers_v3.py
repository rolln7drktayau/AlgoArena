import multiprocessing
import time

from fastapi.testclient import TestClient

from backend.app.main import app
from backend.app.core import storage


def test_disconnect_terminates_process_and_keeps_manifest(tmp_path, monkeypatch):
    monkeypatch.setenv("ALGOARENA_DATA_DIR", str(tmp_path))
    with TestClient(app) as client:
        with client.websocket_connect("/ws/run") as ws:
            ws.send_json({"type": "start_run", "payload": {
                "seed": 42, "problem": {"name": "ZDT1", "n_var": 10},
                "algorithms": [{"id": "slow", "name": "NSGA-II", "hyperparams": {"population_size": 100, "generations": 2000}}]
            }})
            run_id = ws.receive_json()["run_id"]
            while True:
                event = ws.receive_json()
                if event["type"] == "generation":
                    break
                assert event["type"] != "error", event
        deadline = time.monotonic() + 5
        while time.monotonic() < deadline and storage.get_manifest(run_id)["status"] == "running":
            time.sleep(.05)
        assert storage.get_manifest(run_id)["status"] == "cancelled"
        assert not multiprocessing.active_children()
        assert storage.read_events(run_id)


def test_completed_worker_exports_survive_new_manager(tmp_path, monkeypatch):
    monkeypatch.setenv("ALGOARENA_DATA_DIR", str(tmp_path))
    with TestClient(app) as client:
        with client.websocket_connect("/ws/run") as ws:
            ws.send_json({"type": "start_run", "payload": {
                "seed": 42, "problem": {"name": "ZDT1", "n_var": 5},
                "algorithms": [{"id": "random", "name": "Random Search", "hyperparams": {"population_size": 10, "generations": 2}}]
            }})
            run_id = ws.receive_json()["run_id"]
            while True:
                event = ws.receive_json()
                assert event["type"] != "error", event
                if event["type"] == "completed":
                    break
        assert client.get(f"/api/runs/{run_id}/manifest").json()["status"] == "completed"
        response = client.get(f"/api/runs/{run_id}/export/csv")
        assert response.status_code == 200
        assert "Random Search" in response.text


def test_worker_timeout_reclaims_process_and_slot(tmp_path, monkeypatch):
    from backend.app.core.workers import _active
    monkeypatch.setenv("ALGOARENA_DATA_DIR", str(tmp_path))
    monkeypatch.setenv("ALGOARENA_WORKER_TIMEOUT_SEC", "0.01")
    with TestClient(app) as client:
        with client.websocket_connect("/ws/run") as ws:
            ws.send_json({"type": "start_run", "payload": {
                "problem": {"name": "ZDT1", "n_var": 5},
                "algorithms": [{"id": "random", "name": "Random Search"}]
            }})
            run_id = ws.receive_json()["run_id"]
            event = ws.receive_json()
            assert event["type"] == "error" and "budget" in event["error"]
        assert not _active
        assert not multiprocessing.active_children()
        assert storage.get_manifest(run_id)["status"] == "failed"
