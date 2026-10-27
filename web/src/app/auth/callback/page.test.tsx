import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { replace, exchangeHandoff, takeVerifier, storeToken } = vi.hoisted(
  () => ({
    replace: vi.fn(),
    exchangeHandoff: vi.fn(),
    takeVerifier: vi.fn(),
    storeToken: vi.fn(),
  }),
);
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace }) }));
vi.mock("@/auth/sso-client", async () => {
  const actual =
    await vi.importActual<typeof import("@/auth/sso-client")>(
      "@/auth/sso-client",
    );
  return { ...actual, exchangeHandoff, takeVerifier, storeToken };
});

import AuthCallbackPage from "./page";

const HANDOFF = "A".repeat(43);

function visit(search: string) {
  window.history.replaceState(null, "", `/auth/callback${search}`);
}

describe("AuthCallbackPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("exchanges the handoff, stores the token and enters the dashboard", async () => {
    visit(`?handoff=${HANDOFF}`);
    takeVerifier.mockReturnValue("v");
    exchangeHandoff.mockResolvedValue("tok");
    render(<AuthCallbackPage />);
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/dashboard"));
    expect(exchangeHandoff).toHaveBeenCalledWith(HANDOFF, "v");
    expect(storeToken).toHaveBeenCalledWith("tok");
    expect(window.location.search).toBe("");
  });

  it("shows the redirect error without exchanging", async () => {
    visit("?error=access_denied");
    render(<AuthCallbackPage />);
    expect(await screen.findByTestId("auth-callback-error")).toHaveTextContent(
      /cancelled/,
    );
    expect(exchangeHandoff).not.toHaveBeenCalled();
  });

  it("reports an expired session when the verifier is gone", async () => {
    visit(`?handoff=${HANDOFF}`);
    takeVerifier.mockReturnValue(null);
    render(<AuthCallbackPage />);
    expect(await screen.findByTestId("auth-callback-error")).toHaveTextContent(
      /expired/,
    );
    expect(exchangeHandoff).not.toHaveBeenCalled();
  });

  it("reports an exchange failure", async () => {
    visit(`?handoff=${HANDOFF}`);
    takeVerifier.mockReturnValue("v");
    exchangeHandoff.mockRejectedValue(new Error("boom"));
    render(<AuthCallbackPage />);
    expect(
      await screen.findByTestId("auth-callback-error"),
    ).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });
});
