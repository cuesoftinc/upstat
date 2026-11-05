"""The evaluator's and notifier's working state (§5.1): per-monitor state,
open ticks, cooldown stamps and flapping windows. It lives in the shared
Valkey (keys upstat:*) so any instance can pick up a monitor, and is
rebuildable from the monitors snapshot: losing it is survivable (§9.2).
Without Valkey (tests, a single local instance) it stays in memory.
"""

import json
import logging

log = logging.getLogger(__name__)

TTL_SECONDS = 7 * 24 * 3600


class MemoryState:
    def __init__(self):
        self._data: dict[str, str] = {}

    async def get(self, key: str) -> dict | None:
        raw = self._data.get(key)
        return json.loads(raw) if raw else None

    async def put(self, key: str, value: dict, ttl: int = TTL_SECONDS) -> None:
        self._data[key] = json.dumps(value)

    async def delete(self, key: str) -> None:
        self._data.pop(key, None)

    async def keys(self, prefix: str) -> list[str]:
        return [k for k in self._data if k.startswith(prefix)]

    async def aclose(self) -> None:
        return None


class ValkeyState:
    """The same interface on Valkey. Reads that fail act as empty and
    writes that fail are logged: the notifier then fails open (sends)."""

    def __init__(self, client, prefix: str):
        self._r = client
        self._p = prefix

    async def get(self, key: str) -> dict | None:
        try:
            raw = await self._r.get(self._p + key)
        except Exception:
            log.warning("valkey read failed; treating as empty", extra={"key": key.split(":", 1)[0]})
            return None
        return json.loads(raw) if raw else None

    async def put(self, key: str, value: dict, ttl: int = TTL_SECONDS) -> None:
        try:
            await self._r.set(self._p + key, json.dumps(value), ex=ttl)
        except Exception:
            log.warning("valkey write failed", extra={"key": key.split(":", 1)[0]})

    async def delete(self, key: str) -> None:
        try:
            await self._r.delete(self._p + key)
        except Exception:
            log.warning("valkey delete failed")

    async def keys(self, prefix: str) -> list[str]:
        try:
            return [k.decode().removeprefix(self._p) if isinstance(k, bytes) else k.removeprefix(self._p)
                    async for k in self._r.scan_iter(match=self._p + prefix + "*", count=500)]
        except Exception:
            log.warning("valkey scan failed")
            return []

    async def aclose(self) -> None:
        await self._r.aclose()


def from_settings(settings):
    if not settings.redis_host:
        return MemoryState()
    import redis.asyncio as redis

    client = redis.Redis(host=settings.redis_host, port=settings.redis_port, username=settings.redis_username or None,
                         password=settings.redis_password or None, db=settings.redis_db, ssl=settings.redis_tls,
                         socket_timeout=2, socket_connect_timeout=2)
    return ValkeyState(client, settings.redis_key_prefix + "analytics:")
