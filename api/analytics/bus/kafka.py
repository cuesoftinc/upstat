"""aiokafka producer and consumer for the shared lanes.

Failure handling follows the shared messaging contract (rules 8 and 10): a
message is handled once per envelope id; one that keeps failing is parked in
working state (dead:<id>) and handled again on later passes along REDRIVE,
then recorded as failed (failed:<id>), and the offset is committed either way
so a lane is never blocked.
"""

import asyncio
import contextlib
import hashlib
import json
import logging
import time
from collections.abc import Awaitable, Callable

from aiokafka import AIOKafkaConsumer, AIOKafkaProducer, TopicPartition
from aiokafka.helpers import create_ssl_context

from app.config import Settings
from bus import TOPIC_FOR, envelope
from contract import Contract, ContractError
from storage import ObjectStore

log = logging.getLogger(__name__)

# A handler gets the payload and the request_id its results must carry.
Handler = Callable[[dict, str | None], Awaitable[None]]

ATTEMPTS = 3
BACKOFF_SECONDS = 1.0
REDRIVE_SECONDS = (60, 300, 1500, 3600)  # waits before each later handling of a parked message
SEEN_TTL = 3 * 24 * 3600  # the service keeps messages for at most 3 days
FAILED_TTL = 7 * 24 * 3600


def connection_kwargs(settings: Settings) -> dict:
    kwargs: dict = {"bootstrap_servers": settings.kafka_broker_list}
    if settings.kafka_username:
        # SASL/SCRAM over TLS with the product's own Kafka user (X-11).
        ca = settings.kafka_ssl_ca
        if not ca:
            ssl = create_ssl_context()
        elif "-----BEGIN" in ca:
            ssl = create_ssl_context(cadata=ca)
        else:
            ssl = create_ssl_context(cafile=ca)
        kwargs.update(security_protocol="SASL_SSL", sasl_mechanism="SCRAM-SHA-256", sasl_plain_username=settings.kafka_username,
                      sasl_plain_password=settings.kafka_password, ssl_context=ssl)
    return kwargs


def _decode(value: bytes) -> object:
    """JSON, or None for anything else on the shared lanes."""
    try:
        return json.loads(value.decode())
    except (UnicodeDecodeError, ValueError):
        return None


class Producer:
    """Publishes validated envelopes; acks=all with idempotence."""

    def __init__(self, settings: Settings, contract: Contract, store: ObjectStore):
        self._settings = settings
        self._contract = contract
        self._store = store
        self._producer = AIOKafkaProducer(
            acks="all",
            enable_idempotence=True,
            value_serializer=lambda v: json.dumps(v, separators=(",", ":")).encode(),
            key_serializer=lambda k: k.encode(),
            **connection_kwargs(settings),
        )

    async def start(self) -> None:
        await self._producer.start()

    async def stop(self) -> None:
        await self._producer.stop()

    async def send(self, event: str, key: str, data: dict, request_id: str | None = None) -> None:
        message = await envelope.wrap(event, data, self._contract, self._store, self._settings.storage_prefix, request_id)
        await self._producer.send_and_wait(TOPIC_FOR[event], message, key=key)


class Invalid(Exception):
    """The message can never succeed: bad envelope, schema or version."""


