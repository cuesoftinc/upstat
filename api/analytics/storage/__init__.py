"""Object storage (system-design.md §5.1): GCS in cloud, any S3-compatible
store (MinIO) for compose and self-host. analytics reads config snapshots
and reads and writes compute/ claim-check payloads."""

from typing import Protocol

from app.config import Settings


class ObjectMissing(Exception):
    """The object does not exist."""


class ObjectStore(Protocol):
    bucket: str

    async def get(self, key: str) -> bytes: ...

    async def put(self, key: str, data: bytes, content_type: str) -> None: ...


class MemoryStore:
    """In-process store for tests."""

    def __init__(self, bucket: str = "test"):
        self.bucket = bucket
        self.objects: dict[str, bytes] = {}

    async def get(self, key: str) -> bytes:
        if key not in self.objects:
            raise ObjectMissing(key)
        return self.objects[key]

    async def put(self, key: str, data: bytes, content_type: str) -> None:
        self.objects[key] = data


def from_settings(settings: Settings) -> ObjectStore:
    if settings.storage_driver == "s3":
        from storage.s3 import S3Store

        return S3Store(settings.storage_bucket, settings.storage_endpoint, settings.storage_access_key, settings.storage_secret_key,
                       settings.storage_use_ssl)
    from storage.gcs import GCSStore

    return GCSStore(settings.storage_bucket)
