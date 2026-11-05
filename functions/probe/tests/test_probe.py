import http.server
import importlib
import json
import socket
import threading
import time

import pycurl
import pytest

from probe import ssrf
from probe.check import check
from probe.run import run


class Handler(http.server.BaseHTTPRequestHandler):
    def log_message(self, *args):
        pass

    def do_GET(self):
        routes = {
            "/ok": (200, {}, b'{"status":"healthy"}'),
            "/fail": (503, {}, b"down"),
            "/missing": (404, {}, b"nope"),
            "/redirect": (302, {"Location": "/ok"}, b""),
            "/loop": (302, {"Location": "/loop"}, b""),
        }
        if self.path == "/slow":
            time.sleep(3)
            routes["/slow"] = (200, {}, b"late")
        status, headers, body = routes.get(self.path, (404, {}, b""))
        self.send_response(status)
        for k, v in headers.items():
            self.send_header(k, v)
        self.send_header("X-Version", "7")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


@pytest.fixture(scope="module")
def server():
    srv = http.server.ThreadingHTTPServer(("127.0.0.1", 0), Handler)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    yield f"http://127.0.0.1:{srv.server_address[1]}"
    srv.shutdown()


@pytest.fixture
def private(monkeypatch):
    monkeypatch.setenv("PROBE_ALLOW_PRIVATE", "true")


@pytest.mark.parametrize("ip", ["127.0.0.1", "10.1.2.3", "192.168.0.1", "172.16.0.1", "169.254.1.1", "100.64.0.1", "::1", "fd00::1",
                                "0.0.0.0", "::ffff:10.0.0.1", "64:ff9b::808:808", "64:ff9b::7f00:1"])
def test_private_addresses_are_refused(ip, monkeypatch):
    monkeypatch.delenv("PROBE_ALLOW_PRIVATE", raising=False)
    assert not ssrf.address_allowed(ip)


def test_public_addresses_pass(monkeypatch):
    monkeypatch.delenv("PROBE_ALLOW_PRIVATE", raising=False)
    assert ssrf.address_allowed("8.8.8.8")
    assert ssrf.address_allowed("2606:4700:4700::1111")


def test_metadata_is_refused_even_in_self_host(private):
    assert not ssrf.address_allowed("169.254.169.254")


def test_check_refuses_a_loopback_target_in_cloud(server, monkeypatch):
    monkeypatch.delenv("PROBE_ALLOW_PRIVATE", raising=False)
    r = check(server + "/ok", 5)
    assert r == {**r, "ok": False, "cause": "blocked", "status_code": 0}


def test_credentials_in_urls_are_blocked():
    with pytest.raises(ssrf.Blocked):
        ssrf.resolve("http://user:pass@example.com/")


def test_passing_check_has_timings(server, private):
    r = check(server + "/ok", 5)
    assert r["ok"] and r["status_code"] == 200 and r["cause"] == ""
    assert r["total_ms"] >= r["ttfb_ms"] >= 0 and r["cert_not_after"] is None


@pytest.mark.parametrize("path,cause,status", [("/fail", "http_5xx", 503), ("/missing", "http_4xx", 404), ("/loop", "too_many_redirects", 302)])
def test_failure_causes(server, private, path, cause, status):
    r = check(server + path, 5)
    assert not r["ok"] and r["cause"] == cause and r["status_code"] == status


def test_redirects_are_followed(server, private):
    r = check(server + "/redirect", 5)
    assert r["ok"] and r["status_code"] == 200


def test_timeout(server, private):
    r = check(server + "/slow", 1)
    assert not r["ok"] and r["cause"] == "timeout" and r["total_ms"] < 2500


def test_refused(private):
    r = check("http://127.0.0.1:1/", 2)
    assert r["cause"] == "refused"


def test_unresolvable():
    r = check("http://name-that-does-not-exist.invalid/", 2)
    assert r["cause"] == "dns"


def test_multi_step_run_stops_at_the_first_failure(server, private):
    steps = [
        {"kind": "http", "method": "GET", "url": server + "/ok", "summary": "GET /ok"},
        {"kind": "assertion", "expression": "status == 200", "summary": "status == 200"},
        {"kind": "assertion", "expression": 'body contains "healthy"', "summary": "body"},
        {"kind": "assertion", "expression": "header.X-Version == 7", "summary": "header"},
        {"kind": "wait", "wait_ms": 10, "summary": "wait 10 ms"},
        {"kind": "assertion", "expression": "status == 201", "summary": "status == 201"},
        {"kind": "http", "method": "GET", "url": server + "/ok", "summary": "never runs"},
    ]
    out = run("multi_step", steps, None)
    assert [s["status"] for s in out["steps"]] == ["pass", "pass", "pass", "pass", "pass", "fail"]


def test_browser_checks_fail_honestly():
    out = run("browser", [], {"url": "https://example.com", "viewport": "1440x900", "screenshot_on_failure": True})
    assert out["steps"][0]["status"] == "fail"


def test_http_entrypoint(server, private, monkeypatch):
    import flask

    import main

    monkeypatch.setenv("INTERNAL_TOKEN", "secret")
    app = flask.Flask(__name__)
    with app.test_request_context("/check", method="POST", json={"job_id": "j", "target": server + "/ok", "timeout_s": 5},
                                  headers={"X-Internal-Token": "secret"}):
        body, status, _ = main.probe(flask.request)
        assert status == 200 and json.loads(body)["ok"]
    with app.test_request_context("/check", method="POST", json={"target": server + "/ok", "timeout_s": 5}):
        _, status, _ = main.probe(flask.request)
        assert status == 401


