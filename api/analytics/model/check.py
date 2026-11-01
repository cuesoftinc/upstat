from dataclasses import dataclass


@dataclass(frozen=True)
class MonitorCheck:
    """One check result as the feature builder reads it."""

    success: bool
    response_time_ms: int
    status_code: int | None
