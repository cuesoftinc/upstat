import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DashboardListRow } from "./DashboardListRow";

describe("DashboardListRow", () => {
  it("toggles the favorite star", async () => {
    const onFav = vi.fn();
    render(
      <DashboardListRow
        name="Service overview"
        updated="2d ago"
        favorite={false}
        onFavoriteChange={onFav}
        shared
      />,
    );
    await userEvent.click(
      screen.getByRole("switch", { name: "Favorite Service overview" }),
    );
    expect(onFav).toHaveBeenCalledWith(true);
    expect(screen.getByLabelText("org-shared")).toBeInTheDocument();
  });
});
