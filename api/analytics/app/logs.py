"""Structured JSON logs on stdout for Cloud Logging: severity, logger, message, every
`extra` field and the traceback of an exception. Callers never put secrets or
webhook URLs in `extra` (never-log list)."""

import json
import logging
import sys

# uvicorn adds color_message, an ANSI-coloured copy of the message.
_STANDARD = set(logging.LogRecord("", 0, "", 0, "", (), None).__dict__) | {"message", "asctime", "color_message"}


class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        out = {"severity": record.levelname, "logger": record.name, "message": record.getMessage()}
        out.update({k: v for k, v in record.__dict__.items() if k not in _STANDARD and not k.startswith("_")})
        if record.exc_info:
            out["exception"] = self.formatException(record.exc_info)
        if record.stack_info:
            out["stack"] = self.formatStack(record.stack_info)
        return json.dumps(out, default=str)


def configure_logging(level: str) -> None:
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(JsonFormatter())
    logging.basicConfig(level=level, handlers=[handler], force=True)
