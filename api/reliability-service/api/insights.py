import logging

from fastapi import APIRouter
from services.insight_generator import generate_insight

logger = logging.getLogger(__name__)

insights_router = APIRouter()

@insights_router.get("/insights/{monitor_id}")
def get_insights(monitor_id: str):
    logger.info(f"Received get_insights request for monitor_id={monitor_id}")
    insight = generate_insight(monitor_id)
    logger.info(
        "Insight generation completed",
        extra={
            "monitor_id": monitor_id,
            "monitor_name": insight.monitor_name,
            "anomaly_detected": insight.anomaly_detected,
            "risk_score": insight.risk_score,
        },
    )
    return insight.to_dict()
