import { beforeEach, describe, expect, it } from "vitest";
import { resetDb } from "@/mocks/store";
import { POST } from "./route";

function queryReq(body: unknown): Request {
  return new Request("http://mock/api/mock/v1/query", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

describe("POST /v1/query", () => {
  beforeEach(() => {
    resetDb(Date.parse("2026-07-18T12:00:00Z"));
  });

  it("returns timeseries for a valid grammar query", async () => {
    const res = await POST(
      queryReq({
        q: "metric:http.request.duration_ms service:checkout | p95()",
        from: "2026-07-18T06:00:00Z",
        to: "2026-07-18T12:00:00Z",
      }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.kind).toBe("timeseries");
    expect(body.series[0].points.length).toBeGreaterThan(0);
  });

  it("rejects unknown facets with invalid_query", async () => {
    const res = await POST(
      queryReq({ q: "sevrice:web", from: "2026-07-18T06:00:00Z", to: "2026-07-18T12:00:00Z" }),
    );
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error.code).toBe("invalid_query");
  });

  it("rejects >92d ranges with range_too_large", async () => {
    const res = await POST(
      queryReq({ q: "service:web", from: "2026-01-01T00:00:00Z", to: "2026-07-18T12:00:00Z" }),
    );
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error.code).toBe("range_too_large");
  });

  it("rejects missing fields with bad_shape", async () => {
    const res = await POST(queryReq({ q: "service:web" }));
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error.code).toBe("bad_shape");
  });
});