class Dispatcher:
    """Routes one record to its handler; never raises, so the consumer
    always commits and moves on."""

    def __init__(self, handlers: dict[str, Handler], contract: Contract, store: ObjectStore, state=None, attempts: int = ATTEMPTS,
                 backoff: float = BACKOFF_SECONDS, clock=time.time):
        self.handlers = handlers
        self._contract = contract
        self._store = store
        self._state = state
        self._attempts = attempts
        self._backoff = backoff
        self._clock = clock

    @staticmethod
    def _id_of(value: object) -> str:
        if isinstance(value, dict) and isinstance(value.get("id"), str):
            return value["id"]
        return hashlib.sha256(json.dumps(value, sort_keys=True, default=str).encode()).hexdigest()[:32]

    async def _once(self, topic: str, value: object) -> None:
        """One handling: Invalid when it can never succeed, anything else is worth another try."""
        try:
            event, data, request_id = await envelope.unwrap(topic, value, self._contract, self._store)
        except (ContractError, ValueError, KeyError) as exc:
            raise Invalid(type(exc).__name__) from exc
        await self.handlers[event](data, request_id)

    async def handle(self, topic: str, value: object) -> None:
        event = envelope.event_of(value)
        if event not in self.handlers:
            return  # another product's event, or one this service doesn't handle
        message_id = self._id_of(value)
        request_id = value.get("request_id") if isinstance(value, dict) else None
        if self._state is not None and (await self._state.get(f"seen:{message_id}") or await self._state.get(f"dead:{message_id}")):
            return  # redelivered after a crash or rebalance: already handled, or parked for a later pass
        error: Exception | None = None
        for attempt in range(1, self._attempts + 1):
            try:
                await self._once(topic, value)
            except Invalid:
                # Can never succeed; never log the payload (never-log list).
                log.exception("dropping invalid message", extra={"topic": topic, "request_id": request_id})
                await self._failed(message_id, topic, event, request_id, "invalid")
                return
            except Exception as exc:
                error = exc
            else:
                await self._done(message_id)
                return
            if attempt < self._attempts:
                log.warning("handler failed; retrying", extra={"topic": topic, "event": event, "attempt": attempt, "error": type(error).__name__})
                await asyncio.sleep(self._backoff * 2 ** (attempt - 1))
        log.error("handler kept failing; parked for a later pass", exc_info=error, extra={"topic": topic, "event": event, "request_id": request_id})
        if self._state is not None:
            await self._state.put(f"dead:{message_id}", {"topic": topic, "event": event, "request_id": request_id, "value": value,
                                                          "attempts": self._attempts, "redrives": 0, "next_at": self._clock() + REDRIVE_SECONDS[0]},
                                  ttl=SEEN_TTL)

    async def redrive(self, deadline: float | None = None) -> int:
        """Handles parked messages whose wait is over (deadline is a
        time.monotonic value); returns how many were handled or given up on."""
        if self._state is None:
            return 0
        touched = 0
        for key in sorted(await self._state.keys("dead:")):
            if deadline is not None and time.monotonic() >= deadline:
                break
            job = await self._state.get(key)
            if not job or job["next_at"] > self._clock():
                continue
            message_id = key.removeprefix("dead:")
            try:
                await self._once(job["topic"], job["value"])
            except Invalid:
                await self._failed(message_id, job["topic"], job["event"], job["request_id"], "invalid")
            except Exception as exc:
                job["redrives"] += 1
                if job["redrives"] >= len(REDRIVE_SECONDS):
                    log.error("handler kept failing; giving up", exc_info=exc, extra={"topic": job["topic"], "event": job["event"],
                                                                                    "request_id": job["request_id"]})
                    await self._failed(message_id, job["topic"], job["event"], job["request_id"], type(exc).__name__)
                else:
                    job["next_at"] = self._clock() + REDRIVE_SECONDS[job["redrives"]]
                    await self._state.put(key, job, ttl=SEEN_TTL)
            else:
                await self._state.delete(key)
                await self._done(message_id)
            touched += 1
        return touched

    async def _done(self, message_id: str) -> None:
        if self._state is not None:
            await self._state.put(f"seen:{message_id}", {"at": self._clock()}, ttl=SEEN_TTL)

    async def _failed(self, message_id: str, topic: str, event: str, request_id: str | None, reason: str) -> None:
        """The record that a message was given up on, kept without its payload."""
        if self._state is not None:
            await self._state.delete(f"dead:{message_id}")
            await self._state.put(f"failed:{message_id}", {"topic": topic, "event": event, "request_id": request_id, "reason": reason,
                                                           "at": self._clock()}, ttl=FAILED_TTL)


class Consumer:
    """One consumer group (upstat-analytics) over the lanes its events use."""

    def __init__(self, name: str, handlers: dict[str, Handler], settings: Settings, contract: Contract, store: ObjectStore, state=None):
        self.name = name
        self._dispatcher = Dispatcher(handlers, contract, store, state)
        self._topics = sorted({TOPIC_FOR[event] for event in handlers})
        self._consumer = AIOKafkaConsumer(
            *self._topics,
            group_id=settings.kafka_group,
            enable_auto_commit=False,
            auto_offset_reset="earliest",
            value_deserializer=_decode,
            **connection_kwargs(settings),
        )
        self._task: asyncio.Task | None = None
        self.running = False

    async def start(self) -> None:
        await self._consumer.start()
        self._task = asyncio.create_task(self._run(), name=f"consumer-{self.name}")
        self.running = True
        log.info("consumer started", extra={"topics": self._topics})

    async def stop(self) -> None:
        self.running = False
        if self._task:
            self._task.cancel()
            with contextlib.suppress(asyncio.CancelledError):
                await self._task
        await self._consumer.stop()

    async def redrive(self, deadline: float | None = None) -> int:
        return await self._dispatcher.redrive(deadline)

    async def caught_up(self) -> bool:
        """Whether the group has committed every message now on its lanes,
        across all partitions (S-14: on request-based CPU, a settle request
        waits for this so the work happens while the instance has CPU)."""
        partitions = []
        for topic in self._topics:
            ids = self._consumer.partitions_for_topic(topic)
            if not ids:
                return False  # metadata not fetched yet: still joining
            partitions += [TopicPartition(topic, p) for p in ids]
        ends = await self._consumer.end_offsets(partitions)
        firsts = await self._consumer.beginning_offsets(partitions)
        for tp in partitions:
            committed = await self._consumer.committed(tp)
            if committed is None:
                committed = firsts[tp]  # never committed: the group starts at the first offset
            if committed < ends[tp]:
                return False
        return True

    async def wait_caught_up(self, budget: float) -> bool:
        """Polls caught_up until it holds or budget seconds pass."""
        deadline = time.monotonic() + budget
        while True:
            try:
                if await self.caught_up():
                    return True
            except Exception as exc:
                log.warning("lag check failed", extra={"error": type(exc).__name__})
            if time.monotonic() >= deadline:
                return False
            await asyncio.sleep(0.25)

    async def _run(self) -> None:
        while True:
            try:
                async for record in self._consumer:
                    await self._dispatcher.handle(record.topic, record.value)
                    try:
                        await self._consumer.commit()
                    except Exception:
                        log.warning("commit failed; the message may be redelivered", extra={"topic": record.topic, "offset": record.offset})
                return
            except Exception:
                log.exception("consumer error; resuming")
                await asyncio.sleep(BACKOFF_SECONDS)
