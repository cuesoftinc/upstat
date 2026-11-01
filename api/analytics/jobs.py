"""POST /internal/jobs/{name} for Cloud Scheduler (as api/common): a Google
OIDC token whose audience is SCHEDULER_AUDIENCE and whose verified email is
SCHEDULER_INVOKER_EMAIL. Unset configuration fails closed.

  evaluate  every minute: tick deadlines, nodata timers, flapping exits,
            renotify, metric/log/trace/SLO rules and SLOs
  insights  hourly: the proactive insight pass
"""

import asyncio
import logging
import time
from collections.abc import Awaitable, Callable

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

log = logging.getLogger(__name__)


def _error(status: int, code: str, message: str) -> JSONResponse:
    return JSONResponse({"error": {"code": code, "message": message, "details": {}}}, status_code=status)


def verify_google_token(token: str, audience: str) -> dict:
    import google.auth.transport.requests
    import google.oauth2.id_token

    return google.oauth2.id_token.verify_oauth2_token(token, google.auth.transport.requests.Request(), audience)


def router(jobs: dict[str, Callable[[], Awaitable[object]]], audience: str, invoker: str, verify=verify_google_token) -> APIRouter:
    r = APIRouter()

    @r.post("/internal/jobs/{name}")
    async def run(name: str, request: Request):
        if not audience or not invoker:
            log.error("scheduler auth not configured")
            return _error(503, "unavailable", "Scheduler auth is not configured")
        scheme, _, token = request.headers.get("authorization", "").partition(" ")
        if scheme.lower() != "bearer" or not token.strip():
            return _error(401, "unauthorized", "Missing bearer token")
        try:
            claims = await asyncio.to_thread(verify, token.strip(), audience.rstrip("/"))
        except Exception:
            log.warning("scheduler token rejected")
            return _error(401, "unauthorized", "Invalid token")
        if not claims.get("email_verified") or claims.get("email") != invoker:
            return _error(403, "forbidden", "Caller is not allowed")
        job = jobs.get(name)
        if job is None:
            return _error(404, "not_found", "Not found")
        started = time.monotonic()
        try:
            await job()
        except Exception:
            log.exception("job failed", extra={"job": name})
            return _error(500, "internal", "Something went wrong")
        return {"job": name, "ms": int((time.monotonic() - started) * 1000)}

    return r
