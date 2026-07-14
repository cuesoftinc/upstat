from dataclasses import dataclass
from datetime import datetime


@dataclass(frozen=True)
class IncidentContext:
    monitor_id: str
    owner_id: str | None = None
    monitor_name: str | None = None
    active_incident_count: int = 0
    historical_incident_count: int = 0
    recent_incident_count: int = 0
    time_since_last_incident_seconds: int | None = None
    last_incident_severity: str | None = None
    last_incident_summary: str | None = None
    last_incident_started_at: datetime | None = None
    last_incident_resolved_at: datetime | None = None
