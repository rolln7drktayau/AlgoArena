from __future__ import annotations

from pymoo.algorithms.moo.dnsga2 import DNSGA2

from .pymoo_adapter import PymooSteppingAlgorithm


class DNSGA2Algorithm(PymooSteppingAlgorithm):
    display_name = "D-NSGA-II"
    hyperparam_schema = {
        "population_size": {"label": "Population Size", "type": "int", "min": 20, "max": 600, "step": 10, "default": 120},
        "generations": {"label": "Generations", "type": "int", "min": 5, "max": 1000, "step": 5, "default": 140},
        "crossover_rate": {"label": "Crossover Rate", "type": "float", "min": 0.1, "max": 1.0, "step": 0.01, "default": 0.9},
        "mutation_rate": {"label": "Mutation Rate", "type": "float", "min": 0.01, "max": 1.0, "step": 0.01, "default": 0.1},
        "perc_detect_change": {"label": "Change Detect %", "type": "float", "min": 0.01, "max": 1.0, "step": 0.01, "default": 0.1},
        "perc_diversity": {"label": "Diversity %", "type": "float", "min": 0.01, "max": 1.0, "step": 0.01, "default": 0.3},
        "eps": {"label": "Epsilon", "type": "float", "min": 0.0, "max": 0.2, "step": 0.001, "default": 0.0},
    }

    def _build_algorithm(self) -> DNSGA2:
        return DNSGA2(
            pop_size=self.population_size,
            perc_detect_change=float(self.hyperparams.get("perc_detect_change", 0.1)),
            perc_diversity=float(self.hyperparams.get("perc_diversity", 0.3)),
            eps=float(self.hyperparams.get("eps", 0.0)),
            sampling=self._sampling(),
            crossover=self._crossover(),
            mutation=self._mutation(),
            eliminate_duplicates=True,
        )
