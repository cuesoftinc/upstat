from models.incident_context import IncidentContext


def calculate_risk_score(features: dict, incident_context: IncidentContext) -> int:
    if features["total_checks"] == 0:
        return 0

    score = 0
    failure_rate = features["failure_rate"]

    score += int(failure_rate * 50)
    score += min(features["consecutive_failures"] * 12, 30)
    score += min(features["recent_failed_checks"] * 5, 20)

    if features["response_time_trend"] >= 0.20:
        score += 15
    elif features["response_time_trend"] >= 0.10:
        score += 8

    if features["status_code_anomaly"]:
        score += 20

    if features["average_response_time"] > 1000:
        score += 12
    elif features["average_response_time"] > 500:
        score += 6

    score += min(incident_context.historical_incident_count * 4, 20)
    score += incident_context.active_incident_count * 20

    if incident_context.time_since_last_incident_seconds is not None:
        if incident_context.time_since_last_incident_seconds < 3600:
            score += 20
        elif incident_context.time_since_last_incident_seconds < 14400:
            score += 10

    if score > 100:
        score = 100
    if score < 0:
        score = 0

    return int(score)
