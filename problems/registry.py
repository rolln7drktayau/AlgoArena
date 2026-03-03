from __future__ import annotations

import importlib.util
import math
from pathlib import Path
from types import ModuleType
from typing import Any, Callable
from uuid import uuid4

import numpy as np
from pymoo.core.problem import Problem
from pymoo.problems import get_problem


BUILTIN_PROBLEMS = [
    "ZDT1",
    "ZDT2",
    "ZDT3",
    "ZDT4",
    "ZDT5",
    "ZDT6",
    "DTLZ1",
    "DTLZ2",
    "DTLZ3",
    "DTLZ4",
    "DTLZ5",
    "DTLZ6",
    "DTLZ7",
    "WFG1",
    "WFG2",
    "WFG3",
    "WFG4",
    "WFG5",
    "WFG6",
    "WFG7",
    "WFG8",
    "WFG9",
    "WFG",
]

_CUSTOM_FACTORIES: dict[str, Callable[[], Problem]] = {}
_CUSTOM_SPECS: dict[str, dict[str, Any]] = {}


class ExpressionProblem(Problem):
    def __init__(
        self,
        objective_expressions: list[str],
        n_var: int,
        xl: float | list[float],
        xu: float | list[float],
    ):
        self._functions = [_compile_expression(expr) for expr in objective_expressions]
        lower = _normalize_bounds(xl, n_var)
        upper = _normalize_bounds(xu, n_var)
        super().__init__(n_var=n_var, n_obj=len(self._functions), xl=lower, xu=upper, vtype=float)

    def _evaluate(self, x: np.ndarray, out: dict[str, Any], *args: Any, **kwargs: Any) -> None:
        rows: list[list[float]] = []
        for candidate in x:
            rows.append([float(func(candidate)) for func in self._functions])
        out["F"] = np.asarray(rows, dtype=float)


class UploadedFunctionProblem(Problem):
    def __init__(
        self,
        evaluator: Callable[[np.ndarray], list[float] | tuple[float, ...] | np.ndarray],
        n_var: int,
        n_obj: int,
        xl: float | list[float],
        xu: float | list[float],
    ):
        self._evaluator = evaluator
        lower = _normalize_bounds(xl, n_var)
        upper = _normalize_bounds(xu, n_var)
        super().__init__(n_var=n_var, n_obj=n_obj, xl=lower, xu=upper, vtype=float)

    def _evaluate(self, x: np.ndarray, out: dict[str, Any], *args: Any, **kwargs: Any) -> None:
        rows = []
        for candidate in x:
            values = self._evaluator(candidate)
            arr = np.asarray(values, dtype=float).reshape(-1)
            if arr.shape[0] != self.n_obj:
                raise ValueError(f"Uploaded evaluator returned {arr.shape[0]} objectives, expected {self.n_obj}.")
            rows.append(arr)
        out["F"] = np.asarray(rows, dtype=float)


def create_problem(config: dict[str, Any]) -> Problem:
    kind = config.get("kind", "builtin")
    if kind == "builtin":
        return _create_builtin_problem(config)
    if kind in {"expression", "uploaded"}:
        problem_id = config.get("problem_id")
        if problem_id and problem_id in _CUSTOM_FACTORIES:
            return _CUSTOM_FACTORIES[problem_id]()
        if kind == "expression" and config.get("objectives"):
            return ExpressionProblem(
                objective_expressions=list(config["objectives"]),
                n_var=int(config.get("n_var", 10)),
                xl=config.get("xl", 0.0),
                xu=config.get("xu", 1.0),
            )
        raise ValueError("Custom problem requires a valid 'problem_id' or inline expression objectives.")
    raise ValueError(f"Unknown problem kind '{kind}'.")


def _create_builtin_problem(config: dict[str, Any]) -> Problem:
    name = str(config.get("name", "ZDT1")).upper()
    if name == "WFG":
        name = "WFG1"
    if name not in BUILTIN_PROBLEMS:
        raise ValueError(f"Unsupported built-in problem '{name}'.")

    params: dict[str, Any] = {}
    if config.get("n_var") is not None:
        params["n_var"] = int(config["n_var"])
    if config.get("n_obj") is not None:
        params["n_obj"] = int(config["n_obj"])
    if name.startswith("ZDT"):
        params.pop("n_obj", None)

    try:
        return get_problem(name.lower(), **params)
    except TypeError:
        relaxed = dict(params)
        relaxed.pop("n_obj", None)
        try:
            return get_problem(name.lower(), **relaxed)
        except TypeError:
            relaxed.pop("n_var", None)
            return get_problem(name.lower(), **relaxed)


