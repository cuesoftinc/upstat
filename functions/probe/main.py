"""The probe: one Cloud Run function per region (S-5, S-12), called only by
api/common with a Cloud Run IAM identity token (§7.1). It holds no secrets
and no IAM roles, and has no VPC connector, so even an SSRF bypass reaches
nothing internal (§8). Self-host runs the same code as a container with
functions-framework; there INTERNAL_TOKEN guards it instead.

  Auth: INTERNAL_TOKEN in X-Internal-Token, or on Cloud Run a Google ID
  token for PROBE_AUDIENCE from one of PROBE_INVOKERS (comma separated).
  With neither configured on Cloud Run every call is refused.

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


def verify_google_token(token: str, audience: str) -> dict:
    import google.auth.transport.requests
    import google.oauth2.id_token

    return google.oauth2.id_token.verify_oauth2_token(token, google.auth.transport.requests.Request(), audience)


def _authorized(request, verify=None) -> bool:
    token = os.environ.get("INTERNAL_TOKEN", "")
    if token and hmac.compare_digest(request.headers.get("X-Internal-Token", "").encode(), token.encode()):
        return True
    if not os.environ.get("K_SERVICE"):
        return not token  # self-host with no token configured stays open, as before
    audience = os.environ.get("PROBE_AUDIENCE", "").rstrip("/")
    invokers = {i.strip() for i in os.environ.get("PROBE_INVOKERS", "").split(",") if i.strip()}
    scheme, _, bearer = request.headers.get("Authorization", "").partition(" ")
    if not audience or not invokers or scheme.lower() != "bearer" or not bearer.strip():
        return False
    try:
        claims = (verify or verify_google_token)(bearer.strip(), audience)
    except Exception:
        return False
    return bool(claims.get("email_verified")) and claims.get("email") in invokers


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
        if not isinstance(target, str) or not isinstance(timeout, int) or isinstance(timeout, bool) or not 1 <= timeout <= 60:
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
        if not all(isinstance(step, dict) for step in steps):
            return _error(400, "bad_shape", "each step must be an object")
        kind, browser = body.get("kind", "multi_step"), body.get("browser")
        if not isinstance(kind, str) or not (browser is None or isinstance(browser, dict)):
            return _error(400, "bad_shape", "kind is a string and browser an object")
        return _json(run(kind, steps, browser))
    return _error(404, "not_found", "unknown path")
