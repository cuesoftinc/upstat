import logging
import os
from datetime import datetime, timedelta, timezone

import requests

from model.incident_context import IncidentContext
from model.monitor import MonitorCheck

logger = logging.getLogger(__name__)

DEFAULT_API_URL = "http://localhost:8080"
DEFAULT_CHECK_LIMIT = 50
REQUEST_TIMEOUT_SECONDS = 5


def get_recent_checks(monitor_id: str) -> list[MonitorCheck]:
    limit = int(os.getenv("API_CHECK_LIMIT", DEFAULT_CHECK_LIMIT))

    try:
        logger.debug(f"Requesting recent checks for monitor {monitor_id} with limit {limit}")
        body = _get(f"/v1/monitors/{monitor_id}/checks", params={"limit": limit})
        checks = body.get("recent_checks") or []
        logger.info(f"Successfully retrieved {len(checks)} checks for monitor {monitor_id}")
        return [convert_check(check) for check in checks]
    except Exception as e:
        logger.error(f"Failed to get recent checks from the API: {type(e).__name__} - {str(e)}")
        raise


def get_monitor(monitor_id: str) -> dict | None:
    try:
        return _get(f"/v1/monitors/{monitor_id}")
    except Exception as e:
        logger.error(f"Failed to get monitor from the API: {type(e).__name__} - {str(e)}")
        return None


def get_monitor_name(monitor_id: str) -> str | None:
    monitor = get_monitor(monitor_id)
    return monitor.get("name") if monitor is not None else None


def get_incident_context(monitor_id: str) -> IncidentContext:
    monitor = get_monitor(monitor_id)
    owner_id = monitor.get("owner_id") if monitor is not None else None
    monitor_name = monitor.get("name") if monitor is not None else None
    incident_context = IncidentContext(
        monitor_id=monitor_id,
        owner_id=owner_id,
        monitor_name=monitor_name,
    )

    if not owner_id:
        return incident_context

    try:
        body = _get(f"/v1/status/{owner_id}")
        active = [i for i in body.get("active_incidents") or [] if i.get("monitor_id") == monitor_id]
        historical = [i for i in body.get("historical_incidents") or [] if i.get("monitor_id") == monitor_id]
        incidents = active + historical

        if not incidents:
            return incident_context

        last_incident = max(incidents, key=lambda i: _parse_checked_at(i.get("started_at")))
        resolved_at = last_incident.get("resolved_at")
        started_at = _parse_checked_at(last_incident.get("started_at"))
        last_event_time = _parse_checked_at(resolved_at) if resolved_at else started_at

        recent_incident_count = sum(
            1
            for incident in incidents
            if _parse_checked_at(incident.get("started_at")) >= _recent_window()
        )

        return IncidentContext(
            monitor_id=monitor_id,
            owner_id=owner_id,
            monitor_name=monitor_name,
            active_incident_count=len(active),
            historical_incident_count=len(incidents),
            recent_incident_count=recent_incident_count,
            time_since_last_incident_seconds=int((datetime.now(timezone.utc) - last_event_time).total_seconds()),
            last_incident_severity=None,
            last_incident_summary=last_incident.get("failure_reason"),
            last_incident_started_at=started_at,
            last_incident_resolved_at=_parse_checked_at(resolved_at) if resolved_at else None,
        )
    except Exception as e:
        logger.error(f"Failed to get incident context from the API: {type(e).__name__} - {str(e)}")
        return incident_context


def convert_check(check: dict) -> MonitorCheck:
    return MonitorCheck(
        monitor_id=check.get("monitor_id", ""),
        success=bool(check.get("up")),
        response_time_ms=check.get("response_time_ms", 0),
        status_code=check.get("status_code", 0),
        checked_at=_parse_checked_at(check.get("checked_at")),
    )


def _get(path: str, params: dict | None = None) -> dict:
    base = os.getenv("API_URL", DEFAULT_API_URL).rstrip("/")
    response = requests.get(
        f"{base}{path}",
        params=params,
        headers=_auth_headers(os.getenv("API_TOKEN")),
        timeout=REQUEST_TIMEOUT_SECONDS,
    )
    response.raise_for_status()
    return response.json()


def _auth_headers(token: str | None) -> dict[str, str]:
    if not token:
        return {}
    return {"Authorization": f"Bearer {token}"}


def _recent_window() -> datetime:
    return datetime.now(timezone.utc) - timedelta(days=30)


def _parse_checked_at(value: str | None) -> datetime:
    if not value:
        return datetime.now(timezone.utc)

    return datetime.fromisoformat(value.replace("Z", "+00:00"))
