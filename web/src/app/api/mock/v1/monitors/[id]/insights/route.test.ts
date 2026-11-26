import { beforeEach, expect, it } from "vitest";
import { resetDb } from "@/mocks/store";
import { GET } from "./route";

beforeEach(() => resetDb());

const request = (id: string) =>
  GET(new Request("http://mock"), { params: Promise.resolve({ id }) });

it("returns monitor-scoped insights with the real API shape", async () => {
  const db = resetDb();
  const insight = db.monitorInsights[0];
  db.monitorInsights.push({
    ...insight,
    id: "other",
    monitor_id: db.monitors[1].id,
  });
  const response = await request("mon_homepage");
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual([insight]);
});

it("returns an empty array for a monitor without insights", async () => {
  const response = await request(resetDb().monitors[1].id);
  expect(await response.json()).toEqual([]);
});

it("returns not_found for an unknown monitor", async () => {
  const response = await request("missing");
  expect(response.status).toBe(404);
  expect((await response.json()).error.code).toBe("not_found");
});
