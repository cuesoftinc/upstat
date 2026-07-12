import json
import logging
import os
from typing import Any

import requests
from models.insight import Insight

logger = logging.getLogger(__name__)

GROQ_API_BASE_URL = os.getenv("GROQ_API_BASE_URL", "https://api.groq.com/openai/v1/responses")
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
GROQ_MODEL = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")
GROQ_TIMEOUT_SECONDS = int(os.getenv("GROQ_TIMEOUT_SECONDS", "12"))

print('LLM Renderer initiated')

def _build_prompt(insight: Insight):
    return [
        {
            "role": "system",
            "content": (
                "You are a monitoring report generator. "
                "Your work has nothing to do with computer monitors, the output devices; never mention them\n\n"

                "CRITICAL RULES:\n"
                "- Refer to the monitored system ONLY as 'The service'.\n"
                "- NEVER mention the monitor name.\n"
                "- NEVER mention the monitor ID.\n"
                "- NEVER use any proper names.\n"
                "- NEVER use phrases like 'this monitor', 'the monitor', "
                "'the system', 'The Server Monitor', 'the application', 'the platform', or "
                "'the infrastructure'. Only use 'this service'.\n"
                "- ALWAYS use the exact phrase 'The service' when referring "
                "to the monitored entity.\n"
                "- Return exactly one short paragraph.\n"
                "- Do not include headings.\n"
                "- Do not include bullet points.\n"
                "- Do not include markdown.\n"
                "- Do not include reasoning.\n"
                "- Do not include analysis.\n"
                "- Do not include planning.\n"
                "- Do not explain your answer.\n"
                "- Output only the final report text."
            ),
        },
        {
            "role": "user",
            "content": (
                f"Risk score: {insight.risk_score}\n"
                f"Severity: {insight.severity}\n"
                f"Anomaly detected: {'yes' if insight.anomaly_detected else 'no'}\n"
                f"Summary: {insight.summary}\n"
                f"Recommended action: {insight.recommended_action}"
            ),
        },
    ]

# def _sanitize_output(text: str) -> str:
#     bad_prefixes = [
#         "we need to",
#         "i need to",
#         "let me",
#         "reasoning:",
#         "analysis:",
#         "thought:",
#         "plan:",
#     ]

#     lower = text.lower()

#     for prefix in bad_prefixes:
#         idx = lower.find(prefix)
#         if idx == 0:
#             split = text.rfind(".")
#             if split != -1:
#                 sentences = text.split(".")
#                 return ".".join(sentences[-2:]).strip()

#     return text.strip()

def _extract_text(response_json: dict[str, Any]) -> str:
    if not response_json:
        return ""

    if "output" in response_json and isinstance(response_json["output"], list):
        message_text = _extract_message_output_text(response_json["output"])
        if message_text:
            return message_text

    if "output_text" in response_json and isinstance(response_json["output_text"], str):
        return response_json["output_text"]

    if "choices" in response_json and isinstance(response_json["choices"], list):
        for choice in response_json["choices"]:
            if isinstance(choice, dict):
                if "message" in choice and isinstance(choice["message"], dict):
                    content = choice["message"].get("content")
                    if isinstance(content, str):
                        return content
                if "text" in choice and isinstance(choice["text"], str):
                    return choice["text"]
    return ""


def _extract_message_output_text(output: list[Any]) -> str:
    parts = []
    for item in output:
        if not isinstance(item, dict):
            continue

        item_type = item.get("type")
        role = item.get("role")
        if item_type != "message" and role != "assistant":
            continue

        content = item.get("content")
        if isinstance(content, str):
            parts.append(content)
        elif isinstance(content, list):
            parts.extend(_extract_output_text_parts(content))

        text = item.get("text")
        if isinstance(text, str):
            parts.append(text)

    return "".join(parts).strip()


def _extract_output_text_parts(content: list[Any]) -> list[str]:
    parts = []
    for part in content:
        if isinstance(part, str):
            parts.append(part)
        elif isinstance(part, dict):
            part_type = part.get("type")
            if part_type not in {"output_text", "text", "message_text", None}:
                continue

            text = part.get("text")
            if isinstance(text, str):
                parts.append(text)
    return parts


def render_insight_narrative(insight: Insight) -> str:
    if not GROQ_API_KEY:
        raise EnvironmentError("GROQ_API_KEY is not configured")

    prompt = _build_prompt(insight)
    payload = {
        "model": GROQ_MODEL,
        "input": prompt,
        "max_output_tokens": 200,
    }
    headers = {
        "Authorization": f"Bearer {GROQ_API_KEY}",
        "Content-Type": "application/json",
    }

    try:
        response = requests.post(
            GROQ_API_BASE_URL,
            headers=headers,
            json=payload,
            timeout=GROQ_TIMEOUT_SECONDS,
        )
        response.raise_for_status()
        result = response.json()
        text = _extract_text(result).strip()
        if not text:
            raise ValueError("Groq response did not contain readable text")
        return text
    except Exception as exc:
        logger.error("Groq narrative generation failed: %s", exc)
        raise
