import asyncio
import io

from minio import Minio
from minio.error import S3Error

from storage import ObjectMissing


class S3Store:
    """S3-compatible storage: MinIO in compose and self-host (D9)."""

    def __init__(self, bucket: str, endpoint: str, access_key: str, secret_key: str, secure: bool):
        self.bucket = bucket
        self._client = Minio(endpoint, access_key=access_key, secret_key=secret_key, secure=secure)

    async def get(self, key: str) -> bytes:
        def _read() -> bytes:
            try:
                resp = self._client.get_object(self.bucket, key)
            except S3Error as exc:
                if exc.code in ("NoSuchKey", "NoSuchObject"):
                    raise ObjectMissing(key) from exc
                raise
            try:
                return resp.read()
            finally:
                resp.close()
                resp.release_conn()

        return await asyncio.to_thread(_read)

    async def put(self, key: str, data: bytes, content_type: str) -> None:
        await asyncio.to_thread(self._client.put_object, self.bucket, key, io.BytesIO(data), len(data), content_type=content_type)
