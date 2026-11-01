import { afterEach, describe, expect, it, vi } from "vitest";
import { GET, POST, targetFor } from "./route";

const ctx = (path: string[]) => ({ params: Promise.resolve({ path }) });

describe("/api/v1 proxy", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("routes telemetry reads to api/query and the rest to api/common", () => {
    expect(targetFor(["query"])).toBe("query");
    expect(targetFor(["logs", "patterns"])).toBe("query");
    expect(targetFor(["rum", "summary"])).toBe("query");
    expect(targetFor(["monitors", "m1", "checks"])).toBe("common");
    expect(targetFor(["auth", "sso", "google"])).toBe("common");
  });

  it("forwards method, path, query, body and the session headers", async () => {
    vi.stubEnv("API_URL", "http://common:8080");
    vi.stubEnv("QUERY_URL", "http://query:8083");
    const fetchMock = vi.fn(
      async () =>
        new Response('{"ok":true}', {
          status: 201,
          headers: {
            "content-type": "application/json",
            "set-cookie": "upstat_session=x; HttpOnly",
          },
        }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const res = await POST(
      new Request("http://web/api/v1/monitors?x=1", {
        method: "POST",
        body: '{"name":"a"}',
        headers: {
          cookie: "upstat_session=s",
          origin: "http://web",
          "x-evil": "no",
        },
      }),
      ctx(["monitors"]),
    );
    expect(res.status).toBe(201);
    expect(res.headers.get("set-cookie")).toContain("upstat_session=x");
    const [url, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toBe("http://common:8080/v1/monitors?x=1");
    const headers = init.headers as Headers;
    expect(headers.get("cookie")).toBe("upstat_session=s");
    expect(headers.get("x-evil")).toBeNull();
    await GET(
      new Request("http://web/api/v1/logs?q=level:error"),
      ctx(["logs"]),
    );
    expect((fetchMock.mock.calls[1] as unknown as [string])[0]).toBe(
      "http://query:8083/v1/logs?q=level:error",
    );
  });

  it("answers 502 in the error envelope when the backend is down", async () => {
    vi.stubEnv("API_URL", "http://common:8080");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Promise.reject(new Error("refused"))),
    );
    const res = await GET(
      new Request("http://web/api/v1/monitors"),
      ctx(["monitors"]),
    );
    expect(res.status).toBe(502);
    expect((await res.json()).error.code).toBe("backend_unavailable");
  });
});
