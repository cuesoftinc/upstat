import {
  Inject,
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from "@nestjs/common";
import { Kafka, type Consumer } from "kafkajs";
import { CONFIG, type Config } from "../config/config";
import { ContractService } from "../contract/contract.service";
import { StorageService } from "../storage/storage.service";
import { ConfigCacheService } from "./config-cache.service";

const REQUESTS = "cuelabs.requests";
const CONFIG_CHANGED = "upstat.config.changed";

const RETRY_FIRST_MS = 2_000;
const RETRY_MAX_MS = 60_000;

/**
 * Consumer group upstat-observability (<product>-<service>) on the shared
 * requests lane: reloads a snapshot when common says it changed. A group
 * gives each message to one instance, so this only speeds one instance
 * up; every instance rechecks the snapshot by age (ConfigCacheService),
 * and readiness never waits for Kafka. Start retries with backoff until
 * it connects. Every other message is another product's or another
 * service's, and is committed without a word.
 */
@Injectable()
export class ConfigConsumerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ConfigConsumerService.name);
  private readonly consumer: Consumer;
  running = false;
  private stopped = false;
  private retry?: NodeJS.Timeout;

  constructor(
    @Inject(CONFIG) config: Config,
    private readonly cache: ConfigCacheService,
    private readonly contract: ContractService,
    private readonly storage: StorageService,
  ) {
    const { kafka } = config;
    this.consumer = new Kafka({
      clientId: "upstat-api-observability",
      brokers: kafka.brokers,
      ...(kafka.username
        ? {
            // SASL/SCRAM over TLS, the product's own Kafka user (X-11).
            ssl: kafka.sslCa ? { ca: [kafka.sslCa] } : true,
            sasl: {
              mechanism: "scram-sha-256" as const,
              username: kafka.username,
              password: kafka.password,
            },
          }
        : {}),
    }).consumer({ groupId: "upstat-observability" });
  }

  async onModuleInit(): Promise<void> {
    await this.cache.load();
    // Don't block startup on Kafka: the snapshots are loaded.
    void this.start();
  }

  private async start(delay = RETRY_FIRST_MS): Promise<void> {
    if (this.stopped) return;
    try {
      await this.consumer.connect();
      await this.consumer.subscribe({ topic: REQUESTS, fromBeginning: false });
      await this.consumer.run({
        eachMessage: async ({ message }) => this.handle(message.value),
      });
      this.running = true;
    } catch (error) {
      this.logger.warn({
        message: "kafka not reachable; retrying",
        error: (error as Error).message,
        retry_in_ms: delay,
      });
      await this.consumer.disconnect().catch(() => undefined);
      if (this.stopped) return;
      this.retry = setTimeout(
        () => void this.start(Math.min(delay * 2, RETRY_MAX_MS)),
        delay,
      );
      this.retry.unref();
    }
  }

  async handle(value: Buffer | null): Promise<void> {
    let envelope: { type?: string; data?: unknown; data_ref?: { key: string } };
    try {
      envelope = JSON.parse(value?.toString("utf8") ?? "null");
    } catch {
      return;
    }
    if (envelope?.type !== CONFIG_CHANGED) return;
    try {
      this.contract.validateEnvelope(envelope);
      const data = envelope.data_ref
        ? JSON.parse(
            (await this.storage.get(envelope.data_ref.key))?.toString("utf8") ??
              "null",
          )
        : envelope.data;
      this.contract.validateData(CONFIG_CHANGED, data);
      await this.cache.reload((data as { kind: string }).kind);
    } catch (error) {
      // A bad or unreadable message never blocks the shared lane.
      this.logger.error({
        message: "config message skipped",
        error: (error as Error).message,
      });
    }
  }

  async onModuleDestroy(): Promise<void> {
    this.stopped = true;
    clearTimeout(this.retry);
    this.running = false;
    await this.consumer.disconnect();
  }
}
