"""Insights (system-design.md §6.6): on a transition, and hourly for every
active monitor, read the monitor's history through api/query, run the
feature builder, risk scorer and isolation-forest detector unchanged, render
the narrative and send upstat.insights.generated for common to persist.
The service never touches common's store.
"""

import asyncio
import logging
import time
import uuid
from datetime import UTC, datetime, timedelta

import bus
from analysis.failure_analysis import describe_failures
from analysis.incident_analysis import describe_incident_context
from analysis.latency_analysis import describe_latency
from analysis.status_code_analysis import describe_status_code_anomaly
from analysis.trend_analysis import describe_trend
from ml.feature_builder import build_features
from model.check import MonitorCheck
from model.incident_context import IncidentContext
from model.insight import Insight
from service.ml_anomaly_detector import MLAnomalyDetector
from service.risk_scorer import calculate_risk_score
from service.severity_classifier import risk_classifier

log = logging.getLogger(__name__)

TRAINING_WINDOW = timedelta(days=14)


def _recommended_action(severity: str, anomaly_detected: bool) -> str:
    if severity in {"critical", "high"} or anomaly_detected:
        return "investigate recent failures and latency spikes"
    if severity == "medium":
        return "monitor closely and review recent deploys"
    return "no action needed"


def legacy(rows: list[dict]) -> list[dict]:
    """Check rows in the shape the feature transformer was trained on."""
    return [{"responseTimeMs": float(r.get("response_time_ms", r.get("total_ms", 0)) or 0),
             "status": "up" if r.get("up", r.get("ok")) in (True, 1, "1") else "down",
             "statusCode": int(r.get("status_code") or 0), "attempts": 1} for r in rows]


class InsightGenerator:
    def __init__(self, config, state, query, narrator, publish, clock=time.time):
        self._config = config
        self._state = state
        self._query = query
        self._narrator = narrator
        self._publish = publish
        self._clock = clock

    async def on_transition(self, msg: dict, request_id: str | None) -> None:
        if msg["to"] == "down":
            hist = await self._state.get(f"incidents:{msg['monitor_id']}") or {"downs": []}
            hist["downs"] = (hist["downs"] + [self._clock()])[-50:]
            await self._state.put(f"incidents:{msg['monitor_id']}", hist, ttl=90 * 24 * 3600)
        if msg["to"] in ("down", "up", "nodata"):
            await self.generate(msg["monitor_id"], msg["org_id"], active=msg["to"] == "down")

    async def sweep(self) -> int:
        """The hourly proactive pass over active monitors."""
        n = 0
        for monitor in list(self._config.monitors.values()):
            if monitor.get("active", True):
                try:
                    await self.generate(monitor["id"], monitor["org_id"], active=monitor.get("status") == "down")
                    n += 1
                except Exception:
                    log.exception("insight failed", extra={"monitor_id": monitor["id"]})
        return n

    async def _context(self, monitor_id: str, active: bool) -> IncidentContext:
        downs = (await self._state.get(f"incidents:{monitor_id}") or {}).get("downs", [])
        last = int(self._clock() - downs[-1]) if downs else None
        recent = sum(1 for t in downs if self._clock() - t < 7 * 24 * 3600)
        return IncidentContext(monitor_id=monitor_id, active_incident_count=1 if active else 0,
                               historical_incident_count=len(downs), recent_incident_count=recent, time_since_last_incident_seconds=last)

    async def generate(self, monitor_id: str, org_id: str, active: bool = False) -> Insight | None:
        history = await self._query.history(org_id, monitor_id)
        recent = history.get("recent_checks") or []
        if not recent:
            return None
        checks = [MonitorCheck(success=bool(c["up"]), response_time_ms=int(c["response_time_ms"]), status_code=c.get("status_code"))
                  for c in recent]
        features = build_features(checks)
        context = await self._context(monitor_id, active)
        risk = calculate_risk_score(features, context)
        severity = risk_classifier(risk, context)
        training = await self._training_rows(org_id, monitor_id)
        # Training and scoring are CPU work: keep them off the event loop.
        ml = await asyncio.to_thread(lambda: MLAnomalyDetector(monitor_id, legacy(training)).predict_anomaly(legacy(recent)))
        signals = [s for s in (describe_incident_context(context), describe_failures(features), describe_latency(features),
                               describe_trend(features), describe_status_code_anomaly(features)) if s]
        monitor = self._config.monitors.get(monitor_id) or {}
        insight = Insight(monitor_id=monitor_id, monitor_name=monitor.get("name", monitor_id), risk_score=risk,
                          anomaly_detected=bool(ml["is_anomaly"]), severity=severity,
                          summary=", ".join(signals) if signals else "no reliability issues detected",
                          recommended_action=_recommended_action(severity, bool(ml["is_anomaly"])))
        narrative = await self._narrator.render(insight)
        insight_id = str(uuid.uuid4())
        data = {"id": insight_id, "org_id": org_id, "monitor_id": monitor_id, "risk_score": int(risk), "severity": severity,
                "anomaly_detected": insight.anomaly_detected, "summary": insight.summary[:2000], "narrative": narrative[:4000],
                "recommended_action": insight.recommended_action[:2000],
                "generated_at": datetime.now(UTC).isoformat().replace("+00:00", "Z")}
        await self._publish(bus.INSIGHT, monitor_id, data, insight_id)
        log.info("insight generated", extra={"monitor_id": monitor_id, "risk": risk, "severity": severity})
        return insight

    async def _training_rows(self, org_id: str, monitor_id: str) -> list[dict]:
        """Up to 1,000 recent check rows (the raw stream) to train on."""
        now = datetime.fromtimestamp(self._clock(), UTC)
        try:
            table = await self._query.query(org_id, f"check:{monitor_id}", TRAINING_WINDOW, now, signal="checks")
        except Exception:
            log.warning("training history unavailable", extra={"monitor_id": monitor_id})
            return []
        cols = table.get("columns") or []
        rows = [dict(zip(cols, row, strict=False)) for row in table.get("rows") or []]
        return list(reversed(rows))  # oldest first
