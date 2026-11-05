"""Shared messaging rules 8 and 10: one handling per envelope id; a message that
keeps failing is parked and handled again later, then recorded as failed."""

import bus
from bus import envelope
from bus.kafka import REDRIVE_SECONDS, Dispatcher
from state import MemoryState
from storage import MemoryStore
from tests.conftest import Clock, example


def dispatcher(handler, contract, store, state, clock=None):
    return Dispatcher({bus.CONFIG_CHANGED: handler}, contract, store, state, attempts=3, backoff=0, clock=clock or Clock())


async def build(contract):
    store = MemoryStore()
    return store, await envelope.wrap(bus.CONFIG_CHANGED, example("config.changed")["data"], contract, store, "upstat/test")


async def test_a_redelivered_message_is_handled_once(contract):
    store, env = await build(contract)
    seen = []

    async def handler(data, request_id):
        seen.append(data["kind"])

    d = dispatcher(handler, contract, store, MemoryState())
    await d.handle(bus.TOPIC_REQUESTS, env)
    await d.handle(bus.TOPIC_REQUESTS, env)
    assert seen == ["monitors"]


async def test_a_message_that_keeps_failing_is_parked_not_lost(contract):
    store, env = await build(contract)
    state, clock = MemoryState(), Clock()
    calls = []
    broken = [True]

    async def handler(data, request_id):
        calls.append(1)
        if broken[0]:
            raise RuntimeError("downstream is away")

    d = dispatcher(handler, contract, store, state, clock)
    await d.handle(bus.TOPIC_REQUESTS, env)
    assert len(calls) == 3 and len(await state.keys("dead:")) == 1
    await d.handle(bus.TOPIC_REQUESTS, env)  # redelivered while parked: not handled again
    assert len(calls) == 3
    assert await d.redrive() == 0  # the wait is not over
    broken[0] = False
    clock.t += REDRIVE_SECONDS[0] + 1
    assert await d.redrive() == 1
    assert len(calls) == 4 and await state.keys("dead:") == [] and await state.keys("failed:") == []
    await d.handle(bus.TOPIC_REQUESTS, env)
    assert len(calls) == 4


async def test_a_message_that_never_succeeds_is_recorded_as_failed_in_the_end(contract):
    store, env = await build(contract)
    state, clock = MemoryState(), Clock()

    async def handler(data, request_id):
        raise RuntimeError("always")

    d = dispatcher(handler, contract, store, state, clock)
    await d.handle(bus.TOPIC_REQUESTS, env)
    for _ in REDRIVE_SECONDS:
        clock.t += REDRIVE_SECONDS[-1] + 1
        await d.redrive()
    assert await state.keys("dead:") == []
    [key] = await state.keys("failed:")
    record = await state.get(key)
    assert record["request_id"] == env.get("request_id") and record["event"] == bus.CONFIG_CHANGED and "value" not in record


async def test_a_message_that_can_never_succeed_is_recorded_without_retries(contract):
    store, env = await build(contract)
    state = MemoryState()
    calls = []

    async def handler(data, request_id):
        calls.append(1)

    await dispatcher(handler, contract, store, state).handle(bus.TOPIC_REQUESTS, {**env, "version": "2.0"})
    assert calls == [] and await state.keys("dead:") == [] and len(await state.keys("failed:")) == 1


async def test_other_products_events_are_skipped_silently(contract):
    store = MemoryStore()
    state = MemoryState()
    await dispatcher(lambda d, r: None, contract, store, state).handle(bus.TOPIC_REQUESTS, {"type": "acme.import.ready", "id": "x"})
    assert await state.keys("seen:") == [] and await state.keys("failed:") == []
