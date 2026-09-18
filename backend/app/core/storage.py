"""Local, restart-safe run journal. JSON only: never deserialize executable objects."""
from __future__ import annotations

import hashlib
import json
import os
import platform
import sqlite3
from contextlib import contextmanager
from datetime import datetime, timezone
from importlib.metadata import version
from pathlib import Path
from typing import Any


def database_path() -> Path:
    root = Path(os.getenv("ALGOARENA_DATA_DIR", str(Path.home() / ".algoarena")))
    root.mkdir(parents=True, exist_ok=True)
    return root / "runs.sqlite3"


@contextmanager
def connect():
    db = sqlite3.connect(database_path(), timeout=15)
    try:
        db.execute("PRAGMA journal_mode=WAL")
        db.execute("PRAGMA max_page_count=262144")
        db.executescript("""
      CREATE TABLE IF NOT EXISTS runs(id TEXT PRIMARY KEY, manifest TEXT NOT NULL, record TEXT);
      CREATE TABLE IF NOT EXISTS events(run_id TEXT, seq INTEGER, payload TEXT,
                                      PRIMARY KEY(run_id, seq));
        """)
        with db:
            yield db
    finally:
        db.close()


def start_run(run_id: str, kind: str, config: dict[str, Any], requested: dict | None = None) -> None:
    canonical = json.dumps(config, sort_keys=True, separators=(",", ":"))
    manifest = {"schema_version": 1, "run_id": run_id, "kind": kind, "status": "running",
                "started_at": datetime.now(timezone.utc).isoformat(), "config": config,
                "requested_config": requested if requested is not None else config,
                "config_sha256": hashlib.sha256(canonical.encode()).hexdigest(),
                "python": platform.python_version(), "platform": platform.platform(),
                "versions": {name: version(name) for name in ("numpy", "pymoo", "fastapi")}}
    with connect() as db:
        db.execute("INSERT INTO runs(id,manifest) VALUES (?,?)", (run_id, json.dumps(manifest)))


def append_event(run_id: str, seq: int, payload: dict) -> None:
    with connect() as db:
        db.execute("INSERT INTO events VALUES (?,?,?)", (run_id, seq, json.dumps(payload)))


def finish_run(run_id: str, status: str) -> None:
    with connect() as db:
        row = db.execute("SELECT manifest FROM runs WHERE id=?", (run_id,)).fetchone()
        if row:
            manifest = json.loads(row[0])
            manifest.update(status=status, finished_at=datetime.now(timezone.utc).isoformat())
            db.execute("UPDATE runs SET manifest=? WHERE id=?", (json.dumps(manifest), run_id))


def save_record(run_id: str, record: dict) -> None:
    with connect() as db:
        db.execute("UPDATE runs SET record=? WHERE id=?", (json.dumps(record, default=str), run_id))


def load_record(run_id: str) -> dict | None:
    with connect() as db:
        row = db.execute("SELECT record FROM runs WHERE id=?", (run_id,)).fetchone()
    return json.loads(row[0]) if row and row[0] else None


def get_manifest(run_id: str) -> dict:
    with connect() as db:
        row = db.execute("SELECT manifest FROM runs WHERE id=?", (run_id,)).fetchone()
    if not row:
        raise KeyError(run_id)
    return json.loads(row[0])


def list_runs() -> list[dict]:
    with connect() as db:
        rows = db.execute("SELECT manifest FROM runs ORDER BY rowid DESC LIMIT 100").fetchall()
    return [json.loads(row[0]) for row in rows]


def read_events(run_id: str, after: int = 0, limit: int = 100) -> list[dict]:
    with connect() as db:
        rows = db.execute("SELECT seq,payload FROM events WHERE run_id=? AND seq>? ORDER BY seq LIMIT ?",
                          (run_id, after, min(100, max(1, limit)))).fetchall()
    return [{"seq": seq, "event": json.loads(payload)} for seq, payload in rows]


def mark_interrupted() -> None:
    with connect() as db:
        for run_id, raw in db.execute("SELECT id,manifest FROM runs").fetchall():
            data = json.loads(raw)
            if data.get("status") == "running":
                data["status"] = "interrupted"
                db.execute("UPDATE runs SET manifest=? WHERE id=?", (json.dumps(data), run_id))
