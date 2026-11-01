"""Typed environment config (CueLABS standard: fail fast on missing settings).

Variable names follow system-design.md §10.3. Nothing else in the service
reads os.environ.
"""

from functools import lru_cache
from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    port: int = 8082
    log_level: str = "INFO"

    kafka_brokers: str = Field(min_length=1)
    kafka_username: str = ""
    kafka_password: str = ""
    kafka_ssl_ca: str = ""
    kafka_group: str = "upstat-analytics"

    storage_driver: Literal["gcs", "s3"] = "gcs"
    storage_bucket: str = Field(min_length=1)
    storage_prefix: str = Field(min_length=1, description="e.g. upstat/stg")
    storage_endpoint: str = ""
    storage_access_key: str = ""
    storage_secret_key: str = ""
    storage_use_ssl: bool = True

    # Evaluator working state (§5.1): rebuildable, so losing it is survivable.
    redis_host: str = ""
    redis_port: int = 6379
    redis_username: str = ""
    redis_password: str = ""
    redis_tls: bool = False
    redis_db: int = 0
    redis_key_prefix: str = "upstat:"

    # api/query's internal surface: rule, SLO and insight history reads.
    query_url: str = ""
    internal_token: str = ""

    # api/common, woken after each result sent for it (scale to zero).
    wake_common_url: str = ""

    # Notifications (U-4, X-7: Brevo REST, no SMTP).
    brevo_api_key: str = ""
    brevo_from_email: str = ""
    brevo_from_name: str = "Upstat"
    web_url: str = "http://localhost:3000"
    # Cloud never delivers webhooks to private addresses; self-host may.
    allow_private_webhooks: bool = False

    # Insights narrative (X-4): Vertex AI via ADC in cloud; a BYO Groq or
    # Gemini key for self-host; none = a plain template.
    google_cloud_project: str = ""
    vertex_location: str = "us-central1"
    vertex_model: str = "gemini-2.5-flash"
    groq_api_key: str = ""
    gemini_api_key: str = ""

    # POST /internal/jobs/{name} (Cloud Scheduler OIDC, as api/common).
    scheduler_audience: str = ""
    scheduler_invoker_email: str = ""
    # Local runs tick the evaluator in process; Cloud Scheduler does in cloud.
    worker_enabled: bool = True

    contract_dir: str = "contract"

    @property
    def kafka_broker_list(self) -> list[str]:
        return [b.strip() for b in self.kafka_brokers.split(",") if b.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]  # values come from the environment
