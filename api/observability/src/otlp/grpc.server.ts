import {
  Inject,
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from "@nestjs/common";
import * as grpc from "@grpc/grpc-js";
import { CONFIG, type Config } from "../config/config";
import { ApiError } from "../errors/api-error";
import { OtlpService, type Signal } from "./otlp.service";

const identity = (b: Buffer) => b;

const SERVICES: Record<Signal, string> = {
  traces: "/opentelemetry.proto.collector.trace.v1.TraceService/Export",
  metrics: "/opentelemetry.proto.collector.metrics.v1.MetricsService/Export",
  logs: "/opentelemetry.proto.collector.logs.v1.LogsService/Export",
};

const STATUS: Record<number, grpc.status> = {
  401: grpc.status.UNAUTHENTICATED,
  403: grpc.status.PERMISSION_DENIED,
  429: grpc.status.RESOURCE_EXHAUSTED,
  503: grpc.status.UNAVAILABLE,
};

/**
 * OTLP/gRPC (port 4317). Messages stay raw bytes (a pass-through
 * serializer): the gateway never parses OTLP. An Export*ServiceRequest is
 * the same protobuf OTLP/HTTP carries, so each is forwarded to the
 * collector over HTTP; the empty response is the all-default message.
 * Cloud Run serves one port per service, so cloud deploys this listener as
 * its own service (ingest-grpc, §6.3); compose runs both in one container.
 */
@Injectable()
export class GrpcServer implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(GrpcServer.name);
  private server?: grpc.Server;

  constructor(
    @Inject(CONFIG) private readonly config: Config,
    private readonly otlp: OtlpService,
  ) {}

  async onModuleInit(): Promise<void> {
    if (!this.config.grpcPort) return;
    const server = new grpc.Server({
      "grpc.max_receive_message_length": 16 << 20,
    });
    for (const [signal, path] of Object.entries(SERVICES) as [
      Signal,
      string,
    ][]) {
      server.addService(
        {
          Export: {
            path,
            requestStream: false,
            responseStream: false,
            requestSerialize: identity,
            requestDeserialize: identity,
            responseSerialize: identity,
            responseDeserialize: identity,
          },
        },
        {
          Export: (
            call: grpc.ServerUnaryCall<Buffer, Buffer>,
            done: grpc.sendUnaryData<Buffer>,
          ) => void this.export(signal, call, done),
        },
      );
    }
    await new Promise<void>((resolve, reject) =>
      server.bindAsync(
        `0.0.0.0:${this.config.grpcPort}`,
        grpc.ServerCredentials.createInsecure(),
        (error) => (error ? reject(error) : resolve()),
      ),
    );
    this.server = server;
    this.logger.log({
      message: "OTLP/gRPC listening",
      port: this.config.grpcPort,
    });
  }

  private async export(
    signal: Signal,
    call: grpc.ServerUnaryCall<Buffer, Buffer>,
    done: grpc.sendUnaryData<Buffer>,
  ): Promise<void> {
    const md = call.metadata;
    const auth = String(md.get("authorization")[0] ?? "");
    const key =
      String(md.get("upstat-ingest-key")[0] ?? "") ||
      (auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "");
    const ip = call
      .getPeer()
      .replace(/^ipv[46]:/, "")
      .replace(/:\d+$/, "")
      .replace(/^\[|\]$/g, "");
    try {
      const out = await this.otlp.ingest(
        signal,
        call.request,
        key,
        "application/x-protobuf",
        undefined,
        ip,
      );
      if (out.status >= 300) {
        done({
          code:
            out.status >= 500
              ? grpc.status.UNAVAILABLE
              : grpc.status.INVALID_ARGUMENT,
          details: `collector ${out.status}`,
        });
        return;
      }
      done(null, Buffer.alloc(0));
    } catch (error) {
      if (error instanceof ApiError) {
        const body = error.getResponse() as { error: { message: string } };
        done({
          code: STATUS[error.getStatus()] ?? grpc.status.INTERNAL,
          details: body.error.message,
        });
        return;
      }
      done({ code: grpc.status.INTERNAL, details: "internal" });
    }
  }

  async onModuleDestroy(): Promise<void> {
    await new Promise<void>((resolve) =>
      this.server ? this.server.tryShutdown(() => resolve()) : resolve(),
    );
  }
}
