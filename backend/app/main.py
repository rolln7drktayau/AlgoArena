from __future__ import annotations

from contextlib import asynccontextmanager
from pathlib import Path
from uuid import uuid4

from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import ValidationError

from .api.routes import router as api_router
from .core.models import RunRequest, ScenarioRequest
from .core.local_access import LocalOriginMiddleware, allowed_origins
from .core.workers import stream_job
from .core import storage


@asynccontextmanager
async def lifespan(app):
    storage.mark_interrupted()
    yield


app = FastAPI(title="AlgoArena Backend", version="3.0.0", lifespan=lifespan)
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_origins=sorted(allowed_origins()),
    allow_methods=["*"],
    allow_headers=["*"],
    allow_credentials=False,
)
app.add_middleware(LocalOriginMiddleware)

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
            await websocket.send_json({"type": "error", "error": "Invalid run payload", "details": str(exc)})
            await websocket.close(code=1003)
            return

        run_id = uuid4().hex
        await websocket.send_json({"type": "run_started", "run_id": run_id})
        await stream_job(websocket, "benchmark", run_id, run_request.model_dump())
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
            await websocket.send_json({"type": "error", "error": "Invalid scenario payload", "details": str(exc)})
            await websocket.close(code=1003)
            return

        run_id = uuid4().hex
        await stream_job(websocket, "scenario", run_id, scenario_request.model_dump())
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


@app.websocket("/ws/campaign")
async def ws_campaign(websocket: WebSocket) -> None:
    from .core.campaigns import CampaignRequest
    await websocket.accept()
    try:
        message = await websocket.receive_json()
        if message.get("type") != "start_campaign":
            raise ValueError("Expected start_campaign")
        request = CampaignRequest.model_validate(message.get("payload", {}))
        await stream_job(websocket, "campaign", uuid4().hex, request.model_dump())
        await websocket.close(code=1000)
    except WebSocketDisconnect:
        return
    except Exception as exc:
        try:
            await websocket.send_json({"type": "error", "error": str(exc)})
            await websocket.close(code=1011)
        except Exception:
            pass


@app.get("/{full_path:path}", include_in_schema=False)
async def spa_fallback(full_path: str) -> FileResponse:
    if full_path.startswith(("api/", "docs", "openapi.json", "redoc", "ws/")):
        raise HTTPException(status_code=404, detail="Not found")

    target = (FRONTEND_DIST / full_path).resolve()
    if not target.is_relative_to(FRONTEND_DIST.resolve()):
        raise HTTPException(status_code=404, detail="Not found")
    if target.exists() and target.is_file():
        return FileResponse(target)

    index_file = FRONTEND_DIST / "index.html"
    if index_file.exists():
        return FileResponse(index_file)
    raise HTTPException(status_code=404, detail="Frontend build not found. Build frontend/dist first.")
