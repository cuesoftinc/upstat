"""The monitor state machine and the multi-region quorum, as pure functions
(flows/monitor.md §2, system-design.md §6.1). Table-tested edge by edge.

States: pending, up, down, nodata, paused.
- A tick passes when fewer than min_failing_regions regions failed; with
  fewer regions reporting than the quorum, it fails only if every
  reporting region failed. No region reporting is no data, never a failure.
- Down needs `threshold` consecutive failed ticks; up needs one pass.
- Up with no completed check for 2 x interval becomes nodata.
"""

from dataclasses import dataclass, replace


@dataclass(frozen=True)
class MonitorState:
    status: str = "pending"
    consecutive_failures: int = 0
    seq: int = 0
    last_result_at: float | None = None  # epoch seconds of the last reporting tick


@dataclass(frozen=True)
class Tick:
    """One closed tick: each reporting region's verdict, missing excluded."""

    results: dict[str, bool]  # region -> ok
    cause: str = ""  # the first failing region's cause
    at: float = 0.0


@dataclass(frozen=True)
class Transition:
    from_status: str
    to_status: str
    cause: str
    consecutive_failures: int
    seq: int


def tick_failed(results: dict[str, bool], min_failing_regions: int) -> bool | None:
    """True/False for a decided tick; None when no region reported."""
    if not results:
        return None
    failing = sum(1 for ok in results.values() if not ok)
    quorum = max(1, min_failing_regions)
    if len(results) < quorum:
        return failing == len(results)
    return failing >= quorum


def apply_tick(state: MonitorState, tick: Tick, threshold: int, min_failing_regions: int) -> tuple[MonitorState, Transition | None]:
    """Advance the state by one closed tick."""
    if state.status == "paused":
        return state, None
    failed = tick_failed(tick.results, min_failing_regions)
    if failed is None:
        return state, None  # nothing reported: the nodata timer decides
    state = replace(state, last_result_at=tick.at)
    if not failed:
        if state.status == "up":
            return replace(state, consecutive_failures=0), None
        return _move(state, "up", "", 0)
    failures = state.consecutive_failures + 1
    if state.status == "down":
        return replace(state, consecutive_failures=failures), None
    if failures >= max(1, threshold):
        return _move(state, "down", tick.cause or "error", failures)
    return replace(state, consecutive_failures=failures), None


def check_nodata(state: MonitorState, now: float, interval_s: int) -> tuple[MonitorState, Transition | None]:
    """Up becomes nodata after 2 x interval without a completed check."""
    if state.status != "up" or state.last_result_at is None:
        return state, None
    if now - state.last_result_at <= 2 * interval_s:
        return state, None
    return _move(state, "nodata", "", state.consecutive_failures)


def _move(state: MonitorState, to: str, cause: str, failures: int) -> tuple[MonitorState, Transition]:
    seq = state.seq + 1
    t = Transition(from_status=state.status, to_status=to, cause=cause, consecutive_failures=failures, seq=seq)
    return replace(state, status=to, consecutive_failures=0 if to == "up" else failures, seq=seq), t
