"""The evaluator (system-design.md §6.1): collects each tick's region
results, closes the tick when every expected region answered or its
deadline passed (timeout + 10 s), applies the state machine and publishes
upstat.monitor.transition, keyed by monitor id.

A transition is stored (emit:<monitor>:<seq>) before the new state is saved
and removed once published, so a failed publish is repeated by the next
sweep with the same id and time. A result for a tick at or before the last
closed one is a duplicate or late, and is ignored.
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
        scheduled = parse_ts(msg["scheduled_at"])
        closed = await self._state.get(f"closed:{msg['monitor_id']}")
        if closed and scheduled <= closed["scheduled_at"]:
            return  # a duplicate or late answer for a tick that already closed
        key = f"tick:{msg['monitor_id']}:{msg['tick_id']}"
        tick = await self._state.get(key) or {
            "monitor_id": msg["monitor_id"], "expected": msg["regions_expected"], "results": {}, "missing": [], "cause": "",
            "scheduled_at": scheduled, "deadline": scheduled + msg["timeout_s"] + TICK_GRACE_SECONDS, "at": 0.0,
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
            await self._close(monitor, tick)
            await self._state.delete(key)
        else:
            await self._state.put(key, tick, ttl=600)

    async def _close(self, monitor: dict, tick: dict) -> None:
        st = await self.monitor_state(monitor)
        st, t = apply_tick(st, Tick(results=tick["results"], cause=tick["cause"], at=tick["at"] or self._clock()),
                           monitor.get("failure_threshold", 3), monitor.get("min_failing_regions", 2))
        await self._commit(monitor, st, t, tick["results"])
        scheduled = tick.get("scheduled_at", 0.0)
        closed = await self._state.get(f"closed:{monitor['id']}") or {"scheduled_at": 0.0}
        await self._state.put(f"closed:{monitor['id']}", {"scheduled_at": max(scheduled, closed["scheduled_at"])})

    async def sweep(self) -> int:
        """Publish transitions an earlier publish failed on, close ticks past
        their deadline and run every monitor's nodata timer; called on every
        evaluate job and wake. Returns transitions."""
        await self.flush()
        now = self._clock()
        emitted = 0
        for key in await self._state.keys("tick:"):
            tick = await self._state.get(key)
            if tick is None or tick["deadline"] > now:
                continue
            monitor = self._config.monitors.get(tick["monitor_id"])
            if monitor and monitor.get("active", True):
                await self._close(monitor, tick)
            await self._state.delete(key)
        for monitor in list(self._config.monitors.values()):
            if not monitor.get("active", True):
                await self._state.delete(f"mon:{monitor['id']}")  # resuming starts fresh from the snapshot
                continue
            st = await self.monitor_state(monitor)
            st, t = check_nodata(st, now, monitor.get("interval_s", 60))
            if t is not None:
                await self._commit(monitor, st, t, {})
                emitted += 1
        return emitted

    async def _commit(self, monitor: dict, st: MonitorState, t, regions: dict[str, bool]) -> None:
        """Stores the transition, then the state, then publishes."""
        if t is None:
            await self.save(monitor["id"], st)
            return
        transition_id = str(uuid.uuid5(uuid.NAMESPACE_URL, f"upstat:{monitor['id']}:{t.seq}"))
        data = {"id": transition_id, "monitor_id": monitor["id"], "org_id": monitor["org_id"], "seq": t.seq, "from": t.from_status,
                "to": t.to_status, "cause": t.cause, "at": iso(self._clock()), "regions": regions,
                "consecutive_failures": t.consecutive_failures}
        await self._state.put(f"emit:{monitor['id']}:{t.seq}", data)
        await self.save(monitor["id"], st)
        await self._emit(data)

    async def flush(self) -> None:
        for key in await self._state.keys("emit:"):
            data = await self._state.get(key)
            if data:
                await self._emit(data)

    async def _emit(self, data: dict) -> None:
        """Publishes a stored transition; a failure leaves it stored."""
        try:
            await self._publish(bus.TRANSITION, data["monitor_id"], data, data["id"])
        except Exception:
            log.warning("transition not published; the next pass publishes it again",
                        extra={"monitor_id": data["monitor_id"], "seq": data["seq"]})
            return
        await self._state.delete(f"emit:{data['monitor_id']}:{data['seq']}")
        log.info("transition", extra={"monitor_id": data["monitor_id"], "from": data["from"], "to": data["to"], "seq": data["seq"]})
