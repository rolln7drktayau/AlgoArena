from __future__ import annotations

from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.append(str(ROOT))

from backend.app.scenario.workflows import get_workflow_preview, list_workflow_specs, load_workflow_tasks  # noqa: E402


def test_workflow_catalog_contains_scientific_families() -> None:
    specs = list_workflow_specs()
    assert len(specs) > 0
    families = {str(item["family"]).lower() for item in specs}
    for expected in ["epigenomics", "cybershake", "montage", "inspiral", "sipht"]:
        assert expected in families


def test_load_workflow_tasks_supports_limit() -> None:
    specs = list_workflow_specs()
    assert len(specs) > 0
    target = next((item for item in specs if str(item["family"]).lower() == "epigenomics"), specs[0])
    tasks, metadata = load_workflow_tasks(str(target["workflow_id"]), limit=10)
    assert len(tasks) == 10
    assert metadata["workflow_id"] == target["workflow_id"]
    assert metadata["available_task_count"] >= 10
    assert all(task.compute_demand > 0 for task in tasks)
    assert all(task.data_size > 0 for task in tasks)


def test_workflow_preview_returns_task_features() -> None:
    specs = list_workflow_specs()
    sample = specs[0]
    preview = get_workflow_preview(str(sample["workflow_id"]), limit=5)
    assert preview["workflow_id"] == sample["workflow_id"]
    assert len(preview["tasks"]) == 5
    row = preview["tasks"][0]
    assert "runtime" in row
    assert "io_kb" in row
    assert "depth" in row
