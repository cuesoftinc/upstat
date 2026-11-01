import http.server
import json
import threading
import time

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
                                "0.0.0.0", "::ffff:10.0.0.1"])
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
