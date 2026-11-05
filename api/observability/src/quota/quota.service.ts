import { createHash, randomBytes } from "node:crypto";
import { Injectable } from "@nestjs/common";
import { unavailable } from "../errors/api-error";
import { ValkeyService } from "../valkey/valkey.service";

export interface Verdict {
  ok: boolean;
  retryAfter: number;
}

/** Debit a fixed window; a denied debit is rolled back. Returns 1 when allowed. */
export const TAKE_SCRIPT = `
local used = redis.call('INCRBY', KEYS[1], ARGV[1])
if used == tonumber(ARGV[1]) then redis.call('EXPIRE', KEYS[1], ARGV[3]) end
if used > tonumber(ARGV[2]) then
  redis.call('DECRBY', KEYS[1], ARGV[1])
  return 0
end
return 1`;

/** Create the day's salt once and return the stored one. */
export const SALT_SCRIPT = `
redis.call('SET', KEYS[1], ARGV[1], 'NX', 'EX', ARGV[2])
return redis.call('GET', KEYS[1])`;

/**
 * Limits and daily salts on the shared Valkey (keys upstat:*; §5.1):
 * per-key byte quotas (S-11), per-property event rates, pre-auth per-IP
 * limits, and the visitor-hash salts. Fixed windows, counted in Valkey so
 * every instance shares them. Where Valkey is required and unreachable the
 * call answers 503 with a retry hint: per-instance counters or salts would
 * loosen limits and split visitors. Without REDIS_HOST (a single local
 * process) the state is in memory.
 */
@Injectable()
export class QuotaService {
  private readonly local = new Map<string, { window: number; used: number }>();
  private readonly salts = new Map<string, Buffer>();

  constructor(private readonly valkey: ValkeyService) {}

  /**
   * Debit `cost` against `limit` per `windowSeconds` for `key`. Denied
   * requests are not debited.
   */
  async take(
    key: string,
    cost: number,
    limit: number,
    windowSeconds: number,
    now = Date.now(),
  ): Promise<Verdict> {
    const window = Math.floor(now / 1000 / windowSeconds);
    const retryAfter = Math.max(
      1,
      Math.ceil((window + 1) * windowSeconds - now / 1000),
    );
    if (this.valkey.enabled) {
      const allowed = await this.valkey.eval(
        TAKE_SCRIPT,
        [this.valkey.key(`q:${key}:${window}`)],
        [cost, limit, windowSeconds * 2],
      );
      return allowed === 1
        ? { ok: true, retryAfter: 0 }
        : { ok: false, retryAfter };
    }
    const slot = this.local.get(key);
    const used = (slot && slot.window === window ? slot.used : 0) + cost;
    if (used > limit) return { ok: false, retryAfter };
    this.local.set(key, { window, used });
    if (this.local.size > 50_000) this.local.clear();
    return { ok: true, retryAfter: 0 };
  }

  /**
   * The UTC day's salt (analytics-math.md §1): 32 random bytes, created
   * once per day and destroyed 48 h after the day ends, so no salt spans
   * two days and none outlives the ingest window.
   */
  async salt(day: string, now = Date.now()): Promise<Buffer> {
    const cached = this.salts.get(day);
    if (cached) return cached;
    let salt = randomBytes(32);
    if (this.valkey.enabled) {
      const dayEnd = Date.parse(`${day}T00:00:00Z`) + 24 * 3600 * 1000;
      const ttl = Math.max(
        60,
        Math.ceil((dayEnd + 48 * 3600 * 1000 - now) / 1000),
      );
      const stored = await this.valkey.eval(
        SALT_SCRIPT,
        [this.valkey.key(`salt:${day}`)],
        [salt.toString("base64"), ttl],
      );
      if (typeof stored !== "string") throw unavailable(2);
      salt = Buffer.from(stored, "base64");
    }
    this.salts.set(day, salt);
    for (const known of this.salts.keys()) {
      if (Date.parse(`${known}T00:00:00Z`) + 72 * 3600 * 1000 < now)
        this.salts.delete(known);
    }
    return salt;
  }

  /** A limit key for an IP that never stores the address itself. */
  static ipKey(ip: string): string {
    return `ip:${createHash("sha256").update(ip).digest("hex").slice(0, 24)}`;
  }
}
