from __future__ import annotations

import numpy as np

from algorithms.base import BaseAlgorithm, PopulationMember, PopulationSnapshot


class TemplateAlgorithm(BaseAlgorithm):
    display_name = "Template Algorithm"
    hyperparam_schema = {
        "population_size": {"label": "Population Size", "type": "int", "min": 20, "max": 400, "step": 10, "default": 80},
        "generations": {"label": "Generations", "type": "int", "min": 5, "max": 500, "step": 5, "default": 80},
    }

    def __init__(self, problem, hyperparams=None):
        super().__init__(problem, hyperparams)
        self.population_size = int(self.hyperparams.get("population_size", 80))
        self.generations = int(self.hyperparams.get("generations", 80))
        self.current_generation = 0
        self.rng = np.random.default_rng(seed=self.hyperparams.get("seed"))

    def step(self) -> PopulationSnapshot:
        if self.is_done():
            raise StopIteration("Template algorithm is done")

        self.current_generation += 1
        x = self.rng.uniform(self.problem.xl, self.problem.xu, (self.population_size, self.problem.n_var))
        f = self.problem.evaluate(x, return_values_of=["F"])

        members = [
            PopulationMember(
                x=[float(value) for value in row_x],
                f=[float(value) for value in row_f],
            )
            for row_x, row_f in zip(x, f)
        ]

        return PopulationSnapshot(
            generation=self.current_generation,
            elapsed_sec=float(self.current_generation),
            population=members,
            done=self.is_done(),
        )

    def is_done(self) -> bool:
        return self.current_generation >= self.generations

