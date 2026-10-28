import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.config import load_env_file

logging.basicConfig(
    level=logging.INFO,
    format="[%(asctime)s] %(levelname)s %(name)s: %(message)s",
)
logger = logging.getLogger("observability")

load_env_file()

from router.analyze import analyze_router
from router.insights import insights_router

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting observability")
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
