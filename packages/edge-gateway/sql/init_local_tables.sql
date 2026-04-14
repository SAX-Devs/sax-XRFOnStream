-- Edge Gateway local tables
-- These are NEW tables in the local PostgreSQL, they do NOT interfere with existing tables.

CREATE TABLE IF NOT EXISTS edge_gateway_buffer (
    id          BIGSERIAL PRIMARY KEY,
    topic       TEXT NOT NULL,
    payload     BYTEA NOT NULL,
    qos         INTEGER NOT NULL DEFAULT 1,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_egw_buffer_created
    ON edge_gateway_buffer(created_at ASC);

CREATE TABLE IF NOT EXISTS edge_gateway_command_map (
    command_id    TEXT PRIMARY KEY,
    local_index   INTEGER NOT NULL,
    module        TEXT NOT NULL,
    command       TEXT NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
