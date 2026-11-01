def describe_latency(features: dict) -> str | None:
    if features["average_response_time"] > 1000:
        return "average latency is above 1000ms"

    if features["latest_response_time"] > features["average_response_time"] * 1.4:
        return "latest response time is sharply above baseline"

    return None

