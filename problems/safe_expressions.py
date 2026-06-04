from __future__ import annotations

import ast
import math
from typing import Any, Callable

import numpy as np


ALLOWED_NAMES = {"x", "np", "math", "abs", "min", "max", "sum", "pow", "round", "range", "len", "i", "j", "k"}
ALLOWED_NODE_TYPES = (
    ast.Expression,
    ast.BinOp,
    ast.UnaryOp,
    ast.BoolOp,
    ast.Compare,
    ast.IfExp,
    ast.Call,
    ast.Name,
    ast.Load,
    ast.Constant,
    ast.Subscript,
    ast.Slice,
    ast.Tuple,
    ast.List,
    ast.Attribute,
    ast.GeneratorExp,
    ast.comprehension,
    ast.Store,
    ast.Add,
    ast.Sub,
    ast.Mult,
    ast.Div,
    ast.FloorDiv,
    ast.Mod,
    ast.Pow,
    ast.USub,
    ast.UAdd,
    ast.And,
    ast.Or,
    ast.Eq,
    ast.NotEq,
    ast.Lt,
    ast.LtE,
    ast.Gt,
    ast.GtE,
)
BLOCKED_ATTRIBUTE_PREFIXES = {"__", "_"}


class SafeExpressionError(ValueError):
    pass


def _validate_node(node: ast.AST) -> None:
    if not isinstance(node, ALLOWED_NODE_TYPES):
        raise SafeExpressionError(f"Unsupported expression syntax: {type(node).__name__}")

    if isinstance(node, ast.Name) and isinstance(node.ctx, ast.Store):
        return

    if isinstance(node, ast.Name) and node.id not in ALLOWED_NAMES:
        raise SafeExpressionError(f"Unknown name '{node.id}' in expression.")

    if isinstance(node, ast.Attribute):
        if node.attr.startswith(tuple(BLOCKED_ATTRIBUTE_PREFIXES)):
            raise SafeExpressionError(f"Unsupported attribute '{node.attr}' in expression.")
        if not isinstance(node.value, ast.Name) or node.value.id not in {"np", "math"}:
            raise SafeExpressionError("Only np.* and math.* attributes are allowed.")

    if isinstance(node, ast.Call):
        if isinstance(node.func, ast.Name) and node.func.id not in ALLOWED_NAMES:
            raise SafeExpressionError(f"Unsupported function '{node.func.id}'.")
        if isinstance(node.func, ast.Attribute):
            _validate_node(node.func)
        elif not isinstance(node.func, ast.Name):
            raise SafeExpressionError("Only named functions are allowed.")

    for child in ast.iter_child_nodes(node):
        _validate_node(child)


def compile_safe_expression(expression: str) -> Callable[[np.ndarray], float]:
    text = expression.strip()
    if not text:
        raise SafeExpressionError("Expression cannot be empty.")
    if text.startswith("lambda"):
        raise SafeExpressionError("Lambda expressions are not supported in safe mode. Use an expression with x.")

    try:
        tree = ast.parse(text, mode="eval")
    except SyntaxError as exc:
        raise SafeExpressionError(f"Invalid expression syntax: {exc.msg}") from exc
    _validate_node(tree)
    code = compile(tree, "<safe_objective_expression>", "eval")
    safe_globals: dict[str, Any] = {
        "__builtins__": {},
        "np": np,
        "math": math,
        "abs": abs,
        "min": min,
        "max": max,
        "sum": sum,
        "pow": pow,
        "round": round,
        "range": range,
        "len": len,
    }

    def _evaluate(x: np.ndarray) -> float:
        runtime_globals = dict(safe_globals)
        runtime_globals["x"] = x
        value = eval(code, runtime_globals, {})
        result = float(value)
        if not np.isfinite(result):
            raise SafeExpressionError("Expression evaluated to a non-finite value.")
        return result

    return _evaluate
