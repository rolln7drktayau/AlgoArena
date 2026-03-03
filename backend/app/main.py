from __future__ import annotations

import asyncio
import time
from pathlib import Path
from uuid import uuid4

from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import ValidationError

from .api.routes import router as api_router
from .core.models import RunRequest, ScenarioRequest
from .core.state import run_manager
from .scenario.service import simulate_scenario_stream


app = FastAPI(title="AlgoArena Backend", version="1.0.0")
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
    allow_credentials=True,
)

PROJECT_ROOT = Path(__file__).resolve().parents[2]
FRONTEND_DIST = PROJECT_ROOT / "frontend" / "dist"
FRONTEND_ASSETS = FRONTEND_DIST / "assets"

if FRONTEND_ASSETS.exists():
    app.mount("/assets", StaticFiles(directory=str(FRONTEND_ASSETS)), name="frontend-assets")


@app.websocket("/ws/run")
async def ws_run(websocket: WebSocket) -> None:
    await websocket.accept()
    try:
        message = await websocket.receive_json()
        if message.get("type") != "start_run":
            await websocket.send_json({"type": "error", "error": "First websocket message must be type='start_run'."})
            await websocket.close(code=1003)
            return

        try:
            run_request = RunRequest.model_validate(message.get("payload", {}))
        except ValidationError as exc:
            await websocket.send_json({"type": "error", "error": "Invalid run payload", "details": exc.errors()})
            await websocket.close(code=1003)
            return

        run_id = run_request.run_id or uuid4().hex
        await websocket.send_json({"type": "run_started", "run_id": run_id})
        await run_manager.execute_run(run_id=run_id, run_request=run_request, websocket=websocket)
    except WebSocketDisconnect:
        return
    except Exception as exc:  # pragma: no cover - defensive websocket error path
        try:
            await websocket.send_json({"type": "error", "error": str(exc)})
        except Exception:
            pass
        try:
            await websocket.close(code=1011)
        except Exception:
            pass


@app.websocket("/ws/scenario")
async def ws_scenario(websocket: WebSocket) -> None:
    await websocket.accept()
    try:
        message = await websocket.receive_json()
        if message.get("type") != "start_scenario":
            await websocket.send_json({"type": "error", "error": "First websocket message must be type='start_scenario'."})
            await websocket.close(code=1003)
            return

        try:
            scenario_request = ScenarioRequest.model_validate(message.get("payload", {}))
        except ValidationError as exc:
            await websocket.send_json({"type": "error", "error": "Invalid scenario payload", "details": exc.errors()})
            await websocket.close(code=1003)
            return

        run_id = uuid4().hex
        queue: asyncio.Queue[dict[str, object]] = asyncio.Queue()
        loop = asyncio.get_running_loop()

        def on_update(payload: dict[str, object]) -> None:
            event = dict(payload)
            event["run_id"] = run_id
            loop.call_soon_threadsafe(queue.put_nowait, event)

        worker_task = asyncio.create_task(asyncio.to_thread(simulate_scenario_stream, scenario_request, on_update))
        last_keepalive_at = time.monotonic()
        keepalive_interval_sec = 10.0
        last_progress = {
            "total_algorithms": len(scenario_request.algorithms),
            "completed_algorithms": 0,
            "total_steps": len(scenario_request.algorithms) * max(1, scenario_request.repetitions),
            "completed_steps": 0,
        }

        while True:
            if worker_task.done() and queue.empty():
                break
            try:
                event = await asyncio.wait_for(queue.get(), timeout=0.15)
            except asyncio.TimeoutError:
                now = time.monotonic()
                if now - last_keepalive_at >= keepalive_interval_sec:
                    await websocket.send_json(
                        {
                            "type": "scenario_keepalive",
                            "run_id": run_id,
                            "total_algorithms": last_progress["total_algorithms"],
                            "completed_algorithms": last_progress["completed_algorithms"],
                            "total_steps": last_progress["total_steps"],
                            "completed_steps": last_progress["completed_steps"],
                        }
                    )
                    last_keepalive_at = now
                await asyncio.sleep(0)
                continue

            if "total_algorithms" in event:
                total_algorithms = event.get("total_algorithms")
                if isinstance(total_algorithms, int):
                    last_progress["total_algorithms"] = total_algorithms
            if "completed_algorithms" in event:
                completed_algorithms = event.get("completed_algorithms")
                if isinstance(completed_algorithms, int):
                    last_progress["completed_algorithms"] = completed_algorithms
            if "total_steps" in event:
                total_steps = event.get("total_steps")
                if isinstance(total_steps, int):
                    last_progress["total_steps"] = total_steps
            if "completed_steps" in event:
                completed_steps = event.get("completed_steps")
                if isinstance(completed_steps, int):
                    last_progress["completed_steps"] = completed_steps

            await websocket.send_json(event)
            last_keepalive_at = time.monotonic()

        await worker_task
        await websocket.close(code=1000)
    except WebSocketDisconnect:
        return
    except Exception as exc:  # pragma: no cover - defensive websocket error path
        try:
            await websocket.send_json({"type": "error", "error": str(exc)})
        except Exception:
            pass
        try:
            await websocket.close(code=1011)
        except Exception:
            pass


@app.get("/", include_in_schema=False)
async def spa_index() -> FileResponse:
    index_file = FRONTEND_DIST / "index.html"
    if index_file.exists():
        return FileResponse(index_file)
    raise HTTPException(status_code=404, detail="Frontend build not found. Build frontend/dist first.")


@app.get("/{full_path:path}", include_in_schema=False)
async def spa_fallback(full_path: str) -> FileResponse:
    if full_path.startswith(("api/", "docs", "openapi.json", "redoc", "ws/")):
        raise HTTPException(status_code=404, detail="Not found")

    target = FRONTEND_DIST / full_path
    if target.exists() and target.is_file():
        return FileResponse(target)

    index_file = FRONTEND_DIST / "index.html"
    if index_file.exists():
        return FileResponse(index_file)
    raise HTTPException(status_code=404, detail="Frontend build not found. Build frontend/dist first.")
