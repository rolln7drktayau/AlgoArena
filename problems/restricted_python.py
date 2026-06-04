from __future__ import annotations

from pathlib import Path
from types import FunctionType
from typing import Any, Callable

import numpy as np


class RestrictedPythonUnavailable(RuntimeError):
    pass


def load_restricted_evaluator(file_path: str, function_name: str) -> Callable[[np.ndarray], list[float]]:
    try:
        from RestrictedPython import compile_restricted
        from RestrictedPython.Guards import guarded_iter_unpack_sequence, guarded_unpack_sequence, safer_getattr
        from RestrictedPython.PrintCollector import PrintCollector
        from RestrictedPython import safe_builtins, utility_builtins
    except Exception as exc:  # pragma: no cover - depends on optional environment
        raise RestrictedPythonUnavailable("RestrictedPython is not installed.") from exc

    source = Path(file_path).read_text(encoding="utf-8")
    byte_code = compile_restricted(source, filename=file_path, mode="exec")
    restricted_globals: dict[str, Any] = {
        "__builtins__": {
            **safe_builtins,
            "abs": abs,
            "float": float,
            "int": int,
            "len": len,
            "max": max,
            "min": min,
            "pow": pow,
            "range": range,
            "round": round,
            "sum": sum,
        },
        "_getattr_": safer_getattr,
        "_getitem_": lambda obj, index: obj[index],
        "_getiter_": iter,
        "_iter_unpack_sequence_": guarded_iter_unpack_sequence,
        "_unpack_sequence_": guarded_unpack_sequence,
        "_print_": PrintCollector,
        "np": np,
        **utility_builtins,
    }
    restricted_locals: dict[str, Any] = {}
    exec(byte_code, restricted_globals, restricted_locals)
    evaluator = restricted_locals.get(function_name) or restricted_globals.get(function_name)
    if not isinstance(evaluator, FunctionType):
        raise ValueError(f"Function '{function_name}' was not found in restricted problem module.")
    return evaluator
