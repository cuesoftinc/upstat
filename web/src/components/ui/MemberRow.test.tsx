import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemberRow } from "./MemberRow";

describe("MemberRow", () => {
  it("renders roster info with a role select", () => {
    render(
      <MemberRow
        member={{
          id: "usr_kemi",
          name: "Kemi",
          email: "kemi@cuesoft.io",
          role: "admin",
          status: "active",
        }}
      />,
    );
    expect(screen.getByText("kemi@cuesoft.io")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Role for Kemi" })).toBeInTheDocument();
  });

  it("badges invited members and locks the owner role", () => {
    render(
      <MemberRow
        member={{ id: "u", name: "Sade", email: "sade@cuesoft.io", role: "owner", status: "invited" }}
      />,
    );
    expect(screen.getByText("invited")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Role for Sade" })).toBeDisabled();
  });
});
