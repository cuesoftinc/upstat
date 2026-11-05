import { Kafka } from "kafkajs";
import type { Config } from "../config/config";
import type { ContractService } from "../contract/contract.service";
import type { StorageService } from "../storage/storage.service";
import type { ConfigCacheService } from "./config-cache.service";
import { ConfigConsumerService } from "./config-consumer.service";

jest.mock("kafkajs", () => ({ Kafka: jest.fn() }));

describe("ConfigConsumerService", () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it("starts without Kafka, keeps retrying, and stops cleanly", async () => {
    const consumer = {
      connect: jest
        .fn()
        .mockRejectedValueOnce(new Error("kafka down"))
        .mockRejectedValueOnce(new Error("kafka down"))
        .mockResolvedValue(undefined),
      subscribe: jest.fn().mockResolvedValue(undefined),
      run: jest.fn().mockResolvedValue(undefined),
      disconnect: jest.fn().mockResolvedValue(undefined),
    };
    (Kafka as unknown as jest.Mock).mockImplementation(() => ({
      consumer: () => consumer,
    }));
    const cache = { load: jest.fn().mockResolvedValue(undefined) };
    const service = new ConfigConsumerService(
      {
        kafka: { brokers: ["x:1"], username: "", password: "", sslCa: "" },
      } as Config,
      cache as unknown as ConfigCacheService,
      {} as ContractService,
      {} as StorageService,
    );
    await service.onModuleInit();
    await jest.advanceTimersByTimeAsync(0);
    expect(cache.load).toHaveBeenCalledTimes(1);
    expect(service.running).toBe(false);
    await jest.advanceTimersByTimeAsync(2_000);
    expect(service.running).toBe(false);
    await jest.advanceTimersByTimeAsync(4_000);
    expect(service.running).toBe(true);
    expect(consumer.connect).toHaveBeenCalledTimes(3);
    await service.onModuleDestroy();
    expect(jest.getTimerCount()).toBe(0);
  });
});
