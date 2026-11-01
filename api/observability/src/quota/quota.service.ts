import { createHash, randomBytes } from "node:crypto";
import {
  Inject,
  Injectable,
  Logger,
  type OnModuleDestroy,
} from "@nestjs/common";
import { createClient, type RedisClientType } from "redis";
import { CONFIG, type Config } from "../config/config";

export interface Verdict {
  ok: boolean;
  retryAfter: number;
}

/**
 * Limits and daily salts on the shared Valkey (keys upstat:*; §5.1):
 * per-key byte quotas (S-11), per-property event rates, pre-auth per-IP
 * limits, and the visitor-hash salts. Fixed windows, counted in Valkey so
 * every instance shares them. If Valkey is down each instance falls back
 * to its own counters: limits get looser, ingest keeps working (§9.2).
 */
@Injectable()
export class QuotaService implements OnModuleDestroy {
  private readonly logger = new Logger(QuotaService.name);
  private readonly client: RedisClientType | null = null;
  private readonly prefix: string;
  private readonly local = new Map<string, { window: number; used: number }>();
  private readonly salts = new Map<string, Buffer>();

  constructor(@Inject(CONFIG) config: Config) {
    this.prefix = config.redis.prefix;
    if (config.redis.host) {
      const base = {
        host: config.redis.host,
        port: config.redis.port,
        connectTimeout: 2000,
        reconnectStrategy: (retries: number) => Math.min(retries * 200, 5000),
      };
      this.client = createClient({
        socket: config.redis.tls ? { ...base, tls: true as const } : base,
        username: config.redis.username || undefined,
        password: config.redis.password || undefined,
        database: config.redis.db,
      }) as RedisClientType;
      this.client.on("error", () => undefined); // logged where it matters
      this.client.connect().catch((error: Error) =>
        this.logger.warn({
          message: "valkey not reachable; local limits",
          error: error.message,
        }),
      );
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.client?.isOpen) await this.client.quit();
  }

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
    if (this.client?.isReady) {
      try {
        const k = `${this.prefix}q:${key}:${window}`;
        const used = await this.client.incrBy(k, cost);
        if (used === cost) await this.client.expire(k, windowSeconds * 2);
        if (used > limit) {
          await this.client.decrBy(k, cost);
          return { ok: false, retryAfter };
        }
        return { ok: true, retryAfter: 0 };
      } catch (error) {
        this.logger.warn({
          message: "valkey quota failed; local limits",
          error: (error as Error).message,
        });
      }
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
    const dayEnd = Date.parse(`${day}T00:00:00Z`) + 24 * 3600 * 1000;
    const ttl = Math.max(
      60,
      Math.ceil((dayEnd + 48 * 3600 * 1000 - now) / 1000),
    );
    let salt = randomBytes(32);
    if (this.client?.isReady) {
      try {
        const k = `${this.prefix}salt:${day}`;
        await this.client.set(k, salt.toString("base64"), {
          NX: true,
          EX: ttl,
        });
        const stored = await this.client.get(k);
        if (stored) salt = Buffer.from(stored, "base64");
      } catch (error) {
        this.logger.warn({
          message: "valkey salt failed; local salt",
          error: (error as Error).message,
        });
      }
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
