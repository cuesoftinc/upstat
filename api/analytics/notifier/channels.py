"""Delivery to one channel (flows/alert.md §1, §3-§4): signed webhooks and
Brevo email, each attempt with a 10 s timeout on a 1 s / 5 s / 25 s retry
ladder, then failed. Never log a webhook URL or a secret (never-log list).
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
from dataclasses import dataclass
from urllib.parse import urlsplit

import httpx

log = logging.getLogger(__name__)

LADDER = (1, 5, 25)
TIMEOUT_SECONDS = 10.0


@dataclass
class Outcome:
    delivered: bool
    attempts: int
    error: str = ""


def sign(secret: str, body: bytes) -> str:
    """X-Upstat-Signature: hex(hmac-sha256(secret, body)), the documented recipe."""
    return hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()


def _public(host: str) -> bool:
    try:
        infos = socket.getaddrinfo(host, 443, type=socket.SOCK_STREAM)
    except OSError:
        return False
    for info in infos:
        addr = ipaddress.ip_address(info[4][0])
        if addr.is_private or addr.is_loopback or addr.is_link_local or addr.is_reserved or addr.is_multicast or addr.is_unspecified:
            return False
    return True


class Sender:
    def __init__(self, brevo_api_key: str = "", from_email: str = "", from_name: str = "Upstat", allow_private: bool = False,
                 client: httpx.AsyncClient | None = None, ladder=LADDER, sleep=asyncio.sleep):
        self._client = client or httpx.AsyncClient(timeout=TIMEOUT_SECONDS, follow_redirects=False)
        self._brevo_key = brevo_api_key
        self._sender = {"email": from_email, "name": from_name}
        self._allow_private = allow_private
        self._ladder = ladder
        self._sleep = sleep

    async def deliver(self, channel: dict, delivery_id: str, payload: dict, subject: str, text: str) -> Outcome:
        attempt = 0
        error = ""
        for wait in (0, *self._ladder):
            if wait:
                await self._sleep(wait)
            attempt += 1
            try:
                if channel["kind"] == "webhook":
                    ok, error = await self._webhook(channel, delivery_id, payload)
                else:
                    ok, error = await self._email(channel["target"], subject, text)
            except httpx.HTTPError as exc:
                ok, error = False, type(exc).__name__
            if ok:
                return Outcome(True, attempt)
            if error == "blocked":
                break  # never retry a refused target
        log.warning("delivery failed", extra={"channel_id": channel["id"], "kind": channel["kind"], "attempts": attempt, "error": error})
        return Outcome(False, attempt, error)

    async def _webhook(self, channel: dict, delivery_id: str, payload: dict) -> tuple[bool, str]:
        host = urlsplit(channel["target"]).hostname or ""
        if not self._allow_private and not await asyncio.to_thread(_public, host):
            return False, "blocked"
        body = json.dumps(payload, separators=(",", ":")).encode()
        headers = {
            "Content-Type": "application/json",
            "User-Agent": "Upstat-Webhook/1",
            "X-Upstat-Delivery-Id": delivery_id,
            "X-Upstat-Timestamp": str(int(time.time())),
            "X-Upstat-Signature": sign(channel.get("secret", ""), body),
        }
        response = await self._client.post(channel["target"], content=body, headers=headers)
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
