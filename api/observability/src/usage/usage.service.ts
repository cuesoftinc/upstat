import { Injectable, Logger } from "@nestjs/common";
import { CollectorService } from "../collector/collector.service";
import { ValkeyService } from "../valkey/valkey.service";

export type Pillar = "traces" | "metrics" | "logs" | "rum";

interface Tally {
  orgId: string;
  keyId: string;
  pillar: Pillar;
  bytes: number;
  items: number;
}

const WINDOW_MS = 60_000;
const CHECK_EVERY_MS = 15_000;
const LOCK_SECONDS = 60;
const KEEP_SECONDS = 3600;

const ADD_SCRIPT = `
redis.call('HINCRBY', KEYS[1], ARGV[2] .. '|b', ARGV[3])
redis.call('HINCRBY', KEYS[1], ARGV[2] .. '|i', ARGV[4])
redis.call('EXPIRE', KEYS[1], ARGV[5])
redis.call('SADD', KEYS[2], ARGV[1])
return 1`;

const WINDOWS_SCRIPT = `return redis.call('SMEMBERS', KEYS[1])`;

const CLAIM_SCRIPT = `
if redis.call('SET', KEYS[2], '1', 'NX', 'EX', ARGV[1]) then
  return redis.call('HGETALL', KEYS[1])
end
return false`;

const ACK_SCRIPT = `
for i = 2, #ARGV do redis.call('HDEL', KEYS[1], ARGV[i]) end
if redis.call('HLEN', KEYS[1]) == 0 then redis.call('SREM', KEYS[2], ARGV[1]) end
redis.call('DEL', KEYS[3])
return 1`;

/**
 * Usage metering (B12): accepted bytes (and, for events, items) per key and
 * pillar. Counts land in one-minute windows on Valkey while the request is
 * answered; a request that finds closed windows due sends them to the
 * telemetry plane as OTLP logs under service upstat.usage before it
 * responds (ClickHouse sums them into usage_hourly). No timer and no work
 * after a response (S-14). A window nobody flushes yet waits in Valkey for
 * the next request; a crash between send and acknowledgement can send a
 * window twice (at least once). Without REDIS_HOST the windows are in
 * memory (single local process).
 */
@Injectable()
export class UsageService {
  private readonly logger = new Logger(UsageService.name);
  private readonly local = new Map<string, Tally & { window: number }>();
  private nextCheckAt = 0;

  constructor(
    private readonly collector: CollectorService,
    private readonly valkey: ValkeyService,
  ) {}

  async add(
    orgId: string,
    keyId: string,
    pillar: Pillar,
    bytes: number,
    items = 0,
    now = Date.now(),
  ): Promise<void> {
    const window = Math.floor(now / WINDOW_MS);
    if (this.valkey.enabled) {
      await this.valkey.eval(
        ADD_SCRIPT,
        [this.valkey.key(`usage:${window}`), this.valkey.key("usage:windows")],
        [window, `${orgId}|${keyId}|${pillar}`, bytes, items, KEEP_SECONDS],
      );
      return;
    }
    const k = `${window}|${orgId}|${keyId}|${pillar}`;
    const t = this.local.get(k) ?? {
      window,
      orgId,
      keyId,
      pillar,
      bytes: 0,
      items: 0,
    };
    t.bytes += bytes;
    t.items += items;
    this.local.set(k, t);
  }

  /** Sends closed windows when due; called before a response, never fails it. */
  async flushDue(now = Date.now()): Promise<void> {
    if (now < this.nextCheckAt) return;
    this.nextCheckAt = now + CHECK_EVERY_MS;
    const current = Math.floor(now / WINDOW_MS);
    try {
      if (this.valkey.enabled) await this.flushValkey(current);
      else await this.flushLocal(current);
    } catch (error) {
      this.logger.warn({
        message: "usage flush failed",
        error: (error as Error).message,
      });
    }
  }

  private async flushLocal(current: number): Promise<void> {
    const byOrg = new Map<string, [string, Tally & { window: number }][]>();
    for (const entry of this.local) {
      if (entry[1].window >= current) continue;
      const rows = byOrg.get(entry[1].orgId) ?? [];
      rows.push(entry);
      byOrg.set(entry[1].orgId, rows);
    }
    for (const [orgId, rows] of byOrg) {
      await this.send(
        orgId,
        rows.map(([, t]) => t),
      );
      for (const [k] of rows) this.local.delete(k);
    }
  }

  private async flushValkey(current: number): Promise<void> {
    const windowsKey = this.valkey.key("usage:windows");
    const members = (await this.valkey.eval(
      WINDOWS_SCRIPT,
      [windowsKey],
      [],
    )) as string[];
    const due = members
      .map(Number)
      .filter((w) => Number.isInteger(w) && w < current)
      .sort((a, b) => a - b);
    for (const window of due) {
      const hash = this.valkey.key(`usage:${window}`);
      const lock = this.valkey.key(`usage:lock:${window}`);
      const reply = (await this.valkey.eval(
        CLAIM_SCRIPT,
        [hash, lock],
        [LOCK_SECONDS],
      )) as string[] | null;
      if (reply === null) continue;
      const sent: string[] = [];
      try {
        const byOrg = new Map<
          string,
          Map<string, Tally & { window: number }>
        >();
        for (let i = 0; i + 1 < reply.length; i += 2) {
          const [orgId, keyId, pillar, kind] = reply[i].split("|");
          const rows = byOrg.get(orgId) ?? new Map();
          const id = `${keyId}|${pillar}`;
          const t = rows.get(id) ?? {
            window,
            orgId,
            keyId,
            pillar: pillar as Pillar,
            bytes: 0,
            items: 0,
          };
          if (kind === "b") t.bytes = Number(reply[i + 1]);
          else t.items = Number(reply[i + 1]);
          rows.set(id, t);
          byOrg.set(orgId, rows);
        }
        for (const [orgId, rows] of byOrg) {
          await this.send(orgId, [...rows.values()]);
          for (const t of rows.values())
            sent.push(
              `${orgId}|${t.keyId}|${t.pillar}|b`,
              `${orgId}|${t.keyId}|${t.pillar}|i`,
            );
        }
      } finally {
        await this.valkey
          .eval(ACK_SCRIPT, [hash, windowsKey, lock], [window, ...sent])
          .catch((error: Error) =>
            this.logger.warn({
              message: "usage ack failed",
              error: error.message,
            }),
          );
      }
    }
  }

  private send(
    orgId: string,
    tallies: (Tally & { window: number })[],
  ): Promise<void> {
    return this.collector.logs(
      orgId,
      "upstat.usage",
      tallies.map((t) => ({
        time: t.window * WINDOW_MS,
        attributes: {
          "upstat.kind": "usage",
          key_id: t.keyId,
          pillar: t.pillar,
          bytes: String(t.bytes),
          items: String(t.items),
        },
      })),
    );
  }
}
