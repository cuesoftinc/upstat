import type { CollectorService } from "../collector/collector.service";
import type { ValkeyService } from "../valkey/valkey.service";
import { UsageService } from "./usage.service";

const T0 = Date.UTC(2026, 10, 5, 12, 0, 10);

const setup = () => {
  const logs = jest.fn<
    ReturnType<CollectorService["logs"]>,
    Parameters<CollectorService["logs"]>
  >(async () => undefined);
  const usage = new UsageService(
    { logs } as unknown as CollectorService,
    {
      enabled: false,
    } as ValkeyService,
  );
  return { logs, usage };
};

describe("UsageService", () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it("sends closed windows on the request path and leaves no timer", async () => {
    const { logs, usage } = setup();
    await usage.add("org", "k1", "logs", 100, 0, T0);
    await usage.add("org", "k1", "logs", 50, 0, T0 + 5_000);
    await usage.flushDue(T0 + 1_000);
    expect(logs).not.toHaveBeenCalled();
    await usage.flushDue(T0 + 60_000);
    expect(logs).toHaveBeenCalledTimes(1);
    const [org, service, records] = logs.mock.calls[0];
    expect([org, service]).toEqual(["org", "upstat.usage"]);
    expect(records[0].attributes).toMatchObject({
      key_id: "k1",
      pillar: "logs",
      bytes: "150",
    });
    expect(jest.getTimerCount()).toBe(0);
  });

  it("keeps a window the collector refused and retries on a later request", async () => {
    const { logs, usage } = setup();
    await usage.add("org", "k1", "rum", 10, 2, T0);
    logs.mockRejectedValueOnce(new Error("collector down"));
    await expect(usage.flushDue(T0 + 60_000)).resolves.toBeUndefined();
    await usage.flushDue(T0 + 60_000 + 15_000);
    expect(logs).toHaveBeenCalledTimes(2);
    await usage.flushDue(T0 + 60_000 + 30_000);
    expect(logs).toHaveBeenCalledTimes(2);
  });
});
