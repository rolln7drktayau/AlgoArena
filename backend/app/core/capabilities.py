from __future__ import annotations

import importlib.util
import os


def get_runtime_capabilities() -> dict[str, object]:
    restricted_python_available = importlib.util.find_spec("RestrictedPython") is not None
    custom_algorithm_upload_enabled = os.getenv("ALGOARENA_ENABLE_CUSTOM_ALGORITHM_UPLOAD") == "1"
    subprocess_enabled = os.getenv("ALGOARENA_ENABLE_SUBPROCESS") == "1"
    return {
        "runtime": "fastapi-local",
        "websocket": True,
        "pyodide": False,
        "studio": {"version": 3, "persistent_journal": True, "process_cancellation": True,
                   "campaigns": True, "campaign_resume": True, "dag_scheduling": True},
        "labs": {
            "indexeddb": False,
            "algoarena_file": True,
        },
        "custom_problem_modes": {
            "expression_ast": True,
            "python_restricted": restricted_python_available and os.getenv("ALGOARENA_ENABLE_CUSTOM_PROBLEM_UPLOAD") == "1",
            "javascript_worker": False,
            "subprocess_json": subprocess_enabled,
        },
        "custom_algorithm_modes": {
            "python_restricted": False,
            "trusted_python_upload": custom_algorithm_upload_enabled,
            "thread_timeout": True,
            "process_isolation": True,
        },
        "distribution": {
            "web_pyodide": False,
            "desktop_electron": True,
            "cli": True,
        },
    }
