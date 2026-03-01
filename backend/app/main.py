from __future__ import annotations

import asyncio
from uuid import uuid4

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
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

        while True:
            if worker_task.done() and queue.empty():
                break
            try:
                event = await asyncio.wait_for(queue.get(), timeout=0.15)
            except asyncio.TimeoutError:
                await asyncio.sleep(0)
                continue
            await websocket.send_json(event)

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
