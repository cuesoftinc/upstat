import logging
import os
from datetime import datetime, timedelta, timezone

import grpc
from proto import user_pb2, user_pb2_grpc

from models.incident_context import IncidentContext
from models.monitor import MonitorCheck

logger = logging.getLogger(__name__)

DEFAULT_GRPC_ADDRESS = "localhost:8080"
DEFAULT_CHECK_LIMIT = 50


def get_recent_checks(monitor_id: str) -> list[MonitorCheck]:
    address = os.getenv("UPSTAT_GRPC_ADDRESS", DEFAULT_GRPC_ADDRESS)
    token = os.getenv("UPSTAT_GRPC_AUTH_TOKEN")
    limit = int(os.getenv("UPSTAT_GRPC_CHECK_LIMIT", DEFAULT_CHECK_LIMIT))

    try:
        logger.info(f"Connecting to gRPC server at {address}")
        with grpc.insecure_channel(address) as channel:
            logger.info(f"Connected to gRPC server at {address}")
            stub = user_pb2_grpc.MonitorServiceStub(channel)
            request = user_pb2.GetRecentChecksRequest(
                monitor_id=monitor_id,
                limit=limit,
            )
            logger.debug(f"Requesting recent checks for monitor {monitor_id} with limit {limit}")
            response = stub.GetRecentChecks(
                request,
                timeout=5,
                metadata=_auth_metadata(token),
            )
            logger.info(f"Successfully retrieved {len(response.checks)} checks for monitor {monitor_id}")

        return [convert_proto_check(check) for check in response.checks]
    except Exception as e:
        logger.error(f"Failed to get recent checks from gRPC server: {type(e).__name__} - {str(e)}")
        raise


def get_monitor(monitor_id: str):
    address = os.getenv("UPSTAT_GRPC_ADDRESS", DEFAULT_GRPC_ADDRESS)
    token = os.getenv("UPSTAT_GRPC_AUTH_TOKEN")

    try:
        with grpc.insecure_channel(address) as channel:
            stub = user_pb2_grpc.MonitorServiceStub(channel)
            request = user_pb2.GetMonitorRequest(id=monitor_id)
            response = stub.GetMonitor(request, timeout=5, metadata=_auth_metadata(token))
            return response.monitor if response is not None else None
    except Exception as e:
        logger.error(f"Failed to get monitor from gRPC server: {type(e).__name__} - {str(e)}")
        return None


def get_monitor_name(monitor_id: str) -> str | None:
    monitor = get_monitor(monitor_id)
    return monitor.name if monitor is not None else None


def get_incident_context(monitor_id: str) -> IncidentContext:
    monitor = get_monitor(monitor_id)
    owner_id = monitor.owner_id if monitor is not None else None
    monitor_name = monitor.name if monitor is not None else None
    incident_context = IncidentContext(
        monitor_id=monitor_id,
        owner_id=owner_id,
        monitor_name=monitor_name,
    )

    if not owner_id:
        return incident_context

    address = os.getenv("UPSTAT_GRPC_ADDRESS", DEFAULT_GRPC_ADDRESS)
    token = os.getenv("UPSTAT_GRPC_AUTH_TOKEN")

    try:
        with grpc.insecure_channel(address) as channel:
            stub = user_pb2_grpc.MonitorServiceStub(channel)
            request = user_pb2.GetStatusPageRequest(owner_id=owner_id)
            response = stub.GetStatusPage(request, timeout=5, metadata=_auth_metadata(token))

        incidents = [
            incident
            for incident in list(response.active_incidents) + list(response.historical_incidents)
            if incident.monitor_id == monitor_id
        ]

        if not incidents:
            return incident_context

        last_incident = None
        for incident in incidents:
            started_at = _parse_checked_at(incident.started_at)
            if last_incident is None or started_at > _parse_checked_at(last_incident.started_at):
                last_incident = incident

        last_event_time = None
        if last_incident is not None:
            if last_incident.resolved_at:
                last_event_time = _parse_checked_at(last_incident.resolved_at)
            else:
                last_event_time = _parse_checked_at(last_incident.started_at)

        recent_incident_count = sum(
            1
            for incident in incidents
            if _parse_checked_at(incident.started_at) >= _recent_window()
        )

        seconds_since_last = None
        if last_event_time is not None:
            seconds_since_last = int((datetime.now(timezone.utc) - last_event_time).total_seconds())

        incident_context = IncidentContext(
            monitor_id=monitor_id,
            owner_id=owner_id,
            monitor_name=monitor_name,
            active_incident_count=len([i for i in response.active_incidents if i.monitor_id == monitor_id]),
            historical_incident_count=len(incidents),
            recent_incident_count=recent_incident_count,
            time_since_last_incident_seconds=seconds_since_last,
            last_incident_severity=last_incident.severity if last_incident is not None else None,
            last_incident_summary=last_incident.failure_reason if last_incident is not None else None,
            last_incident_started_at=_parse_checked_at(last_incident.started_at) if last_incident is not None else None,
            last_incident_resolved_at=_parse_checked_at(last_incident.resolved_at) if last_incident is not None and last_incident.resolved_at else None,
        )

        return incident_context
    except Exception as e:
        logger.error(f"Failed to get incident context from gRPC server: {type(e).__name__} - {str(e)}")
        return incident_context


def convert_proto_check(check: user_pb2.MonitorCheck) -> MonitorCheck:
    return MonitorCheck(
        monitor_id=check.monitor_id,
        success=check.success,
        response_time_ms=check.response_time,
        status_code=check.status_code,
        checked_at=_parse_checked_at(check.checked_at),
    )


def _auth_metadata(token: str | None) -> tuple[tuple[str, str], ...]:
    if not token:
        return ()
    return (("authorization", f"Bearer {token}"),)


def _parse_checked_at(value: str) -> datetime:
    if not value:
        return datetime.now(timezone.utc)

    return datetime.fromisoformat(value.replace("Z", "+00:00"))


def _recent_window() -> datetime:
    return datetime.now(timezone.utc) - timedelta(days=30)
