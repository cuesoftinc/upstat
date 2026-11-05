import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { configureHttp } from "./app.setup";
import { loadConfig } from "./config/config";
import { JsonLogger } from "./telemetry/json-logger";

async function bootstrap() {
  const config = loadConfig();
  const logger = new JsonLogger();
  if (config.transport === "grpc") {
    // OTLP/gRPC (h2c) on PORT, bound by GrpcServer; no HTTP listener.
    const context = await NestFactory.createApplicationContext(AppModule, {
      logger,
    });
    context.enableShutdownHooks();
    return;
  }
  const app = await NestFactory.create(AppModule, {
    logger,
    bodyParser: false,
  });
  configureHttp(app, config);
  await app.listen(config.port);
}

bootstrap();
