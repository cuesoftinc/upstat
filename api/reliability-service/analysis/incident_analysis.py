from datetime import datetime, timedelta

from models.incident_context import IncidentContext


def _format_duration(seconds: int) -> str:
    minutes = seconds // 60
    hours = minutes // 60
    days = hours // 24

    if days >= 1:
        return f"{days} day{'s' if days != 1 else ''}"
    if hours >= 1:
        return f"{hours} hour{'s' if hours != 1 else ''}"
    if minutes >= 1:
        return f"{minutes} minute{'s' if minutes != 1 else ''}"
    return f"{max(seconds, 1)} second{'s' if seconds != 1 else ''}"


def describe_incident_context(context: IncidentContext) -> str | None:
    if context.active_incident_count > 0:
        summary = f"{context.active_incident_count} active incident{'s' if context.active_incident_count != 1 else ''} are open"
        if context.time_since_last_incident_seconds is not None:
            summary += f" and the newest started {_format_duration(context.time_since_last_incident_seconds)} ago"
        return summary

    if context.historical_incident_count > 0:
        parts = [f"{context.historical_incident_count} historical incident{'s' if context.historical_incident_count != 1 else ''} recorded"]
        if context.time_since_last_incident_seconds is not None:
            parts.append(f"last incident was {_format_duration(context.time_since_last_incident_seconds)} ago")
        return ", ".join(parts)

    return "no incident history for this service"
