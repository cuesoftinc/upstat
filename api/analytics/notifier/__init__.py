"""The notifier (system-design.md §6.2, flows/alert.md): uptime rules to
channels for each transition, with cooldown per rule and direction, mute
windows, the flapping guard and the renotify ladder. Every outcome, including
suppressions, goes back to common as upstat.alerting.delivery. Delivery ids
are derived from (transition, rule, channel), so a redelivered transition
re-sends with the same X-Upstat-Delivery-Id.

The transitions lane is keyed by monitor id, so one consumer handles a
monitor's down and recovered in order (§6.2 ordering).
"""

import logging
import time
import uuid
from datetime import UTC, datetime

import bus
from notifier.channels import Sender

log = logging.getLogger(__name__)

FLAP_WINDOW_SECONDS = 30 * 60
FLAP_EDGES = 7
EVENTS = {"down": "monitor.down", "recovered": "monitor.recovered", "nodata": "monitor.nodata"}
SEV = {"down": "sev1", "renotify": "sev1", "nodata": "sev2", "recovered": "resolved", "flapping": "sev2"}
DEFAULT_ON = {"down", "recovered"}
ON = {"down": {"down"}, "recovered": {"recovered"}, "nodata": {"nodata"}, "all": {"down", "recovered", "nodata"}}


def iso(ts: float) -> str:
    return datetime.fromtimestamp(ts, UTC).isoformat().replace("+00:00", "Z")


def direction_of(msg: dict) -> str | None:
    if msg["to"] == "down":
        return "down"
    if msg["from"] == "down" and msg["to"] == "up":
        return "recovered"
    if msg["to"] == "nodata":
        return "nodata"
    return None


def rule_terms(rule: dict) -> tuple[set[str], set[str]]:
    """The check: and on: values of an uptime rule's query string."""
    checks, on = set(), set()
    for token in (rule.get("query_string") or "").split():
        facet, _, value = token.partition(":")
        value = value.strip('"')
        if facet == "check" and value:
            checks.add(value)
        elif facet == "on" and value:
            on |= ON.get(value, set())
    return checks, on or DEFAULT_ON


def rule_matches(rule: dict, monitor: dict, direction: str) -> bool:
    checks, on = rule_terms(rule)
    if checks and monitor["id"] not in checks and monitor.get("name") not in checks:
        return False
    return direction in on


def muted_now(rule: dict, now: float) -> bool:
    for window in (rule.get("notify") or {}).get("mute_windows") or []:
        try:
            start = datetime.fromisoformat(window["from"].replace("Z", "+00:00")).timestamp()
            end = datetime.fromisoformat(window["to"].replace("Z", "+00:00")).timestamp()
        except (KeyError, ValueError):
            continue
        if start <= now < end:
            return True
    return False


def minutes(seconds: float) -> str:
    m = max(1, round(seconds / 60))
    return f"{m}m" if m < 60 else f"{m // 60}h {m % 60}m"


