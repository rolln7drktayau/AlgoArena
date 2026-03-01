from __future__ import annotations

import heapq
import math
from dataclasses import dataclass
from typing import Any, Callable

import numpy as np
from pymoo.core.problem import Problem

from algorithms.registry import create_algorithm_instance
from ..core.metrics import compute_metrics
from ..core.models import EnvironmentTier, ScenarioRequest, ScenarioTask
from .workflows import load_workflow_tasks


@dataclass
class TierData:
    name: str
    devices: int
    processing_rate: float
    processing_cost: float
    idle_power: float
    working_power: float
    uplink_bandwidth: float
    downlink_bandwidth: float


@dataclass
class ObjectiveSpec:
    name: str
    key: str | None
    direction: str
    target: float | None = None
    expression: str | None = None
    compiled: Any | None = None


DEFAULT_OBJECTIVES: tuple[ObjectiveSpec, ...] = (
    ObjectiveSpec(name="Latency", key="latency", direction="min"),
    ObjectiveSpec(name="Cost", key="cost", direction="min"),
    ObjectiveSpec(name="Energy", key="energy", direction="min"),
)
BUILTIN_OBJECTIVE_KEYS = {"latency", "cost", "energy", "makespan", "execution_speed", "avg_wait"}


class SchedulingProblem(Problem):
    def __init__(self, tiers: list[TierData], tasks: list[ScenarioTask], objectives: list[ObjectiveSpec]):
        self.tiers = tiers
        self.tasks = tasks
        self.objectives = objectives
        n_tiers = len(tiers)
        super().__init__(
            n_var=len(tasks),
            n_obj=len(objectives),
            xl=np.zeros(len(tasks)),
            xu=np.full(len(tasks), n_tiers - 1),
            vtype=float,
        )

    def _evaluate(self, x: np.ndarray, out: dict[str, Any], *args: Any, **kwargs: Any) -> None:
        all_rows: list[list[float]] = []
        for candidate in x:
            features = self._evaluate_candidate_features(candidate)
            all_rows.append(self._features_to_objective_vector(features))
        out["F"] = np.asarray(all_rows, dtype=float)

    def _features_to_objective_vector(self, features: dict[str, float]) -> list[float]:
        values: list[float] = []
        for spec in self.objectives:
            if spec.key is not None:
                raw = float(features.get(spec.key, 0.0))
            elif spec.compiled is not None:
                raw = _evaluate_objective_expression(spec.compiled, features)
            else:
                raw = 0.0
            values.append(float(-raw if spec.direction == "max" else raw))
        return values

    def _evaluate_candidate_features(self, candidate: np.ndarray) -> dict[str, float]:
        assignments = np.clip(np.rint(candidate).astype(int), 0, len(self.tiers) - 1)
        latency = 0.0
        cost = 0.0
        energy = 0.0
        total_wait = 0.0
        makespan = 0.0
        machine_queues: list[list[float]] = []
        for tier in self.tiers:
            devices = max(1, int(tier.devices))
            queue = [0.0 for _ in range(devices)]
            heapq.heapify(queue)
            machine_queues.append(queue)

        for task_index, tier_index in enumerate(assignments):
            task = self.tasks[task_index]
            tier = self.tiers[tier_index]

            effective_rate = max(1e-6, tier.processing_rate * max(1, tier.devices))
            compute_time = task.compute_demand / effective_rate
            transfer_time = task.data_size / max(1e-6, tier.uplink_bandwidth)
            service_time = compute_time + transfer_time
            next_available = heapq.heappop(machine_queues[tier_index])
            finish_time = next_available + service_time
            heapq.heappush(machine_queues[tier_index], finish_time)

            total_wait += next_available
            task_latency = finish_time
            if task.deadline is not None and task_latency > task.deadline:
                task_latency += (task_latency - task.deadline) * 2.0

            latency += task_latency
            cost += task.compute_demand * tier.processing_cost
            energy += (tier.idle_power * (next_available + 1e-6)) + (tier.working_power * service_time)
            makespan = max(makespan, finish_time)

        execution_speed = len(self.tasks) / max(1e-9, makespan)
        avg_wait = total_wait / max(1, len(self.tasks))
        return {
            "latency": float(latency),
            "cost": float(cost),
            "energy": float(energy),
            "makespan": float(makespan),
            "execution_speed": float(execution_speed),
            "avg_wait": float(avg_wait),
        }

    def evaluate_features(self, candidate: np.ndarray) -> dict[str, float]:
        return self._evaluate_candidate_features(candidate)

    def decode_schedule(self, candidate: np.ndarray) -> list[dict[str, Any]]:
        assignments = np.clip(np.rint(candidate).astype(int), 0, len(self.tiers) - 1)
        schedule: list[dict[str, Any]] = []
        for task_index, tier_index in enumerate(assignments):
            schedule.append({"task_id": self.tasks[task_index].id, "tier": self.tiers[tier_index].name})
        return schedule


