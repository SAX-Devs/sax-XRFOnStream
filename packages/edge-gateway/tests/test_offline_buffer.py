"""Tests for OfflineBuffer."""

from unittest.mock import MagicMock, patch, call

from src.offline_buffer import OfflineBuffer


@patch("src.offline_buffer.Path")
@patch("src.offline_buffer.psycopg.connect")
def test_buffer_persists_after_restart(mock_connect, mock_path, mock_local_db_config):
    """Messages enqueued survive a simulated restart (new instance reads them back)."""
    mock_path.return_value.read_text.return_value = "testpassword"
    mock_conn = MagicMock()
    mock_cursor = MagicMock()
    mock_conn.cursor.return_value.__enter__ = MagicMock(return_value=mock_cursor)
    mock_conn.cursor.return_value.__exit__ = MagicMock(return_value=False)
    mock_connect.return_value = mock_conn

    buffer = OfflineBuffer(mock_local_db_config)

    buffer.enqueue("sax/t/d/telemetry/gen", b'{"test": 1}', 1)
    buffer.enqueue("sax/t/d/telemetry/vac", b'{"test": 2}', 1)
    buffer.enqueue("sax/t/d/telemetry/aux", b'{"test": 3}', 1)

    assert mock_cursor.execute.call_count == 3
    for c in mock_cursor.execute.call_args_list:
        assert "INSERT INTO edge_gateway_buffer" in c[0][0]

    mock_cursor.reset_mock()
    mock_cursor.fetchall.return_value = [
        {"id": 1, "topic": "sax/t/d/telemetry/gen", "payload": b'{"test": 1}', "qos": 1},
        {"id": 2, "topic": "sax/t/d/telemetry/vac", "payload": b'{"test": 2}', "qos": 1},
        {"id": 3, "topic": "sax/t/d/telemetry/aux", "payload": b'{"test": 3}', "qos": 1},
    ]

    buffer2 = OfflineBuffer(mock_local_db_config)
    messages = buffer2.drain()

    assert len(messages) == 3
    assert messages[0][1] == "sax/t/d/telemetry/gen"
    assert messages[2][1] == "sax/t/d/telemetry/aux"


@patch("src.offline_buffer.Path")
@patch("src.offline_buffer.psycopg.connect")
def test_buffer_order_by_timestamp(mock_connect, mock_path, mock_local_db_config):
    """Drain query orders messages by created_at ASC."""
    mock_path.return_value.read_text.return_value = "testpassword"
    mock_conn = MagicMock()
    mock_cursor = MagicMock()
    mock_conn.cursor.return_value.__enter__ = MagicMock(return_value=mock_cursor)
    mock_conn.cursor.return_value.__exit__ = MagicMock(return_value=False)
    mock_cursor.fetchall.return_value = []
    mock_connect.return_value = mock_conn

    buffer = OfflineBuffer(mock_local_db_config)
    buffer.drain()

    select_call = mock_cursor.execute.call_args_list[-1]
    assert "ORDER BY created_at ASC" in select_call[0][0]
