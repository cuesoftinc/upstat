from dataclasses import dataclass
from datetime import datetime


@dataclass(frozen=True)
class MonitorCheck:
    monitor_id: str
    success: bool
    response_time_ms: int
    status_code: int
    checked_at: datetime

