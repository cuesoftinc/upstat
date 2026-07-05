from dataclasses import dataclass
from datetime import datetime


@dataclass(frozen=True)
class Incident:
    monitor_id: str
    severity: str
    summary: str
    started_at: datetime

