def estimate_anomaly_score(features: dict) -> float:
    score = 0.0

    if features["latest_response_time"] > features["average_response_time"] * 1.75:
        score += 0.45

    if features["failure_rate"] >= 0.3:
        score += 0.35

    if features["consecutive_failures"] >= 2:
        score += 0.2

    return min(score, 1.0)

