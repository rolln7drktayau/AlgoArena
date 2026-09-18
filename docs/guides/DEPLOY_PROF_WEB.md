# Deploy Professor Demo (web/prof-demo)

This branch is prepared to run AlgoArena as one web service:

- frontend built with Vite
- backend served by FastAPI
- WebSocket endpoints on same domain

## Render (recommended)

1. Push branch `web/prof-demo` to GitHub.
2. Open Render and create a new Blueprint service.
3. Select this repository and choose branch `web/prof-demo`.
4. Render reads `render.yaml`, builds with `Dockerfile`, and starts the service.
5. Share the generated URL with your professor.

## Runtime Endpoints

- App UI: `/`
- API docs: `/docs`
- API base: `/api/*`
- WebSocket runs: `/ws/run`
- WebSocket scenario: `/ws/scenario`
