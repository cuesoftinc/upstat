def describe_failures(features: dict) -> str | None:
    if features["consecutive_failures"] >= 3:
        return "multiple consecutive checks are failing"

    if features["recent_failed_checks"] >= 4:
        return "several recent checks failed"

    if features["failure_rate"] >= 0.30:
        return "failure rate is elevated"

    return None

