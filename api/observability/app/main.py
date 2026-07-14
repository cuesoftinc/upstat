import logging
import os
import threading
from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.config import load_env_file
from router.grpc_server import start_grpc_server_sync

logging.basicConfig(
    level=logging.INFO,
    format="[%(asctime)s] %(levelname)s %(name)s: %(message)s",
)
logger = logging.getLogger("observability")

load_env_file()

from router.analyze import analyze_router
from router.insights import insights_router

def _grpc_enabled() -> bool:
    return os.getenv("ENABLE_GRPC_SERVER", "true").lower() in {"1", "true", "yes", "on"}


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: launch the internal gRPC server once (migrated from on_event).
    logger.info("Starting observability")
    logger.info(f"UPSTAT_GRPC_ADDRESS={os.getenv('UPSTAT_GRPC_ADDRESS', '<unset>')}")
    logger.info(f"UPSTAT_GRPC_AUTH_TOKEN set={bool(os.getenv('UPSTAT_GRPC_AUTH_TOKEN'))}")

    if _grpc_enabled():
        grpc_port = int(os.getenv("GRPC_PORT", "50051"))
        grpc_thread = threading.Thread(
            target=start_grpc_server_sync,
            args=("0.0.0.0", grpc_port),
            daemon=True,
        )
        grpc_thread.start()
        logger.info(f"gRPC server started on port {grpc_port}")

    yield


app = FastAPI(lifespan=lifespan)

app.include_router(analyze_router)
app.include_router(insights_router)

@app.get("/")
def root():
    return {"service": "observability", "message": "ok"}

@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/ready")
def ready():
    return {"status": "ready"}
