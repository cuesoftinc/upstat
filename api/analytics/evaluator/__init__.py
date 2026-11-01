"""The evaluator (system-design.md §6.1): collects each tick's region
results, closes the tick when every expected region answered or its
deadline passed (timeout + 10 s), applies the state machine and publishes
upstat.monitor.transition, keyed by monitor id.
"""

import logging
import time
import uuid
from dataclasses import asdict
from datetime import UTC, datetime

import bus
from evaluator.machine import MonitorState, Tick, apply_tick, check_nodata

log = logging.getLogger(__name__)

TICK_GRACE_SECONDS = 10


def iso(ts: float) -> str:
    return datetime.fromtimestamp(ts, UTC).isoformat().replace("+00:00", "Z")


def parse_ts(value: str) -> float:
    return datetime.fromisoformat(value.replace("Z", "+00:00")).timestamp()


class Evaluator:
    def __init__(self, config, state, publish, clock=time.time):
        self._config = config
        self._state = state
        self._publish = publish  # async (event, key, data, request_id)
        self._clock = clock

    async def monitor_state(self, monitor: dict) -> MonitorState:
        raw = await self._state.get(f"mon:{monitor['id']}")
        if raw is not None and raw.get("seq", 0) >= monitor.get("last_transition_seq", 0):
            return MonitorState(**raw)
        # Rebuild from the snapshot (§9.2: Valkey is rebuildable).
        return MonitorState(status=monitor.get("status", "pending"), consecutive_failures=monitor.get("consecutive_failures", 0),
                            seq=monitor.get("last_transition_seq", 0))

    async def save(self, monitor_id: str, st: MonitorState) -> None:
        await self._state.put(f"mon:{monitor_id}", asdict(st))

    async def on_result(self, msg: dict, request_id: str | None) -> None:
        monitor = self._config.monitors.get(msg["monitor_id"])
        if monitor is None or not monitor.get("active", True):
            return  # deleted or paused since the check ran
        key = f"tick:{msg['monitor_id']}:{msg['tick_id']}"
        tick = await self._state.get(key) or {
            "monitor_id": msg["monitor_id"], "expected": msg["regions_expected"], "results": {}, "missing": [], "cause": "",
            "deadline": parse_ts(msg["scheduled_at"]) + msg["timeout_s"] + TICK_GRACE_SECONDS, "at": 0.0,
        }
        region = msg["region"]
        if msg.get("missing"):
            if region not in tick["missing"]:
                tick["missing"].append(region)
        else:
            tick["results"][region] = bool(msg["ok"])
            tick["at"] = max(tick["at"], parse_ts(msg["checked_at"]))
            if not msg["ok"] and not tick["cause"]:
                tick["cause"] = msg["cause"] or "error"
        answered = set(tick["results"]) | set(tick["missing"])
        if answered >= set(tick["expected"]):
            await self._state.delete(key)
            await self._close(monitor, tick)
        else:
            await self._state.put(key, tick, ttl=600)

    async def _close(self, monitor: dict, tick: dict) -> None:
        st = await self.monitor_state(monitor)
        st, t = apply_tick(st, Tick(results=tick["results"], cause=tick["cause"], at=tick["at"] or self._clock()),
                           monitor.get("failure_threshold", 3), monitor.get("min_failing_regions", 2))
        await self.save(monitor["id"], st)
        if t is not None:
            await self._emit(monitor, t, tick["results"])

    async def sweep(self) -> int:
        """Close ticks past their deadline and run every monitor's nodata
        timer; called on every evaluate job and wake. Returns transitions."""
        now = self._clock()
        emitted = 0
        for key in await self._state.keys("tick:"):
            tick = await self._state.get(key)
            if tick is None or tick["deadline"] > now:
                continue
            await self._state.delete(key)
            monitor = self._config.monitors.get(tick["monitor_id"])
            if monitor and monitor.get("active", True):
                await self._close(monitor, tick)
        for monitor in list(self._config.monitors.values()):
            if not monitor.get("active", True):
                await self._state.delete(f"mon:{monitor['id']}")  # resuming starts fresh from the snapshot
                continue
            st = await self.monitor_state(monitor)
            st, t = check_nodata(st, now, monitor.get("interval_s", 60))
            if t is not None:
                await self.save(monitor["id"], st)
                await self._emit(monitor, t, {})
                emitted += 1
        return emitted

    async def _emit(self, monitor: dict, t, regions: dict[str, bool]) -> None:
        transition_id = str(uuid.uuid5(uuid.NAMESPACE_URL, f"upstat:{monitor['id']}:{t.seq}"))
        data = {"id": transition_id, "monitor_id": monitor["id"], "org_id": monitor["org_id"], "seq": t.seq, "from": t.from_status,
                "to": t.to_status, "cause": t.cause, "at": iso(self._clock()), "regions": regions,
                "consecutive_failures": t.consecutive_failures}
        await self._publish(bus.TRANSITION, monitor["id"], data, transition_id)
        log.info("transition", extra={"monitor_id": monitor["id"], "from": t.from_status, "to": t.to_status, "seq": t.seq})
