from __future__ import annotations

from typing import Any, Literal
from uuid import uuid4

from pydantic import BaseModel, Field, field_validator


class AlgorithmConfig(BaseModel):
    id: str = Field(default_factory=lambda: uuid4().hex)
    name: str
    hyperparams: dict[str, Any] = Field(default_factory=dict)


class ProblemConfig(BaseModel):
    kind: Literal["builtin", "expression", "uploaded"] = "builtin"
    name: str | None = None
    problem_id: str | None = None
    n_var: int | None = None
    n_obj: int | None = None
    xl: float | list[float] | None = None
    xu: float | list[float] | None = None
    objectives: list[str] | None = None

    @field_validator("n_obj")
    @classmethod
    def validate_obj_count(cls, value: int | None) -> int | None:
        if value is not None and not (2 <= value <= 5):
            raise ValueError("n_obj must be between 2 and 5")
        return value


class RunRequest(BaseModel):
    run_id: str | None = None
    seed: int | None = None
    problem: ProblemConfig
    algorithms: list[AlgorithmConfig]


class CreateExpressionProblemRequest(BaseModel):
    name: str
    objectives: list[str]
    n_var: int = 10
    xl: float | list[float] = 0.0
    xu: float | list[float] = 1.0


class EnvironmentTier(BaseModel):
    devices: int
    processing_rate: float
    processing_cost: float
    idle_power: float
    working_power: float
    uplink_bandwidth: float
    downlink_bandwidth: float


class ScenarioTask(BaseModel):
    id: str
    compute_demand: float
    data_size: float
    deadline: float | None = None


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
    environments: dict[str, EnvironmentTier]
    tasks: list[ScenarioTask] = Field(default_factory=list)
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
    population_size: int = 80
    generations: int = 50
    objective_names: list[str] = Field(default_factory=lambda: ["Latency", "Cost", "Energy"])
    objective_targets: dict[str, float] | None = None
    objective_specs: list[ScenarioObjectiveSpec] | None = None
    workflow_id: str | None = None
    workflow_task_limit: int | None = None

    @field_validator("objective_names")
    @classmethod
    def validate_objective_names(cls, value: list[str]) -> list[str]:
        cleaned = [item.strip() for item in value if item and item.strip()]
        if cleaned and not (2 <= len(cleaned) <= 5):
            raise ValueError("objective_names must contain between 2 and 5 names.")
        return cleaned

    @field_validator("objective_specs")
    @classmethod
    def validate_objective_specs(cls, value: list[ScenarioObjectiveSpec] | None) -> list[ScenarioObjectiveSpec] | None:
        if value is None:
            return value
        if not (2 <= len(value) <= 5):
            raise ValueError("objective_specs must contain between 2 and 5 objective entries.")
        return value

    @field_validator("workflow_task_limit")
    @classmethod
    def validate_workflow_task_limit(cls, value: int | None) -> int | None:
        if value is not None and value < 1:
            raise ValueError("workflow_task_limit must be >= 1 when provided.")
        return value
