import { beforeEach, describe, expect, it } from "vitest";
import { TestModeAuthProvider } from "./test-mode";

describe("TestModeAuthProvider", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });

  it("establishes a session immediately on signInWithGoogle", async () => {
    const provider = new TestModeAuthProvider();
    expect(provider.currentUser()).toBeNull();
    const user = await provider.signInWithGoogle();
    expect(user.email).toBe("ibukun@cuesoft.io");
    expect(provider.currentUser()).toEqual(user);
    expect(await provider.idToken()).toBe("test-mode-token");
  });

  it("clears the session on signOut", async () => {
    const provider = new TestModeAuthProvider();
    await provider.signInWithGoogle();
    await provider.signOut();
    expect(provider.currentUser()).toBeNull();
    expect(await provider.idToken()).toBeNull();
  });
});
