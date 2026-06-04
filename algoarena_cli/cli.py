from __future__ import annotations

import argparse
import asyncio
import json
from pathlib import Path
from typing import Any

from algorithms.registry import list_algorithm_specs
from backend.app.core.domain_simulator import DomainSimulationRequest, simulate_domain
from backend.app.core.models import AlgorithmConfig, ProblemConfig, RunRequest
from backend.app.core.problem_domains import list_problem_domains
from backend.app.core.run_manager import RunManager
from problems.registry import list_problem_specs


class CollectingWebSocket:
    def __init__(self) -> None:
        self.messages: list[dict[str, Any]] = []

    async def send_json(self, payload: dict[str, Any]) -> None:
        self.messages.append(payload)


def _print_json(payload: Any) -> None:
    print(json.dumps(payload, indent=2))


async def _run_benchmark(args: argparse.Namespace) -> dict[str, Any]:
    manager = RunManager()
    websocket = CollectingWebSocket()
    algorithms = [
        AlgorithmConfig(
            id=name.lower().replace("/", "-").replace(" ", "-"),
            name=name,
            label=name,
            hyperparams={
                "population_size": args.population,
                "generations": args.generations,
                "crossover_rate": 0.9,
                "mutation_rate": 0.1,
            },
        )
        for name in args.algorithm
    ]
    request = RunRequest(
        problem=ProblemConfig(kind="builtin", name=args.problem, n_var=args.variables, n_obj=args.objectives),
        algorithms=algorithms,
        seed=args.seed,
    )
    await manager.execute_run(run_id=args.run_id, run_request=request, websocket=websocket)  # type: ignore[arg-type]
    completed = next((message for message in reversed(websocket.messages) if message.get("type") == "completed"), None)
    return completed or {"type": "error", "error": "Run did not complete."}


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="algoarena", description="AlgoArena local CLI")
    subparsers = parser.add_subparsers(dest="command", required=True)

    subparsers.add_parser("algorithms", help="List available algorithms")
    subparsers.add_parser("problems", help="List available benchmark problems")
    subparsers.add_parser("domains", help="List V2 optimization domains")

    run = subparsers.add_parser("run", help="Run a local benchmark without starting the web UI")
    run.add_argument("--problem", default="ZDT1")
    run.add_argument("--algorithm", action="append", default=["NSGA-II"], help="Algorithm name. Repeat for multiple competitors.")
    run.add_argument("--variables", type=int, default=30)
    run.add_argument("--objectives", type=int, default=2)
    run.add_argument("--population", type=int, default=60)
    run.add_argument("--generations", type=int, default=50)
    run.add_argument("--seed", type=int, default=None)
    run.add_argument("--run-id", default="cli-run")
    run.add_argument("--output", type=Path, default=None)

    domain = subparsers.add_parser("domain-run", help="Run a V2 domain simulation")
    domain.add_argument("--kind", choices=["mono_objective", "tsp", "bin_packing", "bayesian", "noisy", "drawable"], default="mono_objective")
    domain.add_argument("--iterations", type=int, default=120)
    domain.add_argument("--seed", type=int, default=42)
    domain.add_argument("--expression", default=None)
    domain.add_argument("--output", type=Path, default=None)
    return parser


def main() -> None:
    parser = build_parser()
    args = parser.parse_args()

    if args.command == "algorithms":
        _print_json({"algorithms": list_algorithm_specs()})
        return

    if args.command == "problems":
        _print_json({"problems": list_problem_specs()})
        return

    if args.command == "domains":
        _print_json({"domains": list_problem_domains()})
        return

    if args.command == "run":
        payload = asyncio.run(_run_benchmark(args))
        if args.output:
            args.output.write_text(json.dumps(payload, indent=2), encoding="utf-8")
        else:
            _print_json(payload)
        return

    if args.command == "domain-run":
        payload = simulate_domain(
            DomainSimulationRequest(
                kind=args.kind,
                iterations=args.iterations,
                seed=args.seed,
                expression=args.expression,
            )
        )
        if args.output:
            args.output.write_text(json.dumps(payload, indent=2), encoding="utf-8")
        else:
            _print_json(payload)
        return

    parser.error(f"Unknown command {args.command}")
