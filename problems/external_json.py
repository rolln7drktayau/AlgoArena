from __future__ import annotations

import json
import os
import subprocess
from typing import Any

import numpy as np
from pymoo.core.problem import Problem


class ExternalJsonProblem(Problem):
    def __init__(
        self,
        command: list[str],
        n_var: int,
        n_obj: int,
        xl: float | list[float],
        xu: float | list[float],
        timeout_sec: float,
    ):
        if os.getenv("ALGOARENA_ENABLE_SUBPROCESS") != "1":
            raise PermissionError("External JSON evaluators are disabled. Set ALGOARENA_ENABLE_SUBPROCESS=1 in a trusted local environment.")
        if not command:
            raise ValueError("External evaluator command cannot be empty.")
        self.command = command
        self.timeout_sec = timeout_sec
        lower = np.asarray(xl if isinstance(xl, list) else [float(xl)] * n_var, dtype=float)
        upper = np.asarray(xu if isinstance(xu, list) else [float(xu)] * n_var, dtype=float)
        super().__init__(n_var=n_var, n_obj=n_obj, xl=lower, xu=upper, vtype=float)

    def _evaluate_one(self, x: np.ndarray) -> list[float]:
        payload = json.dumps({"x": [float(value) for value in x]})
        completed = subprocess.run(
            self.command,
            input=payload,
            capture_output=True,
            text=True,
            timeout=self.timeout_sec,
            check=False,
        )
        if completed.returncode != 0:
            raise RuntimeError(f"External evaluator failed with code {completed.returncode}: {completed.stderr[:500]}")
        try:
            parsed: Any = json.loads(completed.stdout)
        except json.JSONDecodeError as exc:
            raise RuntimeError("External evaluator did not return valid JSON.") from exc
        values = parsed.get("f") if isinstance(parsed, dict) else parsed
        arr = np.asarray(values, dtype=float).reshape(-1)
        if arr.shape[0] != self.n_obj:
            raise ValueError(f"External evaluator returned {arr.shape[0]} objectives, expected {self.n_obj}.")
        if not np.all(np.isfinite(arr)):
            raise ValueError("External evaluator returned non-finite objective values.")
        return [float(value) for value in arr]

    def _evaluate(self, x: np.ndarray, out: dict[str, Any], *args: Any, **kwargs: Any) -> None:
        out["F"] = np.asarray([self._evaluate_one(candidate) for candidate in x], dtype=float)
