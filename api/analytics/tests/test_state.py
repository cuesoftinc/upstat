import logging

from state import ValkeyState


class DownClient:
    async def get(self, key):
        raise ConnectionError("refused")

    async def set(self, key, value, ex=None):
        raise PermissionError("NOPERM")

    async def delete(self, key):
        raise TimeoutError()

    async def scan_iter(self, match=None, count=None):
        raise ConnectionError("refused")
        yield  # pragma: no cover


async def test_every_valkey_failure_names_its_error_kind(caplog):
    state = ValkeyState(DownClient(), "upstat:")
    with caplog.at_level(logging.WARNING, logger="state"):
        assert await state.get("monitor:m1") is None
        await state.put("cooldown:m1", {"at": 1})
        await state.delete("monitor:m1")
        assert await state.keys("monitor:") == []
    kinds = [(r.getMessage(), getattr(r, "error", None)) for r in caplog.records]
    assert kinds == [
        ("valkey read failed; treating as empty", "ConnectionError"),
        ("valkey write failed", "PermissionError"),
        ("valkey delete failed", "TimeoutError"),
        ("valkey scan failed", "ConnectionError"),
    ]
    assert [getattr(r, "key", None) for r in caplog.records[:2]] == ["monitor", "cooldown"]
