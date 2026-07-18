import type { ServiceStats } from "@/models";
import { jsonOk } from "@/mocks/http";
import { SERVICES, metricValue } from "@/mocks/series";
import { getDb } from "@/mocks/store";

/** GET /v1/services — APM service list (pages.md B5: req/s, p50/95/99, errors). */
export async function GET() {
  const db = getDb();
  const now = Date.now();
  const list: ServiceStats[] = SERVICES.map((service) => {
    const reqPerS = metricValue("http.requests_total", "rate", service, now, db.outage);
    const errRate =
      metricValue("http.errors_total", "rate", service, now, db.outage) / Math.max(reqPerS, 1);
    return {
      service,
      req_per_s: reqPerS,
      p50_ms: metricValue("http.request.duration_ms", "p50", service, now, db.outage),
      p95_ms: metricValue("http.request.duration_ms", "p95", service, now, db.outage),
      p99_ms: metricValue("http.request.duration_ms", "p99", service, now, db.outage),
      error_rate: Math.round(errRate * 10000) / 10000,
      apdex: Math.round((0.99 - Math.min(errRate * 4, 0.5)) * 100) / 100,
    };
  });
  return jsonOk(list);
}
