from __future__ import annotations

from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.append(str(ROOT))

from backend.app.core.models import EnvironmentTier, ScenarioRequest, ScenarioTask  # noqa: E402
from backend.app.scenario.service import simulate_scenario  # noqa: E402
from backend.app.scenario.workflows import list_workflow_specs  # noqa: E402


def _default_env() -> dict[str, EnvironmentTier]:
    return {
        "Edge": EnvironmentTier(
            devices=3,
            processing_rate=1000,
            processing_cost=0.02,
            idle_power=30,
            working_power=700,
            uplink_bandwidth=10000,
            downlink_bandwidth=10000,
        ),
        "Cloud": EnvironmentTier(
            devices=5,
            processing_rate=1600,
            processing_cost=0.9,
            idle_power=1332,
            working_power=1648,
            uplink_bandwidth=200,
            downlink_bandwidth=10000,
        ),
    }


def test_scenario_returns_failures_without_crashing() -> None:
    request = ScenarioRequest(
        environments=_default_env(),
        tasks=[
            ScenarioTask(id="T1", compute_demand=400, data_size=40, deadline=5),
            ScenarioTask(id="T2", compute_demand=700, data_size=60, deadline=8),
        ],
        algorithms=["NSGA-II", "UnknownAlgo"],
        population_size=20,
        generations=5,
        repetitions=2,
        base_seed=42,
        objective_names=["Latency", "Cost", "Energy"],
        objective_targets={"Latency": 2.0},
    )

    result = simulate_scenario(request)
    assert len(result["results"]) >= 1
    assert len(result["failed_algorithms"]) == 1
    assert result["failed_algorithms"][0]["algorithm_name"] == "UnknownAlgo"
    winner = result["results"][0]
    assert winner["repeat_count"] >= 1
    assert "repeat_stats" in winner
    assert "run_samples" in winner
    assert "makespan" in winner["best_objectives"]
    assert "execution_speed" in winner["best_objectives"]
    assert result["attainment"] is not None


def test_scenario_with_workflow_catalog_tasks() -> None:
    specs = list_workflow_specs()
    assert len(specs) > 0
    montage = next((row for row in specs if row["family"].lower() == "montage"), specs[0])

    request = ScenarioRequest(
        environments=_default_env(),
        algorithms=["NSGA-II", "Random Search"],
        population_size=20,
        generations=3,
        repetitions=2,
        base_seed=7,
        objective_names=["Latency", "Cost", "Energy"],
        workflow_id=str(montage["workflow_id"]),
        workflow_task_limit=12,
    )
    result = simulate_scenario(request)
    assert result["workflow"] is not None
    assert result["workflow"]["workflow_id"] == montage["workflow_id"]
    assert result["task_count"] == 12
    assert len(result["results"]) >= 1
    assert result["repetitions"] == 2


def test_scenario_accepts_manual_objective_specs() -> None:
    request = ScenarioRequest(
        environments=_default_env(),
        tasks=[
            ScenarioTask(id="T1", compute_demand=400, data_size=40, deadline=5),
            ScenarioTask(id="T2", compute_demand=700, data_size=60, deadline=8),
            ScenarioTask(id="T3", compute_demand=500, data_size=50, deadline=6),
        ],
        algorithms=["NSGA-II", "Random Search"],
        population_size=20,
        generations=4,
        repetitions=3,
        base_seed=100,
        objective_specs=[
            {"name": "Latency", "key": "latency", "direction": "min"},
            {"name": "Cost", "key": "cost", "direction": "min"},
            {"name": "Energy", "key": "energy", "direction": "min"},
            {"name": "Makespan", "key": "makespan", "direction": "min"},
            {"name": "Execution Speed", "key": "execution_speed", "direction": "max"},
        ],
    )

    result = simulate_scenario(request)
    assert len(result["results"]) >= 1
    first = result["results"][0]
    assert "Makespan" in first["objective_values"]
    assert "Execution Speed" in first["objective_values"]
    assert first["objective_directions"]["Execution Speed"] == "max"
    assert first["repeat_count"] >= 1
    assert first["repeat_stats"]["metrics"]
