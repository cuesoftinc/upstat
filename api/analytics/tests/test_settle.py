"""The settle route (S-14), its phase ordering and budget, and the consumer's caught-up check."""

import asyncio
import time

import httpx
import pytest
from aiokafka import TopicPartition
from fastapi import FastAPI
from fastapi.testclient import TestClient

from bus.kafka import Consumer
from settle import router, settle_pass

SERVICE = {"X-Internal-Token": "s3cret"}


def app_with(run, token="s3cret", **kwargs):
    app = FastAPI()
    app.include_router(router(run, token, **kwargs))
    return app


async def noop(*args):
    return None


def test_settle_runs_and_reports():
    seen = []

    async def run(budget):
        seen.append(budget)
        return {"caught_up": True, "errors": 0}

    response = TestClient(app_with(run)).post("/internal/settle", headers=SERVICE)
    assert response.status_code == 200
    assert response.json()["caught_up"] is True
    assert seen == [25.0]


@pytest.mark.parametrize("on_cloud_run", [False, True])
def test_settle_checks_the_caller_everywhere(monkeypatch, on_cloud_run):
    if on_cloud_run:
        monkeypatch.setenv("K_SERVICE", "upstat-api-analytics")
    else:
        monkeypatch.delenv("K_SERVICE", raising=False)

    async def run(budget):
        return {}

    client = TestClient(app_with(run))
    assert client.post("/internal/settle").status_code == 401
    assert client.post("/internal/settle", headers={"X-Internal-Token": "wrong"}).status_code == 401
    assert client.post("/internal/settle", headers=SERVICE).status_code == 200


def test_a_non_ascii_token_is_a_401_not_a_500():
    async def run(budget):
        return {}

    response = TestClient(app_with(run)).post("/internal/settle", headers={"X-Internal-Token": "sécret".encode()})
    assert response.status_code == 401


def test_settle_is_refused_when_no_auth_is_configured():
    async def run(budget):
        return {}

    assert TestClient(app_with(run, token="")).post("/internal/settle").status_code == 503


def test_settle_accepts_the_invoking_service_account_on_cloud_run(monkeypatch):
    monkeypatch.setenv("K_SERVICE", "upstat-api-analytics")
    audiences = []

    def verify(token, audience):
        audiences.append(audience)
        if token != "good":
            raise ValueError("bad")
        return {"email_verified": True, "email": "common@p.iam.gserviceaccount.com"}

    async def run(budget):
        return {}

    client = TestClient(app_with(run, token="", audience="https://analytics.example/", invokers=["common@p.iam.gserviceaccount.com"], verify=verify))
    assert client.post("/internal/settle", headers={"Authorization": "Bearer good"}).status_code == 200
    assert client.post("/internal/settle", headers={"Authorization": "Bearer forged"}).status_code == 401
    assert client.post("/internal/settle").status_code == 401
    assert audiences == ["https://analytics.example", "https://analytics.example"]


def test_settle_refuses_another_service_account_and_unverified_email():
    async def run(budget):
        return {}

    def other(token, audience):
        return {"email_verified": True, "email": "someone@else.iam.gserviceaccount.com"}

    def unverified(token, audience):
        return {"email_verified": False, "email": "common@p.iam.gserviceaccount.com"}

    for verify in (other, unverified):
        client = TestClient(app_with(run, token="", audience="a", invokers=["common@p.iam.gserviceaccount.com"], verify=verify))
        assert client.post("/internal/settle", headers={"Authorization": "Bearer t"}).status_code == 401


def test_settle_failure_is_a_500():
    async def run(budget):
        raise RuntimeError("boom")

    assert TestClient(app_with(run)).post("/internal/settle", headers=SERVICE).status_code == 500


