"""The settle route (S-14) and the consumer's caught-up check."""

import asyncio

import pytest
from aiokafka import TopicPartition
from fastapi import FastAPI
from fastapi.testclient import TestClient

from bus.kafka import Consumer
from settle import router


def app_with(run, token=""):
    app = FastAPI()
    app.include_router(router(run, token))
    return app


def test_settle_runs_and_reports(monkeypatch):
    monkeypatch.delenv("K_SERVICE", raising=False)
    seen = []

    async def run(budget):
        seen.append(budget)
        return {"caught_up": True, "background": 0}

    response = TestClient(app_with(run)).post("/internal/settle")
    assert response.status_code == 200
    assert response.json()["caught_up"] is True
    assert seen == [25.0]


def test_settle_checks_the_internal_token_off_cloud_run(monkeypatch):
    monkeypatch.delenv("K_SERVICE", raising=False)

    async def run(budget):
        return {}

    client = TestClient(app_with(run, token="s3cret"))
    assert client.post("/internal/settle").status_code == 401
    assert client.post("/internal/settle", headers={"X-Internal-Token": "s3cret"}).status_code == 200


def test_settle_trusts_iam_on_cloud_run(monkeypatch):
    monkeypatch.setenv("K_SERVICE", "upstat-api-analytics")

    async def run(budget):
        return {}

    assert TestClient(app_with(run, token="s3cret")).post("/internal/settle").status_code == 200


def test_settle_failure_is_a_500(monkeypatch):
    monkeypatch.delenv("K_SERVICE", raising=False)

    async def run(budget):
        raise RuntimeError("boom")

    assert TestClient(app_with(run)).post("/internal/settle").status_code == 500


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
