import logging
import os
import threading

from fastapi import FastAPI

from app.config import load_env_file
from api.grpc_server import start_grpc_server_sync

logging.basicConfig(
    level=logging.INFO,
    format="[%(asctime)s] %(levelname)s %(name)s: %(message)s",
)
logger = logging.getLogger("reliability-service")

load_env_file()

from api.analyze import analyze_router
from api.insights import insights_router

app = FastAPI()


def _grpc_enabled() -> bool:
    return os.getenv("ENABLE_GRPC_SERVER", "true").lower() in {"1", "true", "yes", "on"}


@app.on_event("startup")
def startup_event():
    logger.info("Starting reliability-service")
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

app.include_router(analyze_router)
app.include_router(insights_router)

@app.get("/")
def root():
    return {"service": "reliability-ai", "message": "initial development"}

@app.get("/health")
def health():
    return {"status": "ok"}
