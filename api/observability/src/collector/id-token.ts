const METADATA_IDENTITY =
  "http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/identity";

/** On Cloud Run every service-to-service call carries an ID token for its target. */
export const onCloudRun = (env: NodeJS.ProcessEnv = process.env): boolean =>
  Boolean(env.K_SERVICE || env.CLOUD_RUN_JOB);

/**
 * ID tokens from the metadata server, one per audience, cached for most of
 * their hour of life (api/common's gcpauth.Signer, ported). Off Cloud Run it
 * signs nothing: compose and self-host reach the collector on a private network.
 */
export class IdTokenSigner {
  private readonly tokens = new Map<
    string,
    { token: string; expires: number }
  >();

  constructor(
    private readonly enabled = onCloudRun(),
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async headers(audience: string): Promise<Record<string, string>> {
    if (!this.enabled) return {};
    return { Authorization: `Bearer ${await this.token(audience)}` };
  }

  private async token(audience: string, now = Date.now()): Promise<string> {
    const hit = this.tokens.get(audience);
    if (hit && hit.expires - now > 5 * 60_000) return hit.token;
    const response = await this.fetchImpl(
      `${METADATA_IDENTITY}?audience=${encodeURIComponent(audience)}`,
      {
        headers: { "Metadata-Flavor": "Google" },
        signal: AbortSignal.timeout(10_000),
      },
    );
    if (!response.ok)
      throw new Error(`metadata identity status ${response.status}`);
    const token = (await response.text()).trim();
    this.tokens.set(audience, { token, expires: now + 55 * 60_000 });
    return token;
  }
}
