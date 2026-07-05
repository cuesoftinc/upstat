from collections import Counter

from models.monitor import MonitorCheck


def build_features(checks: list[MonitorCheck]) -> dict:
    total_checks = len(checks)
    failed_checks = sum(1 for check in checks if not check.success)
    recent_checks = checks[-10:]
    recent_failed_checks = sum(1 for check in recent_checks if not check.success)
    response_times = [check.response_time_ms for check in checks]
    average_response_time = int(sum(response_times) / total_checks) if total_checks else 0
    latest_response_time = response_times[-1] if response_times else 0
    latest_status_code = checks[-1].status_code if checks else 0

    consecutive_failures = 0
    for check in reversed(checks):
        if check.success:
            break
        consecutive_failures += 1

    status_codes = [check.status_code for check in checks if check.status_code is not None]
    status_code_counts = Counter(status_codes)
    baseline_status_code = status_code_counts.most_common(1)[0][0] if status_code_counts else 0
    status_code_flips = sum(
        1 for index in range(1, len(status_codes))
        if status_codes[index] != status_codes[index - 1]
    )
    status_code_anomaly = bool(
        latest_status_code != 0
        and baseline_status_code != 0
        and latest_status_code != baseline_status_code
        and (status_code_flips >= 2 or latest_status_code >= 400)
    )

    response_time_trend = 0.0
    if total_checks >= 3:
        segment = response_times[-3:]
        if segment[0] > 0:
            response_time_trend = (segment[-1] - segment[0]) / segment[0]

    return {
        "total_checks": total_checks,
        "failed_checks": failed_checks,
        "recent_failed_checks": recent_failed_checks,
        "failure_rate": failed_checks / total_checks if total_checks else 0,
        "average_response_time": average_response_time,
        "latest_response_time": latest_response_time,
        "latest_status_code": latest_status_code,
        "baseline_status_code": baseline_status_code,
        "status_code_flips": status_code_flips,
        "status_code_anomaly": status_code_anomaly,
        "response_time_trend": response_time_trend,
        "consecutive_failures": consecutive_failures,
    }

