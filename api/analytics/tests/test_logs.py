import json
import logging
import sys

from app.logs import JsonFormatter


def record(**kwargs) -> dict:
    logger = logging.getLogger("test.logs")
    made = logger.makeRecord("test.logs", logging.WARNING, __file__, 1, kwargs.pop("msg"), (), kwargs.pop("exc_info", None), extra=kwargs)
    return json.loads(JsonFormatter().format(made))


def test_extra_fields_are_kept():
    out = record(msg="delivery failed", monitor_id="m1", attempts=3)
    assert out["severity"] == "WARNING" and out["logger"] == "test.logs" and out["message"] == "delivery failed"
    assert out["monitor_id"] == "m1" and out["attempts"] == 3


def test_quotes_in_a_message_stay_valid_json():
    assert record(msg='said "no"')["message"] == 'said "no"'


def test_a_traceback_is_included():
    try:
        raise ZeroDivisionError("boom")
    except ZeroDivisionError:
        out = record(msg="failed", exc_info=sys.exc_info())
    assert "ZeroDivisionError: boom" in out["exception"] and "Traceback" in out["exception"]


def test_values_that_are_not_json_are_stringified():
    assert record(msg="x", blob={1, 2})["blob"] == "{1, 2}"
