from datetime import timedelta

import pytest

import bus
from bus import envelope
from contract import ContractError
from evaluation import Evaluation, classify, parse_window, slo_status
from storage import MemoryStore
from tests.conftest import ORG, example

RULE = "4b3a2918-0f7e-4d6c-9b5a-4f3e2d1c0b9a"
SLO = "2a1b0c9d-8e7f-4a6b-9c5d-4e3f2a1b0c9d"


@pytest.mark.parametrize("value,want", [(None, "nodata"), (5, "ok"), (8, "warn"), (10, "alert"), (99, "alert")])
def test_classify(value, want):
    assert classify(value, {"warn": 8, "crit": 10}) == want


def test_parse_window():
    assert parse_window("5m", timedelta(0)) == timedelta(minutes=5)
    assert parse_window("30d", timedelta(0)) == timedelta(days=30)
    assert parse_window("nope", timedelta(hours=1)) == timedelta(hours=1)


def test_slo_math():
    # 99.9% target, 99.95% attained: half the budget left; a clean last hour.
    current, budget, burn, state = slo_status(9995, 10000, 100, 100, 99.9)
    assert (current, budget, burn, state) == (99.95, 50.0, 0.0, "healthy")
    # Burning: last hour's error rate is 5x the budget's.
    assert slo_status(9995, 10000, 995, 1000, 99.9)[2:] == (5.0, "burning")
    assert slo_status(9980, 10000, 1000, 1000, 99.9)[3] == "exhausted"
    assert slo_status(0, 0, 0, 0, 99.9)[:2] == (100.0, 100.0)  # no data spends nothing


class FakeQuery:
    def __init__(self, values):
        self.values = values
        self.calls = []

    async def query(self, org_id, q, window, now, step=None, signal=""):
        self.calls.append(q)
        v = self.values.get(q, self.values.get("*"))
        return {"kind": "timeseries", "series": [] if v is None else [{"name": "x", "tags": {}, "points": [{"ts": "t", "value": v}]}]}


class FakeNotifier:
    def __init__(self):
        self.alerts = []

    async def rule_alert(self, rule, entered, value, now):
        self.alerts.append((rule["id"], entered, value))


async def test_rule_state_changes_are_published_and_notified(config, state, published, clock):
    config.rules = {RULE: {"id": RULE, "org_id": ORG, "name": "Errors", "signal": "log", "query": None, "query_string": "level:error",
                           "thresholds": {"warn": 5, "crit": 10, "window": "5m"}, "notify": {"channel_ids": []}, "state": "ok"}}
    q, n = FakeQuery({"*": 12}), FakeNotifier()
    ev = Evaluation(config, state, q, published, n, clock)
    await ev.run()
    await ev.run()  # unchanged: nothing new
    q.values["*"] = 1
    clock.t += 60
    await ev.run()
    states = [m["state"] for m in published.of(bus.RULE_EVALUATED)]
    assert states == ["alert", "ok"] and n.alerts == [(RULE, True, 12.0), (RULE, False, 1.0)]
    assert q.calls[0] == "level:error | count()"


async def test_check_slo(config, state, published, clock):
    config.slos = {SLO: {"id": SLO, "org_id": ORG, "name": "Homepage", "sli_source": "check", "target": 99.0, "window": "30d",
                         "monitor_id": "5c2a9d1e-3b4f-4a6c-8d7e-9f0a1b2c3d4e", "query": "", "state": "healthy"}}
    q = FakeQuery({"check:5c2a9d1e-3b4f-4a6c-8d7e-9f0a1b2c3d4e status:up | count()": 990,
                   "check:5c2a9d1e-3b4f-4a6c-8d7e-9f0a1b2c3d4e | count()": 1000})
    await Evaluation(config, state, q, published, FakeNotifier(), clock).run()
    [s] = published.of(bus.SLO_EVALUATED)
    assert (s["current"], s["budget_remaining_pct"], s["state"]) == (99.0, 0.0, "exhausted") and s["exhausted_at"]


async def test_envelope_round_trip_and_examples(contract):
    store = MemoryStore()
    data = example("monitor.transition")["data"]
    env = await envelope.wrap(bus.TRANSITION, data, contract, store, "upstat/test", "req")
    assert "data" not in env and env["data_ref"]["key"].startswith("upstat/test/compute/")
    event, got, request_id = await envelope.unwrap(bus.TOPIC_RESULTS, env, contract, store)
    assert (event, got, request_id) == (bus.TRANSITION, data, "req")
    for name in ("synthetics.result", "alerting.verify_requested", "monitor.transition", "alerting.delivery", "rule.evaluated",
                 "slo.evaluated", "insights.generated", "config.changed"):
        msg = example(name)
        contract.validate_envelope(msg)
        contract.validate_data(msg["type"], msg["data"])
    with pytest.raises(ContractError):
        contract.validate_data(bus.TRANSITION, {**data, "to": "sideways"})
