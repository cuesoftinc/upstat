from datetime import UTC, datetime

import pytest

import bus
from evaluator import Evaluator
from evaluator.machine import MonitorState, Tick, apply_tick, check_nodata, tick_failed
from tests.conftest import MON, ORG

# The evaluation-semantics transition table (flows/monitor.md §2; the
# non-negotiable unit test of engineering.md §4): every edge.

PASS = Tick(results={"a": True, "b": True}, at=100)
FAIL = Tick(results={"a": False, "b": False}, cause="timeout", at=100)


@pytest.mark.parametrize(
    "start,tick,threshold,want_status,want_failures,transition",
    [
        (MonitorState("pending"), PASS, 3, "up", 0, ("pending", "up")),
        (MonitorState("pending", 2), FAIL, 3, "down", 3, ("pending", "down")),
        (MonitorState("pending", 1), FAIL, 3, "pending", 2, None),
        (MonitorState("up"), FAIL, 3, "up", 1, None),
        (MonitorState("up", 2), FAIL, 3, "down", 3, ("up", "down")),
        (MonitorState("up", 2), PASS, 3, "up", 0, None),
        (MonitorState("down", 3), PASS, 3, "up", 0, ("down", "up")),  # recovery is immediate
        (MonitorState("down", 3), FAIL, 3, "down", 4, None),
        (MonitorState("nodata"), PASS, 3, "up", 0, ("nodata", "up")),
        (MonitorState("nodata", 2), FAIL, 3, "down", 3, ("nodata", "down")),
        (MonitorState("paused"), FAIL, 1, "paused", 0, None),
        (MonitorState("up"), FAIL, 1, "down", 1, ("up", "down")),
    ],
)
def test_transition_table(start, tick, threshold, want_status, want_failures, transition):
    st, t = apply_tick(start, tick, threshold, 2)
    assert (st.status, st.consecutive_failures) == (want_status, want_failures)
    assert (None if t is None else (t.from_status, t.to_status)) == transition
    if t is not None:
        assert t.seq == start.seq + 1 == st.seq


def test_up_goes_nodata_after_two_intervals_never_down():
    st = MonitorState("up", last_result_at=1000)
    assert check_nodata(st, 1000 + 120, 60)[1] is None
    st2, t = check_nodata(st, 1000 + 121, 60)
    assert st2.status == "nodata" and t.to_status == "nodata"
    assert check_nodata(MonitorState("down", last_result_at=0), 10_000, 60)[1] is None


@pytest.mark.parametrize(
    "results,quorum,want",
    [
        ({"a": False, "b": False}, 2, True),
        ({"a": False, "b": True}, 2, False),  # one region's blip never pages anyone
        ({"a": False}, 2, True),  # fewer reported than the quorum: all reporting failed
        ({"a": True}, 2, False),
        ({}, 2, None),  # nobody reported: no data, never a failure
        ({"a": False, "b": True, "c": True}, 1, True),
    ],
)
def test_quorum(results, quorum, want):
    assert tick_failed(results, quorum) is want


def result(region, ok, tick="0b6f3c2e-6a51-4b1e-9d0a-7e1f2a3b4c5d", missing=False, regions=("us-central1", "us-east4")):
    return {"tick_id": tick, "monitor_id": MON, "org_id": ORG, "region": region, "regions_expected": list(regions),
            "scheduled_at": "2026-10-28T12:00:00Z", "checked_at": "2026-10-28T12:00:01Z", "ok": ok, "missing": missing,
            "cause": "" if ok else "timeout", "status_code": 200 if ok else 0, "total_ms": 120, "timeout_s": 10}


async def test_a_tick_closes_when_every_region_answered(config, state, published, clock):
    config.monitors[MON]["failure_threshold"] = 1
    ev = Evaluator(config, state, published, clock)
    await ev.on_result(result("us-central1", False), None)
    assert published.of(bus.TRANSITION) == []
    await ev.on_result(result("us-east4", False), None)
    [t] = published.of(bus.TRANSITION)
    assert (t["from"], t["to"], t["regions"]) == ("pending", "down", {"us-central1": False, "us-east4": False})


async def test_one_region_down_is_not_down(config, state, published, clock):
    config.monitors[MON]["failure_threshold"] = 1
    ev = Evaluator(config, state, published, clock)
    await ev.on_result(result("us-central1", False), None)
    await ev.on_result(result("us-east4", True), None)
    [t] = published.of(bus.TRANSITION)
    assert t["to"] == "up"


async def test_a_missing_region_is_not_a_failure(config, state, published, clock):
    ev = Evaluator(config, state, published, clock)
    await ev.on_result(result("us-central1", True), None)
    await ev.on_result(result("us-east4", False, missing=True), None)
    [t] = published.of(bus.TRANSITION)
    assert t["to"] == "up" and t["regions"] == {"us-central1": True}


async def test_an_unanswered_tick_closes_at_its_deadline(config, state, published, clock):
    config.monitors[MON]["failure_threshold"] = 1
    config.monitors[MON]["min_failing_regions"] = 1
    ev = Evaluator(config, state, published, clock)
    await ev.on_result(result("us-central1", False), None)
    clock.t = datetime(2026, 10, 28, 12, 0, 19, tzinfo=UTC).timestamp()
    await ev.sweep()
    assert published.of(bus.TRANSITION) == []
    clock.t += 2  # past scheduled + timeout + 10 s
    await ev.sweep()
    [t] = published.of(bus.TRANSITION)
    assert t["to"] == "down"


async def test_paused_monitors_drop_results_and_resume_fresh(config, state, published, clock):
    ev = Evaluator(config, state, published, clock)
    await ev.on_result(result("us-central1", True), None)
    await ev.on_result(result("us-east4", True), None)
    config.monitors[MON].update(active=False, status="paused")
    await ev.sweep()
    await ev.on_result(result("us-central1", False, tick="1b6f3c2e-6a51-4b1e-9d0a-7e1f2a3b4c5d"), None)
    config.monitors[MON].update(active=True, status="pending")
    st = await ev.monitor_state(config.monitors[MON])
    assert st.status == "pending"


async def test_transition_ids_are_stable_for_redelivery(config, state, published, clock):
    ev = Evaluator(config, state, published, clock)
    await ev.on_result(result("us-central1", True), None)
    await ev.on_result(result("us-east4", True), None)
    [t] = published.of(bus.TRANSITION)
    assert published.messages[0][3] == t["id"] and t["seq"] == 1