def _dns(monkeypatch, answers: dict[str, str]):
    real = socket.getaddrinfo

    def fake(host, port, *args, **kwargs):
        if host in answers:
            return [(socket.AF_INET, socket.SOCK_STREAM, 6, "", (answers[host], port))]
        return real(host, port, *args, **kwargs)

    monkeypatch.setattr(ssrf.socket, "getaddrinfo", fake)


@pytest.mark.parametrize(
    ("location", "self_host"),
    [("http://169.254.169.254/latest/meta-data/", False), ("http://169.254.169.254/latest/meta-data/", True), ("http://internal.example/", False),
     ("http://[::1]/", False), ("http://[64:ff9b::a00:1]/", False)],
)
def test_a_redirect_from_a_public_host_to_an_internal_one_is_refused(monkeypatch, location, self_host):
    if self_host:
        monkeypatch.setenv("PROBE_ALLOW_PRIVATE", "true")
    else:
        monkeypatch.delenv("PROBE_ALLOW_PRIVATE", raising=False)
    _dns(monkeypatch, {"public.example": "93.184.216.34", "internal.example": "10.0.0.5"})
    connected = []

    def one(url, host, port, ip, method, timeout_s):
        connected.append((url, ip))
        return 302, {"location": location}, b"", None, pycurl.Curl()

    monkeypatch.setattr(importlib.import_module("probe.check"), "_one", one)
    r = check("http://public.example/start", 5)
    assert r["cause"] == "blocked" and not r["ok"]
    assert connected == [("http://public.example/start", "93.184.216.34")]


def test_environment_proxies_are_ignored(server, private, monkeypatch):
    for name in ("http_proxy", "https_proxy", "all_proxy"):
        monkeypatch.setenv(name, "http://127.0.0.1:9")
    for name in ("no_proxy", "NO_PROXY"):
        monkeypatch.delenv(name, raising=False)
    r = check(server + "/ok", 5)
    assert r["ok"] and r["status_code"] == 200


def test_a_slow_resolver_cannot_exceed_the_timeout(monkeypatch):
    monkeypatch.delenv("PROBE_ALLOW_PRIVATE", raising=False)

    def slow(*args, **kwargs):
        time.sleep(3)
        return []

    monkeypatch.setattr(ssrf.socket, "getaddrinfo", slow)
    started = time.monotonic()
    r = check("http://slow-dns.example/", 1)
    assert r["cause"] == "timeout" and time.monotonic() - started < 2


def _call(path, body, headers=None):
    import flask

    import main

    with flask.Flask(__name__).test_request_context(path, method="POST", json=body, headers=headers or {}):
        out, status, _ = main.probe(flask.request)
        return status, json.loads(out)


def test_a_non_object_step_is_a_400(monkeypatch):
    monkeypatch.delenv("K_SERVICE", raising=False)
    monkeypatch.delenv("INTERNAL_TOKEN", raising=False)
    status, body = _call("/run", {"kind": "multi_step", "steps": ["GET /"]})
    assert status == 400 and body["error"]["code"] == "bad_shape"
    assert _call("/run", {"steps": [{"kind": "wait", "wait_ms": "x"}]})[0] == 200
    assert _call("/run", {"steps": [{"kind": "http", "url": 5}]})[0] == 200


def test_a_non_ascii_token_is_a_401(monkeypatch):
    monkeypatch.delenv("K_SERVICE", raising=False)
    monkeypatch.setenv("INTERNAL_TOKEN", "secret")
    assert _call("/check", {"target": "http://x.example/", "timeout_s": 1}, {"X-Internal-Token": "sécret"})[0] == 401


def test_cloud_run_refuses_callers_when_no_auth_is_configured(monkeypatch):
    monkeypatch.setenv("K_SERVICE", "upstat-probe")
    for name in ("INTERNAL_TOKEN", "PROBE_AUDIENCE", "PROBE_INVOKERS"):
        monkeypatch.delenv(name, raising=False)
    assert _call("/check", {"target": "http://x.example/", "timeout_s": 1})[0] == 401
    assert _call("/check", {"target": "http://x.example/", "timeout_s": 1}, {"Authorization": "Bearer anything"})[0] == 401


def test_cloud_run_accepts_the_invoker_identity_token(server, private, monkeypatch):
    import main

    monkeypatch.setenv("K_SERVICE", "upstat-probe")
    monkeypatch.delenv("INTERNAL_TOKEN", raising=False)
    monkeypatch.setenv("PROBE_AUDIENCE", "https://probe.example/")
    monkeypatch.setenv("PROBE_INVOKERS", "common@p.iam.gserviceaccount.com, other@p.iam.gserviceaccount.com")
    seen = []

    def verify(token, audience):
        seen.append(audience)
        if token != "good":
            raise ValueError("bad token")
        return {"email_verified": True, "email": "common@p.iam.gserviceaccount.com"}

    monkeypatch.setattr(main, "verify_google_token", verify)
    body = {"target": server + "/ok", "timeout_s": 5}
    assert _call("/check", body, {"Authorization": "Bearer good"})[0] == 200
    assert _call("/check", body, {"Authorization": "Bearer forged"})[0] == 401
    assert seen == ["https://probe.example", "https://probe.example"]
