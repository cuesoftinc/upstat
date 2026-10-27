import { beforeEach, describe, expect, it } from "vitest";
import { SsoAuthProvider } from "./sso-provider";
import { storeToken } from "./sso-client";

function jwt(payload: object): string {
  const encode = (value: object) =>
    btoa(JSON.stringify(value)).replace(/=+$/, "");
  return `${encode({ alg: "HS256" })}.${encode(payload)}.sig`;
}

describe("SsoAuthProvider", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });

  it("reads signed out without a token", async () => {
    const provider = new SsoAuthProvider();
    expect(provider.currentUser()).toBeNull();
    expect(await provider.idToken()).toBeNull();
  });

  it("reads the user from the session token", async () => {
    const token = jwt({
      userId: "u1",
      email: "ada@example.com",
      name: "Ada",
      exp: Date.now() / 1000 + 600,
    });
    storeToken(token);
    const provider = new SsoAuthProvider();
    expect(provider.currentUser()).toEqual({
      id: "u1",
      email: "ada@example.com",
      name: "Ada",
    });
    expect(await provider.idToken()).toBe(token);
  });

  it("falls back to the email when the token has no name", () => {
    storeToken(
      jwt({
        userId: "u1",
        email: "ada@example.com",
        exp: Date.now() / 1000 + 600,
      }),
    );
    expect(new SsoAuthProvider().currentUser()?.name).toBe("ada@example.com");
  });

  it("reads an expired or malformed token as signed out", () => {
    const provider = new SsoAuthProvider();
    storeToken(
      jwt({
        userId: "u1",
        email: "ada@example.com",
        exp: Date.now() / 1000 - 5,
      }),
    );
    expect(provider.currentUser()).toBeNull();
    storeToken("garbage");
    expect(provider.currentUser()).toBeNull();
  });

  it("clears the token on signOut", async () => {
    storeToken(
      jwt({
        userId: "u1",
        email: "ada@example.com",
        exp: Date.now() / 1000 + 600,
      }),
    );
    const provider = new SsoAuthProvider();
    await provider.signOut();
    expect(provider.currentUser()).toBeNull();
  });
});
