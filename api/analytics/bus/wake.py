"""Wakes api/common after a result is sent for it (shared messaging
contract, "Scale to zero"): Cloud Run starts an instance only for an HTTP
request, so a data-free GET /health brings it up and its consumers then read
the result. Best-effort, debounced; common's URL is public, so no token."""

import asyncio
import logging
import time
from urllib.parse import urlparse

import httpx

log = logging.getLogger(__name__)

DEBOUNCE_SECONDS = 10.0


class Waker:
    def __init__(self, base_url: str, client: httpx.AsyncClient | None = None):
        self._base = base_url.rstrip("/")
        self._client = client or httpx.AsyncClient(timeout=30.0)
        self._last = 0.0
        self._tasks: set[asyncio.Task] = set()

    def soon(self, reason: str) -> None:
        """Wakes common in the background. No URL (compose, Helm): nothing to do."""
        if not self._base or time.monotonic() - self._last < DEBOUNCE_SECONDS:
            return
        self._last = time.monotonic()
        task = asyncio.create_task(self.now(reason))
        self._tasks.add(task)
        task.add_done_callback(self._tasks.discard)

    async def now(self, reason: str) -> bool:
        target = urlparse(self._base).netloc or self._base
        try:
            response = await self._client.get(f"{self._base}/health")
            response.raise_for_status()
        except httpx.HTTPError as exc:
            self._last = 0.0
            log.warning("wake failed", extra={"target": target, "reason": reason, "error": type(exc).__name__})
            return False
        log.info("woke service", extra={"target": target, "reason": reason})
        return True

    async def aclose(self) -> None:
        for task in list(self._tasks):
            task.cancel()
        await self._client.aclose()
