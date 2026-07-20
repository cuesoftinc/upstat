import { beforeEach, describe, expect, it } from "vitest";
import { resetDb } from "@/mocks/store";
import { GET, PUT } from "./route";

const params = (id: string) => ({ params: Promise.resolve({ id }) });

function putReq(body: unknown): Request {
  return new Request("http://mock/v1/incidents/x/postmortem", {
    method: "PUT",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

const INPUT = {
  author: "Ibukun",
  impact: "Checkout errored for 45m.",
  root_cause: "Retry storm saturated the insert queue.",
  action_items: ["Cap ingest retries", "", "Alert on insert-queue depth"],
};

describe("mock /v1/incidents/{id}/postmortem (pages.md B9)", () => {
  beforeEach(() => {
    resetDb();
  });

  it("GET returns the seeded INC-41 postmortem with its frozen timeline", async () => {
    const res = await GET(new Request("http://mock"), params("inc_41"));
    expect(res.status).toBe(200);
    const doc = await res.json();
    expect(doc.incident_id).toBe("inc_41");
    expect(doc.timeline.length).toBeGreaterThan(0);
    expect(doc.timeline[0].phase).toBe("investigating");
    expect(doc.action_items.length).toBeGreaterThan(0);
  });

  it("GET 404s (not_found) before a postmortem is composed", async () => {
    const res = await GET(new Request("http://mock"), params("inc_42"));
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.code).toBe("not_found");
  });

  it("PUT rejects unresolved incidents with incident_not_resolved", async () => {
    const res = await PUT(putReq(INPUT), params("inc_42"));
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error.code).toBe("incident_not_resolved");
  });

  it("PUT composes on resolve: freezes the timeline oldest-first and stamps postmortem_key", async () => {
    const db = resetDb();
    const inc42 = db.incidents.find((i) => i.id === "inc_42")!;
    inc42.status = "resolved";
    inc42.resolved_at = new Date().toISOString();

    const res = await PUT(putReq(INPUT), params("inc_42"));
    expect(res.status).toBe(201);
    const doc = await res.json();
    expect(doc.title).toContain("INC-42");
    // empty action lines are dropped
    expect(doc.action_items).toEqual([
      "Cap ingest retries",
      "Alert on insert-queue depth",
    ]);
    // auto-filled from the incident timeline, oldest-first
    const stamps = doc.timeline.map((t: { ts: string }) => t.ts);
    expect(stamps).toEqual([...stamps].sort());
    expect(doc.timeline[0].phase).toBe("investigating");
    expect(inc42.postmortem_key).toBe(
      `upstat/postmortems/${db.org.id}/inc_42.md`,
    );

    // idempotent update: 200, created_at preserved, updated fields land
    const res2 = await PUT(
      putReq({ ...INPUT, impact: "Revised impact." }),
      params("inc_42"),
    );
    expect(res2.status).toBe(200);
    const doc2 = await res2.json();
    expect(doc2.created_at).toBe(doc.created_at);
    expect(doc2.impact).toBe("Revised impact.");
  });

  it("PUT validates the template shape (bad_shape)", async () => {
    const db = resetDb();
    const inc = db.incidents.find((i) => i.id === "inc_41")!;
    expect(inc.status).toBe("resolved");
    const res = await PUT(
      putReq({ author: "Kemi", impact: "x" }), // missing root_cause/actions
      params("inc_41"),
    );
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error.code).toBe("bad_shape");
  });
});
