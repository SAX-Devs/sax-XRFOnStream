"""Configuration loading tests."""

from __future__ import annotations

import pytest

from src.config import IngestionConfig


def _set_required(monkeypatch: pytest.MonkeyPatch, prefix: str = "") -> None:
    monkeypatch.setenv(f"{prefix}SUPABASE_URL", "http://localhost:54321")
    monkeypatch.setenv(f"{prefix}SUPABASE_SERVICE_ROLE_KEY", "key")
    monkeypatch.setenv(f"{prefix}MQTT_BROKER_URL", "broker")
    monkeypatch.setenv(f"{prefix}MQTT_USERNAME", "user")
    monkeypatch.setenv(f"{prefix}MQTT_PASSWORD", "pass")


def test_load_with_bare_env_vars(monkeypatch: pytest.MonkeyPatch, tmp_path) -> None:
    monkeypatch.chdir(tmp_path)
    _set_required(monkeypatch)
    cfg = IngestionConfig.load()
    assert cfg.supabase_url == "http://localhost:54321"
    assert cfg.mqtt_username == "user"
    assert cfg.mqtt_use_tls is True


def test_load_prefers_ingestion_prefix(monkeypatch: pytest.MonkeyPatch, tmp_path) -> None:
    monkeypatch.chdir(tmp_path)
    _set_required(monkeypatch)  # bare names
    monkeypatch.setenv("INGESTION_SUPABASE_URL", "http://prefixed-url")
    monkeypatch.setenv("INGESTION_SUPABASE_SERVICE_ROLE_KEY", "prefixed-key")
    monkeypatch.setenv("INGESTION_MQTT_BROKER_URL", "prefixed-broker")
    monkeypatch.setenv("INGESTION_MQTT_USERNAME", "prefixed-user")
    monkeypatch.setenv("INGESTION_MQTT_PASSWORD", "prefixed-pass")
    cfg = IngestionConfig.load()
    assert cfg.supabase_url == "http://prefixed-url"
    assert cfg.mqtt_username == "prefixed-user"


def test_missing_required_raises(monkeypatch: pytest.MonkeyPatch, tmp_path) -> None:
    monkeypatch.chdir(tmp_path)
    for var in ("SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "MQTT_BROKER_URL", "MQTT_USERNAME", "MQTT_PASSWORD"):
        monkeypatch.delenv(var, raising=False)
        monkeypatch.delenv(f"INGESTION_{var}", raising=False)
    with pytest.raises(Exception):
        IngestionConfig.load()
