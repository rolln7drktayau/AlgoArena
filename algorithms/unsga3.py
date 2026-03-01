from __future__ import annotations

from pymoo.algorithms.moo.unsga3 import UNSGA3

from .pymoo_adapter import PymooSteppingAlgorithm
from .ref_helpers import build_ref_dirs


class UNSGA3Algorithm(PymooSteppingAlgorithm):
    display_name = "U-NSGA-III"
    hyperparam_schema = {
        "population_size": {"label": "Population Size", "type": "int", "min": 20, "max": 800, "step": 10, "default": 140},
        "generations": {"label": "Generations", "type": "int", "min": 5, "max": 1000, "step": 5, "default": 160},
        "crossover_rate": {"label": "Crossover Rate", "type": "float", "min": 0.1, "max": 1.0, "step": 0.01, "default": 0.9},
        "mutation_rate": {"label": "Mutation Rate", "type": "float", "min": 0.01, "max": 1.0, "step": 0.01, "default": 0.1},
    }

    def _build_algorithm(self) -> UNSGA3:
        ref_dirs = build_ref_dirs(self.problem.n_obj, self.population_size, min_partitions=2, max_partitions=12)
        return UNSGA3(
            ref_dirs=ref_dirs,
            pop_size=len(ref_dirs),
            sampling=self._sampling(),
            crossover=self._crossover(),
            mutation=self._mutation(),
            eliminate_duplicates=True,
        )

