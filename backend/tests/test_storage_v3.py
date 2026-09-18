from backend.app.core import storage


def test_journal_survives_reopening_and_marks_interruption(tmp_path, monkeypatch):
    monkeypatch.setenv("ALGOARENA_DATA_DIR", str(tmp_path))
    storage.start_run("example", "benchmark", {"seed": 42})
    storage.append_event("example", 1, {"type": "generation", "data": [1, 2]})
    storage.save_record("example", {"value": 5})
    assert storage.load_record("example") == {"value": 5}
    assert storage.read_events("example")[0]["seq"] == 1
    assert storage.read_events("example", after=1) == []
    storage.mark_interrupted()
    assert storage.get_manifest("example")["status"] == "interrupted"
    storage.finish_run("example", "cancelled")
    assert storage.list_runs()[0]["status"] == "cancelled"
    assert len(storage.get_manifest("example")["config_sha256"]) == 64
