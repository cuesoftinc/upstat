import { describe, expect, it } from "vitest";
import {
  SsoRequestError,
  getOAuthRedirectErrorMessage,
  getSsoCompletionErrorMessage,
} from "./oauth-errors";

describe("getOAuthRedirectErrorMessage", () => {
  it("returns null without an error", () => {
    expect(getOAuthRedirectErrorMessage(new URLSearchParams(""))).toBeNull();
  });

  it("maps known codes case-insensitively", () => {
    expect(
      getOAuthRedirectErrorMessage(new URLSearchParams("error=ACCESS_DENIED")),
    ).toMatch(/cancelled/);
  });

  it("falls back for unknown codes and legacy fields", () => {
    const generic = /could not be completed/;
    expect(
      getOAuthRedirectErrorMessage(new URLSearchParams("error=zzz")),
    ).toMatch(generic);
    expect(
      getOAuthRedirectErrorMessage(new URLSearchParams("message=boom")),
    ).toMatch(generic);
  });
});

describe("getSsoCompletionErrorMessage", () => {
  it("explains a spent handoff", () => {
    expect(
      getSsoCompletionErrorMessage(new SsoRequestError(401, "handoff_invalid")),
    ).toMatch(/already used/);
  });

  it("separates offline and server failures", () => {
    expect(
      getSsoCompletionErrorMessage(new SsoRequestError(0, "network_error")),
    ).toMatch(/reach Upstat/);
    expect(
      getSsoCompletionErrorMessage(new SsoRequestError(503, "sso_unavailable")),
    ).toMatch(/temporarily/);
  });

  it("uses the default for anything else", () => {
    expect(getSsoCompletionErrorMessage(new Error("x"))).toMatch(
      /could not be completed/,
    );
  });
});
