import {
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from "@nestjs/common";
import { CollectorService } from "../collector/collector.service";

export type Pillar = "traces" | "metrics" | "logs" | "rum";

interface Tally {
  orgId: string;
  keyId: string;
  pillar: Pillar;
  bytes: number;
  items: number;
}

const FLUSH_MS = 60_000;

/**
 * Usage metering (B12): accepted bytes (and, for events, items) per key and
 * pillar, flushed every minute to the telemetry plane as OTLP logs under
 * service upstat.usage; ClickHouse sums them into usage_hourly.
 */
@Injectable()
export class UsageService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(UsageService.name);
  private tallies = new Map<string, Tally>();
  private timer?: NodeJS.Timeout;

  constructor(private readonly collector: CollectorService) {}

  onModuleInit(): void {
    this.timer = setInterval(() => void this.flush(), FLUSH_MS);
    this.timer.unref();
  }

  async onModuleDestroy(): Promise<void> {
    clearInterval(this.timer);
    await this.flush();
  }

  add(
    orgId: string,
    keyId: string,
    pillar: Pillar,
    bytes: number,
    items = 0,
  ): void {
    const k = `${orgId}|${keyId}|${pillar}`;
    const t = this.tallies.get(k) ?? {
      orgId,
      keyId,
      pillar,
      bytes: 0,
      items: 0,
    };
    t.bytes += bytes;
    t.items += items;
    this.tallies.set(k, t);
  }

  async flush(): Promise<void> {
    const batch = this.tallies;
    this.tallies = new Map();
    const byOrg = new Map<string, Tally[]>();
    for (const t of batch.values())
      byOrg.set(t.orgId, [...(byOrg.get(t.orgId) ?? []), t]);
    for (const [orgId, tallies] of byOrg) {
      try {
        await this.collector.logs(
          orgId,
          "upstat.usage",
          tallies.map((t) => ({
            time: Date.now(),
            attributes: {
              "upstat.kind": "usage",
              key_id: t.keyId,
              pillar: t.pillar,
              bytes: String(t.bytes),
              items: String(t.items),
            },
          })),
        );
      } catch (error) {
        // Put it back: the next flush retries.
        for (const t of tallies)
          this.add(t.orgId, t.keyId, t.pillar, t.bytes, t.items);
        this.logger.warn({
          message: "usage flush failed",
          error: (error as Error).message,
        });
      }
    }
  }
}
