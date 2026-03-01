from __future__ import annotations

from pymoo.algorithms.moo.nsga2 import NSGA2

from .pymoo_adapter import PymooSteppingAlgorithm


class NSGA2Algorithm(PymooSteppingAlgorithm):
    display_name = "NSGA-II"
    hyperparam_schema = {
        "population_size": {"label": "Population Size", "type": "int", "min": 20, "max": 600, "step": 10, "default": 120},
        "generations": {"label": "Generations", "type": "int", "min": 5, "max": 1000, "step": 5, "default": 140},
        "crossover_rate": {"label": "Crossover Rate", "type": "float", "min": 0.1, "max": 1.0, "step": 0.01, "default": 0.9},
        "mutation_rate": {"label": "Mutation Rate", "type": "float", "min": 0.01, "max": 1.0, "step": 0.01, "default": 0.1},
    }

    def _build_algorithm(self) -> NSGA2:
        return NSGA2(
            pop_size=self.population_size,
            sampling=self._sampling(),
            crossover=self._crossover(),
            mutation=self._mutation(),
            eliminate_duplicates=True,
        )