def _default_tasks(count: int = 20) -> list[ScenarioTask]:
    rng = np.random.default_rng(seed=42)
    tasks = []
    for idx in range(count):
        tasks.append(
            ScenarioTask(
                id=f"T{idx + 1}",
                compute_demand=float(rng.uniform(200.0, 2000.0)),
                data_size=float(rng.uniform(30.0, 500.0)),
                deadline=float(rng.uniform(1.5, 15.0)),
            )
        )
    return tasks


def _find_best_index(objectives: np.ndarray) -> int:
    if objectives.ndim != 2 or len(objectives) == 0:
        return 0
    mins = objectives.min(axis=0)
    maxs = objectives.max(axis=0)
    ranges = np.where(np.isclose(maxs - mins, 0.0), 1.0, maxs - mins)
    normalized = (objectives - mins) / ranges
    weights = np.full(objectives.shape[1], 1.0 / max(1, objectives.shape[1]), dtype=float)
    weighted = normalized @ weights
    return int(np.argmin(weighted))


def _normalize_objective_token(value: str) -> str:
    return (
        value.strip()
        .lower()
        .replace("-", "_")
        .replace(" ", "_")
        .replace("/", "_")
        .replace("(", "")
        .replace(")", "")
    )


def _compile_objective_expression(expression: str) -> Any:
    text = expression.strip()
    blocked_tokens = ["__", "import", "exec", "eval", "open(", "globals(", "locals("]
    lowered = text.lower()
    for token in blocked_tokens:
        if token in lowered:
            raise ValueError(f"Unsupported token '{token}' in objective expression.")
    return compile(text, "<scenario_objective_expression>", "eval")


def _evaluate_objective_expression(compiled_expression: Any, features: dict[str, float]) -> float:
    safe_globals = {
        "__builtins__": {},
        "np": np,
        "math": math,
        "abs": abs,
        "min": min,
        "max": max,
        "sum": sum,
    }
    raw = eval(compiled_expression, safe_globals, features)
    value = float(raw)
    if not np.isfinite(value):
        raise ValueError("Objective expression evaluated to a non-finite value.")
    return value


def _resolve_objective_key(raw_name_or_key: str) -> str | None:
    token = _normalize_objective_token(raw_name_or_key)
    alias_map = {
        "latency": "latency",
        "cost": "cost",
        "energy": "energy",
        "makespan": "makespan",
        "speed": "execution_speed",
        "execution_speed": "execution_speed",
        "executionspeed": "execution_speed",
        "throughput": "execution_speed",
        "avg_wait": "avg_wait",
        "average_wait": "avg_wait",
    }
    return alias_map.get(token)


def _objective_value_map(objective_specs: list[ObjectiveSpec], minimized_values: np.ndarray) -> dict[str, float]:
    mapped: dict[str, float] = {}
    for spec, value in zip(objective_specs, minimized_values):
        actual = -float(value) if spec.direction == "max" else float(value)
        mapped[spec.name] = actual
    return mapped


def _goal_distance(
    objective_map: dict[str, float],
    objective_specs: list[ObjectiveSpec],
    objective_targets: dict[str, float] | None,
) -> tuple[float | None, float | None]:
    if not objective_targets:
        return None, None
    spec_by_name = {spec.name: spec for spec in objective_specs}
    diffs = []
    satisfied = 0
    total = 0
    for objective_name, target in objective_targets.items():
        if objective_name not in objective_map:
            continue
        spec = spec_by_name.get(objective_name)
        if spec is None:
            continue
        value = objective_map[objective_name]
        denom = abs(target) if abs(target) > 1e-9 else 1.0
        diffs.append(abs(value - target) / denom)
        if (spec.direction == "min" and value <= target) or (spec.direction == "max" and value >= target):
            satisfied += 1
        total += 1
    if total == 0:
        return None, None
    return float(np.mean(diffs)), float(satisfied / total)


