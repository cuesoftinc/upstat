import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { resetDb } from "@/mocks/store";
import { MonitorInsights } from "./MonitorInsights";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

beforeEach(() => resetDb());
afterEach(() => vi.restoreAllMocks());

it("renders the API summary, narrative and recommendation for the selected monitor", async () => {
  const insight = resetDb().monitorInsights[0];
  const fetch = vi
    .spyOn(globalThis, "fetch")
    .mockResolvedValue(json([insight]));

  render(<MonitorInsights monitorId="mon_homepage" />);

  expect(await screen.findByText(insight.summary)).toBeVisible();
  expect(screen.getByText(insight.narrative)).toBeVisible();
  expect(
    screen.getByText(`Recommended action — ${insight.recommended_action}`),
  ).toBeVisible();
  expect(fetch).toHaveBeenCalledWith(
    "/api/mock/v1/monitors/mon_homepage/insights",
    expect.any(Object),
  );
});

it.each([[], null])(
  "shows an empty state for an empty API response (%s)",
  async (data) => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(json(data));
    render(<MonitorInsights monitorId="mon_homepage" />);
    expect(
      await screen.findByText("No insights yet for this monitor."),
    ).toBeVisible();
  },
);

it("shows a load failure and retries without inventing insight text", async () => {
  const insight = resetDb().monitorInsights[0];
  const fetch = vi
    .spyOn(globalThis, "fetch")
    .mockResolvedValueOnce(
      json({ error: { code: "internal", message: "Unavailable" } }, 500),
    )
    .mockResolvedValueOnce(json([insight]));
  render(<MonitorInsights monitorId="mon_homepage" />);
  const retry = await screen.findByRole("button", { name: "Retry insights" });
  expect(screen.getByRole("alert")).toHaveTextContent(
    "Insights could not be loaded.",
  );
  expect(screen.queryByText(insight.summary)).not.toBeInTheDocument();
  await userEvent.click(retry);
  expect(await screen.findByText(insight.summary)).toBeVisible();
  expect(fetch).toHaveBeenCalledTimes(2);
});

it("keeps the loading state until the API completes", async () => {
  let complete!: (value: Response) => void;
  const fetch = vi.spyOn(globalThis, "fetch").mockReturnValue(
    new Promise<Response>((resolve) => {
      complete = resolve;
    }),
  );
  render(<MonitorInsights monitorId="mon_homepage" />);
  await waitFor(() => expect(fetch).toHaveBeenCalledOnce());
  expect(
    screen.queryByText("No insights yet for this monitor."),
  ).not.toBeInTheDocument();
  complete(json([]));
  expect(
    await screen.findByText("No insights yet for this monitor."),
  ).toBeVisible();
});
