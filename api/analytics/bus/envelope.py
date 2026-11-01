"""The message envelope (api/common/contract/envelope.schema.json) and the
claim-check: every product can read the lanes, so every payload travels
through <prefix>/compute/ by reference; storage permissions keep it private."""

import json
import uuid
from datetime import UTC, datetime

from bus import TOPIC_FOR
from contract import Contract, ContractError
from storage import ObjectStore

# Producers send VERSION; consumers accept SUPPORTED_MAJOR only.
VERSION = "1.0"
SUPPORTED_MAJOR = "1"


def now_iso() -> str:
    return datetime.now(UTC).isoformat().replace("+00:00", "Z")


async def wrap(event: str, data: dict, contract: Contract, store: ObjectStore, prefix: str, request_id: str | None = None) -> dict:
    """Validates `data` for `event` and returns the envelope to send."""
    contract.validate_data(event, data)
    message_id = str(uuid.uuid4())
    envelope: dict = {"type": event, "version": VERSION, "id": message_id, "produced_at": now_iso()}
    if request_id:
        envelope["request_id"] = request_id
    body = json.dumps(data, separators=(",", ":")).encode()
    key = f"{prefix}/compute/{message_id}.json"
    await store.put(key, body, "application/json")
    envelope["data_ref"] = {"bucket": store.bucket, "key": key, "size": len(body), "content_type": "application/json"}
    contract.validate_envelope(envelope)
    return envelope


def event_of(value: object) -> str | None:
    """The event type of a raw message, read before any validation: other
    products' envelopes aren't ours to check."""
    if isinstance(value, dict) and isinstance(value.get("type"), str):
        return value["type"]
    return None


async def unwrap(topic: str, envelope: dict, contract: Contract, store: ObjectStore) -> tuple[str, dict, str | None]:
    """Validates the envelope, resolves a data_ref, validates the payload."""
    contract.validate_envelope(envelope)
    major = str(envelope["version"]).split(".", 1)[0]
    if major != SUPPORTED_MAJOR:
        raise ContractError(f"unsupported envelope version {envelope['version']}")
    event = envelope["type"]
    if TOPIC_FOR.get(event) != topic:
        raise ValueError(f"event {event} does not belong on topic {topic}")
    if "data_ref" in envelope:
        data = json.loads(await store.get(envelope["data_ref"]["key"]))
    else:
        data = envelope["data"]
    contract.validate_data(event, data)
    return event, data, envelope.get("request_id")
