"""Independent benchmark repetitions with explicit evaluation accounting."""
from __future__ import annotations

from collections import defaultdict
import hashlib
from typing import Callable

import numpy as np
from pydantic import BaseModel, Field
from scipy.stats import mannwhitneyu

from algorithms.registry import create_algorithm_instance
from problems.registry import create_problem, build_reference_front
from .metrics import compute_metrics
from .models import AlgorithmConfig, ProblemConfig


class CampaignRequest(BaseModel):
    problems: list[ProblemConfig] = Field(min_length=1, max_length=10)
    algorithms: list[AlgorithmConfig] = Field(min_length=1, max_length=12)
    seeds: list[int] = Field(min_length=2, max_length=30)
    evaluations: int = Field(default=1200, ge=100, le=100000)
    resume_from: str | None = Field(default=None, pattern=r"^[A-Za-z0-9_-]{1,100}$")


def run_campaign(request: CampaignRequest, emit: Callable[[dict], None]) -> dict:
    if len(set(request.seeds)) != len(request.seeds) or any(seed < 0 for seed in request.seeds):
        raise ValueError("Seeds must be distinct non-negative integers.")
    if len({a.id for a in request.algorithms}) != len(request.algorithms):
        raise ValueError("Algorithm configuration IDs must be unique.")
    if len(request.problems) * len(request.algorithms) * len(request.seeds) * request.evaluations > 5_000_000:
        raise ValueError("Campaign exceeds the local limit of 5 million requested evaluations.")
    rows = []
    previous = {}
    if request.resume_from:
        from . import storage
        manifest = storage.get_manifest(request.resume_from)
        original = {k: v for k, v in manifest["config"].items() if k != "resume_from"}
        current = request.model_dump(exclude={"resume_from"})
        if manifest["kind"] != "campaign" or original != current:
            raise ValueError("Resume requires the exact original campaign configuration.")
        cursor = 0
        while batch := storage.read_events(request.resume_from, cursor):
            for entry in batch:
                cursor = entry["seq"]
                event = entry["event"]
                if event["type"] == "campaign_sample" and event["sample"]["status"] == "completed":
                    sample = event["sample"]
                    previous[(sample["problem_index"], sample["algorithm_id"], sample["seed"])] = sample
    total = len(request.problems) * len(request.algorithms) * len(request.seeds)
    emit({"type": "campaign_started", "total": total})
    for problem_index, config in enumerate(request.problems):
        for algorithm_config in request.algorithms:
            for seed in request.seeds:
                actual_seed = int.from_bytes(hashlib.sha256(f"{seed}:{algorithm_config.id}:{problem_index}".encode()).digest()[:4], "big")
                row = {"problem_index": problem_index, "problem": config.name or config.problem_id,
                       "algorithm_id": algorithm_config.id, "algorithm": algorithm_config.label or algorithm_config.name,
                       "seed": actual_seed, "base_seed": seed, "requested_evaluations": request.evaluations}
                cached = previous.get((problem_index, algorithm_config.id, actual_seed))
                if cached:
                    rows.append(cached)
                    emit({"type": "campaign_sample", "sample": cached, "reused": True, "completed": len(rows), "total": total})
                    continue
                try:
                    problem = create_problem(config.model_dump(exclude_none=True))
                    reference = build_reference_front(problem)
                    count = 0
                    original_evaluate = problem._evaluate

                    def counted(x, out, *args, **kwargs):
                        nonlocal count
                        count += len(x)
                        return original_evaluate(x, out, *args, **kwargs)

                    problem._evaluate = counted
                    params = {**algorithm_config.hyperparams, "seed": actual_seed, "max_evaluations": request.evaluations}
                    population = int(params.get("population_size", 60))
                    if population < 5 or population > request.evaluations:
                        raise ValueError("Population must be between 5 and the evaluation budget.")
                    params["generations"] = max(1, request.evaluations // population)
                    algorithm = create_algorithm_instance(algorithm_config.name, problem, params)
                    snapshot = None
                    while not algorithm.is_done() and count < request.evaluations:
                        snapshot = algorithm.step()
                    if snapshot is None:
                        raise ValueError("Algorithm returned no population.")
                    metrics = compute_metrics(np.asarray([p.f for p in snapshot.population]), reference_front=reference)
                    row.update(metrics=metrics, actual_evaluations=count, elapsed_sec=snapshot.elapsed_sec,
                               status="completed", budget_exact=count == request.evaluations)
                except Exception as exc:
                    row.update(status="failed", error=str(exc))
                rows.append(row)
                emit({"type": "campaign_sample", "sample": row, "completed": len(rows), "total": total})
    groups = defaultdict(list)
    for row in rows:
        if row["status"] == "completed" and row["budget_exact"]:
            groups[(row["problem_index"], row["algorithm_id"])].append(row)
    summaries = []
    comparisons = []
    for (index, algorithm_id), samples in groups.items():
        hv = [r["metrics"]["hv"] for r in samples if r["metrics"]["hv"] is not None]
        if hv:
            summaries.append({"problem_index": index, "algorithm_id": algorithm_id, "n": len(hv),
                              "hv_mean": float(np.mean(hv)), "hv_std": float(np.std(hv, ddof=1)) if len(hv) > 1 else None,
                              "hv_median": float(np.median(hv))})
    for index in range(len(request.problems)):
        ids = [a.id for a in request.algorithms]
        for i, left in enumerate(ids):
            for right in ids[i + 1:]:
                a = [r["metrics"]["hv"] for r in groups[(index, left)] if r["metrics"]["hv"] is not None]
                b = [r["metrics"]["hv"] for r in groups[(index, right)] if r["metrics"]["hv"] is not None]
                if len(a) < 5 or len(b) < 5:
                    continue
                test = mannwhitneyu(a, b, alternative="two-sided", method="asymptotic")
                comparisons.append({"problem_index": index, "left": left, "right": right, "n_left": len(a), "n_right": len(b),
                                    "p_value": float(test.pvalue), "rank_biserial": float(2 * test.statistic / (len(a) * len(b)) - 1)})
    previous = 0.0
    for rank, item in enumerate(sorted(comparisons, key=lambda r: r["p_value"])):
        previous = max(previous, min(1.0, item["p_value"] * (len(comparisons) - rank)))
        item["p_holm"] = previous
    result = {"samples": rows, "summaries": summaries, "comparisons": comparisons,
              "statistical_design": "Independent runs; two-sided asymptotic Mann–Whitney on final HV; Holm across all reported comparisons. Only exact-budget successful runs included. At least 5 per group; no universal sufficiency guarantee."}
    emit({"type": "campaign_completed", "payload": result})
    return result
