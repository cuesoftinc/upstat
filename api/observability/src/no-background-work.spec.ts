import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

// Request-based CPU (S-14): nothing may run after a response returns.
const sources = (readdirSync(__dirname, { recursive: true }) as string[])
  .filter((f) => f.endsWith(".ts") && !f.endsWith(".spec.ts"))
  .map((f) => ({ file: f, text: readFileSync(join(__dirname, f), "utf8") }));

describe("no background work", () => {
  it("reads the service sources", () => {
    expect(sources.length).toBeGreaterThan(10);
  });

  it("has no interval timers", () => {
    expect(
      sources.filter((s) => /setInterval\s*\(/.test(s.text)).map((s) => s.file),
    ).toEqual([]);
  });

  it("uses timeouts only for the Kafka connect retry and the Valkey connect wait", () => {
    expect(
      sources
        .filter((s) => /setTimeout\s*\(/.test(s.text))
        .map((s) => s.file)
        .sort(),
    ).toEqual(
      [
        join("config-cache", "config-consumer.service.ts"),
        join("valkey", "valkey.service.ts"),
      ].sort(),
    );
  });
});
