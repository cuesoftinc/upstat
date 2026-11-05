"""Rule and SLO evaluation (system-design.md §4 evaluator, pages.md B10),
run by the every-minute evaluate job. Metric, log and trace rules run their
query over the rule's window through api/query and compare the newest value
with warn/crit; SLO-burn rules compare an SLO's burn rate. A state change
goes to common as upstat.rule.evaluated; entering or leaving alert notifies.
A change is stored (rulepend:<rule>) before it is published and removed once
published and notified, so a failed publish is repeated by the next pass with
the same time. No data never ends an alert: the rule stays in alert until a
value says otherwise. Every rule and SLO is evaluated alone, inside the
caller's deadline; a slow or failing query costs that rule only.

SLIs (decisions.md S-13):
- check: passing ÷ completed checks of the SLO's monitor;
- latency: the share of the query's spans at or under 500 ms;
- metric_ratio: "<good query> / <total query>", counted.
Burn rate is the last hour's error rate over the budget's error rate.
"""

import asyncio
import logging
import re
import time
from datetime import UTC, datetime, timedelta

import bus
from queryclient import last_value, total

log = logging.getLogger(__name__)

LATENCY_GOOD_MS = 500
SLO_EVERY_SECONDS = 300
PENDING_TRIES = 10
_WINDOW = re.compile(r"^(\d+)([smhd])$")


def parse_window(spec: str, default: timedelta) -> timedelta:
    m = _WINDOW.match((spec or "").strip())
    if not m:
        return default
    n, unit = int(m.group(1)), m.group(2)
    return {"s": timedelta(seconds=n), "m": timedelta(minutes=n), "h": timedelta(hours=n), "d": timedelta(days=n)}[unit]


def classify(value: float | None, thresholds: dict) -> str:
    if value is None:
        return "nodata"
    crit, warn = thresholds.get("crit"), thresholds.get("warn")
    if crit is not None and value >= crit:
        return "alert"
    if warn is not None and value >= warn:
        return "warn"
    return "ok"


def iso(t: datetime) -> str:
    return t.astimezone(UTC).isoformat().replace("+00:00", "Z")


def slo_status(good: float, all_: float, recent_good: float, recent_all: float, target: float) -> tuple[float, float, float, str]:
    """(current %, budget remaining %, burn rate, state) from counts."""
    current = 100.0 if all_ == 0 else good / all_ * 100
    allowed = max(1e-9, 1 - target / 100)
    spent = (1 - current / 100) / allowed
    budget = max(0.0, min(100.0, (1 - spent) * 100))
    recent_err = 0.0 if recent_all == 0 else 1 - recent_good / recent_all
    burn = recent_err / allowed
    state = "exhausted" if budget <= 0 else ("burning" if burn > 1 else "healthy")
    return round(current, 3), round(budget, 2), round(burn, 2), state


