FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt /app/

RUN pip install --no-cache-dir --timeout 300 -r requirements.txt

COPY . /app

EXPOSE 8000 50051

ENV PYTHONUNBUFFERED=1
ENV UPSTAT_GRPC_ADDRESS=upstat_backend:8080
ENV GRPC_PORT=50051
ENV ENABLE_GRPC_SERVER=true


CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}"]
