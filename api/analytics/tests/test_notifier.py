import hashlib
import hmac
import json
import uuid

import httpx

import bus
from notifier import Notifier
from notifier.channels import Outcome, Sender, sign
from tests.conftest import MON, ORG

CH = "9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d"
RULE = "4b3a2918-0f7e-4d6c-9b5a-4f3e2d1c0b9a"


class FakeSender:
    def __init__(self, fail=False):
        self.sent = []
        self.fail = fail

    async def deliver(self, channel, delivery_id, payload, subject, text):
        self.sent.append({"channel": channel["id"], "id": delivery_id, "event": payload.get("event"), "subject": subject, "text": text})
        return Outcome(not self.fail, 4 if self.fail else 1, "status 500" if self.fail else "")


def setup(config, cooldown=30, on=""):
    config.channels = {CH: {"id": CH, "org_id": ORG, "kind": "webhook", "name": "", "target": "https://hooks.example.com/x", "secret": "s3",
                            "health": "verified"}}
    config.rules = {RULE: {"id": RULE, "org_id": ORG, "name": "Homepage down", "signal": "uptime", "query": None,
                           "query_string": f"check:Homepage {on}".strip(), "thresholds": {"crit": 1, "window": "5m"},
                           "notify": {"channel_ids": [CH], "cooldown_minutes": cooldown, "renotify_minutes": 0, "mute_windows": []},
                           "state": "ok"}}


def transition(seq, frm, to):
    return {"id": str(uuid.uuid4()), "monitor_id": MON, "org_id": ORG, "seq": seq, "from": frm, "to": to, "cause": "timeout",
            "at": "2026-10-28T12:00:00Z", "regions": {}, "consecutive_failures": 3}


async def test_down_and_recovered_are_both_delivered_in_order_inside_cooldown(config, state, published, clock):
    setup(config)
    sender = FakeSender()
    n = Notifier(config, state, published, sender, "https://upstat.example", clock)
    await n.on_transition(transition(1, "up", "down"), None)
    clock.t += 60
    await n.on_transition(transition(2, "down", "up"), None)
    assert [s["event"] for s in sender.sent] == ["monitor.down", "monitor.recovered"]
    assert "Homepage" in sender.sent[0]["subject"] and "https://" not in sender.sent[0]["subject"]  # no URLs in subjects
    states = [d["state"] for d in published.of(bus.DELIVERY)]
    assert states == ["delivered", "delivered"]


async def test_cooldown_suppresses_repeat_downs_but_records_them(config, state, published, clock):
    setup(config)
    sender = FakeSender()
    n = Notifier(config, state, published, sender, "", clock)
    await n.on_transition(transition(1, "up", "down"), None)
    await n.on_transition(transition(2, "down", "up"), None)
    clock.t += 60
    await n.on_transition(transition(3, "up", "down"), None)
    assert [s["event"] for s in sender.sent] == ["monitor.down", "monitor.recovered"]
    assert published.of(bus.DELIVERY)[-1]["state"] == "suppressed"


async def test_nodata_alerts_only_where_opted_in(config, state, published, clock):
    setup(config)
    sender = FakeSender()
    n = Notifier(config, state, published, sender, "", clock)
    await n.on_transition(transition(1, "up", "nodata"), None)
    assert sender.sent == []
    setup(config, on="on:nodata")
    await n.on_transition(transition(2, "nodata", "nodata"), None)
    await n.on_transition(transition(3, "up", "nodata"), None)
    assert [s["event"] for s in sender.sent] == ["monitor.nodata"]


async def test_a_failed_down_is_named_in_the_recovery(config, state, published, clock):
    setup(config)
    failing = FakeSender(fail=True)
    n = Notifier(config, state, published, failing, "", clock)
    await n.on_transition(transition(1, "up", "down"), None)
    n._sender = FakeSender()
    await n.on_transition(transition(2, "down", "up"), None)
    assert n._sender.sent[0]["text"].startswith("(missed: was down since")
    assert published.of(bus.DELIVERY)[0]["state"] == "failed"


async def test_flapping_storm_yields_exactly_one_alert(config, state, published, clock):
    setup(config, cooldown=0)
    sender = FakeSender()
    n = Notifier(config, state, published, sender, "", clock)
    seq, status = 0, "up"
    for _ in range(12):
        nxt = "down" if status == "up" else "up"
        seq += 1
        await n.on_transition(transition(seq, status, nxt), None)
        status = nxt
        clock.t += 60
    events = [s["event"] for s in sender.sent]
    assert events.count("monitor.flapping") == 1
    assert len(events) == 7  # six edges delivered, then one flapping alert, then quiet
    clock.t += 31 * 60
    await n.sweep()
    assert any(d["kind"] == "flapping" and d["sev"] == "resolved" for d in published.of(bus.DELIVERY))


async def test_muted_monitors_suppress(config, state, published, clock):
    setup(config)
    config.monitors[MON]["muted"] = True
    sender = FakeSender()
    await Notifier(config, state, published, sender, "", clock).on_transition(transition(1, "up", "down"), None)
    assert sender.sent == [] and published.of(bus.DELIVERY)[0]["state"] == "suppressed"


async def test_verification_reports_its_outcome(config, state, published, clock):
    setup(config)
    sender = FakeSender()
    await Notifier(config, state, published, sender, "", clock).on_verify(
        {"channel_id": CH, "org_id": ORG, "requested_at": "2026-10-28T12:00:00Z"}, "req-1")
    [d] = published.of(bus.DELIVERY)
    assert d["kind"] == "verify" and d["state"] == "delivered" and d["channel_id"] == CH


def test_signature_matches_the_documented_recipe():
    body = b'{"version":1}'
    assert sign("secret", body) == hmac.new(b"secret", body, hashlib.sha256).hexdigest()


async def test_webhook_retries_on_the_ladder_then_fails():
    calls = []

    def handler(request: httpx.Request):
        calls.append(request)
        return httpx.Response(500)

    slept = []

    async def sleep(s):
        slept.append(s)

    sender = Sender(allow_private=True, client=httpx.AsyncClient(transport=httpx.MockTransport(handler)), sleep=sleep)
    out = await sender.deliver({"id": CH, "kind": "webhook", "target": "https://hooks.example.com/x", "secret": "k"}, "d1",
                               {"version": 1}, "s", "t")
    assert not out.delivered and out.attempts == 4 and slept == [1, 5, 25]
    req = calls[0]
    assert req.headers["X-Upstat-Delivery-Id"] == "d1"
    assert req.headers["X-Upstat-Signature"] == sign("k", req.content) and json.loads(req.content) == {"version": 1}


async def test_webhooks_to_private_addresses_are_refused_in_cloud():
    sender = Sender(allow_private=False, client=httpx.AsyncClient(transport=httpx.MockTransport(lambda r: httpx.Response(200))))
    out = await sender.deliver({"id": CH, "kind": "webhook", "target": "https://127.0.0.1/x", "secret": "k"}, "d", {}, "s", "t")
    assert not out.delivered and out.error == "blocked" and out.attempts == 1
