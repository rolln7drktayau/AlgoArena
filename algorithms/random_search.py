from __future__ import annotations

from time import perf_counter
from typing import Any

import numpy as np
from deap import base, creator, tools

from .base import BaseAlgorithm, PopulationMember, PopulationSnapshot


class RandomSearchAlgorithm(BaseAlgorithm):
    display_name = "Random Search"
    hyperparam_schema = {
        "population_size": {"label": "Population Size", "type": "int", "min": 20, "max": 1000, "step": 10, "default": 150},
        "generations": {"label": "Generations", "type": "int", "min": 5, "max": 1500, "step": 5, "default": 140},
        "mutation_rate": {"label": "Mutation Rate", "type": "float", "min": 0.0, "max": 1.0, "step": 0.01, "default": 0.1},
    }

    def __init__(self, problem: Any, hyperparams: dict[str, Any] | None = None):
        super().__init__(problem, hyperparams)
        self.population_size = int(self.hyperparams.get("population_size", 150))
        self.max_generations = int(self.hyperparams.get("generations", 140))
        self.mutation_rate = float(self.hyperparams.get("mutation_rate", 0.1))
        self._generation = 0
        self._done = False
        self._rng = np.random.default_rng(seed=self.hyperparams.get("seed"))
        self._start_time = perf_counter()

        self._toolbox = base.Toolbox()
        fitness_name = f"FitnessMin_{self.problem.n_obj}D"
        individual_name = f"Individual_{self.problem.n_obj}D"
        if not hasattr(creator, fitness_name):
            creator.create(fitness_name, base.Fitness, weights=tuple([-1.0] * int(self.problem.n_obj)))
        if not hasattr(creator, individual_name):
            creator.create(individual_name, list, fitness=getattr(creator, fitness_name))
        self._individual_cls = getattr(creator, individual_name)

    def _draw_population(self) -> np.ndarray:
        lower = np.asarray(self.problem.xl, dtype=float)
        upper = np.asarray(self.problem.xu, dtype=float)
        if lower.size == 1:
            lower = np.full(self.problem.n_var, float(lower.item()))
        if upper.size == 1:
            upper = np.full(self.problem.n_var, float(upper.item()))
        x = self._rng.uniform(lower, upper, size=(self.population_size, self.problem.n_var))

        # Optional perturbation to avoid purely i.i.d. samples in later generations.
        if self._generation > 0 and self.mutation_rate > 0:
            mutation_mask = self._rng.random(size=x.shape) < self.mutation_rate
            noise = self._rng.normal(0.0, 0.05, size=x.shape)
            x = np.where(mutation_mask, x + noise * (upper - lower), x)
            x = np.clip(x, lower, upper)
        return x

    def step(self) -> PopulationSnapshot:
        if self._done:
            raise StopIteration("Algorithm execution is complete")

        self._generation += 1
        candidates = self._draw_population()
        f_values = self.problem.evaluate(candidates, return_values_of=["F"])
        individuals = []
        for idx, candidate in enumerate(candidates):
            individual = self._individual_cls(candidate.tolist())
            individual.fitness.values = tuple(float(v) for v in f_values[idx])
            individuals.append(individual)

        # Run a fast non-dominated sort to keep DEAP in the loop and expose front structure.
        sorted_fronts = tools.sortNondominated(individuals, len(individuals), first_front_only=False)
        flattened = [item for front in sorted_fronts for item in front]
        members: list[PopulationMember] = []
        for individual in flattened[: self.population_size]:
            members.append(
                PopulationMember(
                    x=[float(v) for v in individual],
                    f=[float(v) for v in individual.fitness.values],
                )
            )

        if self._generation >= self.max_generations:
            self._done = True

        return PopulationSnapshot(
            generation=self._generation,
            elapsed_sec=perf_counter() - self._start_time,
            population=members,
            done=self._done,
        )

    def is_done(self) -> bool:
        return self._done

