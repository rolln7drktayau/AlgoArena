from __future__ import annotations

from pymoo.algorithms.moo.moead import MOEAD

from .pymoo_adapter import PymooSteppingAlgorithm
from .ref_helpers import build_ref_dirs


class MOEADAlgorithm(PymooSteppingAlgorithm):
    display_name = "MOEA/D"
    hyperparam_schema = {
        "population_size": {"label": "Population Size", "type": "int", "min": 20, "max": 800, "step": 10, "default": 120},
        "generations": {"label": "Generations", "type": "int", "min": 5, "max": 1000, "step": 5, "default": 140},
        "crossover_rate": {"label": "Crossover Rate", "type": "float", "min": 0.1, "max": 1.0, "step": 0.01, "default": 0.9},
        "mutation_rate": {"label": "Mutation Rate", "type": "float", "min": 0.01, "max": 1.0, "step": 0.01, "default": 0.1},
        "neighborhood_size": {"label": "Neighborhood Size", "type": "int", "min": 5, "max": 80, "step": 1, "default": 20},
        "prob_neighbor_mating": {"label": "Neighbor Mating Prob.", "type": "float", "min": 0.05, "max": 1.0, "step": 0.01, "default": 0.9},
    }

    def _build_algorithm(self) -> MOEAD:
        ref_dirs = build_ref_dirs(self.problem.n_obj, self.population_size, min_partitions=2, max_partitions=14)
        n_neighbors = int(self.hyperparams.get("neighborhood_size", 20))
        prob_neighbor_mating = float(self.hyperparams.get("prob_neighbor_mating", 0.9))
        return MOEAD(
            ref_dirs=ref_dirs,
            n_neighbors=n_neighbors,
            prob_neighbor_mating=prob_neighbor_mating,
            sampling=self._sampling(),
            crossover=self._crossover(),
            mutation=self._mutation(),
        )
