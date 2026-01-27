-- Orbit state.db schema
-- Tracks audit log and project state

CREATE TABLE IF NOT EXISTS audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp TEXT NOT NULL DEFAULT (datetime('now')),
    project TEXT NOT NULL,
    command TEXT NOT NULL,
    environment TEXT,
    duration_ms INTEGER,
    git_commit TEXT,
    success INTEGER NOT NULL DEFAULT 1,
    error_message TEXT
);

CREATE TABLE IF NOT EXISTS project_state (
    project TEXT PRIMARY KEY,
    current_env TEXT DEFAULT 'dev',
    last_activity TEXT DEFAULT (datetime('now')),
    sidecars_running TEXT DEFAULT '[]'
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_audit_project ON audit_log(project);
CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_log(timestamp);
