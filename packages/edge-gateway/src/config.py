"""Configuration loader for Edge Gateway provision package."""

import json
from pathlib import Path

from pydantic import BaseModel, Field


class MqttConfig(BaseModel):
    broker_url: str
    port: int = 8883
    client_id: str
    username: str
    password_file: str
    use_tls: bool = True


class LocalDbConfig(BaseModel):
    host: str = "localhost"
    port: int = 5432
    dbname: str = "xrfonstream"
    user: str = "sax"
    password_file: str


class GatewayConfig(BaseModel):
    device_id: str
    tenant_id: str
    mqtt: MqttConfig
    hmac_secret_path: str
    local_db: LocalDbConfig
    telemetry_interval_s: float = Field(default=2.0, gt=0)
    spectra_check_interval_s: float = Field(default=10.0, gt=0)
    sentinel_check_interval_s: float = Field(default=5.0, gt=0)
    concentrations_check_interval_s: float = Field(default=10.0, gt=0)

    @classmethod
    def from_json(cls, path: str | Path) -> "GatewayConfig":
        """Load configuration from a provision JSON file."""
        config_path = Path(path)
        if not config_path.exists():
            raise FileNotFoundError(f"Config file not found: {config_path}")
        with open(config_path) as f:
            data = json.load(f)
        return cls(**data)
