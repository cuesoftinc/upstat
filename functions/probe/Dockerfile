# The probe image (S-12): a Cloud Run service per region in cloud, and the
# compose and self-host container.
FROM python:3.12-slim
RUN apt-get update && apt-get install -y --no-install-recommends libcurl4 ca-certificates \
    && rm -rf /var/lib/apt/lists/* && useradd -u 10001 -m app
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY main.py ./
COPY probe ./probe
USER app
ENV PORT=8090
EXPOSE 8090
HEALTHCHECK --interval=30s --timeout=3s CMD python -c "import urllib.request,os;urllib.request.urlopen(f'http://127.0.0.1:{os.environ.get(\"PORT\",\"8090\")}/health')"
CMD ["sh", "-c", "exec functions-framework --target=probe --host=0.0.0.0 --port=${PORT}"]
