"""Rule and SLO evaluation (system-design.md §4 evaluator, pages.md B10),
run by the every-minute evaluate job. Metric, log and trace rules run their
query over the rule's window through api/query and compare the newest value
with warn/crit; SLO-burn rules compare an SLO's burn rate. A state change
goes to common as upstat.rule.evaluated; entering or leaving alert notifies.

SLIs (decisions.md S-13):
- check: passing ÷ completed checks of the SLO's monitor;
- latency: the share of the query's spans at or under 500 ms;
- metric_ratio: "<good query> / <total query>", counted.
Burn rate is the last hour's error rate over the budget's error rate.
"""

import logging
import re
import time
from datetime import UTC, datetime, timedelta

import bus
from queryclient import QueryError, last_value, total

log = logging.getLogger(__name__)

LATENCY_GOOD_MS = 500
SLO_EVERY_SECONDS = 300
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

    async def run(self) -> None:
        now_ts = self._clock()
        now = datetime.fromtimestamp(now_ts, UTC)
        stamp = await self._state.get("slo:last") or {"at": 0}
        if now_ts - stamp["at"] >= SLO_EVERY_SECONDS:
            for slo in list(self._config.slos.values()):
                try:
                    await self._slo(slo, now)
                except QueryError as exc:
                    log.warning("slo evaluation failed", extra={"slo_id": slo["id"], "error": str(exc)})
            await self._state.put("slo:last", {"at": now_ts})
        for rule in list(self._config.rules.values()):
            if rule["signal"] == "uptime":
                continue
            try:
                await self._rule(rule, now)
            except QueryError as exc:
                log.warning("rule evaluation failed", extra={"rule_id": rule["id"], "error": str(exc)})

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
        value = await self._value(rule, now)
        state = classify(value, rule.get("thresholds") or {})
        previous = (await self._state.get(f"rule:{rule['id']}") or {}).get("state", rule.get("state", "ok"))
        if state == previous:
            return
        await self._state.put(f"rule:{rule['id']}", {"state": state})
        entered = state == "alert" and previous != "alert"
        data = {"rule_id": rule["id"], "org_id": rule["org_id"], "state": state, "value": value, "triggered": entered, "at": iso(now)}
        await self._publish(bus.RULE_EVALUATED, rule["id"], data, f"{rule['id']}:{iso(now)}")
        if entered:
            await self._notifier.rule_alert(rule, True, value, now.timestamp())
        elif previous == "alert":
            await self._notifier.rule_alert(rule, False, value, now.timestamp())

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
