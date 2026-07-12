import logging

from analysis.failure_analysis import describe_failures
from analysis.incident_analysis import describe_incident_context
from analysis.latency_analysis import describe_latency
from analysis.status_code_analysis import describe_status_code_anomaly
from analysis.trend_analysis import describe_trend
from ml.feature_builder import build_features
from models.insight import Insight
from repositories.insight_repository import save_insight
from repositories.monitor_repository import get_incident_context, get_monitor_name, get_recent_checks
from services.groq_renderer import render_insight_narrative
from services.risk_scorer import calculate_risk_score
from services.severity_classifier import risk_classifier
from services.ml_anomaly_detector import MLAnomalyDetector

logger = logging.getLogger(__name__)


def generate_insight(monitor_id: str) -> Insight:
    logger.info(f"Starting insight generation for monitor_id={monitor_id}")
    checks = get_recent_checks(monitor_id)
    logger.info(f"Retrieved {len(checks)} checks for monitor_id={monitor_id}")
    features = build_features(checks)
    incident_context = get_incident_context(monitor_id)

    risk_score = calculate_risk_score(features, incident_context)
    severity = risk_classifier(risk_score, incident_context)
    logger.info(
        f"Computed risk_score={risk_score}, severity={severity} "
        f"for monitor_id={monitor_id}"
    )

    ml_detector = MLAnomalyDetector(monitor_id)
    ml_result = ml_detector.predict_anomaly(checks)
    anomaly_detected = ml_result["is_anomaly"]
    anomaly_score = ml_result.get("anomaly_score", 0.0)
    logger.info(
        f"ML anomaly detection result for monitor_id={monitor_id}: "
        f"anomaly_detected={anomaly_detected}, anomaly_score={anomaly_score:.3f}"
    )

    signals = [
        signal
        for signal in (
            describe_incident_context(incident_context),
            describe_failures(features),
            describe_latency(features),
            describe_trend(features),
            describe_status_code_anomaly(features),
        )
        if signal
    ]

    monitor_name = get_monitor_name(monitor_id) or monitor_id
    logger.info(f"Resolved monitor_name={monitor_name} for monitor_id={monitor_id}")

    summary = ", ".join(signals) if signals else "no reliability issues detected"
    human_readable = None
    try:
        preliminary_insight = Insight(
            monitor_id=monitor_id,
            monitor_name=monitor_name,
            risk_score=risk_score,
            anomaly_detected=anomaly_detected,
            severity=severity,
            summary=summary,
            recommended_action=_recommended_action(severity, anomaly_detected),
        )
        human_readable = render_insight_narrative(preliminary_insight)
    except Exception:
        logger.exception("Failed to generate Groq narrative for monitor %s", monitor_id)
        human_readable = None

    insight = Insight(
        monitor_id=monitor_id,
        monitor_name=monitor_name,
        risk_score=risk_score,
        anomaly_detected=anomaly_detected,
        severity=severity,
        summary=summary,
        recommended_action=_recommended_action(severity, anomaly_detected),
        human_readable=human_readable,
    )

    saved_insight = save_insight(insight)
    logger.info(f"Insight saved for monitor_id={monitor_id}")
    return saved_insight


def _recommended_action(severity: str, anomaly_detected: bool) -> str:
    if severity in {"critical", "high"} or anomaly_detected:
        return "investigate recent failures and latency spikes"

    if severity == "medium":
        return "monitor closely and review recent deploys"

    return "no action needed"
