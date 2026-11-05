import hashlib
import hmac
import uuid

import bus
from notifier import Notifier
from notifier.channels import Outcome, sign
from tests.conftest import MON, ORG

CH = "9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d"
RULE = "4b3a2918-0f7e-4d6c-9b5a-4f3e2d1c0b9a"


class FakeSender:
    """One attempt per call, as the real sender: fails always, or for the first fail_first calls."""

    def __init__(self, fail=False, fail_first=0):
        self.sent = []
        self.fail = fail
        self.fail_first = fail_first

    async def deliver(self, channel, delivery_id, payload, subject, text):
        self.sent.append({"channel": channel["id"], "id": delivery_id, "event": payload.get("event"), "subject": subject, "text": text})
        failing = self.fail or len(self.sent) <= self.fail_first
        return Outcome(not failing, 1, "status 500" if failing else "")


def setup(config, cooldown=30, on="", renotify=0):
    config.channels = {CH: {"id": CH, "org_id": ORG, "kind": "webhook", "name": "", "target": "https://hooks.example.com/x", "secret": "s3",
                            "health": "verified"}}
    config.rules = {RULE: {"id": RULE, "org_id": ORG, "name": "Homepage down", "signal": "uptime", "query": None,
                           "query_string": f"check:Homepage {on}".strip(), "thresholds": {"crit": 1, "window": "5m"},
                           "notify": {"channel_ids": [CH], "cooldown_minutes": cooldown, "renotify_minutes": renotify, "mute_windows": []},
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
    assert [d["state"] for d in published.of(bus.DELIVERY)] == ["failed", "delivered"]  # the abandoned down, then the recovery


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
    await state.put(f"mon:{MON}", {"status": "up", "consecutive_failures": 0, "seq": seq})
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


async def test_a_failing_webhook_retries_on_the_ladder_across_passes_then_fails(config, state, published, clock):
    setup(config)
    sender = FakeSender(fail=True)
    n = Notifier(config, state, published, sender, "", clock)
    await n.on_transition(transition(1, "up", "down"), None)  # returns after one attempt: the lane is free
    assert len(sender.sent) == 1 and published.of(bus.DELIVERY) == []
    for wait, attempts in ((1, 2), (5, 3), (25, 4)):
        await n.retry_due()
        assert len(sender.sent) == attempts - 1  # the ladder step has not come
        clock.t += wait
        await n.retry_due()
        assert len(sender.sent) == attempts
    [d] = published.of(bus.DELIVERY)
    assert d["state"] == "failed" and d["attempts"] == 4
    assert await state.keys("retry:") == []
    assert len({s["id"] for s in sender.sent}) == 1  # every attempt carries the same delivery id


async def test_a_retry_that_succeeds_is_recorded_as_delivered(config, state, published, clock):
    setup(config)
    sender = FakeSender(fail_first=1)
    n = Notifier(config, state, published, sender, "", clock)
    await n.on_transition(transition(1, "up", "down"), None)
    clock.t += 1
    assert await n.retry_due() == 1
    [d] = published.of(bus.DELIVERY)
    assert d["state"] == "delivered" and d["attempts"] == 2
    clock.t += 60
    assert await n.retry_due() == 0


async def test_an_unpublished_outcome_is_published_by_the_next_pass(config, state, published, clock):
    setup(config)
    calls = []

    async def flaky(event, key, data, request_id):
        calls.append(data["id"])
        if len(calls) == 1:
            raise RuntimeError("kafka is away")
        await published(event, key, data, request_id)

    n = Notifier(config, state, flaky, FakeSender(), "", clock)
    await n.on_transition(transition(1, "up", "down"), None)  # the alert was sent; recording it failed, the handler did not
    assert published.of(bus.DELIVERY) == []
    assert await n.retry_due() == 1
    [d] = published.of(bus.DELIVERY)
    assert d["state"] == "delivered" and await state.keys("retry:") == []


async def test_a_transition_published_twice_is_notified_once(config, state, published, clock):
    setup(config)
    sender = FakeSender()
    n = Notifier(config, state, published, sender, "", clock)
    msg = transition(1, "up", "down")
    await n.on_transition(msg, None)
    await n.on_transition(msg, None)
    assert len(sender.sent) == 1


async def test_recovery_clears_renotify_even_when_the_rule_ignores_recoveries(config, state, published, clock):
    setup(config, on="on:down", renotify=10)
    sender = FakeSender()
    n = Notifier(config, state, published, sender, "", clock)
    await n.on_transition(transition(1, "up", "down"), None)
    assert await state.keys("renotify:")
    clock.t += 60
    await n.on_transition(transition(2, "down", "up"), None)
    assert await state.keys("renotify:") == []
    clock.t += 20 * 60
    await n.renotify()
    assert [s["event"] for s in sender.sent] == ["monitor.down"]  # no "still down" for a monitor that is up


async def test_recovery_clears_renotify_for_a_muted_monitor(config, state, published, clock):
    setup(config, renotify=10)
    sender = FakeSender()
    n = Notifier(config, state, published, sender, "", clock)
    await n.on_transition(transition(1, "up", "down"), None)
    config.monitors[MON]["muted"] = True
    await n.on_transition(transition(2, "down", "up"), None)
    assert await state.keys("renotify:") == []


async def test_renotify_stops_once_the_evaluator_says_up(config, state, published, clock):
    setup(config, renotify=10)
    sender = FakeSender()
    n = Notifier(config, state, published, sender, "", clock)
    await n.on_transition(transition(1, "up", "down"), None)
    await state.put(f"mon:{MON}", {"status": "up", "consecutive_failures": 0, "seq": 2})  # recovered; its transition is still queued
    clock.t += 20 * 60
    await n.renotify()
    assert [s["event"] for s in sender.sent] == ["monitor.down"] and await state.keys("renotify:") == []


async def test_a_monitor_still_down_renotifies(config, state, published, clock):
    setup(config, renotify=10)
    sender = FakeSender()
    n = Notifier(config, state, published, sender, "", clock)
    await n.on_transition(transition(1, "up", "down"), None)
    await state.put(f"mon:{MON}", {"status": "down", "consecutive_failures": 3, "seq": 1})
    clock.t += 11 * 60
    await n.renotify()
    assert [s["event"] for s in sender.sent] == ["monitor.down", "monitor.renotify"]


async def test_flapping_exit_while_the_monitor_is_down_alerts_instead_of_resolving(config, state, published, clock):
    setup(config, cooldown=0)
    sender = FakeSender()
    n = Notifier(config, state, published, sender, "", clock)
    seq, status = 0, "up"
    for _ in range(7):  # the 7th edge is down and enters flapping
        nxt = "down" if status == "up" else "up"
        seq += 1
        await n.on_transition(transition(seq, status, nxt), None)
        status = nxt
        clock.t += 60
    assert status == "down" and sender.sent[-1]["event"] == "monitor.flapping"
    await state.put(f"mon:{MON}", {"status": "down", "consecutive_failures": 3, "seq": seq})
    clock.t += 31 * 60
    sent_before = len(sender.sent)
    await n.sweep()
    exits = [d for d in published.of(bus.DELIVERY) if d["kind"] == "flapping" and d["state"] == "suppressed"]
    assert len(exits) == 1 and exits[0]["sev"] != "resolved" and "down" in exits[0]["message"]
    assert [s["event"] for s in sender.sent[sent_before:]] == ["monitor.down"]


async def test_flapping_exit_while_the_monitor_is_up_resolves_without_alerting(config, state, published, clock):
    setup(config, cooldown=0)
    sender = FakeSender()
    n = Notifier(config, state, published, sender, "", clock)
    seq, status = 0, "up"
    for _ in range(8):  # ends up
        nxt = "down" if status == "up" else "up"
        seq += 1
        await n.on_transition(transition(seq, status, nxt), None)
        status = nxt
        clock.t += 60
    await state.put(f"mon:{MON}", {"status": "up", "consecutive_failures": 0, "seq": seq})
    clock.t += 31 * 60
    sent_before = len(sender.sent)
    await n.sweep()
    exits = [d for d in published.of(bus.DELIVERY) if d["kind"] == "flapping" and d["state"] == "suppressed" and d["sev"] == "resolved"]
    assert len(exits) == 1 and len(sender.sent) == sent_before
