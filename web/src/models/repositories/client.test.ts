import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/models";
import { http } from "./client";

describe("repository http client", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("parses successful JSON responses", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () => new Response(JSON.stringify({ ok: true }), { status: 200 }),
      ),
    );
    await expect(http.get("/v1/orgs/current")).resolves.toEqual({ ok: true });
  });

  it("throws ApiError carrying the ecosystem envelope", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              error: { code: "not_found", message: "org not found" },
            }),
            { status: 404 },
          ),
      ),
    );
    const err = (await http
      .get("/v1/orgs/current")
      .catch((e) => e)) as ApiError;
    expect(err).toBeInstanceOf(ApiError);
    expect(err.code).toBe("not_found");
    expect(err.status).toBe(404);
    expect(err.message).toBe("org not found");
  });

  it("synthesizes a stable code for non-envelope failures", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("bad gateway", { status: 502 })),
    );
    const err = (await http.get("/v1/anything").catch((e) => e)) as ApiError;
    expect(err).toBeInstanceOf(ApiError);
    expect(err.code).toBe("internal");
    expect(err.status).toBe(502);
  });

  it("targets the mock server base in TEST_MODE", async () => {
    const spy = vi.fn(async () => new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", spy);
    await http.get("/v1/members");
    expect(spy).toHaveBeenCalledWith(
      "/api/mock/v1/members",
      expect.objectContaining({ headers: expect.anything() }),
    );
  });
});
