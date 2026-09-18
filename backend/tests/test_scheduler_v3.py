import numpy as np
import pytest

from backend.app.core.models import ScenarioTask
from backend.app.scenario.scheduler import schedule, task_order
from backend.app.scenario.service import TierData


def tier(name="Edge", devices=1):
    return TierData(name, devices, 10, 0.1, 2, 5, 8, 8)


def test_per_device_rate_is_not_multiplied_by_device_count():
    tasks = [ScenarioTask(id=str(i), compute_demand=20, data_size=0) for i in range(3)]
    features, trace = schedule([tier(devices=2)], tasks, np.zeros(3), task_order(tasks))
    assert [row["finish"] for row in trace] == [2, 2, 4]
    assert features["makespan"] == 4
    # Six device-seconds busy + two idle, each counted once.
    assert features["energy"] == 6 * 5 + 2 * 2


def test_child_waits_for_parent_and_cross_tier_transfer():
    tasks = [ScenarioTask(id="child", compute_demand=10, data_size=2, parents=["parent"]),
             ScenarioTask(id="parent", compute_demand=20, data_size=0)]
    features, trace = schedule([tier(), tier("Cloud")], tasks, np.array([1, 0]), task_order(tasks))
    assert trace[0]["task_id"] == "parent"
    assert trace[1]["start"] == 4  # parent 2s + 2 MB at 8 Mbps = 2s
    assert trace[1]["finish"] == 5
    assert features["latency"] == 7


def test_ingress_link_serializes_transfers():
    tasks = [ScenarioTask(id=str(i), compute_demand=10, data_size=1) for i in range(2)]
    _, trace = schedule([tier(devices=2)], tasks, np.zeros(2), task_order(tasks))
    assert [r["transfer_start"] for r in trace] == [0, 1]
    assert [r["finish"] for r in trace] == [2, 3]


@pytest.mark.parametrize("tasks", [
    [ScenarioTask(id="a", compute_demand=1, data_size=0, parents=["missing"])],
    [ScenarioTask(id="a", compute_demand=1, data_size=0, parents=["a"])],
    [ScenarioTask(id="a", compute_demand=1, data_size=0), ScenarioTask(id="a", compute_demand=1, data_size=0)],
])
def test_invalid_graph_rejected(tasks):
    with pytest.raises(ValueError):
        task_order(tasks)


def test_deadline_penalty_does_not_change_physical_latency():
    tasks = [ScenarioTask(id="a", compute_demand=20, data_size=0, deadline=1)]
    features, _ = schedule([tier()], tasks, np.array([0]), task_order(tasks))
    assert features["latency"] == 2
    assert features["tardiness"] == 1
