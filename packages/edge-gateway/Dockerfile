FROM python:3.11-slim

WORKDIR /app

COPY pyproject.toml .
COPY src/ src/

# Install deps, create the unprivileged runtime user + its writable state dir.
RUN pip install --no-cache-dir . \
    && useradd --system --no-create-home --uid 10001 sax \
    && mkdir -p /var/lib/sax \
    && chown sax:sax /var/lib/sax

USER sax

ENTRYPOINT ["python", "-m", "src.main"]
CMD ["--config", "/etc/sax/provision.json"]
