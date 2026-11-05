"""The CueLABS shared message bus (decisions.md X-11): lanes, envelope with
its claim-check, a producer, and consumers that commit after their handler
finishes or after a few failed attempts (never block a shared lane)."""

# Events (system-design.md §5.4); the type is also the schema name.
CONFIG_CHANGED = "upstat.config.changed"
SYNTHETIC_RESULT = "upstat.synthetics.result"
VERIFY_REQUESTED = "upstat.alerting.verify_requested"
TRANSITION = "upstat.monitor.transition"
DELIVERY = "upstat.alerting.delivery"
RULE_EVALUATED = "upstat.rule.evaluated"
SLO_EVALUATED = "upstat.slo.evaluated"
INSIGHT = "upstat.insights.generated"

TOPIC_REQUESTS = "cuelabs.requests"
TOPIC_RESULTS = "cuelabs.results"

TOPIC_FOR = {
    CONFIG_CHANGED: TOPIC_REQUESTS,
    SYNTHETIC_RESULT: TOPIC_REQUESTS,
    VERIFY_REQUESTED: TOPIC_REQUESTS,
    TRANSITION: TOPIC_RESULTS,
    DELIVERY: TOPIC_RESULTS,
    RULE_EVALUATED: TOPIC_RESULTS,
    SLO_EVALUATED: TOPIC_RESULTS,
    INSIGHT: TOPIC_RESULTS,
}
