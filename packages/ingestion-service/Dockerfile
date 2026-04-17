FROM python:3.11-slim AS builder

WORKDIR /build
COPY pyproject.toml ./
COPY src/ ./src/
RUN pip install --no-cache-dir --user .

FROM python:3.11-slim AS runtime

RUN useradd --create-home --shell /bin/bash ingestion
WORKDIR /app

COPY --from=builder /root/.local /home/ingestion/.local
COPY --chown=ingestion:ingestion src/ ./src/

ENV PATH=/home/ingestion/.local/bin:$PATH \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

USER ingestion

EXPOSE 8080

CMD ["python", "-m", "src.main"]
