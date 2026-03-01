from __future__ import annotations

import importlib.util
import inspect
from pathlib import Path
from types import ModuleType
from typing import Any, Type
from uuid import uuid4

from .base import BaseAlgorithm
from .ctaea import CTAEAAlgorithm
from .dnsga2 import DNSGA2Algorithm
from .moead import MOEADAlgorithm
from .nsga2 import NSGA2Algorithm
from .nsga3 import NSGA3Algorithm
from .random_search import RandomSearchAlgorithm
from .rnsga2 import RNSGA2Algorithm
from .rnsga3 import RNSGA3Algorithm
from .rvea import RVEAAlgorithm
from .smsemoa import SMSEMOAAlgorithm
from .spea2 import SPEA2Algorithm
from .unsga3 import UNSGA3Algorithm

try:
    from .cmopso import CMOPSOAlgorithm
except Exception:
    CMOPSOAlgorithm = None

try:
    from .mopsocd import MOPSOCDAlgorithm
except Exception:
    MOPSOCDAlgorithm = None


BUILTIN_ALGORITHMS: dict[str, Type[BaseAlgorithm]] = {
    "NSGA-II": NSGA2Algorithm,
    "NSGA-III": NSGA3Algorithm,
    "U-NSGA-III": UNSGA3Algorithm,
    "R-NSGA-II": RNSGA2Algorithm,
    "R-NSGA-III": RNSGA3Algorithm,
    "D-NSGA-II": DNSGA2Algorithm,
    "MOEA/D": MOEADAlgorithm,
    "RVEA": RVEAAlgorithm,
    "C-TAEA": CTAEAAlgorithm,
    "SPEA2": SPEA2Algorithm,
    "SMS-EMOA": SMSEMOAAlgorithm,
    "Random Search": RandomSearchAlgorithm,
}
if CMOPSOAlgorithm is not None:
    BUILTIN_ALGORITHMS["CMOPSO"] = CMOPSOAlgorithm
if MOPSOCDAlgorithm is not None:
    BUILTIN_ALGORITHMS["MOPSO-CD"] = MOPSOCDAlgorithm

_CUSTOM_ALGORITHMS: dict[str, Type[BaseAlgorithm]] = {}


def register_custom_algorithm(name: str, algorithm_cls: Type[BaseAlgorithm]) -> None:
    _CUSTOM_ALGORITHMS[name] = algorithm_cls


def create_algorithm_instance(name: str, problem: Any, hyperparams: dict[str, Any] | None = None) -> BaseAlgorithm:
    if name in _CUSTOM_ALGORITHMS:
        return _CUSTOM_ALGORITHMS[name](problem, hyperparams)
    if name in BUILTIN_ALGORITHMS:
        return BUILTIN_ALGORITHMS[name](problem, hyperparams)
    raise ValueError(f"Unknown algorithm '{name}'.")


def list_algorithm_specs() -> list[dict[str, Any]]:
    specs: list[dict[str, Any]] = []
    for name, cls in BUILTIN_ALGORITHMS.items():
        specs.append(
            {
                "name": name,
                "source": "builtin",
                "module": cls.__module__,
                "hyperparams": cls.hyperparam_schema,
            }
        )
    for name, cls in _CUSTOM_ALGORITHMS.items():
        specs.append(
            {
                "name": name,
                "source": "custom",
                "module": cls.__module__,
                "hyperparams": getattr(cls, "hyperparam_schema", {}),
            }
        )
    return specs


def _load_module_from_file(file_path: str) -> ModuleType:
    module_name = f"algorithms.custom.dynamic_{uuid4().hex}"
    spec = importlib.util.spec_from_file_location(module_name, file_path)
    if spec is None or spec.loader is None:
        raise ValueError(f"Unable to build module spec for {file_path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def _find_algorithm_classes(module: ModuleType) -> list[Type[BaseAlgorithm]]:
    classes: list[Type[BaseAlgorithm]] = []
    for _, cls in inspect.getmembers(module, inspect.isclass):
        if cls is BaseAlgorithm:
            continue
        if issubclass(cls, BaseAlgorithm):
            classes.append(cls)
    return classes


def load_custom_algorithm_from_file(
    file_path: str,
    class_name: str | None = None,
    display_name: str | None = None,
) -> str:
    module = _load_module_from_file(file_path)
    classes = _find_algorithm_classes(module)
    if not classes:
        raise ValueError("No class inheriting BaseAlgorithm was found.")

    selected_cls: Type[BaseAlgorithm] | None = None
    if class_name is not None:
        for cls in classes:
            if cls.__name__ == class_name:
                selected_cls = cls
                break
        if selected_cls is None:
            raise ValueError(f"Class '{class_name}' not found.")
    else:
        selected_cls = classes[0]

    algo_name = display_name or getattr(selected_cls, "display_name", None) or selected_cls.__name__
    register_custom_algorithm(algo_name, selected_cls)
    return algo_name


def discover_custom_algorithms(custom_dir: str | Path | None = None) -> None:
    if custom_dir is None:
        custom_dir = Path(__file__).resolve().parent / "custom"
    path = Path(custom_dir)
    if not path.exists():
        return
    for py_file in path.glob("*.py"):
        if py_file.name.startswith("_"):
            continue
        try:
            load_custom_algorithm_from_file(str(py_file))
        except Exception:
            continue


discover_custom_algorithms()
