from datetime import datetime, timezone
import logging

from database.mongo import get_database
from models.insight import Insight

logger = logging.getLogger(__name__)
_insights: list[Insight] = []


def save_insight(insight: Insight) -> Insight:
    _insights.append(insight)
    logger.info(f"Saving insight for monitor_id={insight.monitor_id}")
    db = get_database()
    if db is None:
        logger.warning("MongoDB not available, saving insight in memory only")
        return insight

    try:
        now = datetime.now(timezone.utc)
        db["MonitorInsight"].update_one(
            {"monitorId": insight.monitor_id},
            {
                "$set": {
                    "monitorId": insight.monitor_id,
                    "riskScore": insight.risk_score,
                    "anomalyDetected": insight.anomaly_detected,
                    "severity": insight.severity,
                    "summary": insight.summary,
                    "recommendedAction": insight.recommended_action,
                    "humanReadable": insight.human_readable,
                    "generatedAt": now,
                    "updatedAt": now,
                },
                "$setOnInsert": {
                    "createdAt": now,
                },
            },
            upsert=True,
        )
    except Exception as exc:
        logger.error("Failed to save insight to MongoDB: %s", exc)

    return insight


def list_insights() -> list[Insight]:
    return _insights
