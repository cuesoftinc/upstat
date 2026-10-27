import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SsoRequestError } from "./oauth-errors";
import {
  exchangeHandoff,
  isValidHandoff,
  pkceChallenge,
  takeVerifier,
} from "./sso-client";

const HANDOFF = "A".repeat(43);

function reply(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status });
}

describe("sso-client", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("derives the RFC 7636 challenge", async () => {
    expect(
      await pkceChallenge("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"),
    ).toBe("E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM");
  });

  it("validates handoff shape", () => {
    expect(isValidHandoff(HANDOFF)).toBe(true);
    expect(isValidHandoff("short")).toBe(false);
    expect(isValidHandoff(null)).toBe(false);
  });

  it("takes a stored verifier once and rejects other owners and expiry", () => {
    const record = (patch: object) =>
      JSON.stringify({
        version: 1,
        verifier: "v",
        owner: window.location.origin,
        createdAt: 0,
        expiresAt: Date.now() + 1000,
        ...patch,
      });
    window.sessionStorage.setItem("upstat.sso-verifier", record({}));
    expect(takeVerifier()).toBe("v");
    expect(takeVerifier()).toBeNull();
    window.sessionStorage.setItem(
      "upstat.sso-verifier",
      record({ owner: "https://evil.example" }),
    );
    expect(takeVerifier()).toBeNull();
    window.sessionStorage.setItem(
      "upstat.sso-verifier",
      record({ expiresAt: Date.now() - 1 }),
    );
    expect(takeVerifier()).toBeNull();
  });

  it("returns the token and sends credentials", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(reply(200, { data: { access_token: "tok" } }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(exchangeHandoff(HANDOFF, "v")).resolves.toBe("tok");
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toMatch(/\/v1\/auth\/sso\/exchange$/);
    expect(init.credentials).toBe("include");
    expect(JSON.parse(init.body)).toEqual({ handoff: HANDOFF, verifier: "v" });
  });

  it("does not retry a rejected handoff", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(reply(401, { error: { code: "handoff_invalid" } }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(exchangeHandoff(HANDOFF, "v")).rejects.toMatchObject({
      status: 401,
      code: "handoff_invalid",
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("retries server failures then succeeds", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(reply(503, { error: { code: "sso_unavailable" } }))
      .mockResolvedValueOnce(reply(200, { data: { access_token: "tok" } }));
    vi.stubGlobal("fetch", fetchMock);
    const result = exchangeHandoff(HANDOFF, "v");
    await vi.advanceTimersByTimeAsync(1000);
    await expect(result).resolves.toBe("tok");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("gives up after the last retry on network failure", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("offline")));
    const result = exchangeHandoff(HANDOFF, "v");
    const assertion = expect(result).rejects.toBeInstanceOf(SsoRequestError);
    await vi.advanceTimersByTimeAsync(11_000);
    await assertion;
  });
});
