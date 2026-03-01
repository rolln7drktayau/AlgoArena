from __future__ import annotations

from pathlib import Path
import sys

from pymoo.problems import get_problem

ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.append(str(ROOT))

from algorithms.registry import BUILTIN_ALGORITHMS, create_algorithm_instance  # noqa: E402


def test_builtin_algorithms_implement_interface() -> None:
    problem = get_problem("zdt1", n_var=20)
    for algorithm_name in BUILTIN_ALGORITHMS:
        algorithm = create_algorithm_instance(
            algorithm_name,
            problem,
            {"population_size": 20, "generations": 2, "mutation_rate": 0.1, "crossover_rate": 0.9},
        )
        snapshot = algorithm.step()
        assert snapshot.generation >= 1
        assert len(snapshot.population) > 0
        assert len(snapshot.population[0].f) == 2
        while not algorithm.is_done():
            algorithm.step()
        assert algorithm.is_done()