class Notifier:
    def __init__(self, config, state, publish, sender: Sender, web_url: str = "", clock=time.time):
        self._config = config
        self._state = state
        self._publish = publish
        self._sender = sender
        self._web = web_url.rstrip("/")
        self._clock = clock

    # ── transitions ──────────────────────────────────────────────────────

    async def on_transition(self, msg: dict, request_id: str | None) -> None:
        direction = direction_of(msg)
        monitor = self._config.monitors.get(msg["monitor_id"]) or {"id": msg["monitor_id"], "name": msg["monitor_id"], "target": "",
                                                                   "org_id": msg["org_id"]}
        now = self._clock()
        if msg["to"] == "down":
            await self._state.put(f"downsince:{monitor['id']}", {"at": now})
        if await self._flapping(msg, monitor, now):
            return
        if direction is None:
            return
        rules = [r for r in self._config.org_rules(msg["org_id"], "uptime") if rule_matches(r, monitor, direction)]
        for rule in rules:
            await self._dispatch(rule, monitor, msg, direction, now)

    async def _flapping(self, msg: dict, monitor: dict, now: float) -> bool:
        """flows/alert.md §3: count up<->down edges in a sliding 30-minute
        window; the 7th enters flapping (one alert, then suppression), and a
        window holding at most one edge exits it. True when suppressed."""
        key = f"flap:{monitor['id']}"
        flap = await self._state.get(key) or {"edges": [], "on": False}
        if {msg["from"], msg["to"]} == {"up", "down"}:
            flap["edges"].append(now)
        flap["edges"] = [t for t in flap["edges"] if now - t <= FLAP_WINDOW_SECONDS]
        if not flap["on"] and len(flap["edges"]) >= FLAP_EDGES:
            flap["on"] = True
            await self._state.put(key, flap)
            for rule in self._config.org_rules(msg["org_id"], "uptime"):
                checks, on = rule_terms(rule)
                if (not checks or monitor["id"] in checks or monitor.get("name") in checks) and "down" in on:
                    await self._dispatch(rule, monitor, msg, "flapping", now, bypass_cooldown=True)
            return True
        if flap["on"] and len(flap["edges"]) <= 1:
            flap["on"] = False
            await self._state.put(key, flap)
            await self._exit_flapping(monitor, msg["org_id"], now)
            return False
        await self._state.put(key, flap)
        if flap["on"]:
            direction = direction_of(msg)
            for rule in self._config.org_rules(msg["org_id"], "uptime"):
                if direction and rule_matches(rule, monitor, direction):
                    await self._record(rule, monitor, msg, direction, "suppressed", 0, now, None, "suppressed: monitor is flapping")
            return True
        return False

    async def _exit_flapping(self, monitor: dict, org_id: str, now: float) -> None:
        for rule in self._config.org_rules(org_id, "uptime"):
            for direction in ("down", "nodata"):
                await self._state.delete(f"cool:{rule['id']}:{monitor['id']}:{direction}")
        await self._publish(bus.DELIVERY, monitor["id"], {
            "id": str(uuid.uuid5(uuid.NAMESPACE_URL, f"upstat:flap-exit:{monitor['id']}:{int(now)}")), "org_id": org_id,
            "kind": "flapping", "sev": "resolved", "monitor_name": monitor.get("name", ""),
            "message": f"{monitor.get('name', '')} stopped flapping; alerts resume", "state": "suppressed", "attempts": 0, "at": iso(now),
        }, None)

    async def sweep(self) -> None:
        """Exit flapping for monitors that have gone quiet (no transition
        arrives to notice it otherwise)."""
        now = self._clock()
        for key in await self._state.keys("flap:"):
            flap = await self._state.get(key)
            if not flap or not flap.get("on"):
                continue
            edges = [t for t in flap["edges"] if now - t <= FLAP_WINDOW_SECONDS]
            if len(edges) <= 1:
                monitor = self._config.monitors.get(key.removeprefix("flap:"))
                await self._state.put(key, {"edges": edges, "on": False})
                if monitor:
                    await self._exit_flapping(monitor, monitor["org_id"], now)

    async def _dispatch(self, rule: dict, monitor: dict, msg: dict, direction: str, now: float, bypass_cooldown: bool = False) -> None:
        notify = rule.get("notify") or {}
        if monitor.get("muted"):
            return await self._record(rule, monitor, msg, direction, "suppressed", 0, now, None, "suppressed: monitor muted")
        if muted_now(rule, now):
            return await self._record(rule, monitor, msg, direction, "suppressed", 0, now, None, "suppressed: mute window")
        cool_key = f"cool:{rule['id']}:{monitor['id']}:{direction}"
        cooldown = int(notify.get("cooldown_minutes", 30)) * 60
        if direction in ("down", "nodata") and not bypass_cooldown and cooldown > 0:
            stamp = await self._state.get(cool_key)
            if stamp and now - stamp["at"] < cooldown:
                return await self._record(rule, monitor, msg, direction, "suppressed", 0, now, None, "suppressed: cooldown")
        subject, text, payload = self._compose(monitor, msg, direction, now)
        sent_any = False
        for channel_id in notify.get("channel_ids") or []:
            channel = self._config.channels.get(channel_id)
            if channel is None or channel.get("health") == "unverified":
                continue
            delivery_id = str(uuid.uuid5(uuid.NAMESPACE_URL, f"upstat:{msg['id']}:{rule['id']}:{channel_id}:{direction}"))
            body = text
            missed = await self._state.get(f"downfail:{monitor['id']}:{channel_id}")
            if direction == "recovered" and missed:
                body = f"(missed: was down since {iso(missed['since'])}) " + text
                await self._state.delete(f"downfail:{monitor['id']}:{channel_id}")
            outcome = await self._sender.deliver(channel, delivery_id, payload, subject, body)
            if direction == "down" and not outcome.delivered:
                await self._state.put(f"downfail:{monitor['id']}:{channel_id}", {"since": now})
            await self._record(rule, monitor, msg, direction, "delivered" if outcome.delivered else "failed", outcome.attempts, now,
                               channel_id, subject, delivery_id)
            sent_any = True
        if sent_any and direction in ("down", "nodata"):
            await self._state.put(cool_key, {"at": now}, ttl=max(cooldown, 60))
        if direction == "down" and int(notify.get("renotify_minutes", 0)) > 0:
            await self._state.put(f"renotify:{rule['id']}:{monitor['id']}", {"at": now, "transition_id": msg["id"]})
        if direction in ("recovered",):
            await self._state.delete(f"renotify:{rule['id']}:{monitor['id']}")

    def _compose(self, monitor: dict, msg: dict, direction: str, now: float) -> tuple[str, str, dict]:
        name = monitor.get("name") or monitor["id"]
        link = f"{self._web}/dashboard/monitors/{monitor['id']}" if self._web else ""
        if direction == "recovered":
            subject = f"[Upstat] {name} RECOVERED"
            text = f"{name} is back up."
        elif direction == "nodata":
            subject = f"[Upstat] {name} has NO DATA"
            text = f"No check of {name} completed for two intervals."
        elif direction == "renotify":
            subject = f"[Upstat] {name} is still DOWN"
            text = f"{name} is still down."
        elif direction == "flapping":
            subject = f"[Upstat] {name} is FLAPPING"
            text = f"{name} keeps switching between up and down; further alerts are held until it settles for 30 minutes."
        else:
            subject = f"[Upstat] {name} is DOWN"
            text = f"{name} is down ({msg.get('cause') or 'failing'}) after {msg.get('consecutive_failures', 0)} failed checks."
        if link:
            text += f"\n{link}"
        payload = {
            "version": 1,
            "event": f"monitor.{direction}" if direction in ("flapping", "renotify") else EVENTS[direction],
            "monitor": {"id": monitor["id"], "name": name, "target": monitor.get("target", "")},
            "transition": {"from": msg.get("from"), "to": msg.get("to"), "at": msg.get("at", iso(now)), "cause": msg.get("cause", ""),
                           "consecutive_failures": msg.get("consecutive_failures", 0)},
            "incident": None,
        }
        return subject, text, payload

    async def _record(self, rule, monitor, msg, direction, state, attempts, now, channel_id, message, delivery_id=None) -> None:
        data = {
            "id": delivery_id or str(uuid.uuid5(uuid.NAMESPACE_URL, f"upstat:{msg['id']}:{rule['id']}:{direction}:{state}")),
            "org_id": monitor["org_id"],
            "kind": "flapping" if direction == "flapping" else ("renotify" if direction == "renotify" else "alert"),
            "transition_id": msg["id"],
            "rule_id": rule["id"],
            "sev": SEV.get(direction, "sev2"),
            "monitor_name": monitor.get("name", ""),
            "message": message[:1000],
            "state": state,
            "attempts": attempts,
            "at": iso(now),
        }
        if channel_id:
            data["channel_id"] = channel_id
        await self._publish(bus.DELIVERY, monitor["id"], data, data["id"])

    async def renotify(self) -> None:
        """Re-send "still down" while a monitor stays down (opt-in per rule)."""
        now = self._clock()
        for key in await self._state.keys("renotify:"):
            stamp = await self._state.get(key)
            _, rule_id, monitor_id = key.split(":", 2)
            rule, monitor = self._config.rules.get(rule_id), self._config.monitors.get(monitor_id)
            if not stamp or not rule or not monitor:
                await self._state.delete(key)
                continue
            every = int((rule.get("notify") or {}).get("renotify_minutes", 0)) * 60
            if every <= 0 or now - stamp["at"] < every:
                continue
            since = (await self._state.get(f"downsince:{monitor_id}") or {}).get("at", stamp["at"])
            msg = {"id": f"{stamp['transition_id']}-{int(now // every)}", "from": "down", "to": "down", "cause": "",
                   "consecutive_failures": 0, "at": iso(now)}
            msg["id"] = str(uuid.uuid5(uuid.NAMESPACE_URL, msg["id"]))
            await self._dispatch(rule, monitor, msg, "renotify", now, bypass_cooldown=True)
            await self._state.put(key, {"at": now, "transition_id": stamp["transition_id"]})
            log.info("renotified", extra={"monitor_id": monitor_id, "down_for": minutes(now - since)})

    # ── channel verification and rule alerts ─────────────────────────────

    async def on_verify(self, msg: dict, request_id: str | None) -> None:
        channel = self._config.channels.get(msg["channel_id"])
        if channel is None:
            return
        delivery_id = str(uuid.uuid5(uuid.NAMESPACE_URL, f"upstat:verify:{request_id or msg['requested_at']}"))
        payload = {"version": 1, "event": "channel.verify", "channel": {"id": channel["id"]}, "at": msg["requested_at"]}
        outcome = await self._sender.deliver(channel, delivery_id, payload, "[Upstat] Verify this alert channel",
                                             "This is a test from Upstat. If you received it, the channel works.")
        await self._publish(bus.DELIVERY, channel["id"], {
            "id": delivery_id, "org_id": msg["org_id"], "kind": "verify", "channel_id": channel["id"], "sev": "sev2",
            "message": "verification sent" if outcome.delivered else f"verification failed: {outcome.error}"[:1000],
            "state": "delivered" if outcome.delivered else "failed", "attempts": outcome.attempts, "at": iso(self._clock()),
        }, delivery_id)

    async def rule_alert(self, rule: dict, entered: bool, value: float | None, now: float) -> None:
        """Notify a metric/log/trace/SLO-burn rule entering or leaving alert."""
        notify = rule.get("notify") or {}
        direction = "down" if entered else "recovered"
        cool_key = f"cool:{rule['id']}:rule:{direction}"
        cooldown = int(notify.get("cooldown_minutes", 30)) * 60
        if entered and cooldown > 0:
            stamp = await self._state.get(cool_key)
            if stamp and now - stamp["at"] < cooldown:
                return
        if muted_now(rule, now):
            return
        verb = "is alerting" if entered else "recovered"
        shown = "" if value is None else f" (value {value:g})"
        subject = f"[Upstat] Rule {rule['name']} {verb}"
        text = f"{rule['name']} {verb}{shown}: {rule.get('query_string', '')}"
        tick = int(now)
        for channel_id in notify.get("channel_ids") or []:
            channel = self._config.channels.get(channel_id)
            if channel is None or channel.get("health") == "unverified":
                continue
            delivery_id = str(uuid.uuid5(uuid.NAMESPACE_URL, f"upstat:rule:{rule['id']}:{channel_id}:{direction}:{tick}"))
            payload = {"version": 1, "event": f"rule.{'alert' if entered else 'recovered'}",
                       "rule": {"id": rule["id"], "name": rule["name"], "signal": rule["signal"], "query": rule.get("query_string", "")},
                       "value": value, "at": iso(now)}
            outcome = await self._sender.deliver(channel, delivery_id, payload, subject, text)
            await self._publish(bus.DELIVERY, rule["id"], {
                "id": delivery_id, "org_id": rule["org_id"], "kind": "rule", "rule_id": rule["id"], "channel_id": channel_id,
                "sev": "sev1" if entered else "resolved", "monitor_name": rule["name"], "message": text[:1000],
                "state": "delivered" if outcome.delivered else "failed", "attempts": outcome.attempts, "at": iso(now),
            }, delivery_id)
        if entered:
            await self._state.put(cool_key, {"at": now}, ttl=max(cooldown, 60))
