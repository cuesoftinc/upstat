"""One HTTP check (system-design.md §6.1): a single attempt, no retries (the
quorum and the failure threshold do the damping), redirects followed by
hand so each hop is re-validated, phase timings from libcurl and the
certificate's expiry for OBS-011.

A check passes iff a response arrives within the timeout with a status
below 400 (flows/monitor.md §2); causes follow §4.
"""

import time
from datetime import UTC, datetime
from io import BytesIO
from urllib.parse import urljoin

import pycurl

from probe import ssrf

MAX_REDIRECTS = 5
MAX_BODY = 1 << 20  # assertions read at most 1 MiB
USER_AGENT = "UpstatProbe/1.0 (+https://upstat.cuesoft.io)"

_TLS_ERRORS = {35, 51, 53, 54, 58, 59, 60, 64, 66, 77, 80, 82, 83, 90, 91}


def _cause_for(code: int) -> str:
    if code == pycurl.E_OPERATION_TIMEDOUT:
        return "timeout"
    if code in (pycurl.E_COULDNT_RESOLVE_HOST,):
        return "dns"
    if code == pycurl.E_COULDNT_CONNECT:
        return "refused"
    if code in _TLS_ERRORS:
        return "tls"
    return "error"


def _cert_not_after(c: pycurl.Curl) -> str | None:
    try:
        chain = c.getinfo(pycurl.INFO_CERTINFO)
    except pycurl.error:
        return None
    if not chain:
        return None
    for key, value in chain[0]:
        if key.lower() == "expire date":
            for fmt in ("%b %d %H:%M:%S %Y %Z", "%Y-%m-%d %H:%M:%S %Z"):
                try:
                    return datetime.strptime(value, fmt).replace(tzinfo=UTC).isoformat()
                except ValueError:
                    continue
    return None


class Response:
    def __init__(self):
        self.status_code = 0
        self.headers: dict[str, str] = {}
        self.body = b""
        self.cause = ""
        self.dns_ms = self.connect_ms = self.tls_ms = self.ttfb_ms = self.total_ms = 0.0
        self.cert_not_after: str | None = None


def fetch(url: str, timeout_s: float, method: str = "GET") -> Response:
    """Fetch url, following up to five redirects, within timeout_s overall."""
    out = Response()
    deadline = time.monotonic() + timeout_s
    started = time.monotonic()
    for hop in range(MAX_REDIRECTS + 1):
        remaining = deadline - time.monotonic()
        if remaining <= 0:
            out.cause = "timeout"
            break
        t0 = time.monotonic()
        try:
            host, port, ip = ssrf.resolve(url)
        except ssrf.Blocked:
            out.cause = "blocked"
            break
        except ssrf.Unresolvable:
            out.cause = "dns"
            break
        dns_ms = (time.monotonic() - t0) * 1000
        status, headers, body, err, c = _one(url, host, port, ip, method, remaining)
        if hop == 0:
            out.dns_ms = round(dns_ms, 2)
            out.connect_ms = round(c.getinfo(pycurl.CONNECT_TIME) * 1000, 2)
            appconnect = c.getinfo(pycurl.APPCONNECT_TIME) * 1000
            out.tls_ms = round(max(0.0, appconnect - out.connect_ms), 2) if appconnect else 0.0
            out.cert_not_after = _cert_not_after(c) if url.startswith("https") else None
        out.ttfb_ms = round(dns_ms + c.getinfo(pycurl.STARTTRANSFER_TIME) * 1000, 2)
        c.close()
        if err is not None:
            out.cause = _cause_for(err)
            break
        out.status_code, out.headers, out.body = status, headers, body
        location = headers.get("location")
        if 300 <= status < 400 and location:
            if hop == MAX_REDIRECTS:
                out.cause = "too_many_redirects"
                break
            url = urljoin(url, location)
            method = "GET" if status in (301, 302, 303) else method
            continue
        if status >= 500:
            out.cause = "http_5xx"
        elif status >= 400:
            out.cause = "http_4xx"
        break
    out.total_ms = round((time.monotonic() - started) * 1000, 2)
    return out


def _one(url, host, port, ip, method, timeout_s):
    buf = BytesIO()
    headers: dict[str, str] = {}

    def on_header(line: bytes):
        text = line.decode("iso-8859-1").strip()
        if ":" in text:
            k, v = text.split(":", 1)
            headers[k.strip().lower()] = v.strip()
        elif text.startswith("HTTP/"):
            headers.clear()  # a new response (after 100 Continue)

    def on_body(chunk: bytes):
        if buf.tell() < MAX_BODY:
            buf.write(chunk[: MAX_BODY - buf.tell()])

    c = pycurl.Curl()
    c.setopt(pycurl.URL, url)
    # Pin the connection to the address that passed the guard.
    c.setopt(pycurl.RESOLVE, [f"{host}:{port}:{ip if ':' not in ip else '[' + ip + ']'}"])
    c.setopt(pycurl.FOLLOWLOCATION, False)
    c.setopt(pycurl.TIMEOUT_MS, max(1, int(timeout_s * 1000)))
    c.setopt(pycurl.CONNECTTIMEOUT_MS, max(1, int(timeout_s * 1000)))
    c.setopt(pycurl.NOSIGNAL, 1)
    c.setopt(pycurl.USERAGENT, USER_AGENT)
    c.setopt(pycurl.PROTOCOLS, pycurl.PROTO_HTTP | pycurl.PROTO_HTTPS)
    c.setopt(pycurl.HEADERFUNCTION, on_header)
    c.setopt(pycurl.WRITEFUNCTION, on_body)
    c.setopt(pycurl.OPT_CERTINFO, 1)
    if method == "HEAD":
        c.setopt(pycurl.NOBODY, 1)
    elif method == "POST":
        c.setopt(pycurl.POST, 1)
        c.setopt(pycurl.POSTFIELDS, "")
    err = None
    try:
        c.perform()
    except pycurl.error as e:
        err = e.args[0]
    status = c.getinfo(pycurl.RESPONSE_CODE) if err is None else 0
    return status, headers, buf.getvalue(), err, c


def check(target: str, timeout_s: int) -> dict:
    """The /check answer common relays as upstat.synthetics.result."""
    r = fetch(target, float(timeout_s))
    ok = r.cause == "" and 0 < r.status_code < 400
    return {
        "ok": ok,
        "cause": "" if ok else (r.cause or "error"),
        "status_code": r.status_code,
        "dns_ms": r.dns_ms,
        "connect_ms": r.connect_ms,
        "tls_ms": r.tls_ms,
        "ttfb_ms": r.ttfb_ms,
        "total_ms": r.total_ms,
        "cert_not_after": r.cert_not_after,
    }