def _run_algorithm(
    problem: SchedulingProblem,
    algorithm_name: str,
    population_size: int,
    generations: int,
    objective_specs: list[ObjectiveSpec],
    objective_targets: dict[str, float] | None,
) -> dict[str, Any]:
    algorithm = create_algorithm_instance(
        algorithm_name,
        problem,
        {
            "population_size": population_size,
            "generations": generations,
            "crossover_rate": 0.9,
            "mutation_rate": 0.15,
        },
    )
    last_snapshot = None
    while not algorithm.is_done():
        last_snapshot = algorithm.step()
    if last_snapshot is None:
        raise RuntimeError(f"{algorithm_name} did not generate any solution")

    if len(last_snapshot.population) == 0:
        raise RuntimeError(f"{algorithm_name} produced an empty population.")
    try:
        obj_values = np.array([member.f for member in last_snapshot.population], dtype=float)
    except Exception as exc:
        raise RuntimeError(
            f"{algorithm_name} returned inconsistent objective vector shapes in the final population: {exc}"
        ) from exc

    if obj_values.ndim != 2:
        raise RuntimeError(f"{algorithm_name} returned an invalid objective tensor shape: {obj_values.shape}")
    if obj_values.shape[1] != problem.n_obj:
        raise RuntimeError(
            f"{algorithm_name} returned objective vectors with dimension {obj_values.shape[1]}, expected {problem.n_obj}."
        )

    best_idx = _find_best_index(obj_values)
    best_solution = np.array(last_snapshot.population[best_idx].x, dtype=float)
    best_objectives = np.asarray(obj_values[best_idx], dtype=float)
    best_features = problem.evaluate_features(best_solution)
    schedule = problem.decode_schedule(best_solution)
    objective_map = _objective_value_map(objective_specs, best_objectives)
    goal_distance, target_satisfaction = _goal_distance(objective_map, objective_specs, objective_targets)

    metrics = compute_metrics(obj_values)
    metrics["generation_speed"] = (
        float(last_snapshot.generation / last_snapshot.elapsed_sec) if last_snapshot.elapsed_sec > 0 else None
    )
    metrics["execution_speed"] = float(best_features.get("execution_speed", 0.0))
    metrics["makespan"] = float(best_features.get("makespan", 0.0))
    return {
        "algorithm_name": algorithm_name,
        "best_objectives": {
            "latency": float(best_features.get("latency", 0.0)),
            "cost": float(best_features.get("cost", 0.0)),
            "energy": float(best_features.get("energy", 0.0)),
            "makespan": float(best_features.get("makespan", 0.0)),
            "execution_speed": float(best_features.get("execution_speed", 0.0)),
        },
        "objective_directions": {spec.name: spec.direction for spec in objective_specs},
        "objective_values": objective_map,
        "goal_distance": goal_distance,
        "target_satisfaction": target_satisfaction,
        "quality_metrics": metrics,
        "schedule": schedule,
        "generation": last_snapshot.generation,
        "elapsed_sec": last_snapshot.elapsed_sec,
    }


def _tier_data_from_request(environments: dict[str, EnvironmentTier]) -> list[TierData]:
    return [
        TierData(
            name=name,
            devices=tier.devices,
            processing_rate=tier.processing_rate,
            processing_cost=tier.processing_cost,
            idle_power=tier.idle_power,
            working_power=tier.working_power,
            uplink_bandwidth=tier.uplink_bandwidth,
            downlink_bandwidth=tier.downlink_bandwidth,
        )
        for name, tier in environments.items()
    ]


def _objective_specs_from_request(request: ScenarioRequest) -> tuple[list[ObjectiveSpec], dict[str, float]]:
    if request.objective_specs:
        specs: list[ObjectiveSpec] = []
        targets: dict[str, float] = {}
        for index, item in enumerate(request.objective_specs):
            name = item.name.strip() if item.name else f"Objective {index + 1}"
            direction = item.direction
            key = item.key.strip() if item.key else None
            expression = item.expression.strip() if item.expression else None
            compiled = None
            resolved_key = _resolve_objective_key(key) if key else _resolve_objective_key(name)
            if expression:
                compiled = _compile_objective_expression(expression)
            elif resolved_key is None:
                raise ValueError(
                    f"Objective '{name}' is neither a known built-in objective nor an expression objective."
                )
            specs.append(
                ObjectiveSpec(
                    name=name,
                    key=resolved_key if expression is None else None,
                    direction=direction,
                    target=item.target,
                    expression=expression,
                    compiled=compiled,
                )
            )
            if item.target is not None:
                targets[name] = float(item.target)

        if len(specs) < 2 or len(specs) > 5:
            raise ValueError("Scenario objectives must contain between 2 and 5 objectives.")
        return specs, targets

    specs = [ObjectiveSpec(name=spec.name, key=spec.key, direction=spec.direction) for spec in DEFAULT_OBJECTIVES]
    targets = {}
    if request.objective_targets:
        targets.update({str(k): float(v) for k, v in request.objective_targets.items()})
    if request.objective_names:
        cleaned = [item.strip() for item in request.objective_names if item and item.strip()]
        if len(cleaned) >= 2:
            specs = []
            for index, name in enumerate(cleaned[:5]):
                resolved = _resolve_objective_key(name)
                fallback = None
                if resolved is None and index < len(DEFAULT_OBJECTIVES):
                    fallback = DEFAULT_OBJECTIVES[index].key
                specs.append(
                    ObjectiveSpec(
                        name=name,
                        key=resolved or fallback,
                        direction="min",
                    )
                )
        for spec in specs:
            if spec.key is None:
                raise ValueError(
                    f"Objective '{spec.name}' is not recognized. Use built-ins (Latency, Cost, Energy, Makespan, Execution Speed) "
                    "or objective_specs with expressions."
                )
    return specs, targets


