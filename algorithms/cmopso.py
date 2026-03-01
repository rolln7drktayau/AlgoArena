from __future__ import annotations

from pymoo.algorithms.moo.cmopso import CMOPSO

from .pymoo_adapter import PymooSteppingAlgorithm


class CMOPSOAlgorithm(PymooSteppingAlgorithm):
    display_name = "CMOPSO"
    hyperparam_schema = {
        "population_size": {"label": "Population Size", "type": "int", "min": 20, "max": 600, "step": 10, "default": 120},
        "generations": {"label": "Generations", "type": "int", "min": 5, "max": 1000, "step": 5, "default": 140},
        "mutation_rate": {"label": "Mutation Rate", "type": "float", "min": 0.0, "max": 1.0, "step": 0.01, "default": 0.5},
        "max_velocity_rate": {"label": "Max Velocity", "type": "float", "min": 0.01, "max": 1.0, "step": 0.01, "default": 0.2},
        "elite_size": {"label": "Elite Size", "type": "int", "min": 5, "max": 200, "step": 1, "default": 10},
    }

    def _build_algorithm(self) -> CMOPSO:
        return CMOPSO(
            pop_size=self.population_size,
            mutation_rate=float(self.hyperparams.get("mutation_rate", 0.5)),
            max_velocity_rate=float(self.hyperparams.get("max_velocity_rate", 0.2)),
            elite_size=int(self.hyperparams.get("elite_size", 10)),
            sampling=self._sampling(),
        )
