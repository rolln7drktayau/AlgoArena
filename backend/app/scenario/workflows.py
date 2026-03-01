from __future__ import annotations

from collections import deque
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
import re
from typing import Any
import xml.etree.ElementTree as ET

import numpy as np

from ..core.models import ScenarioTask


PROJECT_ROOT = Path(__file__).resolve().parents[3]
WORKFLOW_ROOT = PROJECT_ROOT / "Workflows"
WORKFLOW_SIZE_PATTERN = re.compile(r"^(?P<family>[A-Za-z][A-Za-z0-9]*)_(?P<size>\d+)$")


@dataclass(frozen=True)
class WorkflowTaskData:
    job_id: str
    runtime: float
    total_io_kb: float
    depth: int
    task: ScenarioTask


@dataclass(frozen=True)
class ParsedWorkflow:
    workflow_id: str
    family: str
    size: int | None
    display_name: str
    source_file: str
    task_count: int
    edge_count: int
    max_depth: int
    tasks: tuple[WorkflowTaskData, ...]


def _safe_float(raw: str | None, default: float = 0.0) -> float:
    if raw is None:
        return default
    try:
        value = float(raw)
    except ValueError:
        return default
    if np.isnan(value) or np.isinf(value):
        return default
    return value


def _slugify(value: str) -> str:
    slug = value.strip().lower()
    slug = re.sub(r"[^a-z0-9]+", "-", slug)
    return slug.strip("-")


def _workflow_identity(xml_path: Path) -> tuple[str, str, int | None]:
    stem = xml_path.stem
    match = WORKFLOW_SIZE_PATTERN.match(stem)
    if not match:
        return stem, stem, None
    family = match.group("family")
    return stem, family, int(match.group("size"))


def _build_workflow_id(family: str, size: int | None) -> str:
    if size is None:
        return _slugify(family)
    return f"{_slugify(family)}-{size}"


def _runtime_to_compute(runtime_norm: float, depth_norm: float) -> float:
    return 180.0 + (1900.0 * min(1.0, runtime_norm)) + (400.0 * depth_norm)


def _io_to_data_size(io_norm: float) -> float:
    return 20.0 + (5200.0 * min(1.0, io_norm))


def _estimate_deadline(runtime_norm: float, io_norm: float, depth_norm: float) -> float:
    score = 0.55 * runtime_norm + 0.30 * io_norm + 0.15 * depth_norm
    return 1.0 + (9.0 * min(1.0, score))


def _parse_workflow(xml_path: Path) -> ParsedWorkflow:
    tree = ET.parse(xml_path)
    root = tree.getroot()

    _, family, size = _workflow_identity(xml_path)
    workflow_id = _build_workflow_id(family, size)

    job_meta: dict[str, dict[str, float]] = {}
    for idx, job in enumerate(root.findall(".//{*}job")):
        job_id = job.attrib.get("id") or f"T{idx + 1}"
        runtime = max(0.01, _safe_float(job.attrib.get("runtime"), 1.0))
        input_bytes = 0.0
        output_bytes = 0.0
        for item in job.findall("{*}uses"):
            size_bytes = max(0.0, _safe_float(item.attrib.get("size"), 0.0))
            link = (item.attrib.get("link") or "").lower()
            if link == "input":
                input_bytes += size_bytes
            elif link == "output":
                output_bytes += size_bytes
            else:
                input_bytes += size_bytes * 0.5
                output_bytes += size_bytes * 0.5
        total_io_kb = (input_bytes + output_bytes) / 1024.0
        job_meta[job_id] = {"runtime": runtime, "io_kb": total_io_kb}

    if not job_meta:
        raise ValueError(f"{xml_path.name} does not contain any job node.")

    parents_by_child: dict[str, set[str]] = {job_id: set() for job_id in job_meta}
    children_by_parent: dict[str, set[str]] = {job_id: set() for job_id in job_meta}
    for child in root.findall(".//{*}child"):
        child_id = child.attrib.get("ref")
        if not child_id or child_id not in job_meta:
            continue
        for parent in child.findall("{*}parent"):
            parent_id = parent.attrib.get("ref")
            if not parent_id or parent_id not in job_meta:
                continue
            parents_by_child[child_id].add(parent_id)
            children_by_parent[parent_id].add(child_id)

    edge_count = int(sum(len(parents) for parents in parents_by_child.values()))
    in_degree = {job_id: len(parents) for job_id, parents in parents_by_child.items()}
    queue = deque(sorted(job_id for job_id, degree in in_degree.items() if degree == 0))
    topo_order: list[str] = []
    depth: dict[str, int] = {job_id: 0 for job_id in job_meta}

    while queue:
        node = queue.popleft()
        topo_order.append(node)
        for child_id in sorted(children_by_parent[node]):
            depth[child_id] = max(depth[child_id], depth[node] + 1)
            in_degree[child_id] -= 1
            if in_degree[child_id] == 0:
                queue.append(child_id)

    if len(topo_order) < len(job_meta):
        remaining = sorted(set(job_meta.keys()) - set(topo_order))
        topo_order.extend(remaining)

    max_depth = max(depth.values()) if depth else 0
    runtime_values = np.array([meta["runtime"] for meta in job_meta.values()], dtype=float)
    io_values = np.array([meta["io_kb"] for meta in job_meta.values()], dtype=float)
    runtime_min, runtime_max = float(np.min(runtime_values)), float(np.max(runtime_values))
    io_min, io_max = float(np.min(io_values)), float(np.max(io_values))
    runtime_range = runtime_max - runtime_min if runtime_max > runtime_min else 1.0
    io_range = io_max - io_min if io_max > io_min else 1.0
    depth_den = float(max(1, max_depth))

    task_rows: list[WorkflowTaskData] = []
    for job_id in topo_order:
        meta = job_meta[job_id]
        runtime_norm = (meta["runtime"] - runtime_min) / runtime_range
        io_norm = (meta["io_kb"] - io_min) / io_range
        depth_norm = depth[job_id] / depth_den
        task_rows.append(
            WorkflowTaskData(
                job_id=job_id,
                runtime=meta["runtime"],
                total_io_kb=meta["io_kb"],
                depth=depth[job_id],
                task=ScenarioTask(
                    id=job_id,
                    compute_demand=float(_runtime_to_compute(runtime_norm, depth_norm)),
                    data_size=float(_io_to_data_size(io_norm)),
                    deadline=float(_estimate_deadline(runtime_norm, io_norm, depth_norm)),
                ),
            )
        )

    task_count = len(task_rows)
    root_job_count = int(_safe_float(root.attrib.get("jobCount"), float(task_count)))
    size_label = size if size is not None else root_job_count
    display_name = f"{family} {size_label}"
    return ParsedWorkflow(
        workflow_id=workflow_id,
        family=family,
        size=size,
        display_name=display_name,
        source_file=xml_path.name,
        task_count=task_count,
        edge_count=edge_count,
        max_depth=max_depth,
        tasks=tuple(task_rows),
    )


