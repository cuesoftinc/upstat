# ---- build stage ----
FROM golang:1.25-alpine AS builder
RUN apk add --no-cache git
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
# Build for the image's native architecture (no forced amd64 emulation).
RUN CGO_ENABLED=0 go build -o upstat ./cmd/server

# ---- runtime stage ----
FROM alpine:3.20
RUN apk add --no-cache ca-certificates && adduser -D -u 10001 appuser
WORKDIR /app
COPY --from=builder /app/upstat /app/upstat
USER appuser
EXPOSE 8080
# gRPC + HTTP are multiplexed on $PORT via h2c; /health is a plain HTTP/1.1 GET.
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${PORT:-8080}/health" || exit 1
CMD ["/app/upstat"]
