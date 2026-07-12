def describe_trend(features: dict) -> str | None:
    if features["response_time_trend"] >= 0.20:
        return "latency trend is moving upward"

    return None

