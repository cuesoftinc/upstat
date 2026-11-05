# Cloud image of the collector: the stock contrib build with this repo's config.
FROM otel/opentelemetry-collector-contrib:0.130.0
COPY otel-collector.yaml /etc/otelcol-contrib/config.yaml
