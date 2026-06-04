from __future__ import annotations

import math
from statistics import NormalDist
from typing import Any

import numpy as np


def _rank(values: list[float]) -> list[float]:
    order = sorted(enumerate(values), key=lambda item: item[1])
    ranks = [0.0] * len(values)
    index = 0
    while index < len(order):
        end = index + 1
        while end < len(order) and np.isclose(order[end][1], order[index][1]):
            end += 1
        avg_rank = (index + 1 + end) / 2.0
        for pos in range(index, end):
            ranks[order[pos][0]] = avg_rank
        index = end
    return ranks


def wilcoxon_signed_rank(a: list[float], b: list[float]) -> dict[str, Any]:
    pairs = [(float(x), float(y)) for x, y in zip(a, b) if np.isfinite(x) and np.isfinite(y) and not np.isclose(x, y)]
    n = len(pairs)
    if n < 5:
        return {"test": "wilcoxon_signed_rank", "n": n, "available": False, "reason": "Need at least 5 non-zero paired differences."}
    diffs = [x - y for x, y in pairs]
    ranks = _rank([abs(diff) for diff in diffs])
    w_plus = sum(rank for rank, diff in zip(ranks, diffs) if diff > 0)
    w_minus = sum(rank for rank, diff in zip(ranks, diffs) if diff < 0)
    statistic = min(w_plus, w_minus)
    mean = n * (n + 1) / 4.0
    variance = n * (n + 1) * (2 * n + 1) / 24.0
    z = (statistic - mean) / math.sqrt(max(1e-9, variance))
    p_value = 2.0 * NormalDist().cdf(-abs(z))
    return {"test": "wilcoxon_signed_rank", "n": n, "available": True, "statistic": statistic, "z": z, "p_value": p_value}


def kruskal_wallis(groups: dict[str, list[float]]) -> dict[str, Any]:
    clean_groups = {name: [float(v) for v in values if np.isfinite(v)] for name, values in groups.items()}
    clean_groups = {name: values for name, values in clean_groups.items() if len(values) >= 2}
    if len(clean_groups) < 2:
        return {"test": "kruskal_wallis", "available": False, "reason": "Need at least two groups with two samples each."}
    all_values = [value for values in clean_groups.values() for value in values]
    ranks = _rank(all_values)
    offset = 0
    rank_sums = {}
    for name, values in clean_groups.items():
        rank_sums[name] = sum(ranks[offset : offset + len(values)])
        offset += len(values)
    n_total = len(all_values)
    h = (12.0 / (n_total * (n_total + 1))) * sum((rank_sums[name] ** 2) / len(values) for name, values in clean_groups.items()) - 3 * (n_total + 1)
    df = len(clean_groups) - 1
    # Wilson-Hilferty normal approximation for chi-square survival.
    z = ((h / df) ** (1 / 3) - (1 - 2 / (9 * df))) / math.sqrt(2 / (9 * df))
    p_value = NormalDist().cdf(-z)
    return {"test": "kruskal_wallis", "available": True, "groups": list(clean_groups.keys()), "statistic": h, "df": df, "p_value": p_value}
