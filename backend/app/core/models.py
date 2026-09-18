from __future__ import annotations

from typing import Any, Literal
from uuid import uuid4

from pydantic import BaseModel, Field, field_validator


class AlgorithmConfig(BaseModel):
    id: str = Field(default_factory=lambda: uuid4().hex)
    name: str
    label: str | None = None
    hyperparams: dict[str, Any] = Field(default_factory=dict)

    @field_validator("hyperparams")
    @classmethod
    def bounded_parameters(cls, params):
        for key, upper in (("population_size", 1000), ("generations", 2000)):
            if key in params and (isinstance(params[key], bool) or not isinstance(params[key], (int, float)) or not 1 <= params[key] <= upper or int(params[key]) != params[key]):
                raise ValueError(f"{key} must be an integer between 1 and {upper}.")
        if "seed" in params and (not isinstance(params["seed"], int) or not 0 <= params["seed"] <= 2**32 - 1):
            raise ValueError("seed must be an unsigned 32-bit integer.")
        return params


class ProblemConfig(BaseModel):
    kind: Literal["builtin", "expression", "uploaded", "external"] = "builtin"
    name: str | None = None
    problem_id: str | None = None
    n_var: int | None = Field(default=None, ge=1, le=1000)
    n_obj: int | None = Field(default=None, ge=2, le=15)
    xl: float | list[float] | None = None
    xu: float | list[float] | None = None
    objectives: list[str] | None = None

    @field_validator("n_obj")
    @classmethod
    def validate_obj_count(cls, value: int | None) -> int | None:
        if value is not None and value < 2:
            raise ValueError("n_obj must be >= 2")
        return value


class RunRequest(BaseModel):
    run_id: str | None = Field(default=None, pattern=r"^[A-Za-z0-9_-]{1,100}$")
    seed: int | None = Field(default=None, ge=0, le=2**32 - 1)
    problem: ProblemConfig
    algorithms: list[AlgorithmConfig] = Field(min_length=1, max_length=12)

    @field_validator("algorithms")
    @classmethod
    def unique_algorithms(cls, algorithms):
        if len({algorithm.id for algorithm in algorithms}) != len(algorithms):
            raise ValueError("Algorithm IDs must be unique.")
        return algorithms


class CreateExpressionProblemRequest(BaseModel):
    name: str
    objectives: list[str]
    n_var: int = 10
    xl: float | list[float] = 0.0
    xu: float | list[float] = 1.0


class CreateExternalProblemRequest(BaseModel):
    name: str
    command: list[str]
    n_var: int
    n_obj: int
    xl: float | list[float] = 0.0
    xu: float | list[float] = 1.0
    timeout_sec: float = Field(default=3.0, gt=0.0, le=30.0)


class EnvironmentTier(BaseModel):
    devices: int = Field(ge=1, le=256)
    processing_rate: float = Field(gt=0, allow_inf_nan=False)
    processing_cost: float = Field(ge=0, allow_inf_nan=False)
    idle_power: float = Field(ge=0, allow_inf_nan=False)
    working_power: float = Field(ge=0, allow_inf_nan=False)
    uplink_bandwidth: float = Field(gt=0, allow_inf_nan=False)
    downlink_bandwidth: float = Field(gt=0, allow_inf_nan=False)


class ScenarioTask(BaseModel):
    id: str
    compute_demand: float = Field(ge=0, allow_inf_nan=False)
    data_size: float = Field(ge=0, allow_inf_nan=False)
    deadline: float | None = Field(default=None, ge=0, allow_inf_nan=False)
    parents: list[str] = Field(default_factory=list)


class ScenarioObjectiveSpec(BaseModel):
    name: str
    key: str | None = None
    expression: str | None = None
    direction: Literal["min", "max"] = "min"
    target: float | None = None

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("Objective name cannot be empty.")
        return cleaned


class ScenarioRequest(BaseModel):
    environments: dict[str, EnvironmentTier] = Field(min_length=1, max_length=16)
    tasks: list[ScenarioTask] = Field(default_factory=list, max_length=1000)
    algorithms: list[str] = Field(
        default_factory=lambda: [
            "NSGA-II",
            "NSGA-III",
            "U-NSGA-III",
            "R-NSGA-II",
            "R-NSGA-III",
            "D-NSGA-II",
            "MOEA/D",
            "RVEA",
            "C-TAEA",
            "SPEA2",
            "SMS-EMOA",
            "Random Search",
        ]
    )
    population_size: int = Field(default=80, ge=5, le=1000)
    generations: int = Field(default=50, ge=1, le=2000)
    repetitions: int = 1
    base_seed: int | None = Field(default=None, ge=0, le=2**31 - 1)
    objective_names: list[str] = Field(default_factory=lambda: ["Latency", "Cost", "Energy", "Makespan"])
    objective_targets: dict[str, float] | None = None
    objective_specs: list[ScenarioObjectiveSpec] | None = None
    workflow_id: str | None = None
    workflow_task_limit: int | None = None

    @field_validator("objective_names")
    @classmethod
    def validate_objective_names(cls, value: list[str]) -> list[str]:
        cleaned = [item.strip() for item in value if item and item.strip()]
        if cleaned and len(cleaned) < 2:
            raise ValueError("objective_names must contain at least 2 names.")
        return cleaned

    @field_validator("objective_specs")
    @classmethod
    def validate_objective_specs(cls, value: list[ScenarioObjectiveSpec] | None) -> list[ScenarioObjectiveSpec] | None:
        if value is None:
            return value
        if len(value) < 2:
            raise ValueError("objective_specs must contain at least 2 objective entries.")
        return value

    @field_validator("workflow_task_limit")
    @classmethod
    def validate_workflow_task_limit(cls, value: int | None) -> int | None:
        if value is not None and value < 1:
            raise ValueError("workflow_task_limit must be >= 1 when provided.")
        return value

    @field_validator("repetitions")
    @classmethod
    def validate_repetitions(cls, value: int) -> int:
        if value < 1 or value > 30:
            raise ValueError("repetitions must be between 1 and 30.")
        return value
