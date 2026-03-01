from __future__ import annotations

from pymoo.algorithms.moo.rnsga2 import RNSGA2

from .pymoo_adapter import PymooSteppingAlgorithm
from .ref_helpers import build_ref_points


class RNSGA2Algorithm(PymooSteppingAlgorithm):
    display_name = "R-NSGA-II"
    hyperparam_schema = {
        "population_size": {"label": "Population Size", "type": "int", "min": 20, "max": 600, "step": 10, "default": 120},
        "generations": {"label": "Generations", "type": "int", "min": 5, "max": 1000, "step": 5, "default": 140},
        "crossover_rate": {"label": "Crossover Rate", "type": "float", "min": 0.1, "max": 1.0, "step": 0.01, "default": 0.9},
        "mutation_rate": {"label": "Mutation Rate", "type": "float", "min": 0.01, "max": 1.0, "step": 0.01, "default": 0.1},
        "ref_points_count": {"label": "Ref Points", "type": "int", "min": 1, "max": 12, "step": 1, "default": 3},
        "epsilon": {"label": "Epsilon", "type": "float", "min": 0.0001, "max": 0.2, "step": 0.0005, "default": 0.001},
    }

    def _build_algorithm(self) -> RNSGA2:
        ref_points_count = int(self.hyperparams.get("ref_points_count", 3))
        ref_points = build_ref_points(self.problem.n_obj, count=ref_points_count)
        epsilon = float(self.hyperparams.get("epsilon", 0.001))
        return RNSGA2(
            ref_points=ref_points,
            epsilon=epsilon,
            pop_size=self.population_size,
            sampling=self._sampling(),
            crossover=self._crossover(),
            mutation=self._mutation(),
            eliminate_duplicates=True,
        )

