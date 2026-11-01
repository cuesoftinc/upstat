"""aiokafka producer and consumer for the shared lanes."""

import asyncio
import contextlib
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


class Dispatcher:
    """Routes one record to its handler; never raises, so the consumer
    always commits and moves on."""

    def __init__(self, handlers: dict[str, Handler], contract: Contract, store: ObjectStore, attempts: int = ATTEMPTS, backoff: float = BACKOFF_SECONDS):
        self.handlers = handlers
        self._contract = contract
        self._store = store
        self._attempts = attempts
        self._backoff = backoff

    async def handle(self, topic: str, value: object) -> None:
        event = envelope.event_of(value)
        if event not in self.handlers:
            return  # another product's event, or one this service doesn't handle
        request_id = value.get("request_id") if isinstance(value, dict) else None
        error: Exception | None = None
        for attempt in range(1, self._attempts + 1):
            try:
                event, data, request_id = await envelope.unwrap(topic, value, self._contract, self._store)
            except (ContractError, ValueError, KeyError):
                # Can never succeed; never log the payload (never-log list).
                log.exception("dropping invalid message", extra={"topic": topic, "request_id": request_id})
                return
            except Exception as exc:  # storage: worth another try
                error = exc
            else:
                try:
                    await self.handlers[event](data, request_id)
                    return
                except Exception as exc:
                    error = exc
            if attempt < self._attempts:
                log.warning("handler failed; retrying", extra={"topic": topic, "event": event, "attempt": attempt, "error": type(error).__name__})
                await asyncio.sleep(self._backoff * 2 ** (attempt - 1))
        log.error("handler kept failing; skipped", exc_info=error, extra={"topic": topic, "event": event, "request_id": request_id})


class Consumer:
    """One consumer group (upstat-analytics) over the lanes its events use."""

    def __init__(self, name: str, handlers: dict[str, Handler], settings: Settings, contract: Contract, store: ObjectStore):
        self.name = name
        self._dispatcher = Dispatcher(handlers, contract, store)
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
