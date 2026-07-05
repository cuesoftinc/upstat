def describe_status_code_anomaly(features: dict) -> str | None:
    if not features.get("status_code_anomaly"):
        return None

    latest_code = features.get("latest_status_code", 0)
    baseline_code = features.get("baseline_status_code", 0)

    if latest_code >= 500:
        return "status codes are shifting into server error responses"
    if latest_code >= 400:
        return "unexpected client or server error status codes are appearing"
    if baseline_code and latest_code != baseline_code:
        return "status codes have changed from the baseline"

    return "status code patterns are anomalous"
