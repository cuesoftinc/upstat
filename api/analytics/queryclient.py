"""api/query's internal surface (§6.5): analytics reads telemetry only
through it, with a Cloud Run ID token in cloud or INTERNAL_TOKEN elsewhere."""

import asyncio
import logging
from datetime import UTC, datetime, timedelta

import httpx

log = logging.getLogger(__name__)


def _iso(t: datetime) -> str:
    return t.astimezone(UTC).isoformat().replace("+00:00", "Z")


class QueryError(Exception):
    def __init__(self, status: int, code: str, message: str):
        super().__init__(f"{status} {code}: {message}")
        self.status, self.code = status, code


class QueryClient:
    def __init__(self, base_url: str, internal_token: str = "", client: httpx.AsyncClient | None = None, on_cloud_run: bool = False):
        self._base = base_url.rstrip("/")
        self._token = internal_token
        self._client = client or httpx.AsyncClient(timeout=30.0)
        self._cloud = on_cloud_run

    async def _headers(self) -> dict:
        headers = {"Content-Type": "application/json"}
        if self._token:
            headers["X-Internal-Token"] = self._token
        if self._cloud:
            import google.auth.transport.requests
            import google.oauth2.id_token

            token = await asyncio.to_thread(google.oauth2.id_token.fetch_id_token, google.auth.transport.requests.Request(), self._base)
            headers["Authorization"] = f"Bearer {token}"
        return headers

    async def _post(self, path: str, org_id: str, body: dict) -> dict:
        response = await self._client.post(f"{self._base}{path}", params={"org_id": org_id}, json=body, headers=await self._headers())
        return self._parse(response)

    async def _get(self, path: str, params: dict) -> dict:
        response = await self._client.get(f"{self._base}{path}", params=params, headers=await self._headers())
        return self._parse(response)

    @staticmethod
    def _parse(response: httpx.Response) -> dict:
        if response.status_code >= 300:
            try:
                err = response.json()["error"]
            except Exception:
                err = {"code": "internal", "message": response.text[:200]}
            raise QueryError(response.status_code, err.get("code", ""), err.get("message", ""))
        return response.json()

    async def query(self, org_id: str, q: str, window: timedelta, now: datetime, step: str | None = None, signal: str = "") -> dict:
        body = {"q": q, "from": _iso(now - window), "to": _iso(now)}
        if step:
            body["step"] = step
        if signal:
            body["signal"] = signal
        return await self._post("/internal/v1/query", org_id, body)

    async def history(self, org_id: str, monitor_id: str) -> dict:
        return await self._get(f"/internal/v1/monitors/{monitor_id}/history", {"org_id": org_id})

    async def aclose(self) -> None:
        await self._client.aclose()


def last_value(result: dict) -> float | None:
    """The newest non-null point of the first series, or None (no data)."""
    for series in result.get("series") or []:
        for point in reversed(series.get("points") or []):
            if point.get("value") is not None:
                return float(point["value"])
        break
    return None


def total(result: dict) -> float | None:
    """Sum of every point of the first series, or None when empty."""
    values = [p["value"] for s in (result.get("series") or [])[:1] for p in s.get("points") or [] if p.get("value") is not None]
    return float(sum(values)) if values else None
