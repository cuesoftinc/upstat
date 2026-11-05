import asyncio
import json
import time

import httpx
import pytest

from notifier.channels import Sender, address_allowed, sign

CH = {"id": "9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d", "kind": "webhook", "target": "https://hooks.example.com/x", "secret": "k"}
PUBLIC = "93.184.216.34"


class Resolver:
    """Answers per call (the last answer repeats) and counts the lookups."""

    def __init__(self, *answers):
        self.answers = answers
        self.calls = []

    def __call__(self, host, port):
        self.calls.append((host, port))
        return list(self.answers[min(len(self.calls), len(self.answers)) - 1])


def sender(handler, resolver, **kwargs):
    return Sender(client=httpx.AsyncClient(transport=httpx.MockTransport(handler)), resolver=resolver, **kwargs)


@pytest.mark.parametrize("ip", ["10.0.0.1", "127.0.0.1", "169.254.169.254", "100.64.0.1", "100.127.255.254", "224.0.0.1", "0.0.0.0", "::1", "fe80::1",
                                "fd00::1", "64:ff9b::808:808", "::ffff:10.0.0.1", "240.0.0.1"])
def test_internal_addresses_are_not_allowed(ip):
    assert not address_allowed(ip)


def test_public_addresses_are_allowed():
    assert address_allowed(PUBLIC) and address_allowed("2606:4700:4700::1111")


async def test_a_webhook_connects_to_the_vetted_address_with_one_lookup():
    calls = []

    def handler(request: httpx.Request):
        calls.append(request)
        return httpx.Response(204)

    resolver = Resolver([PUBLIC], ["127.0.0.1"])  # a second lookup would rebind the name to loopback
    out = await sender(handler, resolver).deliver(CH, "d1", {"version": 1}, "s", "t")
    assert out.delivered and resolver.calls == [("hooks.example.com", 443)]
    [req] = calls
    assert req.url.host == PUBLIC and req.url.scheme == "https"
    assert req.headers["Host"] == "hooks.example.com" and req.extensions["sni_hostname"] == "hooks.example.com"
    assert req.headers["X-Upstat-Delivery-Id"] == "d1" and req.headers["X-Upstat-Signature"] == sign("k", req.content)
    assert json.loads(req.content) == {"version": 1}


@pytest.mark.parametrize(
    "answer",
    [["100.64.0.1"], ["64:ff9b::808:808"], ["10.0.0.1"], ["169.254.169.254"], ["::1"], ["0.0.0.0"], ["224.0.0.1"], [PUBLIC, "10.0.0.5"], []],
)
async def test_a_webhook_that_resolves_anywhere_internal_is_refused(answer):
    calls = []
    out = await sender(lambda r: calls.append(r) or httpx.Response(200), Resolver(answer)).deliver(CH, "d", {}, "s", "t")
    assert not out.delivered and out.error == "blocked" and out.retry is False and calls == []


@pytest.mark.parametrize("target", ["ftp://hooks.example.com/x", "https://user:pw@hooks.example.com/x", "https:///x"])
async def test_odd_targets_are_refused(target):
    out = await sender(lambda r: httpx.Response(200), Resolver([PUBLIC])).deliver({**CH, "target": target}, "d", {}, "s", "t")
    assert out.error == "blocked"


async def test_an_unresolvable_name_is_refused():
    def broken(host, port):
        raise OSError("no such host")

    out = await sender(lambda r: httpx.Response(200), broken).deliver(CH, "d", {}, "s", "t")
    assert out.error == "blocked"


async def test_redirects_are_not_followed():
    calls = []

    def handler(request: httpx.Request):
        calls.append(request)
        return httpx.Response(302, headers={"Location": "http://169.254.169.254/latest/meta-data/"})

    out = await sender(handler, Resolver([PUBLIC])).deliver(CH, "d", {}, "s", "t")
    assert not out.delivered and out.error == "status 302" and len(calls) == 1


async def test_a_slow_endpoint_is_cut_off_at_the_deadline():
    async def handler(request: httpx.Request):
        await asyncio.sleep(5)
        return httpx.Response(200)

    started = time.monotonic()
    out = await sender(handler, Resolver([PUBLIC]), deadline=0.2).deliver(CH, "d", {}, "s", "t")
    assert not out.delivered and out.error == "timeout" and out.attempts == 1 and out.retry
    assert time.monotonic() - started < 1


async def test_a_hanging_lookup_counts_against_the_deadline():
    def hang(host, port):
        time.sleep(1)
        return [PUBLIC]

    started = time.monotonic()
    out = await sender(lambda r: httpx.Response(200), hang, deadline=0.2).deliver(CH, "d", {}, "s", "t")
    assert out.error == "timeout" and time.monotonic() - started < 0.8


async def test_a_trickling_body_is_never_read():
    def handler(request: httpx.Request):
        return httpx.Response(200, content=b"x" * 1_000_000)

    assert (await sender(handler, Resolver([PUBLIC])).deliver(CH, "d", {}, "s", "t")).delivered


async def test_self_host_may_reach_private_targets():
    calls = []

    def handler(request: httpx.Request):
        calls.append(request)
        return httpx.Response(200)

    resolver = Resolver(["127.0.0.1"])
    out = await sender(handler, resolver, allow_private=True).deliver({**CH, "target": "http://localhost:8080/x"}, "d", {}, "s", "t")
    assert out.delivered and calls[0].url.host == "localhost" and resolver.calls == []


async def test_email_without_a_key_is_not_retried():
    out = await sender(lambda r: httpx.Response(200), Resolver([PUBLIC])).deliver({"id": "c", "kind": "email", "target": "a@b.c"}, "d", {}, "s", "t")
    assert not out.delivered and out.retry is False