class Evaluation:
    def __init__(self, config, state, query, publish, notifier, clock=time.time):
        self._config = config
        self._state = state
        self._query = query
        self._publish = publish
        self._notifier = notifier
        self._clock = clock

    async def run(self, deadline: float | None = None) -> dict:
        """Evaluates the SLOs when due, then every non-uptime rule, starting
        where the last pass stopped. deadline is a time.monotonic value; what
        it cuts off waits for the next pass."""
        now_ts = self._clock()
        now = datetime.fromtimestamp(now_ts, UTC)
        done = skipped = failed = 0

        def left() -> float | None:
            return None if deadline is None else deadline - time.monotonic()

        stamp = await self._state.get("slo:last") or {"at": 0}
        if now_ts - stamp["at"] >= SLO_EVERY_SECONDS:
            cut = False
            for slo in list(self._config.slos.values()):
                if left() is not None and left() <= 0:
                    cut = True
                    break
                if not await self._guard("slo", slo["id"], self._slo(slo, now), left()):
                    failed += 1
            if not cut:
                await self._state.put("slo:last", {"at": now_ts})
        rules = [r for r in self._config.rules.values() if r["signal"] != "uptime"]
        cursor = (await self._state.get("rules:cursor") or {"at": 0})["at"] % len(rules) if rules else 0
        for rule in rules[cursor:] + rules[:cursor]:
            if left() is not None and left() <= 0:
                skipped = len(rules) - done - failed
                break
            if await self._guard("rule", rule["id"], self._rule(rule, now), left()):
                done += 1
            else:
                failed += 1
        if rules:
            await self._state.put("rules:cursor", {"at": cursor + done + failed})
        return {"rules": done, "failed": failed, "skipped": skipped}

    async def _guard(self, kind: str, item_id: str, work, timeout: float | None) -> bool:
        """Runs one rule or SLO alone: its failure or timeout is logged and
        never reaches the others."""
        try:
            await asyncio.wait_for(work, timeout)
        except Exception as exc:
            log.warning(f"{kind} evaluation failed", extra={f"{kind}_id": item_id, "error": type(exc).__name__})
            return False
        return True

    async def _value(self, rule: dict, now: datetime) -> float | None:
        thresholds = rule.get("thresholds") or {}
        if rule["signal"] == "slo_burn":
            target = (rule.get("query_string") or "").strip()
            for slo in self._config.slos.values():
                if slo["org_id"] == rule["org_id"] and target in (slo["id"], slo["name"]):
                    return (await self._state.get(f"slo:{slo['id']}") or {}).get("burn_rate")
            return None
        window = parse_window(thresholds.get("window", "5m"), timedelta(minutes=5))
        q = rule.get("query_string") or ""
        if "|" not in q:
            q += " | count()"
        signal = {"log": "logs", "trace": "traces", "metric": "metrics"}.get(rule["signal"], "")
        result = await self._query.query(rule["org_id"], q, window, now, step=f"{int(window.total_seconds())}s", signal=signal)
        return last_value(result)

    async def _rule(self, rule: dict, now: datetime) -> None:
        pending = await self._state.get(f"rulepend:{rule['id']}")
        if pending:
            return await self._deliver_pending(rule, pending)
        value = await self._value(rule, now)
        state = classify(value, rule.get("thresholds") or {})
        previous = (await self._state.get(f"rule:{rule['id']}") or {}).get("state", rule.get("state", "ok"))
        if state == previous or (state == "nodata" and previous == "alert"):
            return
        change = {"state": state, "previous": previous, "value": value, "triggered": state == "alert", "at": iso(now), "ts": now.timestamp(),
                  "tries": 0}
        await self._state.put(f"rulepend:{rule['id']}", change)
        await self._state.put(f"rule:{rule['id']}", {"state": state})
        await self._deliver_pending(rule, change)

    async def _deliver_pending(self, rule: dict, change: dict) -> None:
        """Publishes and notifies a stored state change, then clears it."""
        key = f"rulepend:{rule['id']}"
        change["tries"] += 1
        if change["tries"] > PENDING_TRIES:
            log.error("rule change dropped after repeated failures", extra={"rule_id": rule["id"], "state": change["state"]})
            await self._state.delete(key)
            return
        await self._state.put(key, change)
        data = {"rule_id": rule["id"], "org_id": rule["org_id"], "state": change["state"], "value": change["value"],
                "triggered": change["triggered"], "at": change["at"]}
        await self._publish(bus.RULE_EVALUATED, rule["id"], data, f"{rule['id']}:{change['at']}")
        if change["triggered"]:
            await self._notifier.rule_alert(rule, True, change["value"], change["ts"], change["at"])
        elif change["previous"] == "alert":
            await self._notifier.rule_alert(rule, False, change["value"], change["ts"], change["at"])
        await self._state.delete(key)

    async def _counts(self, slo: dict, window: timedelta, now: datetime) -> tuple[float, float]:
        org, source = slo["org_id"], slo["sli_source"]
        if source == "check":
            if not slo.get("monitor_id"):
                return 0, 0
            base = f"check:{slo['monitor_id']}"
            good_q, all_q, signal = f"{base} status:up | count()", f"{base} | count()", "checks"
        elif source == "latency":
            filters = (slo.get("query") or "").split("|", 1)[0].strip()
            good_q, all_q, signal = f"{filters} trace.duration_ms:<={LATENCY_GOOD_MS} | count()", f"{filters} | count()", "traces"
        else:
            good, _, all_ = (slo.get("query") or "").partition(" / ")
            if not all_:
                return 0, 0
            good_q, all_q, signal = f"{good.strip()} | count()", f"{all_.strip()} | count()", ""
        step = f"{int(window.total_seconds())}s"
        good = total(await self._query.query(org, good_q, window, now, step=step, signal=signal)) or 0.0
        all_count = total(await self._query.query(org, all_q, window, now, step=step, signal=signal)) or 0.0
        return good, all_count

    async def _slo(self, slo: dict, now: datetime) -> None:
        window = parse_window(slo.get("window", "30d"), timedelta(days=30))
        good, all_ = await self._counts(slo, window, now)
        recent_good, recent_all = await self._counts(slo, timedelta(hours=1), now)
        current, budget, burn, state = slo_status(good, all_, recent_good, recent_all, float(slo["target"]))
        prev = await self._state.get(f"slo:{slo['id']}") or {}
        exhausted_at = prev.get("exhausted_at") if state == "exhausted" else None
        if state == "exhausted" and not exhausted_at:
            exhausted_at = iso(now)
        status = {"current": current, "budget_remaining_pct": budget, "burn_rate": burn, "state": state, "exhausted_at": exhausted_at}
        await self._state.put(f"slo:{slo['id']}", status)
        if {k: prev.get(k) for k in status} == status:
            return  # unchanged: nothing to persist
        data = {"slo_id": slo["id"], "org_id": slo["org_id"], **status, "at": iso(now)}
        await self._publish(bus.SLO_EVALUATED, slo["id"], data, f"{slo['id']}:{iso(now)}")
