"""The probe: one Cloud Run function per region (S-5, S-12), called only by
api/common with a Cloud Run IAM identity token (§7.1). It holds no secrets
and no IAM roles, and has no VPC connector, so even an SSRF bypass reaches
nothing internal (§8). Self-host runs the same code as a container with
functions-framework; there INTERNAL_TOKEN guards it instead.

  POST /check  {job_id, target, timeout_s}      -> one HTTP check
  POST /run    {kind, steps, browser}           -> one synthetic run
  GET  /health                                  -> {"status": "up"}
"""

import hmac
import json
import logging
import os

import functions_framework

from probe.check import check
from probe.run import run

logging.basicConfig(level=logging.INFO, format='{"severity":"%(levelname)s","message":"%(message)s"}')
REGION = os.environ.get("PROBE_REGION", "local")


def _json(body, status=200):
    return (json.dumps(body), status, {"Content-Type": "application/json"})


def _error(status, code, message):
    return _json({"error": {"code": code, "message": message, "details": {}}}, status)


def _authorized(request) -> bool:
    token = os.environ.get("INTERNAL_TOKEN", "")
    if not token:
        return True  # Cloud Run IAM already admitted the caller
    return hmac.compare_digest(request.headers.get("X-Internal-Token", ""), token)


@functions_framework.http
def probe(request):
    if request.path in ("/health", "/ready") and request.method == "GET":
        return _json({"status": "up", "region": REGION})
    if request.method != "POST":
        return _error(405, "method_not_allowed", "POST only")
    if not _authorized(request):
        return _error(401, "unauthorized", "internal callers only")
    body = request.get_json(silent=True)
    if not isinstance(body, dict):
        return _error(400, "bad_shape", "malformed JSON body")
    if request.path == "/check":
        target, timeout = body.get("target"), body.get("timeout_s")
        if not isinstance(target, str) or not isinstance(timeout, int) or not 1 <= timeout <= 60:
            return _error(422, "bad_shape", "target and timeout_s (1-60) are required")
        result = check(target, timeout)
        # Never log the target: it may embed internal hostnames (data-model.md §4).
        logging.info("check job=%s region=%s ok=%s cause=%s ms=%s", body.get("job_id", ""), REGION, result["ok"], result["cause"],
                     result["total_ms"])
        return _json(result)
    if request.path == "/run":
        steps = body.get("steps") or []
        if not isinstance(steps, list) or len(steps) > 20:
            return _error(422, "bad_shape", "steps is a list of at most 20")
        return _json(run(body.get("kind", "multi_step"), steps, body.get("browser")))
    return _error(404, "not_found", "unknown path")