def _is_dax_workflow(xml_path: Path) -> bool:
    try:
        for _, elem in ET.iterparse(xml_path, events=("start",)):
            return elem.tag.endswith("adag")
    except Exception:
        return False
    return False


def _discover_workflow_xml_files() -> list[Path]:
    if not WORKFLOW_ROOT.exists():
        return []

    candidates = [path for path in WORKFLOW_ROOT.rglob("*.xml") if path.is_file()]
    filtered: list[Path] = []
    for xml_path in candidates:
        lower_name = xml_path.name.lower()
        if lower_name.startswith("zdt") or lower_name.startswith("dtlz") or lower_name.startswith("wfg"):
            continue
        if _is_dax_workflow(xml_path):
            filtered.append(xml_path)
    return sorted(filtered)


@lru_cache(maxsize=1)
def _workflow_map() -> dict[str, ParsedWorkflow]:
    parsed: dict[str, ParsedWorkflow] = {}
    for xml_path in _discover_workflow_xml_files():
        try:
            workflow = _parse_workflow(xml_path)
        except Exception:
            continue

        candidate_id = workflow.workflow_id
        if candidate_id in parsed:
            candidate_id = f"{candidate_id}-{_slugify(xml_path.stem)}"
            workflow = ParsedWorkflow(
                workflow_id=candidate_id,
                family=workflow.family,
                size=workflow.size,
                display_name=workflow.display_name,
                source_file=workflow.source_file,
                task_count=workflow.task_count,
                edge_count=workflow.edge_count,
                max_depth=workflow.max_depth,
                tasks=workflow.tasks,
            )
        parsed[candidate_id] = workflow
    return parsed


def list_workflow_specs() -> list[dict[str, Any]]:
    workflows = list(_workflow_map().values())
    workflows.sort(key=lambda item: (item.family.lower(), item.size or item.task_count, item.display_name.lower()))
    return [
        {
            "workflow_id": item.workflow_id,
            "name": item.display_name,
            "family": item.family,
            "size": item.size or item.task_count,
            "task_count": item.task_count,
            "edge_count": item.edge_count,
            "max_depth": item.max_depth,
            "source_file": item.source_file,
        }
        for item in workflows
    ]


def get_workflow_preview(workflow_id: str, limit: int = 25) -> dict[str, Any]:
    normalized = _slugify(workflow_id).replace("--", "-")
    workflows = _workflow_map()
    if normalized not in workflows:
        raise KeyError(f"Unknown workflow_id '{workflow_id}'.")

    workflow = workflows[normalized]
    bounded_limit = max(1, min(int(limit), workflow.task_count))
    task_preview = [
        {
            "id": row.task.id,
            "compute_demand": row.task.compute_demand,
            "data_size": row.task.data_size,
            "deadline": row.task.deadline,
            "runtime": row.runtime,
            "io_kb": row.total_io_kb,
            "depth": row.depth,
        }
        for row in workflow.tasks[:bounded_limit]
    ]
    return {
        "workflow_id": workflow.workflow_id,
        "name": workflow.display_name,
        "family": workflow.family,
        "size": workflow.size or workflow.task_count,
        "task_count": workflow.task_count,
        "edge_count": workflow.edge_count,
        "max_depth": workflow.max_depth,
        "source_file": workflow.source_file,
        "tasks": task_preview,
    }


def load_workflow_tasks(workflow_id: str, limit: int | None = None) -> tuple[list[ScenarioTask], dict[str, Any]]:
    normalized = _slugify(workflow_id).replace("--", "-")
    workflows = _workflow_map()
    if normalized not in workflows:
        raise KeyError(f"Unknown workflow_id '{workflow_id}'.")

    workflow = workflows[normalized]
    if limit is None:
        rows = workflow.tasks
    else:
        bounded = max(1, min(int(limit), workflow.task_count))
        rows = workflow.tasks[:bounded]

    tasks = [row.task for row in rows]
    metadata = {
        "workflow_id": workflow.workflow_id,
        "name": workflow.display_name,
        "family": workflow.family,
        "size": workflow.size or workflow.task_count,
        "task_count": len(tasks),
        "available_task_count": workflow.task_count,
        "edge_count": workflow.edge_count,
        "max_depth": workflow.max_depth,
        "source_file": workflow.source_file,
    }
    return tasks, metadata
