import { beforeEach, describe, expect, it } from "vitest";
import { resetDb } from "@/mocks/store";
import { GET, POST } from "./route";
import {
  GET as getTimeline,
  POST as postTimeline,
} from "./[id]/timeline/route";

const params = (id: string) => ({ params: Promise.resolve({ id }) });

describe("/v1/incidents + timeline", () => {
  beforeEach(() => {
    resetDb(Date.parse("2026-07-18T12:00:00Z"));
  });

  it("seeds the INC-42 SEV-1 narrative in MONITORING", async () => {
    const list = await (await GET()).json();
    const inc42 = list.find((i: { key: string }) => i.key === "INC-42");
    expect(inc42).toMatchObject({
      sev: 1,
      status: "monitoring",
      roles: { commander: "Ibukun", responders: ["Kemi", "Tola"] },
      services: ["checkout", "api-common"],
    });

    const timeline = await (
      await getTimeline(new Request("http://mock"), params(inc42.id))
    ).json();
    expect(timeline.map((t: { phase: string }) => t.phase)).toEqual([
      "monitoring",
      "identified",
      "investigating",
    ]);
  });

  it("declares a new incident with an investigating timeline entry", async () => {
    const res = await POST(
      new Request("http://mock", {
        method: "POST",
        body: JSON.stringify({
          title: "Ingest lag",
          sev: 2,
          commander: "Kemi",
        }),
      }),
    );
    expect(res.status).toBe(201);
    const incident = await res.json();
    expect(incident.key).toBe("INC-43");
    expect(incident.status).toBe("investigating");
    const timeline = await (
      await getTimeline(new Request("http://mock"), params(incident.id))
    ).json();
    expect(timeline).toHaveLength(1);
  });

  it("timeline updates can transition status (the /status slash command)", async () => {
    const list = await (await GET()).json();
    const inc42 = list.find((i: { key: string }) => i.key === "INC-42");
    const res = await postTimeline(
      new Request("http://mock", {
        method: "POST",
        body: JSON.stringify({
          phase: "resolved",
          body: "All clear for 60m.",
          author: "Ibukun",
        }),
      }),
      params(inc42.id),
    );
    expect(res.status).toBe(201);
    const after = await (await GET()).json();
    const resolved = after.find((i: { key: string }) => i.key === "INC-42");
    expect(resolved.status).toBe("resolved");
    expect(resolved.resolved_at).not.toBeNull();
  });
});
