import { Inject, Injectable } from "@nestjs/common";
import { Storage } from "@google-cloud/storage";
import { Client as MinioClient } from "minio";
import { CONFIG, type Config } from "../config/config";

/**
 * Reads config snapshots and claim-check payloads (system-design.md §6.8,
 * X-11). Cloud Storage via ADC in cloud, where IAM grants this service read
 * on config/ and compute/ only; any S3-compatible store in compose.
 */
@Injectable()
export class StorageService {
  private readonly read: (key: string) => Promise<Buffer | null>;
  readonly prefix: string;

  constructor(@Inject(CONFIG) config: Config) {
    const { storage } = config;
    this.prefix = storage.prefix;
    if (storage.driver === "s3") {
      const [host, port] = storage.endpoint.split(":");
      const client = new MinioClient({
        endPoint: host,
        port: port ? Number(port) : undefined,
        useSSL: storage.useSsl,
        accessKey: storage.accessKey,
        secretKey: storage.secretKey,
      });
      this.read = async (key) => {
        try {
          const stream = await client.getObject(storage.bucket, key);
          const chunks: Buffer[] = [];
          for await (const chunk of stream) chunks.push(chunk as Buffer);
          return Buffer.concat(chunks);
        } catch (error) {
          if ((error as { code?: string }).code === "NoSuchKey") return null;
          throw error;
        }
      };
    } else {
      const bucket = new Storage().bucket(storage.bucket);
      this.read = async (key) => {
        try {
          const [data] = await bucket.file(key).download();
          return data;
        } catch (error) {
          if ((error as { code?: number }).code === 404) return null;
          throw error;
        }
      };
    }
  }

  /** The object's bytes, or null when it doesn't exist. */
  get(key: string): Promise<Buffer | null> {
    return this.read(key);
  }

  configKey(kind: string): string {
    return `${this.prefix}/config/${kind}.json`;
  }
}
