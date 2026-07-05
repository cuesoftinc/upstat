import logging

from fastapi import APIRouter
from services.insight_generator import generate_insight

logger = logging.getLogger(__name__)

analyze_router = APIRouter()

@analyze_router.post("/analyze/{monitor_id}")
def analyze(monitor_id: str):
    logger.info(f"Received analyze request for monitor_id={monitor_id}")
    insight = generate_insight(monitor_id)
    logger.info(
        "Analyze completed", extra={
            "monitor_id": monitor_id,
            "monitor_name": insight.monitor_name,
            "anomaly_detected": insight.anomaly_detected,
            "risk_score": insight.risk_score,
        }
    )
    return insight.to_dict()
