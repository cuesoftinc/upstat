"""api/analytics: every decision Upstat makes (system-design.md §4, D2) —
the uptime evaluator (quorum, state machine, nodata), the notifier (rules,
cooldown, flapping, webhooks and Brevo), metric/log/trace/SLO rules and
SLOs, and insights (anomaly detection, risk, the Vertex narrative). It owns
no store: config arrives as snapshots, telemetry through api/query, and
every decision goes to api/common over the shared bus.

Alerts never wait on insights: insight generation runs in the background
after a transition's notifications are delivered.
"""

import asyncio
import logging
import os
import time
from contextlib import asynccontextmanager

from fastapi import FastAPI

import bus
import state as state_store
from app.config import get_settings
from bus.kafka import Consumer, Producer
from bus.wake import Waker
from config_cache import ConfigCache
from contract import Contract
from evaluation import Evaluation
from evaluator import Evaluator
from jobs import router as jobs_router
from narrative import Narrator
from notifier import Notifier
from notifier.channels import Sender
from queryclient import QueryClient
from service.insight_generator import InsightGenerator
from settle import router as settle_router
from storage import from_settings

log = logging.getLogger("analytics")
TICK_SECONDS = 15
INSIGHTS_EVERY_SECONDS = 3600


def configure_logging(level: str) -> None:
    logging.basicConfig(level=level, format='{"severity":"%(levelname)s","logger":"%(name)s","message":"%(message)s"}')


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    configure_logging(settings.log_level)
    contract = Contract(settings.contract_dir)
    store = from_settings(settings)
    working = state_store.from_settings(settings)
    config = ConfigCache(store, settings.storage_prefix)
    await config.load()
    producer = Producer(settings, contract, store)
    waker = Waker(settings.wake_common_url)

    async def publish(event: str, key: str, data: dict, request_id: str | None) -> None:
        await producer.send(event, key, data, request_id)
        waker.soon(event)

    query = QueryClient(settings.query_url, settings.internal_token, on_cloud_run=bool(os.environ.get("K_SERVICE")))
    sender = Sender(settings.brevo_api_key, settings.brevo_from_email, settings.brevo_from_name, settings.allow_private_webhooks)
    notifier = Notifier(config, working, publish, sender, settings.web_url)
    evaluator = Evaluator(config, working, publish)
    evaluation = Evaluation(config, working, query, publish, notifier)
    narrator = Narrator(settings)
    insights = InsightGenerator(config, working, query, narrator, publish)
    background: set[asyncio.Task] = set()

    async def on_config(msg: dict, request_id: str | None) -> None:
        await config.reload(msg["kind"])

    async def on_transition(msg: dict, request_id: str | None) -> None:
        await notifier.on_transition(msg, request_id)
        task = asyncio.create_task(_insight(msg))
        background.add(task)
        task.add_done_callback(background.discard)

    async def _insight(msg: dict) -> None:
        try:
            await insights.on_transition(msg, None)
        except Exception:
            log.exception("insight failed", extra={"monitor_id": msg["monitor_id"]})

    async def evaluate() -> None:
        await evaluator.sweep()
        await notifier.sweep()
        await notifier.renotify()
        await evaluation.run()

    handlers = {
        bus.CONFIG_CHANGED: on_config,
        bus.SYNTHETIC_RESULT: evaluator.on_result,
        bus.VERIFY_REQUESTED: notifier.on_verify,
        bus.TRANSITION: on_transition,
    }
    consumer = Consumer("analytics", handlers, settings, contract, store)
    await producer.start()
    await consumer.start()
    app.state.consumer = consumer
    app.include_router(jobs_router({"evaluate": evaluate, "insights": insights.sweep}, settings.scheduler_audience,
                                   settings.scheduler_invoker_email))

    def in_background(coro) -> None:
        task = asyncio.create_task(coro)
        background.add(task)
        task.add_done_callback(background.discard)

    async def _sweep() -> None:
        try:
            await insights.sweep()
        except Exception:
            log.exception("insight sweep failed")

    async def settle(budget: float) -> dict:
        """One settle (S-14): evaluate, start the hourly insight pass when it
        is due, then wait for the lanes and the background work."""
        deadline = time.monotonic() + budget
        await evaluate()
        last = await working.get("insights:last")
        if not last or time.time() - last.get("at", 0) >= INSIGHTS_EVERY_SECONDS:
            await working.put("insights:last", {"at": time.time()})
            in_background(_sweep())
        caught_up = await consumer.wait_caught_up(max(deadline - time.monotonic(), 0.0))
        pending = list(background)
        if pending:
            await asyncio.wait(pending, timeout=max(deadline - time.monotonic(), 0.0))
        return {"caught_up": caught_up, "background": len(background)}

    app.include_router(settle_router(settle, settings.internal_token))

    loop_task = None
    if settings.worker_enabled:
        async def tick() -> None:
            while True:
                try:
                    await evaluate()
                except Exception:
                    log.exception("evaluate tick failed")
                await asyncio.sleep(TICK_SECONDS)

        loop_task = asyncio.create_task(tick())
    log.info("starting", extra={"narrative": narrator.provider, "email": bool(settings.brevo_api_key)})
    try:
        yield
    finally:
        if loop_task:
            loop_task.cancel()
        for task in list(background):
            task.cancel()
        await consumer.stop()
        await producer.stop()
        await waker.aclose()
        await sender.aclose()
        await query.aclose()
        await narrator.aclose()
        await working.aclose()


app = FastAPI(title="upstat-api-analytics", lifespan=lifespan, docs_url=None, redoc_url=None, openapi_url=None)


@app.get("/health")
async def health():
    return {"status": "up"}


@app.get("/ready")
async def ready():
    consumer = getattr(app.state, "consumer", None)
    if consumer is None or not consumer.running:
        from fastapi.responses import JSONResponse

        return JSONResponse({"status": "not ready"}, status_code=503)
    return {"status": "ready"}
