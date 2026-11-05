import pytest

from model.insight import Insight
from service import groq_renderer

INSIGHT = Insight("m", "Homepage", 40, False, "medium", "latency is rising", "monitor closely")


class Response:
    def raise_for_status(self):
        return None

    def json(self):
        return {"output_text": "The service is slow."}


def test_the_key_is_read_when_called_not_at_import(monkeypatch):
    monkeypatch.delenv("GROQ_API_KEY", raising=False)
    with pytest.raises(OSError):
        groq_renderer.render_insight_narrative(INSIGHT)
    seen = {}

    def post(url, headers, json, timeout):
        seen["auth"] = headers["Authorization"]
        return Response()

    monkeypatch.setattr(groq_renderer.requests, "post", post)
    monkeypatch.setenv("GROQ_API_KEY", "set-after-import")
    assert groq_renderer.render_insight_narrative(INSIGHT) == "The service is slow."
    assert seen["auth"] == "Bearer set-after-import"
    groq_renderer.render_insight_narrative(INSIGHT, api_key="from-settings")
    assert seen["auth"] == "Bearer from-settings"
