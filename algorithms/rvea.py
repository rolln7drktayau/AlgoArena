from __future__ import annotations

from pymoo.algorithms.moo.rvea import RVEA

from .pymoo_adapter import PymooSteppingAlgorithm
from .ref_helpers import build_ref_dirs


class RVEAAlgorithm(PymooSteppingAlgorithm):
    display_name = "RVEA"
    hyperparam_schema = {
        "population_size": {"label": "Population Size", "type": "int", "min": 20, "max": 800, "step": 10, "default": 140},
        "generations": {"label": "Generations", "type": "int", "min": 5, "max": 1000, "step": 5, "default": 160},
        "crossover_rate": {"label": "Crossover Rate", "type": "float", "min": 0.1, "max": 1.0, "step": 0.01, "default": 0.9},
        "mutation_rate": {"label": "Mutation Rate", "type": "float", "min": 0.01, "max": 1.0, "step": 0.01, "default": 0.1},
        "alpha": {"label": "Alpha", "type": "float", "min": 0.5, "max": 10.0, "step": 0.1, "default": 2.0},
        "adapt_freq": {"label": "Adapt Freq", "type": "float", "min": 0.01, "max": 1.0, "step": 0.01, "default": 0.1},
    }

    def _build_algorithm(self) -> RVEA:
        ref_dirs = build_ref_dirs(self.problem.n_obj, self.population_size, min_partitions=2, max_partitions=14)
        alpha = float(self.hyperparams.get("alpha", 2.0))
        adapt_freq = float(self.hyperparams.get("adapt_freq", 0.1))
        return RVEA(
            ref_dirs=ref_dirs,
            pop_size=len(ref_dirs),
            alpha=alpha,
            adapt_freq=adapt_freq,
            sampling=self._sampling(),
            crossover=self._crossover(),
            mutation=self._mutation(),
            eliminate_duplicates=True,
        )

