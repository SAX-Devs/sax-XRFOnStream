"""Environment-based configuration for the Ingestion Service.

Settings are loaded from process environment (12-factor). Validation runs at
startup; missing required values fail fast with a clear Pydantic error.

The service accepts both bare names (e.g. ``MQTT_PASSWORD``) and the
``INGESTION_`` prefix (e.g. ``INGESTION_MQTT_PASSWORD``); the prefixed form
takes precedence. This lets the service reuse the root ``.env`` file without
collisions with the Edge Gateway's own variables.
"""

from __future__ import annotations

from pydantic import Field, SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


class IngestionConfig(BaseSettings):
    model_config = SettingsConfigDict(
        env_prefix="",
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    # --- Supabase ---
    supabase_url: str = Field(..., description="Supabase project URL")
    supabase_service_role_key: SecretStr = Field(
        ...,
        description="Service-role key. Bypasses RLS — server-side only.",
    )

    # --- MQTT broker ---
    mqtt_broker_url: str = Field(..., description="EMQX broker hostname")
    mqtt_broker_port: int = Field(default=8883, ge=1, le=65535)
    mqtt_username: str = Field(..., description="EMQX username (e.g. ingestion-svc)")
    mqtt_password: SecretStr = Field(..., description="EMQX password")
    mqtt_client_id: str = Field(
        default="ingestion-svc-01",
        description="Stable client_id; required for persistent session (clean_session=False)",
    )
    mqtt_use_tls: bool = Field(default=True)
    mqtt_keepalive_s: int = Field(default=60, ge=10, le=600)

    # --- Spectra handling ---
    spectra_inline_threshold_bytes: int = Field(
        default=200 * 1024,
        ge=0,
        description="Spectra payloads above this byte size go to Storage instead of inline JSONB",
    )
    spectra_storage_bucket: str = Field(default="device-spectra")

    # --- Healthcheck ---
    healthcheck_port: int = Field(default=8080, ge=1, le=65535)
    healthcheck_stale_seconds: int = Field(
        default=300,
        ge=10,
        description="If no MQTT message has arrived in this many seconds, /healthz returns 503",
    )

    # --- Observability ---
    log_level: str = Field(default="INFO")

    @classmethod
    def load(cls) -> "IngestionConfig":
        """Single entry point for config loading.

        Tries the ``INGESTION_`` prefix first (so users can scope variables
        when the same shell exports collide with the Edge Gateway), then falls
        back to bare names.
        """
        prefixed = _try_load(env_prefix="INGESTION_")
        if prefixed is not None:
            return prefixed
        return cls()


def _try_load(env_prefix: str) -> IngestionConfig | None:
    """Attempt to construct an IngestionConfig with a custom env prefix.

    Returns None if any required field is missing under that prefix — caller
    falls back to the default (un-prefixed) loader.
    """

    class _Prefixed(IngestionConfig):
        model_config = SettingsConfigDict(
            env_prefix=env_prefix,
            env_file=".env",
            env_file_encoding="utf-8",
            extra="ignore",
            case_sensitive=False,
        )

    try:
        return _Prefixed()  # type: ignore[return-value]
    except Exception:
        return None