def _emit_update(on_update: Callable[[dict[str, Any]], None] | None, payload: dict[str, Any]) -> None:
    if on_update is None:
        return
    try:
        on_update(payload)
    except Exception:
        # Streaming callbacks should never break simulation execution.
        return


def _simulate_scenario_internal(
    request: ScenarioRequest,
    on_update: Callable[[dict[str, Any]], None] | None = None,
) -> dict[str, Any]:
    try:
        tiers = _tier_data_from_request(request.environments)
        workflow_meta: dict[str, Any] | None = None
        if request.workflow_id:
            tasks, workflow_meta = load_workflow_tasks(request.workflow_id, request.workflow_task_limit)
        else:
            tasks = request.tasks if request.tasks else _default_tasks()

        objective_specs, objective_targets = _objective_specs_from_request(request)
        problem = SchedulingProblem(tiers, tasks, objectives=objective_specs)
        total_algorithms = len(request.algorithms)
        completed_algorithms = 0

        _emit_update(
            on_update,
            {
                "type": "scenario_started",
                "task_count": len(tasks),
                "environments": list(request.environments.keys()),
                "workflow": workflow_meta,
                "objective_names": [spec.name for spec in objective_specs],
                "objective_targets": objective_targets,
                "objective_directions": {spec.name: spec.direction for spec in objective_specs},
                "total_algorithms": total_algorithms,
                "completed_algorithms": 0,
            },
        )

        algorithm_outputs = []
        failures: list[dict[str, str]] = []
        for algorithm_name in request.algorithms:
            try:
                output = _run_algorithm(
                    problem=problem,
                    algorithm_name=algorithm_name,
                    population_size=request.population_size,
                    generations=request.generations,
                    objective_specs=objective_specs,
                    objective_targets=objective_targets,
                )
                algorithm_outputs.append(output)
                completed_algorithms += 1
                _emit_update(
                    on_update,
                    {
                        "type": "scenario_result",
                        "algorithm_name": algorithm_name,
                        "result": output,
                        "total_algorithms": total_algorithms,
                        "completed_algorithms": completed_algorithms,
                    },
                )
            except Exception as exc:
                message = str(exc)
                if "supports objective counts" in message:
                    message = f"Incompatible objective count for this algorithm: {message}"
                failures.append({"algorithm_name": algorithm_name, "error": message})
                completed_algorithms += 1
                _emit_update(
                    on_update,
                    {
                        "type": "scenario_algorithm_error",
                        "algorithm_name": algorithm_name,
                        "error": message,
                        "total_algorithms": total_algorithms,
                        "completed_algorithms": completed_algorithms,
                    },
                )

        if objective_targets:
            algorithm_outputs.sort(
                key=lambda item: (
                    item["goal_distance"] if item["goal_distance"] is not None else float("inf"),
                    item["elapsed_sec"],
                )
            )
        else:
            first_name = objective_specs[0].name
            first_direction = objective_specs[0].direction
            algorithm_outputs.sort(
                key=lambda item: (
                    (
                        -item["objective_values"].get(first_name, -float("inf"))
                        if first_direction == "max"
                        else item["objective_values"].get(first_name, float("inf"))
                    ),
                    item["elapsed_sec"],
                )
            )

        final_response = {
            "task_count": len(tasks),
            "environments": list(request.environments.keys()),
            "workflow": workflow_meta,
            "objective_names": [spec.name for spec in objective_specs],
            "objective_targets": objective_targets,
            "objective_directions": {spec.name: spec.direction for spec in objective_specs},
            "results": algorithm_outputs,
            "failed_algorithms": failures,
        }
        _emit_update(on_update, {"type": "scenario_completed", "payload": final_response})
        return final_response
    except Exception as exc:
        failure_response = {
            "task_count": 0,
            "environments": list(request.environments.keys()),
            "workflow": None,
            "objective_names": [],
            "objective_targets": {},
            "objective_directions": {},
            "results": [],
            "failed_algorithms": [{"algorithm_name": "__simulation__", "error": str(exc)}],
        }
        _emit_update(on_update, {"type": "scenario_error", "error": str(exc), "payload": failure_response})
        _emit_update(on_update, {"type": "scenario_completed", "payload": failure_response})
        return failure_response


def simulate_scenario(request: ScenarioRequest) -> dict[str, Any]:
    return _simulate_scenario_internal(request=request)


def simulate_scenario_stream(
    request: ScenarioRequest,
    on_update: Callable[[dict[str, Any]], None],
) -> dict[str, Any]:
    return _simulate_scenario_internal(request=request, on_update=on_update)
