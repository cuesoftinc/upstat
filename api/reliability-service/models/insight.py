from dataclasses import dataclass, field
from datetime import datetime, timezone


@dataclass(frozen=True)
class Insight:
    monitor_id: str
    monitor_name: str
    risk_score: int
    anomaly_detected: bool
    severity: str
    summary: str
    recommended_action: str
    generated_at: str = field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )
    human_readable: str | None = None

    def to_dict(self) -> dict:
        return {
            "monitor_id": self.monitor_id,
            "monitor_name": self.monitor_name, 
            "risk_score": int(self.risk_score),
            "anomaly_detected": bool(self.anomaly_detected),
            "severity": self.severity,
            "summary": self.summary,
            "recommended_action": self.recommended_action,
            "generated_at": self.generated_at,
            "human_readable": self.human_readable,
        }
