import logging
import os
from datetime import datetime, timezone

import grpc
from proto import user_pb2, user_pb2_grpc
from models.insight import Insight

logger = logging.getLogger(__name__)
DEFAULT_GRPC_ADDRESS = "localhost:8080"


def report_insight(insight: Insight) -> None:
    address = os.getenv("UPSTAT_GRPC_ADDRESS", DEFAULT_GRPC_ADDRESS)
    token = os.getenv("UPSTAT_GRPC_AUTH_TOKEN")

    try:
        with grpc.insecure_channel(address) as channel:
            stub = user_pb2_grpc.MonitorServiceStub(channel)
            # Include human_readable if available so backend can persist and return it.
            insight_msg = user_pb2.MonitorInsight(
                monitor_id=insight.monitor_id,
                monitor_name=insight.monitor_name,
                risk_score=int(insight.risk_score),
                anomaly_detected=insight.anomaly_detected,
                severity=insight.severity,
                summary=insight.summary,
                recommended_action=insight.recommended_action,
                generated_at=datetime.now(timezone.utc).isoformat(),
            )
            if getattr(insight, "human_readable", None):
                insight_msg.human_readable = insight.human_readable

            request = user_pb2.ReportMonitorInsightRequest(insight=insight_msg)
            stub.ReportMonitorInsight(request, timeout=5, metadata=_auth_metadata(token))
            logger.info(f"Reported insight for monitor {insight.monitor_id} to backend")
    except Exception as e:
        logger.error(f"Failed to report insight to backend: {e}")


def _auth_metadata(token: str | None) -> tuple[tuple[str, str], ...]:
    if not token:
        return ()
    return (("authorization", f"Bearer {token}"),)
