import logging
import os

from router.grpc_server import start_grpc_server_sync

logging.basicConfig(
    level=logging.INFO,
    format="[%(asctime)s] %(levelname)s %(name)s: %(message)s",
)


def main() -> None:
    host = os.getenv("GRPC_HOST", "0.0.0.0")
    port = int(os.getenv("GRPC_PORT", "50051"))
    start_grpc_server_sync(host, port)


if __name__ == "__main__":
    main()
