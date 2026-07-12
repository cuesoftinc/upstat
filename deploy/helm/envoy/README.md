# Envoy configuration

`envoy.yaml` is the Envoy front-proxy configuration for Upstat. Envoy terminates
browser **gRPC-Web** traffic from the `web` frontend and forwards it as native
**gRPC** to the Go backend (`api/common`), applying CORS along the way.

This lives under the Helm chart because the standard is a **single `deploy/helm`
chart that deploys all services — including Envoy — together**; there is no
standalone `deploy/envoy`. The chart should mount this file (for example via a
`ConfigMap`) into the Envoy deployment so the proxy is provisioned alongside the
backend, observability, and web services.

For local development the same `envoy.yaml` is used by the Docker Compose setup
(see [docs/setup.md](../../../docs/setup.md)); the upstream cluster
(`upstat_backend`) resolves to the Go backend container.
