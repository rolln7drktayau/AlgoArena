import pytest

from backend.app.core.campaigns import CampaignRequest, run_campaign


def request(seeds=(1, 2), budget=100):
    return CampaignRequest(problems=[{"name": "ZDT1", "n_var": 5}], seeds=list(seeds), evaluations=budget,
                           algorithms=[{"id": "a", "name": "Random Search", "hyperparams": {"population_size": 20}}])


def test_campaign_counts_actual_evaluations_and_repeats_deterministically():
    first = run_campaign(request(), lambda _: None)
    second = run_campaign(request(), lambda _: None)
    assert len(first["samples"]) == 2
    assert all(row["actual_evaluations"] == 100 for row in first["samples"])
    assert [r["metrics"] for r in first["samples"]] == [r["metrics"] for r in second["samples"]]
    assert first["comparisons"] == []


def test_duplicate_seeds_rejected():
    with pytest.raises(ValueError, match="distinct"):
        run_campaign(request((1, 1)), lambda _: None)


def test_non_exact_budget_is_excluded_from_statistics():
    result = run_campaign(request(budget=105), lambda _: None)
    assert all(not row["budget_exact"] for row in result["samples"])
    assert result["summaries"] == []


def test_resume_reuses_completed_samples(tmp_path, monkeypatch):
    from backend.app.core import storage
    monkeypatch.setenv("ALGOARENA_DATA_DIR", str(tmp_path))
    original = request()
    storage.start_run("previous", "campaign", original.model_dump())
    events = []
    run_campaign(original, events.append)
    for i, event in enumerate(events, start=1):
        storage.append_event("previous", i, event)
    resumed_events = []
    run_campaign(original.model_copy(update={"resume_from": "previous"}), resumed_events.append)
    assert sum(bool(event.get("reused")) for event in resumed_events) == 2
