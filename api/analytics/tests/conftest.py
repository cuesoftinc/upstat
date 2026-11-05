import json
import os
from pathlib import Path

import pytest

from config_cache import ConfigCache
from contract import Contract
from state import MemoryState
from storage import MemoryStore

CONTRACT_DIR = Path(os.environ.get("CONTRACT_DIR", Path(__file__).resolve().parents[2] / "common" / "contract"))
ORG = "11111111-1111-4111-8111-111111111111"
MON = "5c2a9d1e-3b4f-4a6c-8d7e-9f0a1b2c3d4e"


@pytest.fixture
def contract():
    return Contract(CONTRACT_DIR)


def example(name: str) -> dict:
    return json.loads((CONTRACT_DIR / "examples" / f"{name}.json").read_text())


class Clock:
    def __init__(self, t: float = 1_800_000_000.0):
        self.t = t

    def __call__(self) -> float:
        return self.t


class Published:
    """Captures publish(event, key, data, request_id), validating each."""

    def __init__(self, contract: Contract):
        self.contract = contract
        self.messages: list[tuple[str, str, dict, str | None]] = []

    async def __call__(self, event, key, data, request_id):
        self.contract.validate_data(event, data)
        self.messages.append((event, key, data, request_id))

    def of(self, event):
        return [m[2] for m in self.messages if m[0] == event]


@pytest.fixture
def published(contract):
    return Published(contract)


@pytest.fixture
def clock():
    return Clock()


@pytest.fixture
def config():
    c = ConfigCache(MemoryStore(), "upstat/test")
    c.monitors = {MON: {"id": MON, "org_id": ORG, "name": "Homepage", "target": "https://example.com", "interval_s": 60, "timeout_s": 10,
                        "failure_threshold": 3, "regions": [], "min_failing_regions": 2, "active": True, "muted": False, "status": "pending",
                        "consecutive_failures": 0, "last_transition_seq": 0}}
    return c


@pytest.fixture
def state():
    return MemoryState()
