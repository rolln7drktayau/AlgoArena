from __future__ import annotations

from pymoo.algorithms.moo.rnsga3 import RNSGA3

from .pymoo_adapter import PymooSteppingAlgorithm
from .ref_helpers import build_ref_points, nearest_reference_point_count


class RNSGA3Algorithm(PymooSteppingAlgorithm):
    display_name = "R-NSGA-III"
    hyperparam_schema = {
        "population_size": {"label": "Population Size", "type": "int", "min": 20, "max": 800, "step": 10, "default": 140},
        "generations": {"label": "Generations", "type": "int", "min": 5, "max": 1000, "step": 5, "default": 160},
        "crossover_rate": {"label": "Crossover Rate", "type": "float", "min": 0.1, "max": 1.0, "step": 0.01, "default": 0.9},
        "mutation_rate": {"label": "Mutation Rate", "type": "float", "min": 0.01, "max": 1.0, "step": 0.01, "default": 0.1},
        "ref_points_count": {"label": "Ref Points", "type": "int", "min": 1, "max": 16, "step": 1, "default": 4},
        "mu": {"label": "Mu", "type": "float", "min": 0.001, "max": 0.5, "step": 0.001, "default": 0.05},
    }

    def _build_algorithm(self) -> RNSGA3:
        ref_points_count = int(self.hyperparams.get("ref_points_count", 4))
        ref_points = build_ref_points(self.problem.n_obj, count=ref_points_count)
        raw_pop_per_ref = int(
            self.hyperparams.get("pop_per_ref_point", max(2, self.population_size // max(1, len(ref_points))))
        )
        pop_per_ref = nearest_reference_point_count(self.problem.n_obj, raw_pop_per_ref, min_partitions=1, max_partitions=10)
        mu = float(self.hyperparams.get("mu", 0.05))

        return RNSGA3(
            ref_points=ref_points,
            pop_per_ref_point=pop_per_ref,
            mu=mu,
            sampling=self._sampling(),
            crossover=self._crossover(),
            mutation=self._mutation(),
            eliminate_duplicates=True,
        )
