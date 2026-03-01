from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any


@dataclass
class PopulationMember:
    x: list[float]
    f: list[float]


@dataclass
class PopulationSnapshot:
    generation: int
    elapsed_sec: float
    population: list[PopulationMember] = field(default_factory=list)
    metrics: dict[str, float | None] = field(default_factory=dict)
    heatmap: list[list[float]] = field(default_factory=list)
    done: bool = False


class BaseAlgorithm(ABC):
    display_name: str = "BaseAlgorithm"
    hyperparam_schema: dict[str, dict[str, Any]] = {}
    supported_n_obj: tuple[int, int] = (2, 5)

    def __init__(self, problem: Any, hyperparams: dict[str, Any] | None = None):
        self.problem = problem
        self.hyperparams = hyperparams or {}
        n_obj = getattr(problem, "n_obj", None)
        if n_obj is not None:
            min_obj, max_obj = self.supported_n_obj
            if int(n_obj) < min_obj or int(n_obj) > max_obj:
                raise ValueError(
                    f"{self.display_name} supports objective counts in [{min_obj}, {max_obj}], received n_obj={n_obj}."
                )

    @abstractmethod
    def step(self) -> PopulationSnapshot:
        raise NotImplementedError

    @abstractmethod
    def is_done(self) -> bool:
        raise NotImplementedError
