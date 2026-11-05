import { peerAddress, resolveClientIp, setTrustProxy } from "./client-ip";

describe("resolveClientIp", () => {
  afterEach(() => setTrustProxy(false));

  it("ignores X-Forwarded-For unless proxies are trusted", () => {
    setTrustProxy(false);
    expect(resolveClientIp("6.6.6.6", "::ffff:10.0.0.1")).toBe("10.0.0.1");
  });

  it("takes the address the trusted proxy appended, not a client-supplied one", () => {
    setTrustProxy(true, 1);
    expect(resolveClientIp("6.6.6.6, 203.0.113.7", "10.0.0.1")).toBe(
      "203.0.113.7",
    );
    expect(resolveClientIp("203.0.113.7", "10.0.0.1")).toBe("203.0.113.7");
  });

  it("counts hops from the right behind a load balancer", () => {
    setTrustProxy(true, 2);
    expect(
      resolveClientIp("6.6.6.6, 203.0.113.7, 130.211.0.1", "10.0.0.1"),
    ).toBe("203.0.113.7");
  });

  it("falls back to the peer when the chain is short or not an address", () => {
    setTrustProxy(true, 2);
    expect(resolveClientIp("203.0.113.7", "10.0.0.1")).toBe("10.0.0.1");
    setTrustProxy(true, 1);
    expect(resolveClientIp("6.6.6.6, not-an-ip", "10.0.0.1")).toBe("10.0.0.1");
    expect(resolveClientIp(undefined, "10.0.0.1")).toBe("10.0.0.1");
  });

  it("reads gRPC peers as bare addresses", () => {
    expect(peerAddress("ipv4:10.0.0.1:5555")).toBe("10.0.0.1");
    expect(peerAddress("ipv6:[::1]:5555")).toBe("::1");
  });
});
