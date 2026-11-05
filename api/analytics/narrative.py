"""The insight narrative (U-8, X-4): Vertex AI (Gemini) through Application
Default Credentials in cloud, no vendor keys; a BYO Groq or Gemini key for
self-host; a plain sentence when neither is configured. A failed call falls
back to the sentence: an insight is never lost to its narrative.
"""

import asyncio
import logging

import httpx

from model.insight import Insight
from service.groq_renderer import _build_prompt, render_insight_narrative

log = logging.getLogger(__name__)


def template(insight: Insight) -> str:
    return f"The service shows {insight.severity} risk ({insight.risk_score}/100): {insight.summary}. Suggested next step: {insight.recommended_action}."


def _gemini_body(insight: Insight) -> dict:
    system, user = _build_prompt(insight)
    return {
        "systemInstruction": {"parts": [{"text": system["content"]}]},
        "contents": [{"role": "user", "parts": [{"text": user["content"]}]}],
        "generationConfig": {"maxOutputTokens": 200, "temperature": 0.2},
    }


def _gemini_text(body: dict) -> str:
    for candidate in body.get("candidates") or []:
        parts = (candidate.get("content") or {}).get("parts") or []
        text = "".join(p.get("text", "") for p in parts).strip()
        if text:
            return text
    return ""


class Narrator:
    def __init__(self, settings, client: httpx.AsyncClient | None = None):
        self._s = settings
        self._client = client or httpx.AsyncClient(timeout=15.0)

    @property
    def provider(self) -> str:
        if self._s.google_cloud_project:
            return "vertex"
        if self._s.groq_api_key:
            return "groq"
        if self._s.gemini_api_key:
            return "gemini"
        return "template"

    async def render(self, insight: Insight) -> str:
        try:
            if self.provider == "vertex":
                text = await self._vertex(insight)
            elif self.provider == "groq":
                text = await asyncio.to_thread(render_insight_narrative, insight, self._s.groq_api_key)
            elif self.provider == "gemini":
                text = await self._gemini_key(insight)
            else:
                return template(insight)
            return text or template(insight)
        except Exception as exc:
            log.warning("narrative failed; using the template", extra={"provider": self.provider, "error": type(exc).__name__})
            return template(insight)

    async def _vertex(self, insight: Insight) -> str:
        import google.auth
        import google.auth.transport.requests

        creds, _ = google.auth.default(scopes=["https://www.googleapis.com/auth/cloud-platform"])
        await asyncio.to_thread(creds.refresh, google.auth.transport.requests.Request())
        loc, project, model = self._s.vertex_location, self._s.google_cloud_project, self._s.vertex_model
        url = f"https://{loc}-aiplatform.googleapis.com/v1/projects/{project}/locations/{loc}/publishers/google/models/{model}:generateContent"
        response = await self._client.post(url, json=_gemini_body(insight), headers={"Authorization": f"Bearer {creds.token}"})
        response.raise_for_status()
        return _gemini_text(response.json())

    async def _gemini_key(self, insight: Insight) -> str:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{self._s.vertex_model}:generateContent"
        response = await self._client.post(url, json=_gemini_body(insight), headers={"x-goog-api-key": self._s.gemini_api_key})
        response.raise_for_status()
        return _gemini_text(response.json())

    async def aclose(self) -> None:
        await self._client.aclose()
