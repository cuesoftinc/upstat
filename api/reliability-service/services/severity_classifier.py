from models.incident_context import IncidentContext


def risk_classifier(risk_score: int, incident_context: IncidentContext) -> str:
    if incident_context.active_incident_count > 0:
        return "critical"

    if risk_score >= 90:
        return "critical"

    if risk_score >= 65:
        return "high"

    if risk_score >= 40:
        return "medium"

    if incident_context.historical_incident_count >= 4 and risk_score >= 30:
        return "medium"

    return "low"

