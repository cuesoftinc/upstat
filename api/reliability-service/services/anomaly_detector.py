from ml.isolation_forest import estimate_anomaly_score


def detect_anomaly(features: dict) -> bool:
    return estimate_anomaly_score(features) >= 0.6

