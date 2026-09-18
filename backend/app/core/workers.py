"""Bounded local processes. Disconnect cancels computation, including stuck code.

This is process lifecycle isolation, not a sandbox for untrusted Python.
"""
from __future__ import annotations

import asyncio
import anyio
import multiprocessing as mp
import os
import queue
import time
import secrets
import copy
from dataclasses import asdict

from fastapi import WebSocket

from . import storage

_active: set[str] = set()


def _worker(kind: str, run_id: str, config: dict, recipes: dict, channel) -> None:
    try:
        from problems.registry import restore_recipes
        restore_recipes(recipes)
        if kind == "benchmark":
            from .models import RunRequest
            from .run_manager import RunManager

            class Sink:
                async def send_json(self, event):
                    channel.put(event)

            record = asyncio.run(RunManager(isolated=True).execute_run(run_id, RunRequest.model_validate(config), Sink()))
            storage.save_record(run_id, asdict(record))
        elif kind == "campaign":
            from .campaigns import CampaignRequest, run_campaign
            run_campaign(CampaignRequest.model_validate(config), channel.put)
        else:
            from .models import ScenarioRequest
            from ..scenario.service import simulate_scenario_stream
            simulate_scenario_stream(ScenarioRequest.model_validate(config), channel.put)
        channel.put({"type": "worker_done"})
    except BaseException as exc:
        channel.put({"type": "error", "error": str(exc)})
        channel.put({"type": "worker_done"})


async def stream_job(websocket: WebSocket, kind: str, run_id: str, config: dict) -> None:
    from problems.registry import export_recipes
    if len(_active) >= max(1, int(os.getenv("ALGOARENA_MAX_JOBS", "2"))):
        await websocket.send_json({"type": "error", "error": "Local worker limit reached. Wait for a run to finish."})
        return
    requested = copy.deepcopy(config)
    config = copy.deepcopy(config)
    seed_key = "seed" if kind == "benchmark" else "base_seed"
    if kind != "campaign" and config.get(seed_key) is None:
        config[seed_key] = secrets.randbelow(2**31)
    if kind != "campaign":
        from .run_manager import _env_int
        algorithm_cap = _env_int("ALGOARENA_MAX_ALGORITHMS")
        if algorithm_cap:
            config["algorithms"] = config["algorithms"][:algorithm_cap]
        for key, env_name in (("population_size", "ALGOARENA_MAX_POPULATION"),
                              ("generations", "ALGOARENA_MAX_GENERATIONS"),
                              ("repetitions", "ALGOARENA_MAX_REPETITIONS")):
            cap = _env_int(env_name)
            if cap:
                if kind == "benchmark":
                    for algorithm in config["algorithms"]:
                        if key in algorithm["hyperparams"]:
                            algorithm["hyperparams"][key] = min(algorithm["hyperparams"][key], cap)
                elif key in config:
                    config[key] = min(config[key], cap)
    _active.add(run_id)
    context = mp.get_context("spawn")
    channel = context.Queue(maxsize=8)
    process = context.Process(target=_worker, args=(kind, run_id, config, export_recipes(), channel), daemon=True)
    receiver = None
    status = "cancelled"
    try:
        storage.start_run(run_id, kind, config, requested=requested)
        process.start()
        receiver = asyncio.create_task(websocket.receive())
        seq = 0
        last_event = time.monotonic()
        terminal = None
        failed = False
        while True:
            if receiver.done():
                break
            try:
                event = channel.get_nowait()
            except queue.Empty:
                if not process.is_alive():
                    raise RuntimeError("Worker stopped before completing its run.")
                default_timeout = os.getenv("ALGOARENA_ALGORITHM_STEP_TIMEOUT_SEC", "30") if kind == "benchmark" else "300"
                if time.monotonic() - last_event > float(os.getenv("ALGOARENA_WORKER_TIMEOUT_SEC", default_timeout)):
                    raise TimeoutError("Worker exceeded its inactivity time budget.")
                await asyncio.sleep(0.03)
                continue
            last_event = time.monotonic()
            if event["type"] == "worker_done":
                status = "failed" if failed or not terminal else "completed"
                # Persist completion before telling the browser exports are ready.
                storage.finish_run(run_id, status)
                if terminal:
                    await websocket.send_json(terminal)
                break
            event["run_id"] = run_id
            if event["type"] in {"error", "scenario_error"}:
                failed = True
            seq += 1
            event["seq"] = seq
            storage.append_event(run_id, seq, event)
            if event["type"] in {"completed", "scenario_completed", "campaign_completed"}:
                terminal = event
            else:
                await websocket.send_json(event)
    except Exception:
        status = "failed"
        raise
    finally:
        with anyio.CancelScope(shield=True):
            if receiver:
                receiver.cancel()
                await asyncio.gather(receiver, return_exceptions=True)
            if process.pid:
                if process.is_alive():
                    process.terminate()
                await asyncio.to_thread(process.join, 1.0)
                if process.is_alive():
                    process.kill()
                    await asyncio.to_thread(process.join, 1.0)
                process.close()
            channel.cancel_join_thread()
            channel.close()
            try:
                storage.finish_run(run_id, status)
            finally:
                _active.discard(run_id)