async def test_settle_drains_before_it_evaluates_and_again_after():
    order = []

    async def drain(seconds):
        order.append("drain")
        await asyncio.sleep(0.05)
        return True

    async def evaluate(deadline):
        order.append("evaluate")

    async def insights(deadline):
        order.append("insights")

    assert await settle_pass(2.0, drain, evaluate, insights) == {"caught_up": True, "errors": 0}
    assert order == ["drain", "evaluate", "insights", "drain"]


async def test_each_phase_gets_its_slice_of_the_budget():
    seen = {}

    async def evaluate(deadline):
        seen["evaluate"] = deadline

    async def insights(deadline):
        seen["insights"] = deadline

    async def drain(seconds):
        seen.setdefault("drains", []).append(seconds)
        return True

    start = time.monotonic()
    await settle_pass(10.0, drain, evaluate, insights)
    assert seen["evaluate"] == pytest.approx(start + 7.0, abs=0.5) and seen["insights"] == pytest.approx(start + 8.0, abs=0.5)
    assert seen["drains"][0] <= 4.0 and seen["drains"][1] == pytest.approx(10.0, abs=0.5)


async def test_a_slow_evaluation_is_cut_off_and_the_final_drain_still_runs():
    order = []

    async def drain(seconds):
        order.append("drain")
        return True

    async def evaluate(deadline):
        await asyncio.sleep(30)

    async def insights(deadline):
        order.append("insights")

    started = time.monotonic()
    out = await settle_pass(1.0, drain, evaluate, insights)
    assert time.monotonic() - started < 1.5
    assert out == {"caught_up": True, "errors": 1} and order == ["drain", "insights", "drain"]


async def test_an_httpx_timeout_in_a_phase_does_not_fail_the_settle():
    async def evaluate(deadline):
        raise httpx.ReadTimeout("query timed out")

    out = await settle_pass(1.0, lambda s: asyncio.sleep(0, True), evaluate, noop)
    assert out == {"caught_up": True, "errors": 1}


async def test_the_answer_says_when_the_lanes_were_not_caught_up():
    async def drain(seconds):
        return False

    assert await settle_pass(1.0, drain, noop, noop) == {"caught_up": False, "errors": 0}


class FakeKafka:
    def __init__(self, ends, firsts, committed, partitions=(0, 1)):
        self._ends, self._firsts, self._committed, self._partitions = ends, firsts, committed, set(partitions)

    def partitions_for_topic(self, topic):
        return self._partitions

    async def end_offsets(self, tps):
        return {tp: self._ends[tp.partition] for tp in tps}

    async def beginning_offsets(self, tps):
        return {tp: self._firsts[tp.partition] for tp in tps}

    async def committed(self, tp: TopicPartition):
        return self._committed.get(tp.partition)


def consumer_over(fake):
    c = Consumer.__new__(Consumer)
    c._topics = ["cuelabs.requests"]
    c._consumer = fake
    return c


@pytest.mark.parametrize(
    ("ends", "firsts", "committed", "want"),
    [
        ({0: 5, 1: 3}, {0: 0, 1: 0}, {0: 5, 1: 3}, True),  # everything committed
        ({0: 5, 1: 3}, {0: 0, 1: 0}, {0: 5, 1: 2}, False),  # one message waiting
        ({0: 5, 1: 3}, {0: 5, 1: 3}, {}, True),  # never committed, nothing retained
        ({0: 5, 1: 3}, {0: 0, 1: 3}, {}, False),  # never committed, messages retained
    ],
)
def test_caught_up(ends, firsts, committed, want):
    assert asyncio.run(consumer_over(FakeKafka(ends, firsts, committed)).caught_up()) is want


def test_caught_up_waits_for_the_group_join():
    fake = FakeKafka({0: 0}, {0: 0}, {}, partitions=())
    assert asyncio.run(consumer_over(fake).caught_up()) is False


def test_wait_caught_up_gives_up_at_the_budget():
    fake = FakeKafka({0: 1, 1: 0}, {0: 0, 1: 0}, {})
    assert asyncio.run(consumer_over(fake).wait_caught_up(0.3)) is False