def build_reference_front(problem: Problem, n_points: int = 250) -> np.ndarray | None:
    try:
        pareto_front = problem.pareto_front(n_pareto_points=n_points)
        if pareto_front is None:
            return None
        pf = np.asarray(pareto_front, dtype=float)
        if pf.ndim == 1:
            pf = pf.reshape(-1, 1)
        if len(pf) > n_points:
            idx = np.linspace(0, len(pf) - 1, n_points).astype(int)
            pf = pf[idx]
        return pf
    except Exception:
        return None


def list_problem_specs() -> list[dict[str, Any]]:
    builtin = [
        {"name": name, "kind": "builtin", "default_n_obj": 2 if name.startswith("ZDT") else 3}
        for name in BUILTIN_PROBLEMS
    ]
    custom = [spec for spec in _CUSTOM_SPECS.values()]
    return builtin + custom


def register_expression_problem(
    name: str,
    objectives: list[str],
    n_var: int,
    xl: float | list[float],
    xu: float | list[float],
) -> str:
    if not objectives:
        raise ValueError("At least one objective expression is required.")

    problem_id = f"expr_{uuid4().hex}"

    def _factory() -> Problem:
        return ExpressionProblem(objective_expressions=objectives, n_var=n_var, xl=xl, xu=xu)

    _CUSTOM_FACTORIES[problem_id] = _factory
    _CUSTOM_SPECS[problem_id] = {
        "problem_id": problem_id,
        "name": name,
        "kind": "expression",
        "n_var": n_var,
        "n_obj": len(objectives),
        "objectives": objectives,
    }
    return problem_id


def register_uploaded_problem(
    name: str,
    file_path: str,
    function_name: str,
    n_var: int,
    n_obj: int,
    xl: float | list[float],
    xu: float | list[float],
) -> str:
    module = _load_module(file_path)
    evaluator = getattr(module, function_name, None)
    if evaluator is None or not callable(evaluator):
        raise ValueError(f"Function '{function_name}' was not found in uploaded problem module.")

    problem_id = f"upload_{uuid4().hex}"

    def _factory() -> Problem:
        return UploadedFunctionProblem(
            evaluator=evaluator,
            n_var=n_var,
            n_obj=n_obj,
            xl=xl,
            xu=xu,
        )

    _CUSTOM_FACTORIES[problem_id] = _factory
    _CUSTOM_SPECS[problem_id] = {
        "problem_id": problem_id,
        "name": name,
        "kind": "uploaded",
        "n_var": n_var,
        "n_obj": n_obj,
        "function_name": function_name,
        "source_path": file_path,
    }
    return problem_id


def _load_module(file_path: str) -> ModuleType:
    module_name = f"problems.custom.dynamic_{uuid4().hex}"
    spec = importlib.util.spec_from_file_location(module_name, file_path)
    if spec is None or spec.loader is None:
        raise ValueError(f"Unable to import module from '{file_path}'.")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def _normalize_bounds(value: float | list[float], n_var: int) -> np.ndarray:
    if isinstance(value, list):
        if len(value) != n_var:
            raise ValueError(f"Bounds length {len(value)} does not match n_var={n_var}.")
        return np.asarray(value, dtype=float)
    return np.full(n_var, float(value), dtype=float)


def _compile_expression(expression: str) -> Callable[[np.ndarray], float]:
    text = expression.strip()
    blocked_tokens = ["__", "import", "exec", "eval", "open(", "globals(", "locals("]
    lower_text = text.lower()
    for token in blocked_tokens:
        if token in lower_text:
            raise ValueError(f"Unsupported token '{token}' in expression.")

    safe_globals = {
        "__builtins__": {},
        "np": np,
        "math": math,
        "abs": abs,
        "min": min,
        "max": max,
        "sum": sum,
    }
    if text.startswith("lambda"):
        fn = eval(text, safe_globals, {})
        if not callable(fn):
            raise ValueError("Expression is not callable.")
        return lambda x: float(fn(x))

    code = compile(text, "<objective_expression>", "eval")
    return lambda x: float(eval(code, safe_globals, {"x": x}))
