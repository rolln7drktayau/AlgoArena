from __future__ import annotations

from uuid import uuid4

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import ValidationError

from .api.routes import router as api_router
from .core.models import RunRequest
from .core.state import run_manager


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
