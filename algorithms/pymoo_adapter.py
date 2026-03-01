from __future__ import annotations

from time import perf_counter
from typing import Any

import numpy as np
from pymoo.operators.crossover.sbx import SBX
from pymoo.operators.mutation.pm import PM
from pymoo.operators.sampling.rnd import FloatRandomSampling

from .base import BaseAlgorithm, PopulationMember, PopulationSnapshot


class PymooSteppingAlgorithm(BaseAlgorithm):
    display_name: str = "PymooSteppingAlgorithm"
    default_population_size: int = 100
    default_generations: int = 120

    def __init__(self, problem: Any, hyperparams: dict[str, Any] | None = None):
        super().__init__(problem, hyperparams)
        self.population_size = int(self.hyperparams.get("population_size", self.default_population_size))
        self.max_generations = int(self.hyperparams.get("generations", self.default_generations))
        self.crossover_rate = float(self.hyperparams.get("crossover_rate", 0.9))
        self.mutation_rate = float(self.hyperparams.get("mutation_rate", 0.1))
        self.seed = self.hyperparams.get("seed")

        self._start_time = perf_counter()
        self._done = False
        self._algorithm = self._build_algorithm()
        self._algorithm.setup(self.problem, termination=("n_gen", self.max_generations), seed=self.seed, verbose=False)

    def _build_algorithm(self) -> Any:
        raise NotImplementedError

    def _sampling(self) -> FloatRandomSampling:
        return FloatRandomSampling()

    def _crossover(self) -> SBX:
        return SBX(prob=self.crossover_rate, eta=15)

    def _mutation(self) -> PM:
        return PM(prob=self.mutation_rate, eta=20)

    def _extract_population(self) -> list[PopulationMember]:
        if self._algorithm.pop is None:
            return []
        x_values = self._algorithm.pop.get("X")
        f_values = self._algorithm.pop.get("F")
        if x_values is None or f_values is None:
            return []

        members: list[PopulationMember] = []
        for x, f in zip(np.asarray(x_values), np.asarray(f_values)):
            members.append(PopulationMember(x=[float(v) for v in x], f=[float(v) for v in f]))
        return members

    def step(self) -> PopulationSnapshot:
        if self._done or not self._algorithm.has_next():
            self._done = True
            raise StopIteration("Algorithm execution is complete")

        self._algorithm.next()
        done = not self._algorithm.has_next()
        self._done = done
        return PopulationSnapshot(
            generation=int(self._algorithm.n_gen),
            elapsed_sec=perf_counter() - self._start_time,
            population=self._extract_population(),
            done=done,
        )

    def is_done(self) -> bool:
        return self._done or (not self._algorithm.has_next())

