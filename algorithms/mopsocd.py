from __future__ import annotations

from pymoo.algorithms.moo.mopso_cd import MOPSO_CD

from .pymoo_adapter import PymooSteppingAlgorithm


class MOPSOCDAlgorithm(PymooSteppingAlgorithm):
    display_name = "MOPSO-CD"
    hyperparam_schema = {
        "population_size": {"label": "Population Size", "type": "int", "min": 20, "max": 600, "step": 10, "default": 120},
        "generations": {"label": "Generations", "type": "int", "min": 5, "max": 1000, "step": 5, "default": 140},
        "inertia_w": {"label": "Inertia W", "type": "float", "min": 0.1, "max": 1.2, "step": 0.01, "default": 0.6},
        "c1": {"label": "C1", "type": "float", "min": 0.1, "max": 3.0, "step": 0.01, "default": 2.0},
        "c2": {"label": "C2", "type": "float", "min": 0.1, "max": 3.0, "step": 0.01, "default": 2.0},
        "max_velocity_rate": {"label": "Max Velocity", "type": "float", "min": 0.01, "max": 1.0, "step": 0.01, "default": 0.5},
        "archive_size": {"label": "Archive Size", "type": "int", "min": 20, "max": 1000, "step": 10, "default": 200},
    }

    def _build_algorithm(self) -> MOPSO_CD:
        return MOPSO_CD(
            pop_size=self.population_size,
            w=float(self.hyperparams.get("inertia_w", 0.6)),
            c1=float(self.hyperparams.get("c1", 2.0)),
            c2=float(self.hyperparams.get("c2", 2.0)),
            max_velocity_rate=float(self.hyperparams.get("max_velocity_rate", 0.5)),
            archive_size=int(self.hyperparams.get("archive_size", 200)),
            sampling=self._sampling(),
        )
