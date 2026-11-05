"""POST /internal/settle: handle everything waiting, then answer (S-14).

Cloud Run bills this service per request, so an instance has CPU only while
it serves one. api/common calls settle at the end of every run-checks pass.
One settle drains the lanes first (so every queued result is applied before
a deadline or nodata timer reads the state), evaluates (parked messages,
deadlines, nodata, flapping, renotify, delivery retries, rules, SLOs), runs a
bounded slice of the insight work, then drains again for the transitions it
just published. Each phase has its slice of the 25 s budget and a failing or
slow phase costs only itself; what is cut off waits for the next pass.

Callers are checked here as well as by Cloud Run IAM: the shared
INTERNAL_TOKEN in X-Internal-Token, or a Google ID token for
INTERNAL_AUDIENCE from one of INTERNAL_INVOKERS (as api/query). With neither
configured every call is refused.
"""

import asyncio
import hmac
import logging
import time
from collections.abc import Awaitable, Callable

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

from jobs import verify_google_token

log = logging.getLogger(__name__)

BUDGET_SECONDS = 25.0
DRAIN_FIRST = 0.4  # at most this share of the budget goes to the first drain
KEEP_FOR_INSIGHTS_AND_DRAIN = 0.3  # evaluation ends this share before the end
KEEP_FOR_DRAIN = 0.2  # insights end this share before the end


async def settle_pass(budget: float, drain: Callable[[float], Awaitable[bool]], evaluate: Callable[[float], Awaitable[object]],
                      insights: Callable[[float], Awaitable[object]], clock=time.monotonic) -> dict:
    """drain(seconds) answers whether the lanes are caught up; evaluate and
    insights take the time.monotonic value they must finish by."""
    end = clock() + budget
    errors = 0

    async def phase(name: str, work: Awaitable, until: float):
        nonlocal errors
        try:
            return await asyncio.wait_for(work, max(until - clock(), 0.0))
        except Exception as exc:
            errors += 1
            log.warning("settle phase failed", extra={"phase": name, "error": type(exc).__name__})
            return None

    first = min(end, clock() + budget * DRAIN_FIRST)
    await phase("drain", drain(max(first - clock(), 0.0)), first)
    evaluate_until = end - budget * KEEP_FOR_INSIGHTS_AND_DRAIN
    await phase("evaluate", evaluate(evaluate_until), evaluate_until)
    insights_until = end - budget * KEEP_FOR_DRAIN
    await phase("insights", insights(insights_until), insights_until)
    caught_up = await phase("drain", drain(max(end - clock(), 0.0)), end)
    return {"caught_up": bool(caught_up), "errors": errors}


def _error(status: int, code: str, message: str) -> JSONResponse:
    return JSONResponse({"error": {"code": code, "message": message, "details": {}}}, status_code=status)


def router(run: Callable[[float], Awaitable[dict]], token: str = "", audience: str = "", invokers: list[str] | tuple[str, ...] = (),
           verify=verify_google_token) -> APIRouter:
    r = APIRouter()

    async def caller_ok(request: Request) -> bool:
        if token and hmac.compare_digest(request.headers.get("X-Internal-Token", "").encode(), token.encode()):
            return True
        scheme, _, bearer = request.headers.get("authorization", "").partition(" ")
        if not audience or not invokers or scheme.lower() != "bearer" or not bearer.strip():
            return False
        try:
            claims = await asyncio.to_thread(verify, bearer.strip(), audience.rstrip("/"))
        except Exception:
            log.warning("settle token rejected")
            return False
        return bool(claims.get("email_verified")) and claims.get("email") in invokers

    @r.post("/internal/settle")
    async def settle(request: Request):
        if not token and not (audience and invokers):
            log.error("settle auth not configured")
            return _error(503, "unavailable", "Internal auth is not configured")
        if not await caller_ok(request):
            return _error(401, "unauthorized", "internal callers only")
        started = time.monotonic()
        try:
            out = await run(BUDGET_SECONDS)
        except Exception:
            log.exception("settle failed")
            return _error(500, "internal", "Something went wrong")
        return {**out, "ms": int((time.monotonic() - started) * 1000)}

    return r
