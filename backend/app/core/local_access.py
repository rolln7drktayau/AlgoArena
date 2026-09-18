"""Browser origin policy for the local backend (not remote authentication)."""
from __future__ import annotations

import os


DEFAULT_ORIGINS = {
    f"http://{host}:{port}"
    for host in ("localhost", "127.0.0.1")
    for port in (5173, 8000, 8765)
}


def allowed_origins() -> set[str]:
    desktop_port = os.getenv("ALGOARENA_DESKTOP_PORT", "8765")
    desktop_origins = {f"http://127.0.0.1:{desktop_port}"} if desktop_port.isdigit() else set()
    return DEFAULT_ORIGINS | desktop_origins | {
        value.strip().rstrip("/")
        for value in os.getenv("ALGOARENA_ALLOWED_ORIGINS", "").split(",")
        if value.strip() and value.strip() != "*"
    }


class LocalOriginMiddleware:
    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] in {"http", "websocket"}:
            headers = dict(scope.get("headers", []))
            origin = headers.get(b"origin")
            if origin is not None and origin.decode("latin-1") not in allowed_origins():
                if scope["type"] == "websocket":
                    await send({"type": "websocket.close", "code": 1008})
                else:
                    await send({"type": "http.response.start", "status": 403, "headers": [(b"content-type", b"text/plain")]})
                    await send({"type": "http.response.body", "body": b"Origin not allowed"})
                return
        await self.app(scope, receive, send)
