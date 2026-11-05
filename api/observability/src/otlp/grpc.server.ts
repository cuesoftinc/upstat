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
import { resolveClientIp } from "../net/client-ip";
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
  413: grpc.status.RESOURCE_EXHAUSTED,
  429: grpc.status.RESOURCE_EXHAUSTED,
  503: grpc.status.UNAVAILABLE,
};

const failure = (error: unknown): grpc.StatusObject => {
  if (error instanceof ApiError) {
    const body = error.getResponse() as { error: { message: string } };
    return {
      code: STATUS[error.getStatus()] ?? grpc.status.INTERNAL,
      details: body.error.message,
      metadata: new grpc.Metadata(),
    };
  }
  return {
    code: grpc.status.INTERNAL,
    details: "internal",
    metadata: new grpc.Metadata(),
  };
};

/**
 * OTLP/gRPC. Messages stay raw bytes (a pass-through serializer): the
 * gateway never parses OTLP. An Export*ServiceRequest is the same protobuf
 * OTLP/HTTP carries, so each is forwarded to the collector over HTTP; the
 * empty response is the all-default message. Cloud Run routes only PORT,
 * so the gRPC service runs with INGEST_TRANSPORT=grpc and serves h2c on
 * PORT; INGEST_TRANSPORT=both (compose) serves it on GRPC_PORT beside HTTP.
 * An interceptor checks the source and key from the call's metadata before
 * the message is read.
 */
@Injectable()
export class GrpcServer implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(GrpcServer.name);
  private server?: grpc.Server;

  constructor(
    @Inject(CONFIG) private readonly config: Config,
    private readonly otlp: OtlpService,
  ) {}

  /** The port this process serves gRPC on; 0 = not at all. */
  private port(): number {
    if (this.config.transport === "http") return 0;
    return this.config.transport === "grpc"
      ? this.config.port
      : this.config.grpcPort;
  }

  private credentials(
    md: grpc.Metadata,
    peer: string,
  ): { key: string; ip: string } {
    const auth = String(md.get("authorization")[0] ?? "");
    const key =
      String(md.get("upstat-ingest-key")[0] ?? "") ||
      (auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "");
    const forwarded = String(md.get("x-forwarded-for")[0] ?? "") || undefined;
    return { key, ip: resolveClientIp(forwarded, peer) };
  }

  private readonly gate: grpc.ServerInterceptor = (_method, call) => {
    const listener = new grpc.ServerListenerBuilder()
      .withOnReceiveMetadata((metadata, next) => {
        const { key, ip } = this.credentials(metadata, call.getPeer());
        this.otlp.authenticate(key, ip).then(
          () => next(metadata),
          (error: unknown) => call.sendStatus(failure(error)),
        );
      })
      .build();
    const responder = new grpc.ResponderBuilder()
      .withStart((next) => next(listener))
      .build();
    return new grpc.ServerInterceptingCall(call, responder);
  };

  async onModuleInit(): Promise<void> {
    const port = this.port();
    if (!port) return;
    const server = new grpc.Server({
      "grpc.max_receive_message_length": this.config.maxBodyBytes,
      interceptors: [this.gate],
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
        `0.0.0.0:${port}`,
        grpc.ServerCredentials.createInsecure(),
        (error) => (error ? reject(error) : resolve()),
      ),
    );
    this.server = server;
    this.logger.log({ message: "OTLP/gRPC listening", port });
  }

  private async export(
    signal: Signal,
    call: grpc.ServerUnaryCall<Buffer, Buffer>,
    done: grpc.sendUnaryData<Buffer>,
  ): Promise<void> {
    const { key, ip } = this.credentials(call.metadata, call.getPeer());
    try {
      // The source limit was taken by the interceptor; this only resolves the key.
      const ingestKey = await this.otlp.authenticate(key, ip, false);
      const out = await this.otlp.ingest(
        signal,
        call.request,
        ingestKey,
        "application/x-protobuf",
      );
      if (out.status >= 300) {
        done({
          code: grpc.status.INVALID_ARGUMENT,
          details: `collector ${out.status}`,
        });
        return;
      }
      done(null, Buffer.alloc(0));
    } catch (error) {
      done(failure(error));
    }
  }

  async onModuleDestroy(): Promise<void> {
    await new Promise<void>((resolve) =>
      this.server ? this.server.tryShutdown(() => resolve()) : resolve(),
    );
  }
}
