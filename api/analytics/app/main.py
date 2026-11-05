"""api/analytics: every decision Upstat makes (system-design.md §4, D2) —
the uptime evaluator (quorum, state machine, nodata), the notifier (rules,
cooldown, flapping, webhooks and Brevo), metric/log/trace/SLO rules and
SLOs, and insights (anomaly detection, risk, the Vertex narrative). It owns
no store: config arrives as snapshots, telemetry through api/query, and
every decision goes to api/common over the shared bus.

Alerts never wait on insights: a settle works through the insight queue only
after it has evaluated and delivered, and inside what is left of its budget.
"""

import asyncio
import logging
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI

import bus
import settle
import state as state_store
from app.config import get_settings
from app.logs import configure_logging
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
from storage import from_settings

log = logging.getLogger("analytics")
TICK_SECONDS = 15


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

    async def on_config(msg: dict, request_id: str | None) -> None:
        await config.reload(msg["kind"])

    async def on_transition(msg: dict, request_id: str | None) -> None:
        await notifier.on_transition(msg, request_id)
        try:
            await insights.on_transition(msg, None)
        except Exception:
            log.exception("insight queueing failed", extra={"monitor_id": msg["monitor_id"]})

    handlers = {
        bus.CONFIG_CHANGED: on_config,
        bus.SYNTHETIC_RESULT: evaluator.on_result,
        bus.VERIFY_REQUESTED: notifier.on_verify,
        bus.TRANSITION: on_transition,
    }
    consumer = Consumer("analytics", handlers, settings, contract, store, working)

    async def evaluate(deadline: float | None = None) -> None:
        """Every step runs alone: one failing never skips the rest. deadline
        is a time.monotonic value."""
        steps = (("redrive", lambda: consumer.redrive(deadline)), ("evaluator", evaluator.sweep), ("flapping", notifier.sweep),
                 ("renotify", notifier.renotify), ("retries", lambda: notifier.retry_due(deadline)), ("rules", lambda: evaluation.run(deadline)))
        for name, step in steps:
            try:
                await step()
            except Exception:
                log.exception("evaluate step failed", extra={"step": name})

    await producer.start()
    await consumer.start()
    app.state.consumer = consumer
    app.include_router(jobs_router({"evaluate": evaluate, "insights": insights.sweep}, settings.scheduler_audience,
                                   settings.scheduler_invoker_email))

    async def run_settle(budget: float) -> dict:
        """One settle (S-14): drain, evaluate, insights, drain."""
        return await settle.settle_pass(budget, consumer.wait_caught_up, evaluate, insights.run)

    app.include_router(settle.router(run_settle, settings.internal_token, settings.internal_audience, settings.internal_invoker_list))

    loop_task = None
    if settings.worker_enabled:
        async def tick() -> None:
            while True:
                try:
                    await evaluate()
                    await insights.sweep()
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
