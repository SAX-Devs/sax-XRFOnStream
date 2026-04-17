from __future__ import annotations

import pytest

from src.handlers.spectra_handler import SpectraHandler
from src.topic_router import parse_topic
from tests.conftest import DEVICE_ID, TENANT_ID


@pytest.fixture
def parsed():
    return parse_topic(f"sax/{TENANT_ID}/{DEVICE_ID}/spectra")


def test_small_spectrum_stored_inline(mock_context, spectra_payload_small, parsed) -> None:
    SpectraHandler(mock_context).handle(parsed, spectra_payload_small)
    mock_context.storage.upload.assert_not_called()
    row = mock_context.writer.insert.call_args.args[1]
    assert row["spectra_data"] == {"channels": [1, 2, 3]}
    assert row["storage_path"] is None
    assert row["measurement_id"] == "m-001"


def test_large_spectrum_offloaded_to_storage(mock_context, spectra_payload_large, parsed) -> None:
    SpectraHandler(mock_context).handle(parsed, spectra_payload_large)
    mock_context.storage.upload.assert_called_once()
    row = mock_context.writer.insert.call_args.args[1]
    assert row["spectra_data"] is None
    assert row["storage_path"] == "path/to/spectrum.json"


def test_storage_failure_falls_back_to_inline(mock_context, spectra_payload_large, parsed) -> None:
    mock_context.storage.upload.side_effect = RuntimeError("storage down")
    SpectraHandler(mock_context).handle(parsed, spectra_payload_large)
    row = mock_context.writer.insert.call_args.args[1]
    assert row["spectra_data"] is not None
    assert row["storage_path"] is None
