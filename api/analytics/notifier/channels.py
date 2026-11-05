"""Delivery to one channel (flows/alert.md §1, §3-§4): signed webhooks and
Brevo email. One attempt per call, bounded by an overall deadline; the
notifier owns the 1 s / 5 s / 25 s retry ladder and runs it across passes so
a slow tenant endpoint never holds a consumer lane. Never log a webhook URL
or a secret (never-log list).

A webhook target is resolved once, every answer must be public, and the
request connects to that vetted address (Host and SNI keep the name), so a
second lookup cannot rebind it. Redirects are never followed.
"""

import asyncio
import hashlib
import hmac
import html
import ipaddress
import json
import logging
import socket
import time
from collections.abc import Callable
from dataclasses import dataclass
from urllib.parse import urlsplit

import httpx

log = logging.getLogger(__name__)

LADDER = (1, 5, 25)
DEADLINE_SECONDS = 10.0
_CGNAT = ipaddress.ip_network("100.64.0.0/10")
_NAT64 = ipaddress.ip_network("64:ff9b::/96")

Resolver = Callable[[str, int], list[str]]


@dataclass
class Outcome:
    delivered: bool
    attempts: int
    error: str = ""
    retry: bool = True  # false when another attempt cannot succeed


def sign(secret: str, body: bytes) -> str:
    """X-Upstat-Signature: hex(hmac-sha256(secret, body)), the documented recipe."""
    return hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()


def address_allowed(ip: str) -> bool:
    try:
        addr = ipaddress.ip_address(ip.split("%", 1)[0])
    except ValueError:
        return False
    if isinstance(addr, ipaddress.IPv6Address) and addr.ipv4_mapped:
        addr = addr.ipv4_mapped
    return not (
        addr.is_private
        or addr.is_loopback
        or addr.is_link_local
        or addr.is_reserved
        or addr.is_multicast
        or addr.is_unspecified
        or addr in _CGNAT
        or (addr.version == 6 and addr in _NAT64)
    )


def lookup(host: str, port: int) -> list[str]:
    infos = socket.getaddrinfo(host, port, type=socket.SOCK_STREAM)
    return list(dict.fromkeys(info[4][0] for info in infos))


@dataclass
class Pinned:
    url: str
    headers: dict[str, str]
    extensions: dict


def pin(target: str, ips: list[str]) -> Pinned:
    """The request to send for target, connecting to ips[0] and keeping the name."""
    parts = urlsplit(target)
    host = parts.hostname or ""
    ip = ips[0]
    shown = f"[{ip}]" if ":" in ip else ip
    named = f"[{host}]" if ":" in host else host
    port = f":{parts.port}" if parts.port else ""
    return Pinned(parts._replace(netloc=shown + port).geturl(), {"Host": named + port}, {"sni_hostname": host})


class Sender:
    def __init__(self, brevo_api_key: str = "", from_email: str = "", from_name: str = "Upstat", allow_private: bool = False,
                 client: httpx.AsyncClient | None = None, resolver: Resolver = lookup, deadline: float = DEADLINE_SECONDS):
        self._client = client or httpx.AsyncClient(timeout=DEADLINE_SECONDS, follow_redirects=False)
        self._brevo_key = brevo_api_key
        self._sender = {"email": from_email, "name": from_name}
        self._allow_private = allow_private
        self._resolver = resolver
        self._deadline = deadline

    async def deliver(self, channel: dict, delivery_id: str, payload: dict, subject: str, text: str) -> Outcome:
        """One attempt, finished or abandoned within the deadline."""
        try:
            async with asyncio.timeout(self._deadline):
                if channel["kind"] == "webhook":
                    ok, error = await self._webhook(channel, delivery_id, payload)
                else:
                    ok, error = await self._email(channel["target"], subject, text)
        except (httpx.HTTPError, OSError) as exc:  # a deadline is a TimeoutError, an OSError
            ok, error = False, "timeout" if isinstance(exc, TimeoutError) else type(exc).__name__
        if ok:
            return Outcome(True, 1)
        log.warning("delivery attempt failed", extra={"channel_id": channel["id"], "kind": channel["kind"], "error": error})
        return Outcome(False, 1, error, retry=error not in ("blocked", "email is not configured"))

    async def _vet(self, target: str) -> Pinned | None:
        """The pinned request for target, or None when it may not be reached."""
        parts = urlsplit(target)
        if parts.scheme not in ("http", "https") or not parts.hostname or parts.username or parts.password:
            return None
        port = parts.port or (443 if parts.scheme == "https" else 80)
        try:
            ips = await asyncio.to_thread(self._resolver, parts.hostname, port)
        except (OSError, UnicodeError):
            return None
        if not ips or not all(address_allowed(ip) for ip in ips):
            return None
        return pin(target, ips)

    async def _webhook(self, channel: dict, delivery_id: str, payload: dict) -> tuple[bool, str]:
        target, headers, extensions = channel["target"], {}, {}
        if not self._allow_private:
            pinned = await self._vet(target)
            if pinned is None:
                return False, "blocked"
            target, headers, extensions = pinned.url, pinned.headers, pinned.extensions
        body = json.dumps(payload, separators=(",", ":")).encode()
        headers = {
            **headers,
            "Content-Type": "application/json",
            "User-Agent": "Upstat-Webhook/1",
            "X-Upstat-Delivery-Id": delivery_id,
            "X-Upstat-Timestamp": str(int(time.time())),
            "X-Upstat-Signature": sign(channel.get("secret", ""), body),
        }
        request = self._client.build_request("POST", target, content=body, headers=headers, extensions=extensions)
        response = await self._client.send(request, stream=True, follow_redirects=False)
        await response.aclose()  # the body is never read
        return 200 <= response.status_code < 300, f"status {response.status_code}"

    async def _email(self, to: str, subject: str, text: str) -> tuple[bool, str]:
        if not self._brevo_key:
            return False, "email is not configured"
        body = {"sender": self._sender, "to": [{"email": to}], "subject": subject, "textContent": text,
                "htmlContent": "<p>" + html.escape(text).replace("\n", "<br>") + "</p>"}
        response = await self._client.post("https://api.brevo.com/v3/smtp/email", json=body,
                                           headers={"api-key": self._brevo_key, "Accept": "application/json"})
        return response.status_code < 300, f"status {response.status_code}"

    async def aclose(self) -> None:
        await self._client.aclose()
