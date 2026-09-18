from __future__ import annotations

from pathlib import Path
import os
from uuid import uuid4

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse, JSONResponse, PlainTextResponse

from algorithms.registry import list_algorithm_specs, load_custom_algorithm_from_file
from ..core.capabilities import get_runtime_capabilities
from ..core.domain_simulator import DomainSimulationRequest, simulate_domain
from ..core.models import CreateExpressionProblemRequest, CreateExternalProblemRequest, ScenarioRequest
from ..core.problem_domains import list_problem_domains
from ..core.state import run_manager
from ..scenario.service import simulate_scenario
from ..scenario.workflows import get_workflow_preview, list_workflow_specs
from problems.registry import (
    list_problem_specs,
    register_expression_problem,
    register_external_problem,
    register_uploaded_problem,
)


router = APIRouter(prefix="/api", tags=["api"])
PROJECT_ROOT = Path(__file__).resolve().parents[3]
MAX_UPLOAD_BYTES = 1024 * 1024


@router.get("/runs")
def saved_runs() -> dict:
    from ..core.storage import list_runs
    return {"runs": list_runs()}


@router.get("/runs/{run_id}/manifest")
def run_manifest(run_id: str) -> dict:
    from ..core.storage import get_manifest
    try:
        return get_manifest(run_id)
    except KeyError as exc:
        raise HTTPException(404, "Run not found") from exc


@router.get("/runs/{run_id}/events")
def run_events(run_id: str, after: int = 0) -> dict:
    from ..core.storage import read_events
    return {"events": read_events(run_id, after)}


@router.post("/scenario/decode")
def decode_solution(request: ScenarioRequest, x: list[float]) -> dict:
    import numpy as np
    from ..scenario.service import SchedulingProblem, _tier_data_from_request, _objective_specs_from_request
    from ..scenario.workflows import load_workflow_tasks
    try:
        tasks = load_workflow_tasks(request.workflow_id, request.workflow_task_limit)[0] if request.workflow_id else request.tasks
        problem = SchedulingProblem(_tier_data_from_request(request.environments), tasks, _objective_specs_from_request(request)[0])
        return {"schedule": problem.decode_schedule(np.asarray(x)), "metrics": problem.evaluate_features(np.asarray(x))}
    except (ValueError, KeyError) as exc:
        raise HTTPException(422, str(exc)) from exc


async def _save_python_upload(file: UploadFile, upload_dir: Path) -> Path:
    if not file.filename or not file.filename.lower().endswith(".py"):
        raise HTTPException(status_code=400, detail="Expected a .py file.")
    data = await file.read(MAX_UPLOAD_BYTES + 1)
    if len(data) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="Python uploads are limited to 1 MiB.")
    upload_dir.mkdir(parents=True, exist_ok=True)
    file_path = upload_dir / f"{uuid4().hex}.py"
    file_path.write_bytes(data)
    return file_path


@router.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@router.get("/capabilities")
async def capabilities() -> dict[str, object]:
    return get_runtime_capabilities()


@router.get("/algorithms")
async def algorithms() -> dict[str, list[dict[str, object]]]:
    return {"algorithms": list_algorithm_specs()}


@router.post("/algorithms/upload")
async def upload_algorithm(
    file: UploadFile = File(...),
    class_name: str | None = Form(default=None),
    display_name: str | None = Form(default=None),
) -> dict[str, str]:
    if os.getenv("ALGOARENA_ENABLE_CUSTOM_ALGORITHM_UPLOAD") != "1":
        raise HTTPException(
            status_code=403,
            detail=(
                "Custom algorithm upload is disabled by default in V2 for safety. "
                "Set ALGOARENA_ENABLE_CUSTOM_ALGORITHM_UPLOAD=1 only in a trusted local environment."
            ),
        )
    upload_dir = PROJECT_ROOT / "algorithms" / "custom"
    file_path = await _save_python_upload(file, upload_dir)

    try:
        registered_name = load_custom_algorithm_from_file(str(file_path), class_name=class_name, display_name=display_name)
    except Exception as exc:
        file_path.unlink(missing_ok=True)
        raise HTTPException(status_code=400, detail=f"Failed to load custom algorithm: {exc}") from exc

    return {"status": "registered", "algorithm_name": registered_name, "path": str(file_path)}


@router.get("/problems")
async def problems() -> dict[str, list[dict[str, object]]]:
    return {"problems": list_problem_specs()}


@router.get("/problem-domains")
async def problem_domains() -> dict[str, list[dict[str, object]]]:
    return {"domains": list_problem_domains()}


@router.post("/problem-domains/simulate")
def simulate_problem_domain(request: DomainSimulationRequest) -> dict[str, object]:
    try:
        return simulate_domain(request)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Domain simulation failed: {exc}") from exc


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
    if os.getenv("ALGOARENA_ENABLE_CUSTOM_PROBLEM_UPLOAD") != "1":
        raise HTTPException(status_code=403, detail="Python problem uploads require ALGOARENA_ENABLE_CUSTOM_PROBLEM_UPLOAD=1 in a trusted local environment.")
    upload_dir = PROJECT_ROOT / "problems" / "custom"
    file_path = await _save_python_upload(file, upload_dir)

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
        file_path.unlink(missing_ok=True)
        raise HTTPException(status_code=400, detail=f"Failed to register problem: {exc}") from exc

    return {"problem_id": problem_id, "name": name}


@router.post("/problems/custom/external")
async def create_external_problem(request: CreateExternalProblemRequest) -> dict[str, str]:
    if os.getenv("ALGOARENA_ENABLE_SUBPROCESS") != "1":
        raise HTTPException(
            status_code=403,
            detail="External evaluators are disabled by default. Set ALGOARENA_ENABLE_SUBPROCESS=1 in a trusted local environment.",
        )
    try:
        problem_id = register_external_problem(
            name=request.name,
            command=request.command,
            n_var=request.n_var,
            n_obj=request.n_obj,
            xl=request.xl,
            xu=request.xu,
            timeout_sec=request.timeout_sec,
        )
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Failed to register external problem: {exc}") from exc
    return {"problem_id": problem_id, "name": request.name}


@router.post("/scenario/simulate")
def scenario_simulate(request: ScenarioRequest) -> dict[str, object]:
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


@router.get("/runs/{run_id}/export/latex")
async def export_latex(run_id: str) -> PlainTextResponse:
    try:
        latex_content = run_manager.export_latex(run_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    headers = {"Content-Disposition": f'attachment; filename="algoarena-{run_id}.tex"'}
    return PlainTextResponse(content=latex_content, media_type="application/x-tex", headers=headers)


@router.get("/exports/bibtex")
async def export_bibtex() -> PlainTextResponse:
    headers = {"Content-Disposition": 'attachment; filename="algoarena.bib"'}
    return PlainTextResponse(content=run_manager.export_bibtex(), media_type="application/x-bibtex", headers=headers)


@router.get("/runs/{run_id}/export/statistics")
async def export_statistics(run_id: str, metric: str = "hv") -> JSONResponse:
    try:
        payload = run_manager.export_statistics(run_id, metric=metric)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    headers = {"Content-Disposition": f'attachment; filename="algoarena-{run_id}-statistics.json"'}
    return JSONResponse(content=payload, headers=headers)


def _parse_bounds(raw: str) -> float | list[float]:
    text = raw.strip()
    if text.startswith("[") and text.endswith("]"):
        values = [item.strip() for item in text[1:-1].split(",") if item.strip()]
        return [float(item) for item in values]
    return float(text)
