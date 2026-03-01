from __future__ import annotations

import asyncio
import csv
import io
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from tempfile import gettempdir
from typing import Any

import numpy as np
from fastapi import WebSocket
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from algorithms.base import PopulationSnapshot
from algorithms.registry import create_algorithm_instance
from problems.registry import build_reference_front, create_problem

from .metrics import build_diversity_heatmap, compute_metrics
from .models import RunRequest


@dataclass
class AlgorithmRunRecord:
    algorithm_id: str
    name: str
    snapshots: list[PopulationSnapshot] = field(default_factory=list)
    error: str | None = None


@dataclass
class RunRecord:
    run_id: str
    problem_name: str
    started_at: datetime
    finished_at: datetime | None = None
    algorithms: dict[str, AlgorithmRunRecord] = field(default_factory=dict)
    summary: dict[str, Any] | None = None


class RunManager:
    def __init__(self) -> None:
        self._runs: dict[str, RunRecord] = {}

    def get_run(self, run_id: str) -> RunRecord | None:
        return self._runs.get(run_id)

    async def execute_run(self, run_id: str, run_request: RunRequest, websocket: WebSocket) -> RunRecord:
        problem_config = run_request.problem.model_dump(exclude_none=True)
        problem = create_problem(problem_config)
        reference_front = build_reference_front(problem)
        hv_ref = None
        if reference_front is not None and len(reference_front) > 0:
            hv_ref = np.max(reference_front, axis=0) * 1.15 + 1e-9

        run_record = RunRecord(
            run_id=run_id,
            problem_name=problem_config.get("name") or problem_config.get("problem_id") or run_request.problem.kind,
            started_at=datetime.now(tz=timezone.utc),
        )
        self._runs[run_id] = run_record

        algorithm_instances: dict[str, Any] = {}
        active_algorithm_ids: set[str] = set()

        for algo_cfg in run_request.algorithms:
            algorithm = create_algorithm_instance(algo_cfg.name, problem, algo_cfg.hyperparams)
            algorithm_instances[algo_cfg.id] = algorithm
            active_algorithm_ids.add(algo_cfg.id)
            run_record.algorithms[algo_cfg.id] = AlgorithmRunRecord(algorithm_id=algo_cfg.id, name=algo_cfg.name)

        while active_algorithm_ids:
            progressed_this_cycle = False
            for algorithm_id in list(active_algorithm_ids):
                algorithm = algorithm_instances[algorithm_id]
                algo_record = run_record.algorithms[algorithm_id]
                try:
                    snapshot = await asyncio.to_thread(algorithm.step)
                except StopIteration:
                    active_algorithm_ids.remove(algorithm_id)
                    continue
                except Exception as exc:
                    algo_record.error = str(exc)
                    active_algorithm_ids.remove(algorithm_id)
                    await websocket.send_json(
                        {
                            "type": "algorithm_error",
                            "run_id": run_id,
                            "algorithm_id": algorithm_id,
                            "algorithm_name": algo_record.name,
                            "error": str(exc),
                        }
                    )
                    continue

                previous_snapshot = algo_record.snapshots[-1] if algo_record.snapshots else None
                pop_objectives = np.array([member.f for member in snapshot.population], dtype=float)
                metrics = compute_metrics(pop_objectives, reference_front=reference_front, hv_reference_point=hv_ref)
                metrics.update(
                    self._compute_runtime_metrics(
                        snapshot=snapshot,
                        previous_snapshot=previous_snapshot,
                        current_metrics=metrics,
                    )
                )
                metrics["population_size"] = float(len(snapshot.population))
                snapshot.metrics = metrics
                snapshot.heatmap = build_diversity_heatmap(pop_objectives)
                snapshot.done = algorithm.is_done()

                algo_record.snapshots.append(snapshot)
                if snapshot.done:
                    active_algorithm_ids.remove(algorithm_id)

                progressed_this_cycle = True
                await websocket.send_json(
                    {
                        "type": "generation",
                        "run_id": run_id,
                        "algorithm_id": algorithm_id,
                        "algorithm_name": algo_record.name,
                        "snapshot": self._snapshot_to_payload(snapshot),
                    }
                )

            if progressed_this_cycle:
                await websocket.send_json(
                    {
                        "type": "leaderboard",
                        "run_id": run_id,
                        "entries": self._build_leaderboard(run_record),
                    }
                )
            await asyncio.sleep(0)

        run_record.finished_at = datetime.now(tz=timezone.utc)
        run_record.summary = self._build_summary(run_record)
        await websocket.send_json({"type": "completed", "run_id": run_id, "summary": run_record.summary})
        return run_record

    def _snapshot_to_payload(self, snapshot: PopulationSnapshot) -> dict[str, Any]:
        return {
            "generation": snapshot.generation,
            "elapsed_sec": snapshot.elapsed_sec,
            "population": [{"x": member.x, "f": member.f} for member in snapshot.population],
            "metrics": snapshot.metrics,
            "heatmap": snapshot.heatmap,
            "done": snapshot.done,
        }

    def _build_leaderboard(self, run_record: RunRecord) -> list[dict[str, Any]]:
        rows: list[dict[str, Any]] = []
        for algorithm_id, algo in run_record.algorithms.items():
            if not algo.snapshots:
                continue
            latest = algo.snapshots[-1]
            hv_history = [s.metrics.get("hv") for s in algo.snapshots if s.metrics.get("hv") is not None]
            convergence_gen = self._estimate_convergence_generation(hv_history)
            rows.append(
                {
                    "algorithm_id": algorithm_id,
                    "algorithm_name": algo.name,
                    "generation": latest.generation,
                    "elapsed_sec": latest.elapsed_sec,
                    "hv": latest.metrics.get("hv"),
                    "igd": latest.metrics.get("igd"),
                    "igd_plus": latest.metrics.get("igd_plus"),
                    "gd": latest.metrics.get("gd"),
                    "gd_plus": latest.metrics.get("gd_plus"),
                    "epsilon": latest.metrics.get("epsilon"),
                    "spread": latest.metrics.get("spread"),
                    "spacing": latest.metrics.get("spacing"),
                    "generation_speed": latest.metrics.get("generation_speed"),
                    "hv_improvement": latest.metrics.get("hv_improvement"),
                    "hv_improvement_rate": latest.metrics.get("hv_improvement_rate"),
                    "time_to_convergence": convergence_gen,
                    "error": algo.error,
                }
            )

        def rank_tuple(entry: dict[str, Any]) -> tuple[float, float, float, float, float]:
            hv = entry["hv"] if entry["hv"] is not None else -float("inf")
            igd = entry["igd"] if entry["igd"] is not None else float("inf")
            conv = entry["time_to_convergence"] if entry["time_to_convergence"] is not None else float("inf")
            elapsed = entry["elapsed_sec"] if entry["elapsed_sec"] is not None else float("inf")
            speed = entry["generation_speed"] if entry["generation_speed"] is not None else -float("inf")
            return (-hv, igd, conv, elapsed, -speed)

        rows.sort(key=rank_tuple)
        for index, row in enumerate(rows, start=1):
            row["rank"] = index
        return rows

    def _build_summary(self, run_record: RunRecord) -> dict[str, Any]:
        leaderboard = self._build_leaderboard(run_record)

        per_algorithm: list[dict[str, Any]] = []
        for row in leaderboard:
            algorithm_id = row["algorithm_id"]
            snapshots = run_record.algorithms[algorithm_id].snapshots
            latest = snapshots[-1] if snapshots else None
            per_algorithm.append(
                {
                    "algorithm_id": algorithm_id,
                    "algorithm_name": row["algorithm_name"],
                    "metrics": {
                        "hv": row["hv"],
                        "igd": row["igd"],
                        "igd_plus": row["igd_plus"],
                        "gd": row["gd"],
                        "gd_plus": row["gd_plus"],
                        "epsilon": row["epsilon"],
                        "spread": row["spread"],
                        "spacing": row["spacing"],
                        "generation_speed": row["generation_speed"],
                        "hv_improvement": row["hv_improvement"],
                        "hv_improvement_rate": row["hv_improvement_rate"],
                        "time_to_convergence": row["time_to_convergence"],
                        "elapsed_sec": row["elapsed_sec"],
                    },
                    "generations": latest.generation if latest else 0,
                    "error": row.get("error"),
                }
            )

        radar = self._build_radar(per_algorithm)
        best_overall = leaderboard[0]["algorithm_name"] if leaderboard else None
        return {"best_overall": best_overall, "leaderboard": leaderboard, "radar": radar, "algorithms": per_algorithm}

    def _build_radar(self, per_algorithm: list[dict[str, Any]]) -> list[dict[str, Any]]:
        metric_keys = ["hv", "igd", "igd_plus", "gd", "epsilon", "spread", "generation_speed", "time_to_convergence"]
        metric_values: dict[str, list[float]] = {key: [] for key in metric_keys}

        for item in per_algorithm:
            for key in metric_keys:
                value = item["metrics"].get(key)
                if value is not None:
                    metric_values[key].append(float(value))

        def normalize(key: str, value: float | None) -> float:
            if value is None:
                return 0.0
            values = metric_values[key]
            if not values:
                return 0.0
            min_v, max_v = min(values), max(values)
            if np.isclose(min_v, max_v):
                return 1.0
            if key in {"hv", "generation_speed"}:
                return float((value - min_v) / (max_v - min_v))
            return float((max_v - value) / (max_v - min_v))

        radar_points: list[dict[str, Any]] = []
        for item in per_algorithm:
            metrics = item["metrics"]
            radar_points.append(
                {
                    "algorithm_name": item["algorithm_name"],
                    "hv": normalize("hv", metrics.get("hv")),
                    "igd": normalize("igd", metrics.get("igd")),
                    "igd_plus": normalize("igd_plus", metrics.get("igd_plus")),
                    "gd": normalize("gd", metrics.get("gd")),
                    "epsilon": normalize("epsilon", metrics.get("epsilon")),
                    "spread": normalize("spread", metrics.get("spread")),
                    "generation_speed": normalize("generation_speed", metrics.get("generation_speed")),
                    "time_to_convergence": normalize("time_to_convergence", metrics.get("time_to_convergence")),
                }
            )
        return radar_points

    def _estimate_convergence_generation(self, hv_values: list[float | None], patience: int = 5, tol: float = 1e-4) -> int | None:
        cleaned = [value for value in hv_values if value is not None]
        if len(cleaned) < patience + 1:
            return None
        for idx in range(patience, len(cleaned)):
            window = cleaned[idx - patience : idx + 1]
            if max(window) - min(window) < tol:
                return idx + 1
        return None

    def export_csv(self, run_id: str) -> str:
        run_record = self._runs.get(run_id)
        if run_record is None:
            raise KeyError(f"Run '{run_id}' not found")

        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(
            [
                "algorithm_id",
                "algorithm_name",
                "generation",
                "elapsed_sec",
                "hv",
                "igd",
                "igd_plus",
                "gd",
                "gd_plus",
                "epsilon",
                "spread",
                "spacing",
                "generation_speed",
                "hv_improvement",
                "hv_improvement_rate",
                "population_size",
            ]
        )

        for algorithm_id, algo in run_record.algorithms.items():
            for snapshot in algo.snapshots:
                writer.writerow(
                    [
                        algorithm_id,
                        algo.name,
                        snapshot.generation,
                        round(snapshot.elapsed_sec, 6),
                        snapshot.metrics.get("hv"),
                        snapshot.metrics.get("igd"),
                        snapshot.metrics.get("igd_plus"),
                        snapshot.metrics.get("gd"),
                        snapshot.metrics.get("gd_plus"),
                        snapshot.metrics.get("epsilon"),
                        snapshot.metrics.get("spread"),
                        snapshot.metrics.get("spacing"),
                        snapshot.metrics.get("generation_speed"),
                        snapshot.metrics.get("hv_improvement"),
                        snapshot.metrics.get("hv_improvement_rate"),
                        len(snapshot.population),
                    ]
                )

        return output.getvalue()

    def export_pdf(self, run_id: str) -> Path:
        run_record = self._runs.get(run_id)
        if run_record is None:
            raise KeyError(f"Run '{run_id}' not found")

        output_path = Path(gettempdir()) / f"algoarena-report-{run_id}.pdf"
        doc = SimpleDocTemplate(str(output_path), pagesize=A4)
        styles = getSampleStyleSheet()
        elements: list[Any] = []

        elements.append(Paragraph("AlgoArena Benchmark Report", styles["Title"]))
        elements.append(Spacer(1, 12))
        elements.append(Paragraph(f"Run ID: {run_record.run_id}", styles["Normal"]))
        elements.append(Paragraph(f"Problem: {run_record.problem_name}", styles["Normal"]))
        elements.append(
            Paragraph(
                f"Started: {run_record.started_at.strftime('%Y-%m-%d %H:%M:%S %Z')}",
                styles["Normal"],
            )
        )
        if run_record.finished_at is not None:
            elements.append(
                Paragraph(
                    f"Finished: {run_record.finished_at.strftime('%Y-%m-%d %H:%M:%S %Z')}",
                    styles["Normal"],
                )
            )
        elements.append(Spacer(1, 16))

        table_rows = [["Algorithm", "HV", "IGD", "IGD+", "Epsilon", "Speed (gen/s)", "TTC (gen)", "Elapsed (s)"]]
        leaderboard = run_record.summary["leaderboard"] if run_record.summary else self._build_leaderboard(run_record)
        for row in leaderboard:
            table_rows.append(
                [
                    row["algorithm_name"],
                    self._fmt(row["hv"]),
                    self._fmt(row["igd"]),
                    self._fmt(row["igd_plus"]),
                    self._fmt(row["epsilon"]),
                    self._fmt(row["generation_speed"]),
                    self._fmt(row["time_to_convergence"]),
                    self._fmt(row["elapsed_sec"]),
                ]
            )

        table = Table(table_rows, hAlign="LEFT")
        table.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#2f4f4f")),
                    ("TEXTCOLOR", (0, 0), (-1, 0), colors.whitesmoke),
                    ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
                    ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                    ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f2f2f2")]),
                ]
            )
        )
        elements.append(table)
        elements.append(Spacer(1, 16))
        if run_record.summary and run_record.summary.get("best_overall"):
            elements.append(Paragraph(f"Best overall algorithm: {run_record.summary['best_overall']}", styles["Heading3"]))

        doc.build(elements)
        return output_path

    def _fmt(self, value: Any) -> str:
        if value is None:
            return "-"
        if isinstance(value, float):
            return f"{value:.6f}"
        return str(value)

    def _compute_runtime_metrics(
        self,
        snapshot: PopulationSnapshot,
        previous_snapshot: PopulationSnapshot | None,
        current_metrics: dict[str, float | None],
    ) -> dict[str, float | None]:
        generation_speed: float | None = None
        step_time_sec: float | None = None
        hv_improvement: float | None = None
        hv_improvement_rate: float | None = None

        if snapshot.elapsed_sec > 0:
            generation_speed = float(snapshot.generation / snapshot.elapsed_sec)

        if previous_snapshot is not None:
            step_time = snapshot.elapsed_sec - previous_snapshot.elapsed_sec
            if step_time > 0:
                step_time_sec = float(step_time)

            current_hv = current_metrics.get("hv")
            previous_hv = previous_snapshot.metrics.get("hv")
            if current_hv is not None and previous_hv is not None:
                delta = float(current_hv - previous_hv)
                hv_improvement = delta
                if step_time_sec is not None and step_time_sec > 0:
                    hv_improvement_rate = float(delta / step_time_sec)

        return {
            "generation_speed": generation_speed,
            "step_time_sec": step_time_sec,
            "hv_improvement": hv_improvement,
            "hv_improvement_rate": hv_improvement_rate,
        }
