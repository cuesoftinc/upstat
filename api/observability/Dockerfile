FROM python:3.12-slim
ENV PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1
WORKDIR /app

COPY requirements.txt /app/
RUN pip install --no-cache-dir --timeout 300 -r requirements.txt

COPY . /app
RUN useradd -m -u 10001 appuser && chown -R appuser /app
USER appuser

# FastAPI (HTTP) on $PORT; internal gRPC server on $GRPC_PORT. The address of the
# Go core service (UPSTAT_GRPC_ADDRESS) is provided by compose / the environment.
ENV PORT=8081
ENV GRPC_PORT=50051
ENV ENABLE_GRPC_SERVER=true
EXPOSE 8081 50051
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD python -c "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://localhost:8081/health').status==200 else 1)"
CMD ["sh","-c","uvicorn main:app --host 0.0.0.0 --port ${PORT:-8081}"]
