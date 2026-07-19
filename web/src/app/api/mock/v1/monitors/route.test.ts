import { beforeEach, describe, expect, it } from "vitest";
import { resetDb } from "@/mocks/store";
import { GET, POST } from "./route";
import { DELETE, PATCH } from "./[id]/route";

function post(body: unknown): Request {
  return new Request("http://mock/api/mock/v1/monitors", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

const params = (id: string) => ({ params: Promise.resolve({ id }) });

describe("/v1/monitors CRUD", () => {
  beforeEach(() => {
    resetDb(Date.parse("2026-07-18T12:00:00Z"));
  });

  it("lists the seeded monitors incl. the paused + pending states", async () => {
    const res = await GET();
    const list = await res.json();
    expect(list.length).toBeGreaterThanOrEqual(6);
    const statuses = list.map((m: { status: string }) => m.status);
    expect(statuses).toContain("paused");
    expect(statuses).toContain("pending");
  });

  it("creates a monitor as pending", async () => {
    const res = await POST(
      post({ name: "New check", target: "https://x.dev" }),
    );
    expect(res.status).toBe(201);
    const monitor = await res.json();
    expect(monitor.status).toBe("pending");
  });

  it("enforces name_taken", async () => {
    const res = await POST(
      post({ name: "Homepage", target: "https://dup.dev" }),
    );
    expect(res.status).toBe(409);
    expect((await res.json()).error.code).toBe("name_taken");
  });

  it("enforces timeout < interval", async () => {
    const res = await POST(
      post({
        name: "Bad timing",
        target: "https://x.dev",
        interval_seconds: 30,
        timeout_seconds: 30,
      }),
    );
    expect(res.status).toBe(422);
    expect((await res.json()).error.code).toBe("timeout_gte_interval");
  });

  it("mutes via PATCH and deletes via DELETE", async () => {
    const patched = await PATCH(
      new Request("http://mock", {
        method: "PATCH",
        body: JSON.stringify({ muted: true }),
      }),
      params("mon_homepage"),
    );
    expect((await patched.json()).muted).toBe(true);

    const deleted = await DELETE(
      new Request("http://mock"),
      params("mon_homepage"),
    );
    expect(deleted.status).toBe(204);

    const missing = await DELETE(
      new Request("http://mock"),
      params("mon_homepage"),
    );
    expect(missing.status).toBe(404);
    expect((await missing.json()).error.code).toBe("not_found");
  });
});
