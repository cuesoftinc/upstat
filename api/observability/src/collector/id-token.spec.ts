import { IdTokenSigner, onCloudRun } from "./id-token";

describe("IdTokenSigner", () => {
  it("signs nothing off Cloud Run", async () => {
    const fetchImpl = jest.fn();
    const signer = new IdTokenSigner(
      false,
      fetchImpl as unknown as typeof fetch,
    );
    expect(await signer.headers("https://collector")).toEqual({});
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("asks the metadata server once per audience and caches the token", async () => {
    const fetchImpl = jest.fn(async () => new Response("tok-1\n"));
    const signer = new IdTokenSigner(
      true,
      fetchImpl as unknown as typeof fetch,
    );
    expect(await signer.headers("https://collector")).toEqual({
      Authorization: "Bearer tok-1",
    });
    expect(await signer.headers("https://collector")).toEqual({
      Authorization: "Bearer tok-1",
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toContain("audience=https%3A%2F%2Fcollector");
    expect(init.headers).toEqual({ "Metadata-Flavor": "Google" });
  });

  it("fails when the metadata server refuses", async () => {
    const fetchImpl = jest.fn(async () => new Response("no", { status: 404 }));
    const signer = new IdTokenSigner(
      true,
      fetchImpl as unknown as typeof fetch,
    );
    await expect(signer.headers("https://collector")).rejects.toThrow(
      "metadata identity status 404",
    );
  });

  it("detects Cloud Run from K_SERVICE", () => {
    expect(onCloudRun({ K_SERVICE: "upstat-api-observability" })).toBe(true);
    expect(onCloudRun({})).toBe(false);
  });
});
