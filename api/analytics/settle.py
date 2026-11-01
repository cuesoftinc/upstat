"""POST /internal/settle: handle everything waiting, then answer (S-14).

Cloud Run bills this service per request, so an instance has CPU only while
it serves one. api/common calls settle at the end of every run-checks pass:
analytics evaluates (deadlines, nodata, flapping, renotify, rules, SLOs),
runs the hourly insight pass when it is due, and answers once its consumer
has handled every message on its lanes and its background insight work is
done, or when the budget runs out (the next pass carries on).

On Cloud Run the service is authenticated-only and only common holds the
invoker role, so IAM is the guard. Elsewhere INTERNAL_TOKEN, when set, must
come in X-Internal-Token (as on the probe).
"""

import hmac
import logging
import os
import time
from collections.abc import Awaitable, Callable

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

log = logging.getLogger(__name__)

BUDGET_SECONDS = 25.0


def router(run: Callable[[float], Awaitable[dict]], token: str) -> APIRouter:
    r = APIRouter()

    @r.post("/internal/settle")
    async def settle(request: Request):
        if not os.environ.get("K_SERVICE") and token and not hmac.compare_digest(request.headers.get("X-Internal-Token", ""), token):
            return JSONResponse({"error": {"code": "unauthorized", "message": "internal callers only", "details": {}}}, status_code=401)
        started = time.monotonic()
        try:
            out = await run(BUDGET_SECONDS)
        except Exception:
            log.exception("settle failed")
            return JSONResponse({"error": {"code": "internal", "message": "Something went wrong", "details": {}}}, status_code=500)
        return {**out, "ms": int((time.monotonic() - started) * 1000)}

    return r
