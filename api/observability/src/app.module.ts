import { Module } from "@nestjs/common";
import { CollectorService } from "./collector/collector.service";
import { ConfigCacheService } from "./config-cache/config-cache.service";
import { ConfigConsumerService } from "./config-cache/config-consumer.service";
import { ConfigModule } from "./config/config.module";
import { ContractModule } from "./contract/contract.module";
import { EventsController } from "./events/events.controller";
import { EventsService } from "./events/events.service";
import { HealthController } from "./health/health.controller";
import { IngressService } from "./net/ingress.service";
import { GrpcServer } from "./otlp/grpc.server";
import { OtlpController } from "./otlp/otlp.controller";
import { OtlpService } from "./otlp/otlp.service";
import { QuotaService } from "./quota/quota.service";
import { StorageService } from "./storage/storage.service";
import { UsageService } from "./usage/usage.service";
import { ValkeyService } from "./valkey/valkey.service";

@Module({
  imports: [ConfigModule, ContractModule],
  controllers: [HealthController, EventsController, OtlpController],
  providers: [
    StorageService,
    ValkeyService,
    IngressService,
    ConfigCacheService,
    ConfigConsumerService,
    QuotaService,
    CollectorService,
    UsageService,
    OtlpService,
    EventsService,
    GrpcServer,
  ],
})
export class AppModule {}
