FROM python:3.11-slim

WORKDIR /app

COPY pyproject.toml .
COPY src/ src/

RUN pip install --no-cache-dir .

ENTRYPOINT ["python", "-m", "src.main"]
CMD ["--config", "/etc/sax/provision.json"]
