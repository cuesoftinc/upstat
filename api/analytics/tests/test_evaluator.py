import uuid
from datetime import UTC, datetime

import pytest

import bus
from evaluator import Evaluator
from evaluator.machine import MonitorState, Tick, apply_tick, check_nodata, tick_failed
from state import MemoryState
from tests.conftest import MON, ORG, Published

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


def result(region, ok, tick="0b6f3c2e-6a51-4b1e-9d0a-7e1f2a3b4c5d", missing=False, regions=("us-central1", "us-east4"),
           scheduled="2026-10-28T12:00:00Z"):
    return {"tick_id": tick, "monitor_id": MON, "org_id": ORG, "region": region, "regions_expected": list(regions),
            "scheduled_at": scheduled, "checked_at": scheduled.replace(":00Z", ":01Z"), "ok": ok, "missing": missing,
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


async def test_a_redelivered_batch_applies_once_and_keeps_its_transition_id(config, state, published, clock):
    config.monitors[MON]["failure_threshold"] = 1
    batch = [result("us-central1", False), result("us-east4", False)]
    ev = Evaluator(config, state, published, clock)
    for _ in range(2):  # Kafka redelivers the whole batch
        for msg in batch:
            await ev.on_result(msg, None)
    [t] = published.of(bus.TRANSITION)
    assert t["seq"] == 1 and t["id"] == str(uuid.uuid5(uuid.NAMESPACE_URL, f"upstat:{MON}:1")) and published.messages[0][3] == t["id"]
    assert await state.keys("tick:") == [] and (await ev.monitor_state(config.monitors[MON])).consecutive_failures == 1
    # With the working state lost, the same results give the same transition for common to dedupe on (monitor, seq).
    again = Published(published.contract)
    fresh = Evaluator(config, MemoryState(), again, clock)
    for msg in batch:
        await fresh.on_result(msg, None)
    assert [m["id"] for m in again.of(bus.TRANSITION)] == [t["id"]]


async def test_a_late_result_cannot_open_a_one_region_tick_that_bypasses_the_quorum(config, state, published, clock):
    config.monitors[MON].update(failure_threshold=1, interval_s=3600)
    ev = Evaluator(config, state, published, clock)
    newer = "2026-10-28T12:01:00Z"
    await ev.on_result(result("us-central1", True, tick="1b6f3c2e-6a51-4b1e-9d0a-7e1f2a3b4c5d", scheduled=newer), None)
    await ev.on_result(result("us-east4", True, tick="1b6f3c2e-6a51-4b1e-9d0a-7e1f2a3b4c5d", scheduled=newer), None)
    assert [t["to"] for t in published.of(bus.TRANSITION)] == ["up"]
    await ev.on_result(result("us-central1", False), None)  # the previous tick's answer, arriving after the next one closed
    assert await state.keys("tick:") == []
    clock.t = datetime(2026, 10, 28, 12, 5, tzinfo=UTC).timestamp()
    await ev.sweep()
    assert [t["to"] for t in published.of(bus.TRANSITION)] == ["up"]  # a single failing region never made a down


async def test_a_duplicate_of_a_closed_tick_is_ignored(config, state, published, clock):
    ev = Evaluator(config, state, published, clock)
    await ev.on_result(result("us-central1", True), None)
    await ev.on_result(result("us-east4", True), None)
    await ev.on_result(result("us-central1", True), None)
    assert await state.keys("tick:") == []


class Flaky:
    """Fails the first publish, then delegates."""

    def __init__(self, published):
        self.published, self.calls = published, 0

    async def __call__(self, event, key, data, request_id):
        self.calls += 1
        if self.calls == 1:
            raise RuntimeError("kafka is away")
        await self.published(event, key, data, request_id)


async def test_a_failed_publish_is_published_again_by_the_next_pass(config, state, published, clock):
    config.monitors[MON]["failure_threshold"] = 1
    ev = Evaluator(config, state, Flaky(published), clock)
    await ev.on_result(result("us-central1", False), None)
    await ev.on_result(result("us-east4", False), None)  # closes the tick; the publish fails but the answer does not
    assert published.messages == [] and await state.keys("emit:") == ["emit:" + MON + ":1"]
    assert (await ev.monitor_state(config.monitors[MON])).status == "down"
    await ev.sweep()
    [t] = published.of(bus.TRANSITION)
    assert (t["seq"], t["to"], t["id"]) == (1, "down", str(uuid.uuid5(uuid.NAMESPACE_URL, f"upstat:{MON}:1")))
    assert await state.keys("emit:") == []
    await ev.sweep()
    assert len(published.of(bus.TRANSITION)) == 1


async def test_a_failed_publish_does_not_delay_the_nodata_timer(config, state, published, clock):
    clock.t = datetime(2026, 10, 28, 12, 0, 30, tzinfo=UTC).timestamp()
    ev = Evaluator(config, state, Flaky(published), clock)
    await ev.on_result(result("us-central1", True), None)
    await ev.on_result(result("us-east4", True), None)  # up; this publish fails
    await ev.sweep()
    assert [t["to"] for t in published.of(bus.TRANSITION)] == ["up"]
    clock.t += 3600
    await ev.sweep()
    assert [t["to"] for t in published.of(bus.TRANSITION)] == ["up", "nodata"]
