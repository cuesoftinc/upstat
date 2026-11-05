import {
  Inject,
  Injectable,
  Logger,
  type OnModuleDestroy,
} from "@nestjs/common";
import { createClient } from "redis";
import { CONFIG, type Config } from "../config/config";
import { unavailable } from "../errors/api-error";

/** The slice of the redis client this service uses. */
interface Client {
  isReady: boolean;
  isOpen: boolean;
  connect(): Promise<unknown>;
  on(event: string, listener: (...args: unknown[]) => void): unknown;
  eval(
    script: string,
    options: { keys: string[]; arguments: string[] },
  ): Promise<unknown>;
  close(): Promise<unknown>;
  destroy(): void;
}

const READY_WAIT_MS = 2000;

/**
 * The one connection to the shared Valkey (keys upstat:*). `enabled` is
 * false only in local single-process runs (no REDIS_HOST); where Valkey is
 * required, an unreachable server answers 503 and never falls back to
 * per-instance state.
 */
@Injectable()
export class ValkeyService implements OnModuleDestroy {
  private readonly logger = new Logger(ValkeyService.name);
  private readonly client: Client | null = null;
  private connecting: Promise<unknown> = Promise.resolve();
  readonly prefix: string;
  readonly enabled: boolean;

  constructor(@Inject(CONFIG) config: Config) {
    this.prefix = config.redis.prefix;
    this.enabled = Boolean(config.redis.host);
    if (!this.enabled) return;
    const base = {
      host: config.redis.host,
      port: config.redis.port,
      connectTimeout: READY_WAIT_MS,
      reconnectStrategy: (retries: number) => Math.min(retries * 200, 5000),
    };
    const client = createClient({
      socket: config.redis.tls ? { ...base, tls: true as const } : base,
      username: config.redis.username || undefined,
      password: config.redis.password || undefined,
      database: config.redis.db,
    }) as unknown as Client;
    client.on("error", () => undefined); // surfaced as 503 where it matters
    this.connecting = client.connect().catch((error: Error) =>
      this.logger.warn({
        message: "valkey not reachable",
        error: error.message,
      }),
    );
    this.client = client;
  }

  key(name: string): string {
    return `${this.prefix}${name}`;
  }

  /** Runs one Lua script atomically; any failure is a retryable 503. */
  async eval(
    script: string,
    keys: string[],
    args: (string | number)[],
  ): Promise<unknown> {
    const client = this.client;
    if (!client) throw unavailable(2);
    if (!client.isReady) {
      let timer: NodeJS.Timeout | undefined;
      await Promise.race([
        this.connecting,
        new Promise((resolve) => {
          timer = setTimeout(resolve, READY_WAIT_MS);
        }),
      ]);
      clearTimeout(timer);
      if (!client.isReady) throw unavailable(2);
    }
    try {
      return await client.eval(script, {
        keys,
        arguments: args.map(String),
      });
    } catch (error) {
      this.logger.warn({
        message: "valkey command failed",
        error: (error as Error).message,
      });
      throw unavailable(2);
    }
  }

  async onModuleDestroy(): Promise<void> {
    const client = this.client;
    if (!client?.isOpen) return;
    try {
      if (client.isReady) await client.close();
      else client.destroy();
    } catch {
      client.destroy();
    }
  }
}
