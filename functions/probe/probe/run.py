"""Multi-step synthetic checks (pages.md B7, OBS-011): http steps, assertions
on the latest response, and waits, in order. The run stops at the first
failure; steps after it carry no result.

Browser checks need a headless browser, which this probe does not ship;
they report one failed step saying so instead of pretending to pass.
"""

import re
import time

from probe.check import fetch

STEP_TIMEOUT_S = 15
_ASSERTION = re.compile(r"^(status|body|header\.[A-Za-z0-9-]+|duration_ms)\s*(==|!=|<=|>=|<|>|contains)\s*(.+)$")


def _compare(actual, op: str, expected: str) -> bool:
    expected = expected.strip().strip('"')
    if op == "contains":
        return expected in str(actual)
    try:
        a, e = float(actual), float(expected)
    except (TypeError, ValueError):
        a, e = str(actual), expected
    return {"==": a == e, "!=": a != e, "<": a < e, "<=": a <= e, ">": a > e, ">=": a >= e}[op]


def assert_on(expression: str, last) -> bool:
    m = _ASSERTION.match(expression.strip())
    if not m or last is None:
        return False
    subject, op, expected = m.groups()
    if subject == "status":
        actual = last.status_code
    elif subject == "duration_ms":
        actual = last.total_ms
    elif subject == "body":
        actual = last.body.decode("utf-8", errors="replace")
    else:
        actual = last.headers.get(subject.split(".", 1)[1].lower(), "")
    return _compare(actual, op, expected)


def run(kind: str, steps: list[dict], browser: dict | None) -> dict:
    if kind == "browser":
        return {
            "steps": [{"index": 1, "kind": "http", "summary": f"open {(browser or {}).get('url', '')}", "status": "fail", "duration_ms": 0}],
            "screenshot_step": 0,
        }
    results = []
    last = None
    for i, step in enumerate(steps, start=1):
        started = time.monotonic()
        kind_ = step.get("kind")
        passed = False
        if kind_ == "http":
            last = fetch(step.get("url", ""), STEP_TIMEOUT_S, step.get("method", "GET"))
            passed = last.cause == "" and 0 < last.status_code < 400
        elif kind_ == "assertion":
            passed = assert_on(step.get("expression", ""), last)
        elif kind_ == "wait":
            time.sleep(min(max(int(step.get("wait_ms") or 0), 0), 30000) / 1000)
            passed = True
        duration = int((time.monotonic() - started) * 1000)
        results.append({"index": i, "kind": kind_, "summary": step.get("summary", ""), "status": "pass" if passed else "fail",
                        "duration_ms": duration})
        if not passed:
            break
    return {"steps": results, "screenshot_step": 0}
