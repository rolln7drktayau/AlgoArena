from __future__ import annotations

from pathlib import Path
from uuid import uuid4

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse, PlainTextResponse

from algorithms.registry import list_algorithm_specs, load_custom_algorithm_from_file
from ..core.models import CreateExpressionProblemRequest, ScenarioRequest
from ..core.state import run_manager
from ..scenario.service import simulate_scenario
from ..scenario.workflows import get_workflow_preview, list_workflow_specs
from problems.registry import (
    list_problem_specs,
    register_expression_problem,
    register_uploaded_problem,
)


router = APIRouter(prefix="/api", tags=["api"])
PROJECT_ROOT = Path(__file__).resolve().parents[3]


@router.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@router.get("/algorithms")
async def algorithms() -> dict[str, list[dict[str, object]]]:
    return {"algorithms": list_algorithm_specs()}


@router.post("/algorithms/upload")
async def upload_algorithm(
    file: UploadFile = File(...),
    class_name: str | None = Form(default=None),
    display_name: str | None = Form(default=None),
) -> dict[str, str]:
    upload_dir = PROJECT_ROOT / "algorithms" / "custom"
    upload_dir.mkdir(parents=True, exist_ok=True)
    file_path = upload_dir / f"{uuid4().hex}_{file.filename}"
    data = await file.read()
    file_path.write_bytes(data)

    try:
        registered_name = load_custom_algorithm_from_file(str(file_path), class_name=class_name, display_name=display_name)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Failed to load custom algorithm: {exc}") from exc

    return {"status": "registered", "algorithm_name": registered_name, "path": str(file_path)}


@router.get("/problems")
async def problems() -> dict[str, list[dict[str, object]]]:
    return {"problems": list_problem_specs()}


@router.post("/problems/custom/expression")
async def create_expression_problem(request: CreateExpressionProblemRequest) -> dict[str, str]:
    try:
        problem_id = register_expression_problem(
            name=request.name,
            objectives=request.objectives,
            n_var=request.n_var,
            xl=request.xl,
            xu=request.xu,
        )
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {"problem_id": problem_id, "name": request.name}


@router.post("/problems/custom/upload")
async def upload_problem(
    file: UploadFile = File(...),
    name: str = Form(...),
    function_name: str = Form(default="evaluate"),
    n_var: int = Form(...),
    n_obj: int = Form(...),
    xl: str = Form(default="0.0"),
    xu: str = Form(default="1.0"),
) -> dict[str, str]:
    upload_dir = PROJECT_ROOT / "problems" / "custom"
    upload_dir.mkdir(parents=True, exist_ok=True)
    file_path = upload_dir / f"{uuid4().hex}_{file.filename}"
    file_path.write_bytes(await file.read())

    try:
        parsed_xl = _parse_bounds(xl)
        parsed_xu = _parse_bounds(xu)
        problem_id = register_uploaded_problem(
            name=name,
            file_path=str(file_path),
            function_name=function_name,
            n_var=n_var,
            n_obj=n_obj,
            xl=parsed_xl,
            xu=parsed_xu,
        )
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Failed to register problem: {exc}") from exc

    return {"problem_id": problem_id, "name": name}


@router.post("/scenario/simulate")
async def scenario_simulate(request: ScenarioRequest) -> dict[str, object]:
    try:
        return simulate_scenario(request)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Scenario simulation failed: {exc}") from exc


@router.get("/workflows")
async def workflows() -> dict[str, list[dict[str, object]]]:
    return {"workflows": list_workflow_specs()}


@router.get("/workflows/{workflow_id}")
async def workflow_details(workflow_id: str, limit: int = 25) -> dict[str, object]:
    try:
        return get_workflow_preview(workflow_id, limit=limit)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Failed to load workflow '{workflow_id}': {exc}") from exc


@router.get("/runs/{run_id}/export/csv")
async def export_csv(run_id: str) -> PlainTextResponse:
    try:
        csv_content = run_manager.export_csv(run_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    headers = {"Content-Disposition": f'attachment; filename="algoarena-{run_id}.csv"'}
    return PlainTextResponse(content=csv_content, media_type="text/csv", headers=headers)


@router.get("/runs/{run_id}/export/pdf")
async def export_pdf(run_id: str) -> FileResponse:
    try:
        pdf_path = run_manager.export_pdf(run_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return FileResponse(
        path=pdf_path,
        media_type="application/pdf",
        filename=f"algoarena-{run_id}.pdf",
    )


def _parse_bounds(raw: str) -> float | list[float]:
    text = raw.strip()
    if text.startswith("[") and text.endswith("]"):
        values = [item.strip() for item in text[1:-1].split(",") if item.strip()]
        return [float(item) for item in values]
    return float(text)
