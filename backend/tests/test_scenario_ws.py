from __future__ import annotations

from pathlib import Path
import sys

from fastapi.testclient import TestClient

ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.append(str(ROOT))

from backend.app.main import app  # noqa: E402


def test_scenario_websocket_stream_emits_progress_and_completion() -> None:
    payload = {
        "environments": {
            "Edge": {
                "devices": 2,
                "processing_rate": 1000,
                "processing_cost": 0.02,
                "idle_power": 30,
                "working_power": 700,
                "uplink_bandwidth": 10000,
                "downlink_bandwidth": 10000,
            },
            "Cloud": {
                "devices": 2,
                "processing_rate": 1500,
                "processing_cost": 0.5,
                "idle_power": 100,
                "working_power": 500,
                "uplink_bandwidth": 500,
                "downlink_bandwidth": 5000,
            },
        },
        "tasks": [
            {"id": "T1", "compute_demand": 300, "data_size": 30, "deadline": 5},
            {"id": "T2", "compute_demand": 600, "data_size": 50, "deadline": 8},
        ],
        "algorithms": ["NSGA-II", "Random Search"],
        "population_size": 12,
        "generations": 2,
        "objective_specs": [
            {"name": "Latency", "key": "latency", "direction": "min"},
            {"name": "Cost", "key": "cost", "direction": "min"},
            {"name": "Execution Speed", "key": "execution_speed", "direction": "max"},
        ],
    }

    with TestClient(app) as client:
        with client.websocket_connect("/ws/scenario") as websocket:
            websocket.send_json({"type": "start_scenario", "payload": payload})

            seen_started = False
            seen_completed = False
            seen_repeat = False
            payload_result = None

            for _ in range(40):
                message = websocket.receive_json()
                message_type = message.get("type")
                if message_type == "scenario_started":
                    seen_started = True
                if message_type == "scenario_repeat_result":
                    seen_repeat = True
                if message_type == "scenario_completed":
                    seen_completed = True
                    payload_result = message.get("payload")
                    break

    assert seen_started
    assert seen_repeat
    assert seen_completed
    assert payload_result is not None
    assert len(payload_result.get("results", [])) >= 1
